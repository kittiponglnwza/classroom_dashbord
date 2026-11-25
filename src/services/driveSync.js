import { httpClient } from '../utils/httpClient';
import { StorageRepository } from '../repositories/StorageRepository';
import { STORAGE_CONFIG } from '../config/storage';
import { logger } from '../utils/logger';

const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';
const SYNC_FILE_NAME = 'classroom_hub_sync_settings.json';

// Per-email metadata/payload cache to skip redundant alt=media downloads when Drive file & local state are unchanged
const driveSyncStateCache = new Map();

export const clearDriveSyncCache = (email = '') => {
  const lower = String(email || '').toLowerCase().trim();
  if (lower) {
    driveSyncStateCache.delete(lower);
  } else {
    driveSyncStateCache.clear();
  }
};

const KEYS = STORAGE_CONFIG.keys;

/**
 * Keys that follow the standard pattern: `${baseKey}_${email}`
 */
const STANDARD_SCOPED_KEYS = [
  KEYS.assignments,
  KEYS.hiddenCourses,
  KEYS.pinnedItems,
  KEYS.resources,
  KEYS.schedule,
  KEYS.exams,
  'classroom_hub_enable_email_alerts',
  'classroom_hub_alert_settings',
  'classroom_hub_sunday_digest_time',
  'classroom_hub_notification_history',
  'classroom_hub_sent_notifications',
  'classroom_hub_notification_ledger',
  'classroom_hub_notification_snapshot',
  'classroom_hub_discord_telemetry',
  'classroom_hub_daily_email_limit',
  'classroom_hub_deleted_ids',
  KEYS.profile,
  KEYS.lastSync,
  KEYS.topics,
  KEYS.academic
];

const isSafeSyncKey = (fullKey, expectedEmail = '') => {
  if (typeof fullKey !== 'string' || !fullKey.startsWith('classroom_hub_')) return false;
  const lowerEmail = expectedEmail ? expectedEmail.toLowerCase().trim() : '';
  if (lowerEmail) {
    if (fullKey === `classroom_hub_${lowerEmail}_language`) return true;
    return STANDARD_SCOPED_KEYS.some(prefix => fullKey === `${prefix}_${lowerEmail}`);
  }
  return STANDARD_SCOPED_KEYS.some(prefix => fullKey.startsWith(`${prefix}_`)) || fullKey.endsWith('_language');
};

const canonicalPayloadString = (payload) => {
  if (!payload || typeof payload !== 'object') return '{}';
  const sorted = {};
  Object.keys(payload).sort().forEach(k => {
    sorted[k] = payload[k];
  });
  return JSON.stringify(sorted);
};

/**
 * Collects all user-scoped localStorage raw string data into a payload object.
 */
export const getLocalSettingsPayload = (email) => {
  const payload = {};
  const lowerEmail = email.toLowerCase().trim();

  // 1. Standard scoped keys
  STANDARD_SCOPED_KEYS.forEach(baseKey => {
    const key = `${baseKey}_${lowerEmail}`;
    const value = localStorage.getItem(key);
    if (value !== null) {
      payload[key] = value;
    }
  });

  // 2. Special language key
  const langKey = `classroom_hub_${lowerEmail}_language`;
  const langValue = localStorage.getItem(langKey);
  if (langValue !== null) {
    payload[langKey] = langValue;
  }

  return payload;
};

/**
 * Applies a remote settings payload to localStorage with key allowlist validation.
 */
export const applyRemoteSettingsPayload = (payload, expectedEmail = '') => {
  if (!payload || typeof payload !== 'object') return;
  Object.keys(payload).forEach(fullKey => {
    if (!isSafeSyncKey(fullKey, expectedEmail)) {
      logger.warn(`[Drive Sync] Ignoring unexpected key in remote payload: ${fullKey}`);
      return;
    }
    if (typeof payload[fullKey] === 'string') {
      localStorage.setItem(fullKey, payload[fullKey]);
    }
  });
  StorageRepository.clearMemoryCache();
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent('classroom_hub_remote_applied', {
      detail: { email: expectedEmail ? expectedEmail.toLowerCase().trim() : '' }
    }));
  }
};

