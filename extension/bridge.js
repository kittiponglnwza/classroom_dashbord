/* global chrome */
(() => {
  const CHANNEL = 'CH_EXTENSION_BRIDGE';
  const STORAGE_KEY = 'ch_reg_snapshots_v3';
  const DELIVERED_KEY = 'ch_reg_delivered_v3';
  const EXTENSION_VERSION = '1.2.2';
  const SNAPSHOT_TTL_MS = 24 * 60 * 60 * 1000;
  const ALLOWED_ORIGINS = new Set([
    'https://classrooms-hub.vercel.app',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:4173',
  ]);
  const PAGE_ORIGIN = window.location.origin;

  if (!ALLOWED_ORIGINS.has(PAGE_ORIGIN)) {
    return;
  }

  function buildStatus(snapshots = {}, delivered = {}) {
    return {
      connected: true,
      version: EXTENSION_VERSION,
      timetableCapturedAt: snapshots?.timetable?.capturedAt || null,
      timetableCount: snapshots?.timetable?.count || 0,
      gradeCapturedAt: snapshots?.grade?.capturedAt || null,
      gradeCount: snapshots?.grade?.count || 0,
      lastSyncedAt: delivered?.lastSyncedAt || null,
      hasPending: Boolean(
        (snapshots?.timetable?.hash && snapshots.timetable.hash !== delivered?.timetableHash) ||
        (snapshots?.grade?.hash && snapshots.grade.hash !== delivered?.gradeHash)
      ),
    };
  }

  function postToPage(type, payload = {}) {
    window.postMessage(
      {
        channel: CHANNEL,
        source: 'extension',
        type,
        ...payload,
      },
      PAGE_ORIGIN
    );
  }

  function pruneExpiredSnapshots(rawSnapshots = {}) {
    const now = Date.now();
    const cleaned = { ...rawSnapshots };
    let mutated = false;
    for (const kind of ['timetable', 'grade']) {
      const entry = cleaned[kind];
      if (!entry) continue;
      const ts = new Date(entry.capturedAt || 0).getTime();
      if (!Number.isFinite(ts) || now - ts > SNAPSHOT_TTL_MS) {
        delete cleaned[kind];
        mutated = true;
      }
    }
    return { cleaned, mutated };
  }

  async function readState() {
    const res = await chrome.storage.local.get([STORAGE_KEY, DELIVERED_KEY]);
    const rawSnapshots = res?.[STORAGE_KEY] || {};
    const { cleaned: snapshots, mutated } = pruneExpiredSnapshots(rawSnapshots);
    if (mutated) {
      await chrome.storage.local.set({ [STORAGE_KEY]: snapshots });
    }
    const deliveredMap = res?.[DELIVERED_KEY] || {};
    const delivered = deliveredMap[PAGE_ORIGIN] || {};
    return { snapshots, deliveredMap, delivered };
  }

  async function announceReady() {
    try {
      const { snapshots, delivered } = await readState();
      postToPage('EXTENSION_READY', { status: buildStatus(snapshots, delivered) });
    } catch {
      // Ignore if extension context invalidated
    }
  }

  async function pushSnapshotsIfNeeded(force = false) {
    try {
      const { snapshots, delivered } = await readState();
      const pendingTimetable =
        snapshots?.timetable?.text && (force || snapshots.timetable.hash !== delivered?.timetableHash)
          ? snapshots.timetable
          : null;
      const pendingGrade =
        snapshots?.grade?.text && (force || snapshots.grade.hash !== delivered?.gradeHash)
          ? snapshots.grade
          : null;

      postToPage('EXTENSION_READY', { status: buildStatus(snapshots, delivered) });

      if (!pendingTimetable && !pendingGrade) {
        if (force) {
          postToPage('REG_SYNC_EMPTY', { status: buildStatus(snapshots, delivered) });
        }
        return;
      }

      postToPage('REG_SNAPSHOT_DATA', {
        force,
        payload: {
          timetable: pendingTimetable,
          grade: pendingGrade,
        },
        status: buildStatus(snapshots, delivered),
      });
    } catch {
      // Ignore transient errors
    }
  }

  // Listen to messages strictly from the same window & same origin
  window.addEventListener('message', async (event) => {
    if (event.source !== window || event.origin !== PAGE_ORIGIN) return;
    const msg = event.data;
    if (!msg || msg.channel !== CHANNEL || msg.source !== 'app') return;

    if (msg.type === 'PING_EXTENSION') {
      await pushSnapshotsIfNeeded(false);
    } else if (msg.type === 'REQUEST_SYNC_NOW') {
      await pushSnapshotsIfNeeded(true);
    } else if (msg.type === 'CLEAR_EXTENSION_CACHE') {
      try {
        await chrome.storage.local.remove([STORAGE_KEY, DELIVERED_KEY]);
        postToPage('EXTENSION_READY', { status: buildStatus({}, {}) });
      } catch {
        // Ignore storage errors
      }
    } else if (msg.type === 'ACK_SYNC_COMPLETE') {
      try {
        const { snapshots, deliveredMap, delivered } = await readState();
        const nextDelivered = {
          ...delivered,
          timetableHash: msg.timetableHash || delivered.timetableHash || null,
          gradeHash: msg.gradeHash || delivered.gradeHash || null,
          lastSyncedAt: new Date().toISOString(),
        };
        // Scrub raw academic transcript/timetable text at rest once delivered; retain metadata only
        const scrubbedSnapshots = { ...snapshots };
        if (msg.timetableHash && scrubbedSnapshots.timetable?.hash === msg.timetableHash) {
          const restTimetable = { ...scrubbedSnapshots.timetable };
          delete restTimetable.text;
          scrubbedSnapshots.timetable = restTimetable;
        }
        if (msg.gradeHash && scrubbedSnapshots.grade?.hash === msg.gradeHash) {
          const restGrade = { ...scrubbedSnapshots.grade };
          delete restGrade.text;
          scrubbedSnapshots.grade = restGrade;
        }
        await chrome.storage.local.set({
          [STORAGE_KEY]: scrubbedSnapshots,
          [DELIVERED_KEY]: {
            ...deliveredMap,
            [PAGE_ORIGIN]: nextDelivered,
          },
        });
        postToPage('EXTENSION_READY', { status: buildStatus(scrubbedSnapshots, nextDelivered) });
      } catch {
        // Ignore storage errors
      }
    }
  });

  // Live update: when user visits reg.kmutnb.ac.th in another tab, auto-deliver immediately!
  if (chrome?.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && changes[STORAGE_KEY]) {
        pushSnapshotsIfNeeded(false);
      }
    });
  }

  // Announce presence & auto-deliver pending snapshots on page load
  announceReady();
  setTimeout(() => pushSnapshotsIfNeeded(false), 600);
})();
