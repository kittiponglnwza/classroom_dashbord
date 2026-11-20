import { initialAssignments, initialCourses, defaultProfile } from '../data/mockData';
import { StorageRepository } from '../repositories/StorageRepository';
import { STORAGE_CONFIG } from '../config/storage';
import { DEFAULT_CURRICULUM_CATEGORIES } from './academicUtils';

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

/* Caching Last Sync timestamps */
export const setLastSync = (time, email) => {
  StorageRepository.set(KEYS.lastSync, time, email);
};

export const getLastSync = (email) => {
  // Pass forceIgnoreTTL = true because lastSync is a timestamp metadata, not an expiring cache
  return StorageRepository.get(KEYS.lastSync, email, true);
};

const DELETED_IDS_KEY = 'classroom_hub_deleted_ids';
const TOMBSTONE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export const getDeletedIds = (email) => {
  if (!email) return [];
  const stored = StorageRepository.get(DELETED_IDS_KEY, email, true);
  return Array.isArray(stored) ? stored : [];
};

export const recordDeletedId = (entityType, id, email) => {
  if (!email || !id || !entityType) return;
  const current = getDeletedIds(email);
  const cutoff = Date.now() - TOMBSTONE_RETENTION_MS;
  const filtered = current.filter(entry => {
    if (!entry || !entry.id || !entry.entityType) return false;
    const t = new Date(entry.deletedAt || 0).getTime();
    if (!Number.isFinite(t) || t < cutoff) return false;
    return !(entry.entityType === entityType && String(entry.id) === String(id));
  });
  filtered.push({
    entityType,
    id: String(id),
    deletedAt: new Date().toISOString()
  });
  StorageRepository.set(DELETED_IDS_KEY, filtered.slice(-500), email);
};

