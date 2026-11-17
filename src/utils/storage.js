import { initialAssignments, initialCourses, defaultProfile } from '../data/mockData';
import { StorageRepository } from '../repositories/StorageRepository';
import { STORAGE_CONFIG } from '../config/storage';

const KEYS = STORAGE_CONFIG.keys;

/* Token Handling via Secure Session Storage */
// SECURITY NOTE: As a pure Single Page Application using Google's implicit OAuth flow 
// without a backend server, we must store tokens in client-side storage (sessionStorage). 
// Using HttpOnly cookies would be more secure but requires a backend architecture.
// Session policy: the access token lives only for the browser session (sessionStorage) and
// never beyond Google's `expires_in`. Expired tokens are treated as absent so a refresh after
// expiry never restores a dead session as "logged in".
const TOKEN_EXPIRY_SKEW_MS = 60 * 1000;
const TOKEN_EXPIRY_KEY = `${KEYS.accessToken}_expires_at`;

export const saveToken = (token, expiresInSeconds) => {
  if (token) {
    sessionStorage.setItem(KEYS.accessToken, token);
    const seconds = Number(expiresInSeconds);
    if (Number.isFinite(seconds) && seconds > 0) {
      sessionStorage.setItem(TOKEN_EXPIRY_KEY, String(Date.now() + seconds * 1000));
    } else {
      sessionStorage.removeItem(TOKEN_EXPIRY_KEY);
    }
  }
};

export const getTokenExpiry = () => {
  const raw = sessionStorage.getItem(TOKEN_EXPIRY_KEY);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
};

export const getToken = () => {
  const token = sessionStorage.getItem(KEYS.accessToken);
  if (!token) return null;
  const expiresAt = getTokenExpiry();
  if (expiresAt !== null && Date.now() >= expiresAt - TOKEN_EXPIRY_SKEW_MS) {
    sessionStorage.removeItem(KEYS.accessToken);
    sessionStorage.removeItem(TOKEN_EXPIRY_KEY);
    return null;
  }
  return token;
};

export const clearToken = () => {
  sessionStorage.removeItem(KEYS.accessToken);
  sessionStorage.removeItem(TOKEN_EXPIRY_KEY);
};

/* Active User Email & Remember Me configuration */
const REMEMBER_ME_KEY = 'classroom_hub_remember_me';

export const getRememberMe = () => {
  const raw = localStorage.getItem(REMEMBER_ME_KEY);
  return raw === null ? true : raw === 'true';
};

export const setRememberMe = (remember) => {
  const enabled = Boolean(remember);
  localStorage.setItem(REMEMBER_ME_KEY, String(enabled));
  const current = getActiveEmail();
  if (!current) return;
  if (enabled) {
    localStorage.setItem(KEYS.activeEmail, current);
    sessionStorage.removeItem(KEYS.activeEmail);
  } else {
    sessionStorage.setItem(KEYS.activeEmail, current);
    localStorage.removeItem(KEYS.activeEmail);
  }
};

export const getActiveEmail = () => {
  const email = localStorage.getItem(KEYS.activeEmail) || sessionStorage.getItem(KEYS.activeEmail);
  return email ? email.toLowerCase().trim() : '';
};

export const setActiveEmail = (email) => {
  if (email) {
    const clean = email.toLowerCase().trim();
    if (getRememberMe()) {
      localStorage.setItem(KEYS.activeEmail, clean);
      sessionStorage.removeItem(KEYS.activeEmail);
    } else {
      sessionStorage.setItem(KEYS.activeEmail, clean);
      localStorage.removeItem(KEYS.activeEmail);
    }
  } else {
    localStorage.removeItem(KEYS.activeEmail);
    sessionStorage.removeItem(KEYS.activeEmail);
  }
};

export const touchLocalSettingsTimestamp = (email) => {
  if (!email) return;
  const timeKey = `classroom_hub_settings_last_updated_${email.toLowerCase().trim()}`;
  localStorage.setItem(timeKey, new Date().toISOString());
};

/* Caching Last Sync timestamps */
export const setLastSync = (time, email) => {
  StorageRepository.set(KEYS.lastSync, time, email);
};

export const getLastSync = (email) => {
  // Pass forceIgnoreTTL = true because lastSync is a timestamp metadata, not an expiring cache
  return StorageRepository.get(KEYS.lastSync, email, true);
};

/* Scoped Assignments fetching */
export const getAssignments = (email) => {
  // Pass forceIgnoreTTL = true for local rendering if required, or false for cache logic.
  // Assignments list is managed by SyncManager/ClassroomService. Here we load what is currently stored.
  const stored = StorageRepository.get(KEYS.assignments, email, true);
  if (!stored) {
    const active = email || getActiveEmail();
    if (!active) {
      // Default mock fallback
      StorageRepository.set(KEYS.assignments, initialAssignments);
      return initialAssignments;
    }
    return [];
  }
  return stored;
};

export const saveAssignments = (assignments, email) => {
  StorageRepository.set(KEYS.assignments, assignments, email);
};

