/* global chrome */
(() => {
  const CHANNEL = 'CH_EXTENSION_BRIDGE';
  const STORAGE_KEY = 'ch_reg_snapshots';
  const DELIVERED_KEY = 'ch_reg_delivered_by_origin';
  const EXTENSION_VERSION = '1.0.0';
  const PAGE_ORIGIN = window.location.origin;

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

  async function readState() {
    const res = await chrome.storage.local.get([STORAGE_KEY, DELIVERED_KEY]);
    const snapshots = res?.[STORAGE_KEY] || {};
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
    } else if (msg.type === 'ACK_SYNC_COMPLETE') {
      try {
        const { snapshots, deliveredMap, delivered } = await readState();
        const nextDelivered = {
          ...delivered,
          timetableHash: msg.timetableHash || delivered.timetableHash || null,
          gradeHash: msg.gradeHash || delivered.gradeHash || null,
          lastSyncedAt: new Date().toISOString(),
        };
        await chrome.storage.local.set({
          [DELIVERED_KEY]: {
            ...deliveredMap,
            [PAGE_ORIGIN]: nextDelivered,
          },
        });
        postToPage('EXTENSION_READY', { status: buildStatus(snapshots, nextDelivered) });
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
