import { syncSettingsWithDrive } from './driveSync';
import { STORAGE_CONFIG } from '../config/storage';
import { SYNC_CONFIG } from '../config/sync';
import { logger } from '../utils/logger';

const KEYS = STORAGE_CONFIG.keys;

class SyncManager {
  constructor() {
    this.state = 'idle'; // idle | queued | uploading | success | failed | retry
    this.subscribers = new Set();
    this.debounceTimer = null;
    this.stateResetTimer = null;
    this.activePromise = null;
    this.pendingSyncArgs = null;
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    callback(this.state); // Initial emission
    return () => this.subscribers.delete(callback);
  }

  setState(newState) {
    if (this.state !== newState) {
      logger.info(`SyncManager State Transition: ${this.state} -> ${newState}`);
      this.state = newState;
      this.subscribers.forEach(cb => cb(this.state));
    }
  }

  clearResetTimer() {
    if (this.stateResetTimer) {
      clearTimeout(this.stateResetTimer);
      this.stateResetTimer = null;
    }
  }

  cancel() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.clearResetTimer();
    this.pendingSyncArgs = null;
    this.setState('idle');
  }

  /**
   * Queue a sync operation with debouncing
   */
  queueSync(accessToken, email) {
    if (!accessToken || !email) {
      logger.debug('Sync ignored: Missing token or email');
      return;
    }

    if (this.state === 'uploading') {
      this.pendingSyncArgs = { accessToken, email };
      return;
    }

    this.clearResetTimer();
    this.setState('queued');
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      this.executeSync(accessToken, email).catch(err => {
        logger.error('Background sync execution failed:', err);
      });
    }, SYNC_CONFIG.debounceDelayMs);
  }

  /**
   * Execution wrapper with State Machine transitions
   */
  async executeSync(accessToken, email) {
    if (this.state === 'uploading') {
      logger.debug('Sync already in progress. Scheduling follow-up run.');
      this.pendingSyncArgs = { accessToken, email };
      return this.activePromise;
    }

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.clearResetTimer();
    this.setState('uploading');
    this.activePromise = this.performSync(accessToken, email);

    try {
      const remoteModified = await this.activePromise;
      this.setState('success');
      this.stateResetTimer = setTimeout(() => {
        this.stateResetTimer = null;
        if (this.state === 'success') this.setState('idle');
      }, 3000);
      return remoteModified;
    } catch (err) {
      this.setState('failed');
      this.stateResetTimer = setTimeout(() => {
        this.stateResetTimer = null;
        if (this.state === 'failed') this.setState('idle');
      }, 5000);
      throw err;
    } finally {
      this.activePromise = null;
      const queued = this.pendingSyncArgs;
      if (queued) {
        this.pendingSyncArgs = null;
        setTimeout(() => {
          this.executeSync(queued.accessToken, queued.email).catch(err => {
            logger.error('Queued follow-up sync failed:', err);
          });
        }, 0);
      }
    }
  }

  /**
   * High-fidelity merging & conflict resolution algorithm (Entity-level sync)
   */
  async performSync(accessToken, email) {
    const lowerEmail = email.toLowerCase().trim();
    return await syncSettingsWithDrive(accessToken, lowerEmail, this.mergePayloads.bind(this));
  }

  /**
   * Merges remote and local payloads item-by-item (Assignments, Schedule, Exams, settings)
   * based on specific field-level `updatedAt` properties and cross-device tombstones.
   * Preserves existing collection wrappers when merged `.data` is unchanged so background
   * polling does not create endless Drive PATCH upload loops.
   */
  mergePayloads(localPayload, remotePayload, email) {
    logger.info(`SyncManager merging remote and local payloads for ${email}`);
    const merged = {};

    const deletedIdsKey = `classroom_hub_deleted_ids_${(email || '').toLowerCase().trim()}`;
    let mergedTombstones = [];
    if (localPayload?.[deletedIdsKey] || remotePayload?.[deletedIdsKey]) {
      const localTombs = this.safeParseDataArray(localPayload?.[deletedIdsKey]);
      const remoteTombs = this.safeParseDataArray(remotePayload?.[deletedIdsKey]);
      mergedTombstones = this.mergeDeletedIds(localTombs, remoteTombs);
    }

    const getTombstoneMap = (entityType) => {
      const map = new Map();
      mergedTombstones.forEach(t => {
        if (t?.entityType === entityType && t.id) {
          const ts = new Date(t.deletedAt || 0).getTime();
          if (Number.isFinite(ts)) {
            map.set(String(t.id), ts);
          }
        }
      });
      return map;
    };

    const resolveCollectionResult = (localStr, remoteStr, localParsed, remoteParsed, mergedData) => {
      const mergedDataStr = JSON.stringify(mergedData);
      const localDataStr = JSON.stringify(localParsed.data);
      const remoteDataStr = JSON.stringify(remoteParsed.data);

      const localMatches = mergedDataStr === localDataStr;
      const remoteMatches = mergedDataStr === remoteDataStr;

      if (localMatches && remoteMatches) {
        const localTime = new Date(localParsed.timestamp || 0).getTime();
        const remoteTime = new Date(remoteParsed.timestamp || 0).getTime();
        return remoteTime >= localTime ? remoteStr : localStr;
      }
      if (localMatches) return localStr;
      if (remoteMatches) return remoteStr;

      return JSON.stringify({
        version: STORAGE_CONFIG.schemaVersion,
        timestamp: new Date().toISOString(),
        data: mergedData
      });
    };

    const allKeys = new Set([
      ...Object.keys(localPayload || {}),
      ...Object.keys(remotePayload || {})
    ]);

    allKeys.forEach(fullKey => {
      const localStr = localPayload?.[fullKey];
      const remoteStr = remotePayload?.[fullKey];

      if (!localStr) {
        merged[fullKey] = remoteStr;
        return;
      }
      if (!remoteStr) {
        merged[fullKey] = localStr;
        return;
      }

      // Check key base name
      const isAssignments = fullKey.startsWith(KEYS.assignments);
      const isSchedule = fullKey.startsWith(KEYS.schedule);
      const isExams = fullKey.startsWith(KEYS.exams);
      const isAcademic = fullKey.startsWith(KEYS.academic);
      const isDeletedIds = fullKey.startsWith('classroom_hub_deleted_ids');
      const isSentNotifications = fullKey.startsWith('classroom_hub_sent_notifications');
      const isNotificationHistory = fullKey.startsWith('classroom_hub_notification_history');
      const isDailyEmailLimit = fullKey.startsWith('classroom_hub_daily_email_limit');

      try {
        if (isDeletedIds) {
          const localParsed = JSON.parse(localStr);
          const remoteParsed = JSON.parse(remoteStr);
          const mergedArr = this.mergeDeletedIds(localParsed.data || [], remoteParsed.data || []);
          merged[fullKey] = resolveCollectionResult(localStr, remoteStr, localParsed, remoteParsed, mergedArr);
        } else if (isAssignments) {
          const localParsed = JSON.parse(localStr);
          const remoteParsed = JSON.parse(remoteStr);
          const localArr = localParsed.data || [];
          const remoteArr = remoteParsed.data || [];
          const localIsNewer = new Date(localParsed.timestamp || 0) >= new Date(remoteParsed.timestamp || 0);
          const mergedArr = this.mergeEntitiesById(localArr, remoteArr, localIsNewer, getTombstoneMap('assignments'));
          merged[fullKey] = resolveCollectionResult(localStr, remoteStr, localParsed, remoteParsed, mergedArr);
        } else if (isSchedule) {
          const localParsed = JSON.parse(localStr);
          const remoteParsed = JSON.parse(remoteStr);
          const localArr = localParsed.data || [];
          const remoteArr = remoteParsed.data || [];
          const localIsNewer = new Date(localParsed.timestamp || 0) >= new Date(remoteParsed.timestamp || 0);
          const mergedArr = this.mergeEntitiesById(localArr, remoteArr, localIsNewer, getTombstoneMap('schedule'));
          merged[fullKey] = resolveCollectionResult(localStr, remoteStr, localParsed, remoteParsed, mergedArr);
        } else if (isExams) {
          const localParsed = JSON.parse(localStr);
          const remoteParsed = JSON.parse(remoteStr);
          const localObj = localParsed.data || { exams: [], manualExams: [], unlisted: null };
          const remoteObj = remoteParsed.data || { exams: [], manualExams: [], unlisted: null };
          const localIsNewer = new Date(localParsed.timestamp || 0) >= new Date(remoteParsed.timestamp || 0);
          
          const mergedManual = this.mergeEntitiesById(
            localObj.manualExams || [],
            remoteObj.manualExams || [],
            localIsNewer,
            getTombstoneMap('manualExams')
          );
          
          let mergedExams;
          let mergedUnlisted;
          
          if (localIsNewer) {
            mergedExams = (localObj.exams && localObj.exams.length > 0) ? localObj.exams : (remoteObj.exams || []);
            mergedUnlisted = localObj.unlisted !== undefined ? localObj.unlisted : remoteObj.unlisted;
          } else {
            mergedExams = (remoteObj.exams && remoteObj.exams.length > 0) ? remoteObj.exams : (localObj.exams || []);
            mergedUnlisted = remoteObj.unlisted !== undefined ? remoteObj.unlisted : localObj.unlisted;
          }

          const mergedExamData = {
            exams: mergedExams,
            manualExams: mergedManual,
            unlisted: mergedUnlisted
          };
          merged[fullKey] = resolveCollectionResult(localStr, remoteStr, localParsed, remoteParsed, mergedExamData);
        } else if (isAcademic) {
          const localParsed = JSON.parse(localStr);
          const remoteParsed = JSON.parse(remoteStr);
          const localTime = new Date(localParsed.data?.updatedAt || localParsed.timestamp || 0).getTime();
          const remoteTime = new Date(remoteParsed.data?.updatedAt || remoteParsed.timestamp || 0).getTime();
          const localData = localParsed.data || {};
          const remoteData = remoteParsed.data || {};
          const mergedAcademic = remoteTime > localTime
            ? {
                ...localData,
                ...remoteData,
                courseCategoryMap: { ...(localData.courseCategoryMap || {}), ...(remoteData.courseCategoryMap || {}) }
              }
            : {
                ...remoteData,
                ...localData,
                courseCategoryMap: { ...(remoteData.courseCategoryMap || {}), ...(localData.courseCategoryMap || {}) }
              };
          merged[fullKey] = resolveCollectionResult(localStr, remoteStr, localParsed, remoteParsed, mergedAcademic);
        } else if (isSentNotifications) {
          const localParsed = JSON.parse(localStr);
          const remoteParsed = JSON.parse(remoteStr);
          const mergedArr = this.mergeSentNotifications(localParsed.data || [], remoteParsed.data || []);
          merged[fullKey] = resolveCollectionResult(localStr, remoteStr, localParsed, remoteParsed, mergedArr);
        } else if (isNotificationHistory) {
          const localParsed = JSON.parse(localStr);
          const remoteParsed = JSON.parse(remoteStr);
          const mergedArr = this.mergeNotificationHistory(localParsed.data || [], remoteParsed.data || []);
          merged[fullKey] = resolveCollectionResult(localStr, remoteStr, localParsed, remoteParsed, mergedArr);
        } else if (isDailyEmailLimit) {
          const localParsed = JSON.parse(localStr);
          const remoteParsed = JSON.parse(remoteStr);
          const mergedLimit = this.mergeDailyEmailLimit(localParsed.data || {}, remoteParsed.data || {});
          merged[fullKey] = resolveCollectionResult(localStr, remoteStr, localParsed, remoteParsed, mergedLimit);
        } else {
          // General settings, profiles, lastSync metadata: LWW based on collection timestamp
          let localObj, remoteObj;
          try { localObj = JSON.parse(localStr); } catch { localObj = null; }
          try { remoteObj = JSON.parse(remoteStr); } catch { remoteObj = null; }

          if (!localObj || !remoteObj || localObj.timestamp === undefined || remoteObj.timestamp === undefined) {
            merged[fullKey] = localStr;
          } else {
            const localTime = new Date(localObj.timestamp || 0);
            const remoteTime = new Date(remoteObj.timestamp || 0);
            merged[fullKey] = remoteTime > localTime ? remoteStr : localStr;
          }
        }
      } catch (err) {
        logger.error(`Error merging payload key: ${fullKey}. Falling back to local.`, err);
        merged[fullKey] = localStr;
      }
    });

    return merged;
  }

  safeParseDataArray(rawStr) {
    if (!rawStr) return [];
    try {
      const parsed = JSON.parse(rawStr);
      return Array.isArray(parsed?.data) ? parsed.data : [];
    } catch {
      return [];
    }
  }

  mergeDeletedIds(localList = [], remoteList = []) {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const map = new Map();
    [...(remoteList || []), ...(localList || [])].forEach(entry => {
      if (!entry || !entry.id || !entry.entityType) return;
      const t = new Date(entry.deletedAt || 0).getTime();
      if (!Number.isFinite(t) || t < cutoff) return;
      const key = `${entry.entityType}::${entry.id}`;
      const prev = map.get(key);
      if (!prev || t > new Date(prev.deletedAt || 0).getTime()) {
        map.set(key, entry);
      }
    });
    return Array.from(map.values()).slice(-500);
  }

  /**
   * Helper to merge arrays of entities by comparing their `updatedAt` properties
   * and filtering against cross-device deletion tombstones.
   */
  mergeEntitiesById(localList, remoteList, localIsNewer = false, tombstones = new Map()) {
    const mergedMap = new Map();

    const resolveStatusField = (localItem, remoteItem) => {
      const localStatusTime = localItem.statusUpdatedAt ? new Date(localItem.statusUpdatedAt).getTime() : 0;
      const remoteStatusTime = remoteItem.statusUpdatedAt ? new Date(remoteItem.statusUpdatedAt).getTime() : 0;
      if (remoteStatusTime > 0 || localStatusTime > 0) {
        if (remoteStatusTime > localStatusTime) {
          return { status: remoteItem.status || localItem.status, statusUpdatedAt: remoteItem.statusUpdatedAt };
        }
        return { status: localItem.status || remoteItem.status, statusUpdatedAt: localItem.statusUpdatedAt };
      }
      return {
        status: (localItem.status === 'done' || localItem.status === 'read') ? localItem.status : (remoteItem.status || localItem.status),
        statusUpdatedAt: undefined
      };
    };

    // Map local items unless invalidated by a newer cross-device tombstone
    (localList || []).forEach(item => {
      if (!item || !item.id) return;
      const idStr = String(item.id);
      const tombTime = tombstones?.get(idStr) || 0;
      const itemTime = new Date(item.updatedAt || item.timestamp || 0).getTime();
      if (tombTime > itemTime) return;
      mergedMap.set(idStr, item);
    });

    // Merge remote items
    (remoteList || []).forEach(remoteItem => {
      if (!remoteItem || !remoteItem.id) return;
      const idStr = String(remoteItem.id);
      const tombTime = tombstones?.get(idStr) || 0;
      const remoteTime = new Date(remoteItem.updatedAt || remoteItem.timestamp || 0).getTime();
      if (tombTime > remoteTime) return;

      const localItem = mergedMap.get(idStr);

      if (!localItem) {
        if (!localIsNewer) {
          mergedMap.set(idStr, remoteItem);
        }
      } else {
        const localTime = new Date(localItem.updatedAt || localItem.timestamp || 0).getTime();
        const statusFields = resolveStatusField(localItem, remoteItem);

        if (remoteTime > localTime) {
          mergedMap.set(idStr, {
            ...localItem,
            ...remoteItem,
            ...statusFields
          });
        } else if (statusFields.status !== localItem.status || statusFields.statusUpdatedAt !== localItem.statusUpdatedAt) {
          mergedMap.set(idStr, {
            ...localItem,
            ...statusFields
          });
        }
      }
    });

    return Array.from(mergedMap.values());
  }

  mergeSentNotifications(localList, remoteList) {
    const map = new Map();
    [...(remoteList || []), ...(localList || [])].forEach(item => {
      if (!item || !item.assignmentId || !item.type) return;
      const key = `${item.assignmentId}::${item.type}`;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, item);
      } else {
        const existingTime = new Date(existing.sentAt || 0).getTime();
        const candidateTime = new Date(item.sentAt || 0).getTime();
        if (candidateTime < existingTime) {
          map.set(key, item);
        }
      }
    });
    return Array.from(map.values());
  }

  mergeNotificationHistory(localList, remoteList) {
    const map = new Map();
    [...(remoteList || []), ...(localList || [])].forEach(item => {
      if (!item || !item.id) return;
      const idStr = String(item.id);
      const existing = map.get(idStr);
      if (!existing) {
        map.set(idStr, item);
      } else {
        const existingTime = new Date(existing.updatedAt || existing.sentAt || 0).getTime();
        const candidateTime = new Date(item.updatedAt || item.sentAt || 0).getTime();
        const winner = candidateTime >= existingTime ? { ...existing, ...item } : { ...item, ...existing };
        // Once read on any device, keep read unless explicitly marked unread with a newer timestamp.
        if (candidateTime === existingTime && (existing.read === true || item.read === true)) {
          winner.read = true;
        }
        map.set(idStr, winner);
      }
    });
    return Array.from(map.values())
      .sort((a, b) => new Date(b.sentAt || 0).getTime() - new Date(a.sentAt || 0).getTime())
      .slice(0, 100);
  }

  mergeDailyEmailLimit(localLimit, remoteLimit) {
    const localDate = localLimit?.lastSentDate || '';
    const remoteDate = remoteLimit?.lastSentDate || '';
    if (localDate === remoteDate) {
      return {
        lastSentDate: localDate,
        count: Math.max(Number(localLimit?.count) || 0, Number(remoteLimit?.count) || 0)
      };
    }
    return remoteDate > localDate
      ? { lastSentDate: remoteDate, count: Number(remoteLimit?.count) || 0 }
      : { lastSentDate: localDate, count: Number(localLimit?.count) || 0 };
  }
}

export const syncManager = new SyncManager();
