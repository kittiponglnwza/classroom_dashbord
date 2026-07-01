const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';
const SYNC_FILE_NAME = 'classroom_hub_sync_settings.json';

/**
 * Keys that follow the standard pattern: `${baseKey}_${email}`
 */
const STANDARD_SCOPED_KEYS = [
  'classroom_hub_assignments',
  'classroom_hub_hidden_courses',
  'classroom_hub_enable_email_alerts',
  'classroom_hub_alert_settings',
  'classroom_hub_sunday_digest_time',
  'classroom_hub_exam_results',
  'classroom_hub_notification_history',
  'classroom_hub_sent_notifications',
  'classroom_hub_daily_email_limit',
  'classroom_hub_profile',
  'classroom_hub_last_sync'
];

/**
 * Collects all user-scoped localStorage data into a payload object.
 * Handles both standard keys (`baseKey_email`) and the special language key (`classroom_hub_email_language`).
 */
export const getLocalSettingsPayload = (email) => {
  const payload = {};
  const lowerEmail = email.toLowerCase().trim();

  // 1. Standard scoped keys: baseKey_email
  STANDARD_SCOPED_KEYS.forEach(baseKey => {
    const key = `${baseKey}_${lowerEmail}`;
    const value = localStorage.getItem(key);
    if (value !== null) {
      payload[key] = value;
    }
  });

  // 2. Language key uses a different format: classroom_hub_email_language
  const langKey = `classroom_hub_${lowerEmail}_language`;
  const langValue = localStorage.getItem(langKey);
  if (langValue !== null) {
    payload[langKey] = langValue;
  }

  return payload;
};

/**
 * Applies a remote settings payload to localStorage.
 * Keys in the payload are stored as-is (they already include the email).
 */
export const applyRemoteSettingsPayload = (payload, email) => {
  if (!payload || typeof payload !== 'object') return;
  Object.keys(payload).forEach(fullKey => {
    localStorage.setItem(fullKey, payload[fullKey]);
  });
};

/**
 * Sets the last local modification timestamp for settings
 */
export const touchLocalSettingsTimestamp = (email) => {
  if (!email) return;
  const key = `classroom_hub_settings_last_updated_${email.toLowerCase().trim()}`;
  localStorage.setItem(key, new Date().toISOString());
};

/**
 * Checks Google Drive appDataFolder for the settings sync file.
 * Returns the file object ({ id, name }) or null if not found.
 */
async function findSyncFile(accessToken) {
  const q = encodeURIComponent(`name='${SYNC_FILE_NAME}'`);
  const url = `${DRIVE_FILES_URL}?spaces=appDataFolder&q=${q}&fields=files(id,name)`;
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Drive query failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  return (data.files && data.files.length > 0) ? data.files[0] : null;
}

/**
 * Creates the sync file in Google Drive appDataFolder and immediately uploads initial content.
 * Using multipart upload to create metadata + content in a single request.
 */
