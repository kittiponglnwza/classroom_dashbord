const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';
const SYNC_FILE_NAME = 'classroom_hub_sync_settings.json';

const PREFIXES_TO_SYNC = [
  'classroom_hub_assignments_',
  'classroom_hub_hidden_courses_',
  'classroom_hub_lang_',
  'classroom_hub_enable_email_alerts_',
  'classroom_hub_alert_settings_',
  'classroom_hub_sunday_digest_time_',
  'classroom_hub_exam_results_',
  'classroom_hub_notification_history_'
];

/**
 * Gets a JSON object containing all the user-specific localStorage settings
 */
export const getLocalSettingsPayload = (email) => {
  const payload = {};
  const lowerEmail = email.toLowerCase().trim();
  
  PREFIXES_TO_SYNC.forEach(prefix => {
    const key = `${prefix}${lowerEmail}`;
    const value = localStorage.getItem(key);
    if (value !== null) {
      payload[prefix] = value;
    }
  });
  
  return payload;
};

/**
 * Applies a remote settings payload to local storage
 */
export const applyRemoteSettingsPayload = (payload, email) => {
  const lowerEmail = email.toLowerCase().trim();
  Object.keys(payload).forEach(prefix => {
    const key = `${prefix}${lowerEmail}`;
    localStorage.setItem(key, payload[prefix]);
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
  const url = `${DRIVE_FILES_URL}?spaces=appDataFolder&q=name='${SYNC_FILE_NAME}'`;
  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (!res.ok) {
    throw new Error(`Failed to query Google Drive files: ${res.statusText}`);
  }

  const data = await res.json();
  return (data.files && data.files.length > 0) ? data.files[0] : null;
}

/**
 * Creates the sync file in Google Drive appDataFolder
 */
async function createSyncFile(accessToken) {
  const metadata = {
    name: SYNC_FILE_NAME,
    parents: ['appDataFolder']
  };

  const res = await fetch(DRIVE_FILES_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(metadata)
  });

  if (!res.ok) {
    throw new Error(`Failed to create sync file metadata: ${res.statusText}`);
  }

  return await res.json(); // returns { id, name, ... }
}

/**
 * Uploads settings payload and timestamp to the sync file content
 */
async function uploadSyncFileContent(accessToken, fileId, payload, timestamp) {
  const url = `${DRIVE_UPLOAD_URL}/${fileId}?uploadType=media`;
  const content = {
    timestamp,
    payload
  };

  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(content)
  });

  if (!res.ok) {
    throw new Error(`Failed to upload sync content: ${res.statusText}`);
  }
}

/**
 * Downloads the content of the sync file
 */
async function downloadSyncFileContent(accessToken, fileId) {
  const url = `${DRIVE_FILES_URL}/${fileId}?alt=media`;
  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (!res.ok) {
    throw new Error(`Failed to download sync file: ${res.statusText}`);
  }

  return await res.json(); // returns { timestamp, payload }
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
    console.log('[Classroom Hub Sync] Querying settings from Google Drive...');
    let file = await findSyncFile(accessToken);
    
    if (!file) {
      console.log('[Classroom Hub Sync] No sync file found. Creating new file...');
      file = await createSyncFile(accessToken);
      const localPayload = getLocalSettingsPayload(lowerEmail);
      const now = new Date().toISOString();
      await uploadSyncFileContent(accessToken, file.id, localPayload, now);
      localStorage.setItem(timeKey, now);
      console.log('[Classroom Hub Sync] Settings uploaded and initialized on Google Drive.');
      return false;
    }

    console.log('[Classroom Hub Sync] Sync file found. Downloading content...');
    const remoteData = await downloadSyncFileContent(accessToken, file.id);
    const remoteTime = remoteData.timestamp;
    
    console.log(`[Classroom Hub Sync] Comparison - Local: ${localTime}, Remote: ${remoteTime}`);
    
    const localDate = new Date(localTime);
    const remoteDate = new Date(remoteTime);

    if (remoteDate > localDate) {
      console.log('[Classroom Hub Sync] Remote settings are newer. Applying locally...');
      applyRemoteSettingsPayload(remoteData.payload, lowerEmail);
      localStorage.setItem(timeKey, remoteTime);
      return true; // Applied remote changes
    } else if (localDate > remoteDate) {
      console.log('[Classroom Hub Sync] Local settings are newer. Uploading to Drive...');
      const localPayload = getLocalSettingsPayload(lowerEmail);
      await uploadSyncFileContent(accessToken, file.id, localPayload, localTime);
      console.log('[Classroom Hub Sync] Settings uploaded successfully.');
      return false;
    } else {
      console.log('[Classroom Hub Sync] Settings are already up to date.');
      return false;
    }
  } catch (err) {
    console.error('[Classroom Hub Sync] Error during Google Drive settings sync:', err);
    // Suppress error so that failure in Drive API doesn't crash the Classroom sync
    return false;
  }
}
