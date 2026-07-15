import { httpClient } from '../utils/httpClient';
import { STORAGE_CONFIG } from '../config/storage';
import { logger } from '../utils/logger';

const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';
const SYNC_FILE_NAME = 'classroom_hub_sync_settings.json';

const KEYS = STORAGE_CONFIG.keys;

/**
 * Keys that follow the standard pattern: `${baseKey}_${email}`
 */
const STANDARD_SCOPED_KEYS = [
  KEYS.assignments,
  KEYS.hiddenCourses,
  KEYS.resources,
  KEYS.schedule,
  KEYS.exams,
  'classroom_hub_enable_email_alerts',
  'classroom_hub_alert_settings',
  'classroom_hub_sunday_digest_time',
  'classroom_hub_notification_history',
  'classroom_hub_sent_notifications',
  'classroom_hub_daily_email_limit',
  KEYS.profile,
  KEYS.lastSync,
  KEYS.topics
];

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
 * Applies a remote settings payload to localStorage.
 */
export const applyRemoteSettingsPayload = (payload) => {
  if (!payload || typeof payload !== 'object') return;
  Object.keys(payload).forEach(fullKey => {
    localStorage.setItem(fullKey, payload[fullKey]);
  });
};

/**
 * Checks Google Drive appDataFolder for the settings sync file.
 */
async function findSyncFile(accessToken) {
  const q = encodeURIComponent(`name='${SYNC_FILE_NAME}'`);
  const url = `${DRIVE_FILES_URL}?spaces=appDataFolder&q=${q}&fields=files(id,name)`;
  
  const headers = { 'Authorization': `Bearer ${accessToken}` };
  const data = await httpClient.request(url, { headers });
  return (data.files && data.files.length > 0) ? data.files[0] : null;
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

  const url = `${DRIVE_UPLOAD_URL}?uploadType=multipart`;
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
async function uploadSyncFileContent(accessToken, fileId, payload, timestamp) {
  const url = `${DRIVE_UPLOAD_URL}/${fileId}?uploadType=media`;
  const content = { version: STORAGE_CONFIG.schemaVersion, timestamp, payload };

  await httpClient.request(url, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(content)
  });
}

/**
 * Downloads the content of the sync file.
 */
async function downloadSyncFileContent(accessToken, fileId) {
  const url = `${DRIVE_FILES_URL}/${fileId}?alt=media`;
  // Use httpClient request with alternate media query
  const response = await httpClient.fetchWithTimeout(url, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    throw new Error(`Drive download failed (${response.status}): ${errBody}`);
  }

  const text = await response.text();
  if (!text || text.trim().length === 0) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch (e) {
    logger.warn('[Drive Sync] Failed to parse remote settings file, treating as empty.', e);
    return null;
  }
}

/**
 * Synchronizes local settings with Google Drive appDataFolder.
 * Integrates merge-based conflict resolution.
 */
export async function syncSettingsWithDrive(accessToken, email, mergeCallback) {
  if (!accessToken || !email) return false;

  const lowerEmail = email.toLowerCase().trim();
  const timeKey = `classroom_hub_settings_last_updated_${lowerEmail}`;

  try {
    logger.info('[Drive Sync] Querying sync file on Google Drive...');
    let file = await findSyncFile(accessToken);
    const localPayload = getLocalSettingsPayload(lowerEmail);

    if (!file) {
      logger.info('[Drive Sync] Sync file not found. Creating new sync file...');
      const now = new Date().toISOString();
      await createSyncFileWithContent(accessToken, localPayload, now);
      localStorage.setItem(timeKey, now);
      logger.info('[Drive Sync] Initial settings pushed successfully.');
      return false;
    }

    logger.info('[Drive Sync] Sync file found. Downloading remote state...');
    const remoteData = await downloadSyncFileContent(accessToken, file.id);

    if (!remoteData || !remoteData.payload) {
      logger.info('[Drive Sync] Remote sync file was empty. Uploading current state...');
      const now = new Date().toISOString();
      await uploadSyncFileContent(accessToken, file.id, localPayload, now);
      localStorage.setItem(timeKey, now);
      return false;
    }

    // Perform fine-grained merge using conflict resolution callback
    const mergedPayload = mergeCallback(localPayload, remoteData.payload, lowerEmail);

    const localSerialized = JSON.stringify(localPayload);
    const remoteSerialized = JSON.stringify(remoteData.payload);
    const mergedSerialized = JSON.stringify(mergedPayload);

    const localIsOutOfSync = localSerialized !== mergedSerialized;
    const remoteIsOutOfSync = remoteSerialized !== mergedSerialized;

    let appliedRemote = false;

    if (localIsOutOfSync) {
      logger.info('[Drive Sync] Local data is out of sync. Applying merged data to local storage...');
      applyRemoteSettingsPayload(mergedPayload);
      appliedRemote = true;
    }

    if (remoteIsOutOfSync || localIsOutOfSync) {
      logger.info('[Drive Sync] Remote data requires update. Uploading merged state to Google Drive...');
      const now = new Date().toISOString();
      await uploadSyncFileContent(accessToken, file.id, mergedPayload, now);
      localStorage.setItem(timeKey, now);
    } else {
      logger.info('[Drive Sync] Local and remote data are fully in sync.');
    }

    return appliedRemote;
  } catch (err) {
    logger.error('[Drive Sync] Synchronization process failed:', err.message || err);
    return false;
  }
}
