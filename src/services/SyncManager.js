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
    this.activePromise = null;
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

  /**
   * Queue a sync operation with debouncing
   */
  queueSync(accessToken, email) {
    if (!accessToken || !email) {
      logger.debug('Sync ignored: Missing token or email');
      return;
    }

    this.setState('queued');
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
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
      logger.debug('Sync already in progress. Queueing for next run.');
      return this.activePromise;
    }

    this.setState('uploading');
    this.activePromise = this.performSync(accessToken, email);

    try {
      const remoteModified = await this.activePromise;
      this.setState('success');
      // Reset to idle after a short delay
      setTimeout(() => {
        if (this.state === 'success') this.setState('idle');
      }, 3000);
      return remoteModified;
    } catch (err) {
      this.setState('failed');
      setTimeout(() => {
        if (this.state === 'failed') this.setState('idle');
      }, 5000);
      throw err;
    } finally {
      this.activePromise = null;
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
   * based on specific field-level `updatedAt` properties.
   */
  mergePayloads(localPayload, remotePayload, email) {
    logger.info(`SyncManager merging remote and local payloads for ${email}`);
    const merged = {};

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

      try {
        if (isAssignments) {
          const localArr = JSON.parse(localStr).data || [];
          const remoteArr = JSON.parse(remoteStr).data || [];
          const mergedArr = this.mergeEntitiesById(localArr, remoteArr);
          merged[fullKey] = JSON.stringify({
            version: STORAGE_CONFIG.schemaVersion,
            timestamp: new Date().toISOString(),
            data: mergedArr
          });
        } else if (isSchedule) {
          const localArr = JSON.parse(localStr).data || [];
          const remoteArr = JSON.parse(remoteStr).data || [];
          const mergedArr = this.mergeEntitiesById(localArr, remoteArr);
          merged[fullKey] = JSON.stringify({
            version: STORAGE_CONFIG.schemaVersion,
            timestamp: new Date().toISOString(),
            data: mergedArr
          });
        } else if (isExams) {
          const localObj = JSON.parse(localStr).data || { exams: [], manualExams: [], unlisted: null };
          const remoteObj = JSON.parse(remoteStr).data || { exams: [], manualExams: [], unlisted: null };
          const mergedManual = this.mergeEntitiesById(localObj.manualExams || [], remoteObj.manualExams || []);
          merged[fullKey] = JSON.stringify({
            version: STORAGE_CONFIG.schemaVersion,
            timestamp: new Date().toISOString(),
            data: {
              exams: remoteObj.exams || localObj.exams || [],
              manualExams: mergedManual,
              unlisted: remoteObj.unlisted || localObj.unlisted
            }
          });
        } else {
          // General settings, profiles, lastSync metadata: LWW based on collection timestamp
          const localObj = JSON.parse(localStr);
          const remoteObj = JSON.parse(remoteStr);
          const localTime = new Date(localObj.timestamp || 0);
          const remoteTime = new Date(remoteObj.timestamp || 0);
          merged[fullKey] = remoteTime > localTime ? remoteStr : localStr;
        }
      } catch (err) {
        logger.error(`Error merging payload key: ${fullKey}. Falling back to local.`, err);
        merged[fullKey] = localStr;
      }
    });

    return merged;
  }

  /**
   * Helper to merge arrays of entities by comparing their `updatedAt` properties
   */
  mergeEntitiesById(localList, remoteList) {
    const mergedMap = new Map();

    // Map all local items
    localList.forEach(item => {
      if (item && item.id) {
        mergedMap.set(String(item.id), item);
      }
    });

    // Merge remote items
    remoteList.forEach(remoteItem => {
      if (!remoteItem || !remoteItem.id) return;
      const idStr = String(remoteItem.id);
      const localItem = mergedMap.get(idStr);

      if (!localItem) {
        mergedMap.set(idStr, remoteItem);
      } else {
        const localTime = new Date(localItem.updatedAt || localItem.timestamp || 0).getTime();
        const remoteTime = new Date(remoteItem.updatedAt || remoteItem.timestamp || 0).getTime();
        
        // Preserve notes and status overrides appropriately
        if (remoteTime > localTime) {
          mergedMap.set(idStr, {
            ...localItem,
            ...remoteItem,
            // If local status is manually set to done, keep it done
            status: localItem.status === 'done' ? 'done' : (remoteItem.status || localItem.status)
          });
        }
      }
    });

    return Array.from(mergedMap.values());
  }
}

export const syncManager = new SyncManager();
