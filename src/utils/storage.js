import { initialAssignments, initialCourses, defaultProfile } from '../data/mockData';

const KEYS = {
  ASSIGNMENTS: 'classroom_hub_assignments',
  COURSES: 'classroom_hub_courses',
  PROFILE: 'classroom_hub_profile',
  LAST_SYNC: 'classroom_hub_last_sync',
  ACCESS_TOKEN: 'classroom_hub_access_token',
  RESOURCES: 'classroom_hub_resources',
  HIDDEN_COURSES: 'classroom_hub_hidden_courses',
  ACTIVE_EMAIL: 'classroom_hub_active_email'
};

/* Token Handling via Secure Session Storage (Tab lifetime, immune to persistent storage leaks) */
export const saveToken = (token) => {
  if (token) {
    sessionStorage.setItem(KEYS.ACCESS_TOKEN, token);
  }
};

export const getToken = () => {
  return sessionStorage.getItem(KEYS.ACCESS_TOKEN);
};

export const clearToken = () => {
  sessionStorage.removeItem(KEYS.ACCESS_TOKEN);
};

/* Active User Email configuration (Always lowercased and trimmed) */
export const getActiveEmail = () => {
  const email = localStorage.getItem(KEYS.ACTIVE_EMAIL);
  return email ? email.toLowerCase().trim() : '';
};

export const setActiveEmail = (email) => {
  if (email) {
    localStorage.setItem(KEYS.ACTIVE_EMAIL, email.toLowerCase().trim());
  } else {
    localStorage.removeItem(KEYS.ACTIVE_EMAIL);
  }
};

/* Scoped key helper based on active user email (Always lowercased and trimmed) */
const getScopedKey = (baseKey, email) => {
  const active = (email || getActiveEmail() || '').toLowerCase().trim();
  return active ? `${baseKey}_${active}` : baseKey;
};

/* 
 * Helper to fetch item with auto-migration of uppercase/mixed-case keys to lowercase 
 */
const getStoredItemWithMigration = (baseKey, email) => {
  const activeLower = (email || getActiveEmail() || '').toLowerCase().trim();
  if (!activeLower) {
    return localStorage.getItem(baseKey);
  }
  
  const keyLower = `${baseKey}_${activeLower}`;
  const storedLower = localStorage.getItem(keyLower);
  if (storedLower) {
    return storedLower;
  }
  
  // If lowercase key doesn't exist, check case-insensitive match for old capitalized keys
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.toLowerCase() === keyLower.toLowerCase()) {
      const data = localStorage.getItem(key);
      if (data) {
        localStorage.setItem(keyLower, data); // Migrate data to lowercase key
        localStorage.removeItem(key);         // Delete capitalized key
        return data;
      }
    }
  }
  
  return null;
};

/* Caching Last Sync timestamps */
export const setLastSync = (time, email) => {
  const key = getScopedKey(KEYS.LAST_SYNC, email);
  localStorage.setItem(key, time);
};

export const getLastSync = (email) => {
  return getStoredItemWithMigration(KEYS.LAST_SYNC, email);
};

/* Scoped Assignments fetching */
export const getAssignments = (email) => {
  const stored = getStoredItemWithMigration(KEYS.ASSIGNMENTS, email);
  if (!stored) {
    const active = (email || getActiveEmail() || '').toLowerCase().trim();
    if (!active) {
      // Default to mock assignments on first load before logging in
      const defaultKey = KEYS.ASSIGNMENTS;
      localStorage.setItem(defaultKey, JSON.stringify(initialAssignments));
      return initialAssignments;
    }
    return [];
  }
  try {
    return JSON.parse(stored);
  } catch (e) {
    console.error('Failed to parse assignments from local storage', e);
    return [];
  }
};

export const saveAssignments = (assignments, email) => {
  const key = getScopedKey(KEYS.ASSIGNMENTS, email);
  localStorage.setItem(key, JSON.stringify(assignments));
};

/* 
 * Sync Classroom data to local cache preserving local user overrides (Notes and custom states)
 */