/* 
 * Sync Classroom data to local cache preserving local user overrides (Notes and custom states)
 */
export const syncClassroomAssignments = (apiAssignments, email) => {
  const localAssignments = getAssignments(email);
  
  const merged = apiAssignments.map(apiAssign => {
    const localAssign = localAssignments.find(la => String(la.id) === String(apiAssign.id));
    
    // Merge logic: preserve notes, status, and custom dueDate modifications
    if (localAssign) {
      return {
        ...apiAssign,
        dueDate: localAssign.customDueDate ? localAssign.dueDate : apiAssign.dueDate,
        customDueDate: Boolean(localAssign.customDueDate),
        notes: localAssign.notes || '',
        status: apiAssign.status === 'done' ? 'done' : (localAssign.status || apiAssign.status),
        updatedAt: localAssign.updatedAt || new Date().toISOString()
      };
    }
    return {
      ...apiAssign,
      notes: '',
      updatedAt: new Date().toISOString()
    };
  });

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
  const updated = assignments.map(a => String(a.id) === String(id) ? { ...a, status, updatedAt: new Date().toISOString() } : a);
  saveAssignments(updated, email);
  return updated;
};

export const updateAssignmentDueDate = (id, dueDate, email) => {
  const assignments = getAssignments(email);
  const updated = assignments.map(a => String(a.id) === String(id) ? { ...a, dueDate, customDueDate: true, updatedAt: new Date().toISOString() } : a);
  saveAssignments(updated, email);
  return updated;
};

export const updateAssignmentNotes = (id, notes, email) => {
  const assignments = getAssignments(email);
  const updated = assignments.map(a => String(a.id) === String(id) ? { ...a, notes, updatedAt: new Date().toISOString() } : a);
  saveAssignments(updated, email);
  return updated;
};

export const addAssignment = (assignment, email) => {
  const assignments = getAssignments(email);
  const newAssignment = {
    id: `assign-${Date.now()}`,
    updatedAt: new Date().toISOString(),
    ...assignment
  };
  const updated = [newAssignment, ...assignments];
  saveAssignments(updated, email);
  return updated;
};

export const getCourses = (email) => {
  const stored = StorageRepository.get(KEYS.courses, email, true);
  if (!stored) {
    const active = email || getActiveEmail();
    if (!active) {
      StorageRepository.set(KEYS.courses, initialCourses);
      return initialCourses;
    }
    return [];
  }
  return stored;
};

export const saveCourses = (courses, email) => {
  StorageRepository.set(KEYS.courses, courses, email);
};

export const getProfile = (email) => {
  const stored = StorageRepository.get(KEYS.profile, email, true);
  if (!stored) {
    const active = email || getActiveEmail();
    if (!active) {
      StorageRepository.set(KEYS.profile, defaultProfile);
      return defaultProfile;
    }
    return {};
  }
  return stored;
};

export const saveProfile = (profile, email) => {
  const userEmail = email || profile.email || getActiveEmail();
  StorageRepository.set(KEYS.profile, profile, userEmail);
};

/* Schedule Helpers */
export const getSchedule = (email) => {
  const stored = StorageRepository.get(KEYS.schedule, email, true);
  return stored || [];
};

export const saveSchedule = (schedule, email) => {
  StorageRepository.set(KEYS.schedule, schedule, email);
};

export const getResources = (email) => {
  const stored = StorageRepository.get(KEYS.resources, email, true);
  return stored || [];
};

export const saveResources = (resources, email) => {
  StorageRepository.set(KEYS.resources, resources, email);
};

export const getTopics = (email) => {
  const stored = StorageRepository.get(KEYS.topics, email, true);
  return stored || [];
};

export const saveTopics = (topics, email) => {
  StorageRepository.set(KEYS.topics, topics, email);
};

export const resetDatabase = (email) => {
  const userEmail = (email || getActiveEmail() || '').toLowerCase().trim();
  
  if (!userEmail) {
    StorageRepository.set(KEYS.assignments, initialAssignments);
    StorageRepository.set(KEYS.courses, initialCourses);
    StorageRepository.set(KEYS.profile, defaultProfile);
    StorageRepository.remove(KEYS.resources);
    StorageRepository.remove(KEYS.lastSync);
    StorageRepository.remove(KEYS.hiddenCourses);
    clearToken();
    return {
      assignments: initialAssignments,
      courses: initialCourses,
      profile: defaultProfile
    };
  } else {
    // Reset user-specific database keys
    StorageRepository.remove('classroom_hub_enable_email_alerts', userEmail);
    StorageRepository.remove('classroom_hub_alert_settings', userEmail);
    StorageRepository.remove('classroom_hub_sunday_digest_time', userEmail);
    StorageRepository.remove('classroom_hub_sent_notifications', userEmail);
    StorageRepository.remove('classroom_hub_daily_email_limit', userEmail);
    StorageRepository.remove('classroom_hub_notification_history', userEmail);
    
    StorageRepository.remove(KEYS.assignments, userEmail);
    StorageRepository.remove(KEYS.courses, userEmail);
    StorageRepository.remove(KEYS.profile, userEmail);
    StorageRepository.remove(KEYS.resources, userEmail);
    StorageRepository.remove(KEYS.lastSync, userEmail);
    StorageRepository.remove(KEYS.hiddenCourses, userEmail);
    StorageRepository.remove(KEYS.schedule, userEmail);
    StorageRepository.remove(KEYS.exams, userEmail);
    
    return {
      assignments: [],
      courses: [],
      profile: {}
    };
  }
};