/* Scoped Assignments fetching */
export const getAssignments = (email) => {
  // Pass forceIgnoreTTL = true for local rendering if required, or false for cache logic.
  // Assignments list is managed by SyncManager/ClassroomService. Here we load what is currently stored.
  const stored = StorageRepository.get(KEYS.assignments, email, true);
  if (!stored) {
    const active = email || getActiveEmail();
    if (!active) {
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
  const nowIso = new Date().toISOString();

  const mockIds = ['assign-1', 'assign-2', 'assign-3', 'assign-4', 'assign-5', 'assign-6', 'assign-7'];
  const localManualTasks = localAssignments.filter(la =>
    String(la.id).startsWith('assign-') && !mockIds.includes(la.id)
  );
  const seenIds = new Set(localManualTasks.map(la => String(la.id)));

  const uniqueApiAssignments = [];
  for (const apiAssign of apiAssignments) {
    const key = String(apiAssign?.id ?? '');
    if (!key || seenIds.has(key)) continue;
    seenIds.add(key);
    uniqueApiAssignments.push(apiAssign);
  }

  const merged = uniqueApiAssignments.map(apiAssign => {
    const localAssign = localAssignments.find(la => String(la.id) === String(apiAssign.id));

    // Merge logic: preserve notes, status, and custom dueDate modifications
    if (localAssign) {
      const apiStatus = apiAssign.status;
      // Preserve local status if submissions fetch failed (apiStatus === null)
      const resolvedStatus = apiStatus === 'done'
        ? 'done'
        : (localAssign.status || apiStatus || 'todo');
      return {
        ...apiAssign,
        dueDate: localAssign.customDueDate ? localAssign.dueDate : apiAssign.dueDate,
        customDueDate: Boolean(localAssign.customDueDate),
        notes: localAssign.notes || '',
        status: resolvedStatus,
        statusUpdatedAt: localAssign.statusUpdatedAt || undefined,
        updatedAt: localAssign.updatedAt || nowIso
      };
    }
    return {
      ...apiAssign,
      status: apiAssign.status || 'todo',
      notes: '',
      updatedAt: apiAssign.updatedAt || nowIso
    };
  });

  const finalAssignments = [...localManualTasks, ...merged];
  saveAssignments(finalAssignments, email);
  return finalAssignments;
};

export const updateAssignmentStatus = (id, status, email) => {
  const assignments = getAssignments(email);
  const nowIso = new Date().toISOString();
  const updated = assignments.map(a =>
    String(a.id) === String(id)
      ? { ...a, status, updatedAt: nowIso, statusUpdatedAt: nowIso }
      : a
  );
  saveAssignments(updated, email);
  return updated;
};

export const updateAssignmentDueDate = (id, dueDate, email) => {
  const assignments = getAssignments(email);
  const updated = assignments.map(a => String(a.id) === String(id) ? { ...a, dueDate, customDueDate: Boolean(dueDate), updatedAt: new Date().toISOString() } : a);
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
  const nowIso = new Date().toISOString();
  const newAssignment = {
    id: `assign-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    updatedAt: nowIso,
    statusUpdatedAt: nowIso,
    ...assignment
  };
  const updated = [newAssignment, ...assignments];
  saveAssignments(updated, email);
  return updated;
};

export const deleteAssignment = (id, email) => {
  const assignments = getAssignments(email);
  const updated = assignments.filter(a => String(a.id) !== String(id));
  saveAssignments(updated, email);
  if (email) {
    recordDeletedId('assignments', id, email);
  }
  return updated;
};

export const getCourses = (email) => {
  const stored = StorageRepository.get(KEYS.courses, email, true);
  if (!stored) {
    const active = email || getActiveEmail();
    if (!active) {
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
  if (email) {
    const prev = StorageRepository.get(KEYS.schedule, email, true) || [];
    const nextIds = new Set((Array.isArray(schedule) ? schedule : []).map(item => String(item?.id)));
    if (Array.isArray(prev)) {
      prev.forEach(item => {
        if (item?.id && !nextIds.has(String(item.id))) {
          recordDeletedId('schedule', item.id, email);
        }
      });
    }
  }
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

/* Academic & Graduation Data Helpers (Grades, Enrolled Courses, Curriculum Criteria) */
export const createDefaultAcademicData = () => ({
  semesters: [],
  enrolledCourses: [],
  curriculum: DEFAULT_CURRICULUM_CATEGORIES.map((c) => ({ ...c })),
  minGpax: 2.0,
  courseCategoryMap: {},
  privacyBlur: false,
  lastImportedAt: null,
  updatedAt: null
});

export const getAcademicData = (email) => {
  const stored = StorageRepository.get(KEYS.academic, email, true);
  if (!stored || typeof stored !== 'object') {
    return createDefaultAcademicData();
  }
  return {
    ...createDefaultAcademicData(),
    ...stored,
    semesters: Array.isArray(stored.semesters) ? stored.semesters : [],
    enrolledCourses: Array.isArray(stored.enrolledCourses) ? stored.enrolledCourses : [],
    curriculum:
      Array.isArray(stored.curriculum) && stored.curriculum.length > 0
        ? stored.curriculum
        : DEFAULT_CURRICULUM_CATEGORIES.map((c) => ({ ...c })),
    courseCategoryMap:
      stored.courseCategoryMap && typeof stored.courseCategoryMap === 'object'
        ? stored.courseCategoryMap
        : {}
  };
};

export const saveAcademicData = (academicData, email) => {
  const sanitized = {
    ...createDefaultAcademicData(),
    ...(academicData || {}),
    updatedAt: new Date().toISOString()
  };
  StorageRepository.set(KEYS.academic, sanitized, email);
  return sanitized;
};

export const clearAcademicLocalData = (email) => {
  if (!email) return;
  StorageRepository.remove(KEYS.academic, email);
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
    StorageRepository.remove(KEYS.topics, userEmail);
    StorageRepository.remove(KEYS.academic, userEmail);
    StorageRepository.remove(DELETED_IDS_KEY, userEmail);
    StorageRepository.remove(`classroom_hub_calendar_event_map_${userEmail}`);
    StorageRepository.remove(`classroom_hub_settings_last_updated_${userEmail}`);
    
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

const getEnvDiscordWebhookUrl = () => {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.MODE !== 'test') {
      return String(import.meta.env.VITE_DISCORD_WEBHOOK_URL || '').trim();
    }
  } catch {
    // Ignore if import.meta is unavailable
  }
  return '';
};

export const getAlertSettings = (email) => {
  const key = 'classroom_hub_alert_settings';
  const stored = StorageRepository.get(key, email, true);
  const envWebhookUrl = getEnvDiscordWebhookUrl();
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
    calendarReminderUnit: 'minutes',
    discordEnabled: Boolean(envWebhookUrl),
    discordWebhookUrl: envWebhookUrl
  };
  if (!stored) return defaults;
  const merged = { ...defaults, ...stored };
  if (!merged.discordWebhookUrl && envWebhookUrl) {
    merged.discordWebhookUrl = envWebhookUrl;
  }
  return merged;
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