export const syncClassroomAssignments = (apiAssignments, email) => {
  const localAssignments = getAssignments(email);
  
  const merged = apiAssignments.map(apiAssign => {
    // Find existing task by ID
    const localAssign = localAssignments.find(la => String(la.id) === String(apiAssign.id));
    
    if (localAssign) {
      return {
        ...apiAssign,
        // Preserve user workspace notes
        notes: localAssign.notes || '',
        // If the task was completed on Google, it stays 'done'.
        // If it was marked completed/in-progress locally by the user, keep it.
        status: apiAssign.status === 'done' ? 'done' : (localAssign.status || apiAssign.status)
      };
    }
    return {
      ...apiAssign,
      notes: ''
    };
  });

  // Also preserve manually created local tasks (exclude initial mock assignments)
  const mockIds = ['assign-1', 'assign-2', 'assign-3', 'assign-4', 'assign-5', 'assign-6', 'assign-7'];
  const localManualTasks = localAssignments.filter(la => 
    String(la.id).startsWith('assign-') && !mockIds.includes(la.id)
  );
  const finalAssignments = [...localManualTasks, ...merged];

  saveAssignments(finalAssignments, email);
  return finalAssignments;
};

export const updateAssignmentStatus = (id, status, email) => {
  const assignments = getAssignments(email);
  const updated = assignments.map(a => String(a.id) === String(id) ? { ...a, status } : a);
  saveAssignments(updated, email);
  return updated;
};

export const updateAssignmentNotes = (id, notes, email) => {
  const assignments = getAssignments(email);
  const updated = assignments.map(a => String(a.id) === String(id) ? { ...a, notes } : a);
  saveAssignments(updated, email);
  return updated;
};

export const addAssignment = (assignment, email) => {
  const assignments = getAssignments(email);
  const newAssignment = {
    id: `assign-${Date.now()}`,
    ...assignment
  };
  const updated = [newAssignment, ...assignments];
  saveAssignments(updated, email);
  return updated;
};

export const getCourses = (email) => {
  const stored = getStoredItemWithMigration(KEYS.COURSES, email);
  if (!stored) {
    const active = (email || getActiveEmail() || '').toLowerCase().trim();
    if (!active) {
      const defaultKey = KEYS.COURSES;
      localStorage.setItem(defaultKey, JSON.stringify(initialCourses));
      return initialCourses;
    }
    return [];
  }
  try {
    return JSON.parse(stored);
  } catch (e) {
    console.error('Failed to parse courses from local storage', e);
    return [];
  }
};

export const saveCourses = (courses, email) => {
  const key = getScopedKey(KEYS.COURSES, email);
  localStorage.setItem(key, JSON.stringify(courses));
};

export const getProfile = (email) => {
  const stored = getStoredItemWithMigration(KEYS.PROFILE, email);
  if (!stored) {
    const active = (email || getActiveEmail() || '').toLowerCase().trim();
    if (!active) {
      const defaultKey = KEYS.PROFILE;
      localStorage.setItem(defaultKey, JSON.stringify(defaultProfile));
      return defaultProfile;
    }
    return {};
  }
  try {
    return JSON.parse(stored);
  } catch (e) {
    console.error('Failed to parse profile from local storage', e);
    return {};
  }
};

export const saveProfile = (profile, email) => {
  const userEmail = email || profile.email || getActiveEmail();
  const key = getScopedKey(KEYS.PROFILE, userEmail);
  localStorage.setItem(key, JSON.stringify(profile));
};

export const getResources = (email) => {
  const stored = getStoredItemWithMigration(KEYS.RESOURCES, email);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch (e) {
    console.error('Failed to parse resources from local storage', e);
    return [];
  }
};

export const saveResources = (resources, email) => {
  const key = getScopedKey(KEYS.RESOURCES, email);
  localStorage.setItem(key, JSON.stringify(resources));
};

export const resetDatabase = (email) => {
  const userEmail = (email || getActiveEmail() || '').toLowerCase().trim();
  
  if (!userEmail) {
    localStorage.setItem(KEYS.ASSIGNMENTS, JSON.stringify(initialAssignments));
    localStorage.setItem(KEYS.COURSES, JSON.stringify(initialCourses));
    localStorage.setItem(KEYS.PROFILE, JSON.stringify(defaultProfile));
    localStorage.removeItem(KEYS.RESOURCES);
    localStorage.removeItem(KEYS.LAST_SYNC);
    localStorage.removeItem(KEYS.HIDDEN_COURSES);
    clearToken();
    return {
      assignments: initialAssignments,
      courses: initialCourses,
      profile: defaultProfile
    };
  } else {
    // Reset user-specific database keys
    const assignKey = `${KEYS.ASSIGNMENTS}_${userEmail}`;
    const coursesKey = `${KEYS.COURSES}_${userEmail}`;
    const profileKey = `${KEYS.PROFILE}_${userEmail}`;
    const resourcesKey = `${KEYS.RESOURCES}_${userEmail}`;
    const syncKey = `${KEYS.LAST_SYNC}_${userEmail}`;
    const hiddenKey = `${KEYS.HIDDEN_COURSES}_${userEmail}`;
    
    localStorage.removeItem(`classroom_hub_enable_email_alerts_${userEmail}`);
    localStorage.removeItem(`classroom_hub_alert_settings_${userEmail}`);
    localStorage.removeItem(`classroom_hub_sunday_digest_time_${userEmail}`);
    localStorage.removeItem(`classroom_hub_sent_notifications_${userEmail}`);
    localStorage.removeItem(`classroom_hub_daily_email_limit_${userEmail}`);
    localStorage.removeItem(`classroom_hub_notification_history_${userEmail}`);
    
    localStorage.removeItem(assignKey);
    localStorage.removeItem(coursesKey);
    localStorage.removeItem(profileKey);
    localStorage.removeItem(resourcesKey);
    localStorage.removeItem(syncKey);
    localStorage.removeItem(hiddenKey);
    
    return {
      assignments: [],
      courses: [],
      profile: {}
    };
  }
};

