import { StorageRepository } from '../../repositories/StorageRepository';
import { getSentNotifications, saveSentNotifications } from '../../utils/storage';
import { resolveNotificationPriority } from './notificationSchema';

export const LEDGER_STORAGE_KEY = 'classroom_hub_notification_ledger';
export const SNAPSHOT_STORAGE_KEY = 'classroom_hub_notification_snapshot';
export const TELEMETRY_STORAGE_KEY = 'classroom_hub_discord_telemetry';

export const LEDGER_STATUS = {
  CLAIMED: 'CLAIMED',
  DELIVERED: 'DELIVERED',
  FAILED_RETRYABLE: 'FAILED_RETRYABLE',
  FAILED_PERMANENT: 'FAILED_PERMANENT',
  AMBIGUOUS_TIMEOUT: 'AMBIGUOUS_TIMEOUT'
};

// Stale claim lease recovery: if a tab crashed mid-flight >2 minutes ago, recover safely
const CLAIM_LEASE_MS = 2 * 60 * 1000;
const RETENTION_MS = 90 * 24 * 60 * 60 * 1000; // 90 days for scheduled/deadline events
const MAX_LEDGER_ENTRIES = 1200;

const sanitizeKeyPart = (val, fallback = 'none') => {
  const clean = String(val ?? '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[:|]/g, '-');
  return clean || fallback;
};

/**
 * Builds a deterministic, collision-free notification identity key.
 * Format: `${eventType}:${sourceId}:${stage}:${fingerprint}` (or 3-part when fingerprint omitted).
 *
 * Examples:
 * - `assignment:123:due_3d:2026-11-28T23-59`
 * - `exam:cs101_midterm:exam_1d:2026-11-27`
 * - `announcement:789:new`
 * - `briefing:morning:daily:2026-11-25`
 */
export function buildEventIdentity(eventType, sourceId, stage, fingerprint = '') {
  const p1 = sanitizeKeyPart(eventType, 'event');
  const p2 = sanitizeKeyPart(sourceId, 'global');
  const p3 = sanitizeKeyPart(stage, 'default');
  if (fingerprint !== undefined && fingerprint !== null && String(fingerprint).trim() !== '') {
    return `${p1}:${p2}:${p3}:${sanitizeKeyPart(fingerprint)}`;
  }
  return `${p1}:${p2}:${p3}`;
}

/**
 * Computes exponential backoff delay (ms) with bounded cap for ledger-level retries across runs.
 */
export function computeLedgerRetryDelayMs(attemptCount, baseMs = 30_000, maxMs = 30 * 60 * 1000) {
  const exp = Math.max(0, (Number(attemptCount) || 1) - 1);
  return Math.min(maxMs, baseMs * Math.pow(2, exp));
}

export class NotificationLedger {
  static getAll(email) {
    if (!email) return {};
    const stored = StorageRepository.get(LEDGER_STORAGE_KEY, email, true);
    if (!stored || typeof stored !== 'object' || Array.isArray(stored)) {
      return {};
    }
    return { ...stored };
  }

  static saveAll(email, mapObj) {
    if (!email) return;
    const pruned = this.prune(mapObj);
    StorageRepository.set(LEDGER_STORAGE_KEY, pruned, email);
  }

  static prune(mapObj = {}, nowMs = Date.now()) {
    const entries = Object.entries(mapObj).filter(([k, v]) => k && v && typeof v === 'object');
    if (entries.length === 0) return {};

    const cutoffMs = nowMs - RETENTION_MS;
    const active = entries.filter(([, entry]) => {
      // Retain 'new' post/activity keys longer up to cap so old posts never re-trigger
      if (entry.stage === 'new') return true;
      const refTime = new Date(entry.deliveredAt || entry.lastAttemptAt || entry.claimedAt || 0).getTime();
      return Number.isNaN(refTime) || refTime >= cutoffMs;
    });

    active.sort((a, b) => {
      const ta = new Date(a[1].lastAttemptAt || a[1].deliveredAt || a[1].claimedAt || 0).getTime() || 0;
      const tb = new Date(b[1].lastAttemptAt || b[1].deliveredAt || b[1].claimedAt || 0).getTime() || 0;
      return ta - tb;
    });

    const sliced = active.slice(-MAX_LEDGER_ENTRIES);
    const out = {};
    for (const [k, v] of sliced) {
      out[k] = v;
    }
    return out;
  }

  /**
   * Checks whether an event is already delivered, permanently halted, ambiguously timed out,
   * currently claimed by an active lease, or waiting for its retry backoff window.
   */
  static evaluateEligibility(
    email,
    eventKey,
    { nowMs = Date.now(), legacyCheck = null, stage = '', maxRetries = 3 } = {}
  ) {
    const ledger = this.getAll(email);
    const entry = ledger[eventKey];

    if (entry) {
      if (entry.status === LEDGER_STATUS.DELIVERED) {
        return { eligible: false, reason: 'already_delivered', entry };
      }
      if (entry.status === LEDGER_STATUS.AMBIGUOUS_TIMEOUT) {
        // Honest delivery guarantee: timeout after request left client could have succeeded on Discord.
        // Do not auto-resend indefinitely across syncs.
        return { eligible: false, reason: 'ambiguous_timeout', entry };
      }
      if (entry.status === LEDGER_STATUS.FAILED_PERMANENT) {
        return { eligible: false, reason: 'failed_permanent', entry };
      }
      if ((entry.attemptCount || 0) > maxRetries) {
        return { eligible: false, reason: 'max_retries_exceeded', entry };
      }
      if (entry.status === LEDGER_STATUS.CLAIMED) {
        const claimedMs = new Date(entry.claimedAt || 0).getTime();
        if (Number.isFinite(claimedMs) && nowMs - claimedMs < CLAIM_LEASE_MS) {
          return { eligible: false, reason: 'claimed_in_flight', entry };
        }
        // Lease expired (interrupted tab/execution) -> safe to recover
      }
      if (entry.status === LEDGER_STATUS.FAILED_RETRYABLE && entry.nextRetryAt) {
        const retryAtMs = new Date(entry.nextRetryAt).getTime();
        if (Number.isFinite(retryAtMs) && nowMs < retryAtMs) {
          return { eligible: false, reason: 'backoff_pending', entry };
        }
      }
    }

    // Backward compatibility check with legacy v2 `classroom_hub_sent_notifications`.
    // Only applies when NO v3 ledger record exists for this (sourceId, stage) yet — if v3 already
    // recorded an earlier deadline fingerprint for this stage and the instructor extended the deadline,
    // the new fingerprint is genuinely eligible to re-arm!
    if (legacyCheck && legacyCheck.assignmentId && legacyCheck.type && !entry) {
      const hasPriorV3FingerprintForStage =
        stage &&
        Object.values(ledger).some(
          (e) =>
            e &&
            String(e.sourceId) === String(legacyCheck.assignmentId) &&
            e.stage === stage
        );

      if (!hasPriorV3FingerprintForStage) {
        const legacySent = getSentNotifications(email);
        const foundLegacy = legacySent.some(
          (r) => r.assignmentId === legacyCheck.assignmentId && r.type === legacyCheck.type
        );
        if (foundLegacy) {
          return { eligible: false, reason: 'legacy_sent_record', entry: null };
        }
      }
    }

    return { eligible: true, reason: 'ready', entry: entry || null };
  }

  /**
   * Claims an event before network transmission.
   */
  static claim(email, meta, nowMs = Date.now()) {
    const {
      eventKey,
      eventType = 'event',
      sourceId = '',
      stage = '',
      priority = resolveNotificationPriority(eventType, stage),
      channel = 'discord'
    } = meta;

    const ledger = this.getAll(email);
    const prev = ledger[eventKey] || {};
    const nowIso = new Date(nowMs).toISOString();

    const updated = {
      ...prev,
      eventKey,
      eventType,
      sourceId: String(sourceId),
      stage,
      priority,
      channel,
      status: LEDGER_STATUS.CLAIMED,
      attemptCount: (Number(prev.attemptCount) || 0) + 1,
      claimedAt: nowIso,
      lastAttemptAt: nowIso,
      updatedAt: nowIso
    };

    ledger[eventKey] = updated;
    this.saveAll(email, ledger);
    return updated;
  }

  /**
   * Marks an event as durably DELIVERED only after receiving a 2xx response.
   * Optionally mirrors a backward-compatible record into `classroom_hub_sent_notifications`.
   */
  static markDelivered(email, eventKey, { legacyRecord = null, legacyRecords = null, nowMs = Date.now() } = {}) {
    const ledger = this.getAll(email);
    const prev = ledger[eventKey] || { eventKey, attemptCount: 1 };
    const nowIso = new Date(nowMs).toISOString();

    ledger[eventKey] = {
      ...prev,
      status: LEDGER_STATUS.DELIVERED,
      deliveredAt: nowIso,
      lastAttemptAt: prev.lastAttemptAt || nowIso,
      nextRetryAt: null,
      lastError: null,
      updatedAt: nowIso
    };
    this.saveAll(email, ledger);

    // Mirror to legacy sent_notifications for 100% compatibility with existing tests & v2 Drive clients
    const mirrorList = [];
    if (legacyRecord?.assignmentId && legacyRecord?.type) {
      mirrorList.push({ ...legacyRecord, sentAt: nowIso });
    }
    if (Array.isArray(legacyRecords)) {
      legacyRecords.forEach((r) => {
        if (r?.assignmentId && r?.type) {
          mirrorList.push({ ...r, sentAt: nowIso });
        }
      });
    }

    if (mirrorList.length > 0 && email) {
      const current = getSentNotifications(email);
      const additions = mirrorList.filter(
        (cand) => !current.some((ex) => ex.assignmentId === cand.assignmentId && ex.type === cand.type)
      );
      if (additions.length > 0) {
        saveSentNotifications([...current, ...additions].slice(-1000), email);
      }
    }

    return ledger[eventKey];
  }

  /**
   * Records a failed or ambiguous delivery attempt with bounded retry backoff.
   */
  static markFailed(
    email,
    eventKey,
    {
      errorMessage = 'Delivery failed',
      retryable = true,
      ambiguousTimeout = false,
      retryAfterMs = null,
      maxRetries = 3,
      nowMs = Date.now()
    } = {}
  ) {
    const ledger = this.getAll(email);
    const prev = ledger[eventKey] || { eventKey, attemptCount: 1 };
    const nowIso = new Date(nowMs).toISOString();
    const attempts = Number(prev.attemptCount) || 1;

    let status = LEDGER_STATUS.FAILED_PERMANENT;
    let nextRetryAt = null;

    if (ambiguousTimeout) {
      status = LEDGER_STATUS.AMBIGUOUS_TIMEOUT;
    } else if (retryable && attempts <= maxRetries) {
      status = LEDGER_STATUS.FAILED_RETRYABLE;
      const delay = Number.isFinite(retryAfterMs) && retryAfterMs > 0
        ? retryAfterMs
        : computeLedgerRetryDelayMs(attempts);
      nextRetryAt = new Date(nowMs + delay).toISOString();
    }

    ledger[eventKey] = {
      ...prev,
      status,
      lastAttemptAt: nowIso,
      nextRetryAt,
      lastError: String(errorMessage).slice(0, 240),
      updatedAt: nowIso
    };
    this.saveAll(email, ledger);
    return ledger[eventKey];
  }

  /**
   * Snapshot store for detecting deadline modifications, deleted assignments,
   * submission state transitions, and rescheduled/cancelled exams without false initial-sync alerts.
   */
  static getSnapshot(email) {
    if (!email) return null;
    const stored = StorageRepository.get(SNAPSHOT_STORAGE_KEY, email, true);
    if (!stored || typeof stored !== 'object') return null;
    return stored;
  }

  static saveSnapshot(email, snapshot) {
    if (!email || !snapshot) return;
    StorageRepository.set(SNAPSHOT_STORAGE_KEY, snapshot, email);
  }

  /**
   * Delivery telemetry for Settings & Popover monitoring UI.
   */
  static getTelemetry(email) {
    const defaults = {
      lastAttemptAt: null,
      lastSuccessAt: null,
      lastSuccessType: null,
      lastErrorAt: null,
      lastErrorMessage: null,
      lastStatus: 'idle', // idle | delivered | retrying | failed | ambiguous
      consecutiveFailures: 0,
      totalDelivered: 0
    };
    if (!email) return defaults;
    const stored = StorageRepository.get(TELEMETRY_STORAGE_KEY, email, true);
    if (!stored || typeof stored !== 'object') return defaults;
    return { ...defaults, ...stored };
  }

  static recordTelemetry(email, update = {}) {
    if (!email) return null;
    const current = this.getTelemetry(email);
    const next = {
      ...current,
      ...update,
      updatedAt: new Date().toISOString()
    };
    StorageRepository.set(TELEMETRY_STORAGE_KEY, next, email);
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('classroom_hub_notifications_updated', { detail: { email } }));
    }
    return next;
  }
}