/**
 * Checks Google Drive appDataFolder for the settings sync files (newest first).
 */
async function findSyncFiles(accessToken) {
  const q = encodeURIComponent(`name='${SYNC_FILE_NAME}' and trashed=false`);
  const url = `${DRIVE_FILES_URL}?spaces=appDataFolder&q=${q}&orderBy=modifiedTime desc&fields=files(id,name,modifiedTime)`;
  
  const headers = { 'Authorization': `Bearer ${accessToken}` };
  const data = await httpClient.request(url, { headers });
  return Array.isArray(data?.files) ? data.files : [];
}

/**
 * Creates the sync file in Google Drive appDataFolder and uploads content.
 */
async function createSyncFileWithContent(accessToken, payload, timestamp) {
  const metadata = {
    name: SYNC_FILE_NAME,
    parents: ['appDataFolder']
  };

  const content = JSON.stringify({ version: STORAGE_CONFIG.schemaVersion, timestamp, payload });
  const boundary = '----ClassroomHubSyncBoundary';
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json\r\n\r\n` +
    `${content}\r\n` +
    `--${boundary}--`;

  const url = `${DRIVE_UPLOAD_URL}?uploadType=multipart&fields=id,modifiedTime`;
  return await httpClient.request(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body
  });
}

/**
 * Uploads settings payload to an existing sync file
 */
async function uploadSyncFileContent(accessToken, fileId, payload, timestamp, options = {}) {
  const url = `${DRIVE_UPLOAD_URL}/${fileId}?uploadType=media&fields=id,modifiedTime`;
  const body = JSON.stringify({ version: STORAGE_CONFIG.schemaVersion, timestamp, payload });
  const reqOptions = {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body
  };
  if (options.keepalive && body.length < 60000) {
    reqOptions.keepalive = true;
  }

  return await httpClient.request(url, reqOptions);
}

/**
 * Downloads the content of the sync file via httpClient (supports 401 refresh & retry).
 */
async function downloadSyncFileContent(accessToken, fileId) {
  const url = `${DRIVE_FILES_URL}/${fileId}?alt=media`;
  try {
    const data = await httpClient.request(url, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    return data || null;
  } catch (e) {
    if (e instanceof SyntaxError) {
      logger.warn('[Drive Sync] Failed to parse remote settings JSON, treating as empty.', e);
      return null;
    }
    throw e;
  }
}

/**
 * Synchronizes local settings with Google Drive appDataFolder.
 * Integrates merge-based conflict resolution and avoids stale pre-await local snapshots.
 */
export async function syncSettingsWithDrive(accessToken, email, mergeCallback, options = {}) {
  if (!accessToken || !email) return false;

  const lowerEmail = email.toLowerCase().trim();
  const timeKey = `classroom_hub_settings_last_updated_${lowerEmail}`;

  try {
    logger.info('[Drive Sync] Querying sync file on Google Drive...');
    const files = await findSyncFiles(accessToken);
    const file = files.length > 0 ? files[0] : null;

    if (!file) {
      logger.info('[Drive Sync] Sync file not found. Creating new sync file...');
      const localPayload = getLocalSettingsPayload(lowerEmail);
      const now = new Date().toISOString();
      const createdFile = await createSyncFileWithContent(accessToken, localPayload, now);
      localStorage.setItem(timeKey, now);
      if (createdFile?.id && createdFile?.modifiedTime) {
        driveSyncStateCache.set(lowerEmail, {
          fileId: createdFile.id,
          modifiedTime: createdFile.modifiedTime,
          serialized: canonicalPayloadString(localPayload)
        });
      } else {
        driveSyncStateCache.delete(lowerEmail);
      }
      logger.info('[Drive Sync] Initial settings pushed successfully.');
      return false;
    }

    const preDownloadLocal = getLocalSettingsPayload(lowerEmail);
    const preDownloadSerialized = canonicalPayloadString(preDownloadLocal);
    const cachedMeta = driveSyncStateCache.get(lowerEmail);
    if (
      files.length === 1 &&
      cachedMeta &&
      file.id &&
      file.modifiedTime &&
      cachedMeta.fileId === file.id &&
      cachedMeta.modifiedTime === file.modifiedTime &&
      cachedMeta.serialized === preDownloadSerialized
    ) {
      logger.debug('[Drive Sync] Skipping download; remote modifiedTime and local state unchanged.');
      return false;
    }

    logger.info('[Drive Sync] Sync file found. Downloading remote state...');
    const remoteData = await downloadSyncFileContent(accessToken, file.id);
    let remotePayload = remoteData?.payload || null;
    let mergedDuplicateFile = false;
    if (files.length > 1) {
      // Reconcile accidental duplicate sync files (e.g. concurrent first logins) into the newest file
      for (const dupFile of files.slice(1, 3)) {
        if (!dupFile?.id) continue;
        try {
          const dupData = await downloadSyncFileContent(accessToken, dupFile.id);
          if (dupData?.payload && typeof dupData.payload === 'object') {
            remotePayload = remotePayload
              ? mergeCallback(remotePayload, dupData.payload, lowerEmail)
              : dupData.payload;
            mergedDuplicateFile = true;
          }
        } catch (dupErr) {
          logger.warn('[Drive Sync] Failed reading duplicate sync file:', dupErr?.message || dupErr);
        }
      }
    }
    const localPayload = getLocalSettingsPayload(lowerEmail);

    if (!remotePayload) {
      logger.info('[Drive Sync] Remote sync file was empty. Uploading current state...');
      const now = new Date().toISOString();
      const uploadedFile = await uploadSyncFileContent(accessToken, file.id, localPayload, now, options);
      localStorage.setItem(timeKey, now);
      const nextModifiedTime = uploadedFile?.modifiedTime;
      if (file.id && nextModifiedTime) {
        driveSyncStateCache.set(lowerEmail, {
          fileId: file.id,
          modifiedTime: nextModifiedTime,
          serialized: canonicalPayloadString(localPayload)
        });
      } else {
        driveSyncStateCache.delete(lowerEmail);
      }
      return false;
    }

    // Perform fine-grained merge using fresh local state vs downloaded remote payload
    const mergedPayload = mergeCallback(localPayload, remotePayload, lowerEmail);

    const localSerialized = canonicalPayloadString(localPayload);
    const remoteSerialized = canonicalPayloadString(remoteData?.payload || {});
    const mergedSerialized = canonicalPayloadString(mergedPayload);

    const localIsOutOfSync = localSerialized !== mergedSerialized;
    const remoteIsOutOfSync = mergedDuplicateFile || remoteSerialized !== mergedSerialized;

    let appliedRemote = false;

    if (localIsOutOfSync) {
      logger.info('[Drive Sync] Local data is out of sync. Applying merged data to local storage...');
      applyRemoteSettingsPayload(mergedPayload, lowerEmail);
      appliedRemote = true;
    }

    let latestModifiedTime = file.modifiedTime || '';
    if (remoteIsOutOfSync) {
      logger.info('[Drive Sync] Remote data requires update. Uploading merged state to Google Drive...');
      const now = new Date().toISOString();
      const uploadedFile = await uploadSyncFileContent(accessToken, file.id, mergedPayload, now, options);
      localStorage.setItem(timeKey, now);
      latestModifiedTime = uploadedFile?.modifiedTime || '';
    } else {
      logger.info('[Drive Sync] Local and remote data are fully in sync.');
    }

    if (file.id && latestModifiedTime) {
      driveSyncStateCache.set(lowerEmail, {
        fileId: file.id,
        modifiedTime: latestModifiedTime,
        serialized: mergedSerialized
      });
    } else {
      driveSyncStateCache.delete(lowerEmail);
    }

    return appliedRemote;
  } catch (err) {
    logger.error('[Drive Sync] Synchronization process failed:', err.message || err);
    throw err;
  }
}