async function createSyncFileWithContent(accessToken, payload, timestamp) {
  const metadata = {
    name: SYNC_FILE_NAME,
    parents: ['appDataFolder']
  };

  const content = JSON.stringify({ version: 1, timestamp, payload });

  const boundary = '----ClassroomHubSyncBoundary';
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json\r\n\r\n` +
    `${content}\r\n` +
    `--${boundary}--`;

  const res = await fetch(`${DRIVE_UPLOAD_URL}?uploadType=multipart`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`Drive create failed (${res.status}): ${errBody}`);
  }

  return await res.json();
}

/**
 * Uploads settings payload to an existing sync file
 */
async function uploadSyncFileContent(accessToken, fileId, payload, timestamp) {
  const url = `${DRIVE_UPLOAD_URL}/${fileId}?uploadType=media`;
  const content = { version: 1, timestamp, payload };

  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(content)
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`Drive upload failed (${res.status}): ${errBody}`);
  }
}

/**
 * Downloads the content of the sync file.
 * Returns null if file is empty or unparseable.
 */
async function downloadSyncFileContent(accessToken, fileId) {
  const url = `${DRIVE_FILES_URL}/${fileId}?alt=media`;
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`Drive download failed (${res.status}): ${errBody}`);
  }

  const text = await res.text();
  if (!text || text.trim().length === 0) {
    return null; // Empty file (newly created without content)
  }

  try {
    return JSON.parse(text);
  } catch (e) {
    console.warn('[Classroom Hub Sync] Failed to parse remote settings file, treating as empty.', e);
    return null;
  }
}

/**
 * Synchronizes local settings with Google Drive appDataFolder.
 * Returns true if remote settings were applied locally (indicating UI needs reload).
 */
export async function syncSettingsWithDrive(accessToken, email) {
  if (!accessToken || !email) return false;

  const lowerEmail = email.toLowerCase().trim();
  const timeKey = `classroom_hub_settings_last_updated_${lowerEmail}`;
  const localTime = localStorage.getItem(timeKey) || new Date(0).toISOString();

  try {
    console.log('[Classroom Hub Sync] Starting settings sync with Google Drive...');

    // Step 1: Look for existing sync file
    let file = await findSyncFile(accessToken);

    if (!file) {
      // No file exists yet — create one with current local settings
      console.log('[Classroom Hub Sync] No sync file found. Creating initial sync file...');
      const localPayload = getLocalSettingsPayload(lowerEmail);
      const now = new Date().toISOString();
      await createSyncFileWithContent(accessToken, localPayload, now);
      localStorage.setItem(timeKey, now);
      console.log('[Classroom Hub Sync] ✅ Initial settings uploaded to Google Drive.');
      return false;
    }

    // Step 2: Download existing remote content
    console.log('[Classroom Hub Sync] Sync file found. Downloading...');
    const remoteData = await downloadSyncFileContent(accessToken, file.id);

    // Handle empty or corrupted remote file
    if (!remoteData || !remoteData.payload) {
      console.log('[Classroom Hub Sync] Remote file is empty. Uploading current local settings...');
      const localPayload = getLocalSettingsPayload(lowerEmail);
      const now = new Date().toISOString();
      await uploadSyncFileContent(accessToken, file.id, localPayload, now);
      localStorage.setItem(timeKey, now);
      console.log('[Classroom Hub Sync] ✅ Local settings pushed to empty remote file.');
      return false;
    }

    // Step 3: Compare timestamps
    const remoteTime = remoteData.timestamp;
    console.log(`[Classroom Hub Sync] Local: ${localTime} | Remote: ${remoteTime}`);

    const localDate = new Date(localTime);
    const remoteDate = new Date(remoteTime);

    if (remoteDate > localDate) {
      // Remote is newer → pull
      console.log('[Classroom Hub Sync] ⬇️ Remote is newer. Applying remote settings locally...');
      applyRemoteSettingsPayload(remoteData.payload, lowerEmail);
      localStorage.setItem(timeKey, remoteTime);
      console.log('[Classroom Hub Sync] ✅ Remote settings applied.');
      return true;
    } else if (localDate > remoteDate) {
      // Local is newer → push
      console.log('[Classroom Hub Sync] ⬆️ Local is newer. Uploading to Google Drive...');
      const localPayload = getLocalSettingsPayload(lowerEmail);
      await uploadSyncFileContent(accessToken, file.id, localPayload, localTime);
      console.log('[Classroom Hub Sync] ✅ Local settings pushed to Google Drive.');
      return false;
    } else {
      console.log('[Classroom Hub Sync] ✅ Settings are already in sync.');
      return false;
    }
  } catch (err) {
    // Log the full error for debugging but don't break the main sync flow
    console.error('[Classroom Hub Sync] ❌ Settings sync failed:', err.message || err);
    
    // If the error is a 403/404 on Drive API, it likely means Drive API isn't enabled
    // or the scope wasn't granted. Log a helpful hint.
    if (err.message && (err.message.includes('403') || err.message.includes('404'))) {
      console.warn(
        '[Classroom Hub Sync] 💡 Hint: Make sure Google Drive API is enabled in your ' +
        'Google Cloud Console project and the user has granted the drive.appdata scope. ' +
        'The user may need to log out and log back in to grant the new permission.'
      );
    }
    return false;
  }
}