/* Hidden Courses for controlling visibility of finished semesters */
export const getHiddenCourses = (email) => {
  const stored = getStoredItemWithMigration(KEYS.HIDDEN_COURSES, email);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch (e) {
    return [];
  }
};

export const saveHiddenCourses = (hiddenIds, email) => {
  const key = getScopedKey(KEYS.HIDDEN_COURSES, email);
  localStorage.setItem(key, JSON.stringify(hiddenIds));
};

/* Gmail Notifications Scoped Helpers */
export const getEnableEmailAlerts = (email) => {
  const key = getScopedKey('classroom_hub_enable_email_alerts', email);
  const val = localStorage.getItem(key);
  return val === null ? true : val === 'true';
};

export const setEnableEmailAlerts = (enabled, email) => {
  const key = getScopedKey('classroom_hub_enable_email_alerts', email);
  localStorage.setItem(key, String(enabled));
};

export const getAlertSettings = (email) => {
  const key = getScopedKey('classroom_hub_alert_settings', email);
  const stored = localStorage.getItem(key);
  const defaults = {
    due3Days: true,
    due1Day: true,
    dueToday: true,
    overdue1Day: true,
    newPosts: true,
    sundayDigest: true
  };
  if (!stored) return defaults;
  try {
    return { ...defaults, ...JSON.parse(stored) };
  } catch (e) {
    return defaults;
  }
};

export const saveAlertSettings = (settings, email) => {
  const key = getScopedKey('classroom_hub_alert_settings', email);
  localStorage.setItem(key, JSON.stringify(settings));
};

export const getSundayDigestTime = (email) => {
  const key = getScopedKey('classroom_hub_sunday_digest_time', email);
  return localStorage.getItem(key) || '18:00';
};

export const setSundayDigestTime = (time, email) => {
  const key = getScopedKey('classroom_hub_sunday_digest_time', email);
  localStorage.setItem(key, time);
};

export const getSentNotifications = (email) => {
  const key = getScopedKey('classroom_hub_sent_notifications', email);
  const stored = localStorage.getItem(key);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch (e) {
    return [];
  }
};

export const saveSentNotifications = (records, email) => {
  const key = getScopedKey('classroom_hub_sent_notifications', email);
  localStorage.setItem(key, JSON.stringify(records));
};

export const getDailyEmailLimit = (email) => {
  const key = getScopedKey('classroom_hub_daily_email_limit', email);
  const stored = localStorage.getItem(key);
  const defaults = { lastSentDate: '', count: 0 };
  if (!stored) return defaults;
  try {
    return { ...defaults, ...JSON.parse(stored) };
  } catch (e) {
    return defaults;
  }
};

export const saveDailyEmailLimit = (limitData, email) => {
  const key = getScopedKey('classroom_hub_daily_email_limit', email);
  localStorage.setItem(key, JSON.stringify(limitData));
};

export const getNotificationHistory = (email) => {
  const key = getScopedKey('classroom_hub_notification_history', email);
  const stored = localStorage.getItem(key);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch (e) {
    return [];
  }
};

export const saveNotificationHistory = (logs, email) => {
  const key = getScopedKey('classroom_hub_notification_history', email);
  localStorage.setItem(key, JSON.stringify(logs));
};

export const addNotificationHistoryLog = (logEntry, email) => {
  const logs = getNotificationHistory(email);
  const newLog = {
    id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    sentAt: new Date().toISOString(),
    ...logEntry
  };
  const updated = [newLog, ...logs].slice(0, 100); // Limit to last 100 entries
  saveNotificationHistory(updated, email);
  return updated;
};