/* Hidden Courses */
export const getHiddenCourses = (email) => {
  const stored = StorageRepository.get(KEYS.hiddenCourses, email, true);
  return stored || [];
};

export const saveHiddenCourses = (hiddenIds, email) => {
  StorageRepository.set(KEYS.hiddenCourses, hiddenIds, email);
};

/* Gmail Notifications Scoped Helpers */
export const getEnableEmailAlerts = (email) => {
  const key = 'classroom_hub_enable_email_alerts';
  const val = StorageRepository.get(key, email, true);
  return val === null ? true : val === true || val === 'true';
};

export const setEnableEmailAlerts = (enabled, email) => {
  StorageRepository.set('classroom_hub_enable_email_alerts', enabled, email);
};

export const getAlertSettings = (email) => {
  const key = 'classroom_hub_alert_settings';
  const stored = StorageRepository.get(key, email, true);
  const defaults = {
    due3Days: true,
    due1Day: true,
    dueToday: true,
    overdue1Day: true,
    newPosts: true,
    sundayDigest: true,
    includeExams: true,
    calendarReminderEnabled: true,
    calendarReminderValue: 10,
    calendarReminderUnit: 'minutes'
  };
  if (!stored) return defaults;
  return { ...defaults, ...stored };
};

export const saveAlertSettings = (settings, email) => {
  StorageRepository.set('classroom_hub_alert_settings', settings, email);
};

export const getSundayDigestTime = (email) => {
  const key = 'classroom_hub_sunday_digest_time';
  return StorageRepository.get(key, email, true) || '18:00';
};

export const setSundayDigestTime = (time, email) => {
  StorageRepository.set('classroom_hub_sunday_digest_time', time, email);
};

export const getSentNotifications = (email) => {
  const key = 'classroom_hub_sent_notifications';
  return StorageRepository.get(key, email, true) || [];
};

export const saveSentNotifications = (records, email) => {
  StorageRepository.set('classroom_hub_sent_notifications', records, email);
};

export const getDailyEmailLimit = (email) => {
  const key = 'classroom_hub_daily_email_limit';
  const stored = StorageRepository.get(key, email, true);
  const defaults = { lastSentDate: '', count: 0 };
  if (!stored) return defaults;
  return { ...defaults, ...stored };
};

const emitNotificationStateChange = (email) => {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent('classroom_hub_notifications_updated', { detail: { email } }));
  }
};

export const saveDailyEmailLimit = (limitData, email) => {
  StorageRepository.set('classroom_hub_daily_email_limit', limitData, email);
  emitNotificationStateChange(email);
};

export const getNotificationHistory = (email) => {
  const key = 'classroom_hub_notification_history';
  const stored = StorageRepository.get(key, email, true) || [];
  // Legacy entries created before Read/Unread support lacked `read`; treat them as already read
  // so upgrading does not flood the user's badge with old history.
  return stored.map(entry => ({
    ...entry,
    read: entry.read === false ? false : true
  }));
};

export const saveNotificationHistory = (logs, email) => {
  StorageRepository.set('classroom_hub_notification_history', logs, email);
  emitNotificationStateChange(email);
};

export const addNotificationHistoryLog = (logEntry, email) => {
  const logs = getNotificationHistory(email);
  const nowIso = new Date().toISOString();
  const newLog = {
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
    sentAt: nowIso,
    updatedAt: nowIso,
    read: false,
    ...logEntry
  };
  const updated = [newLog, ...logs].slice(0, 100);
  saveNotificationHistory(updated, email);
  return updated;
};

export const markNotificationRead = (id, email, read = true) => {
  const logs = getNotificationHistory(email);
  const nowIso = new Date().toISOString();
  let changed = false;
  const updated = logs.map(entry => {
    if (entry.id === id && entry.read !== read) {
      changed = true;
      return { ...entry, read, updatedAt: nowIso };
    }
    return entry;
  });
  if (changed) {
    saveNotificationHistory(updated, email);
  }
  return updated;
};

export const markAllNotificationsRead = (email) => {
  const logs = getNotificationHistory(email);
  const nowIso = new Date().toISOString();
  let changed = false;
  const updated = logs.map(entry => {
    if (!entry.read) {
      changed = true;
      return { ...entry, read: true, updatedAt: nowIso };
    }
    return entry;
  });
  if (changed) {
    saveNotificationHistory(updated, email);
  }
  return updated;
};
