export const STORAGE_KEYS = {
  ASSIGNMENTS: 'classroom_hub_assignments',
  COURSES: 'classroom_hub_courses',
  PROFILE: 'classroom_hub_profile',
  LAST_SYNC: 'classroom_hub_last_sync',
  ACCESS_TOKEN: 'classroom_hub_access_token',
  RESOURCES: 'classroom_hub_resources',
  HIDDEN_COURSES: 'classroom_hub_hidden_courses',
  ACTIVE_EMAIL: 'classroom_hub_active_email',
  SETTINGS_LAST_UPDATED: 'classroom_hub_settings_last_updated',
  ENABLE_EMAIL_ALERTS: 'classroom_hub_enable_email_alerts',
  ALERT_SETTINGS: 'classroom_hub_alert_settings',
  SUNDAY_DIGEST_TIME: 'classroom_hub_sunday_digest_time',
  SENT_NOTIFICATIONS: 'classroom_hub_sent_notifications',
  DAILY_EMAIL_LIMIT: 'classroom_hub_daily_email_limit',
  NOTIFICATION_HISTORY: 'classroom_hub_notification_history'
};

export const STANDARD_SCOPED_KEYS = [
  STORAGE_KEYS.ASSIGNMENTS,
  STORAGE_KEYS.COURSES,
  STORAGE_KEYS.RESOURCES,
  STORAGE_KEYS.HIDDEN_COURSES,
  STORAGE_KEYS.ENABLE_EMAIL_ALERTS,
  STORAGE_KEYS.ALERT_SETTINGS,
  STORAGE_KEYS.SUNDAY_DIGEST_TIME,
  'classroom_hub_exam_results',
  STORAGE_KEYS.NOTIFICATION_HISTORY,
  STORAGE_KEYS.SENT_NOTIFICATIONS,
  STORAGE_KEYS.DAILY_EMAIL_LIMIT,
  STORAGE_KEYS.PROFILE,
  STORAGE_KEYS.LAST_SYNC
];

export const API_SCOPES = [
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.me.readonly',
  'https://www.googleapis.com/auth/classroom.student-submissions.me.readonly',
  'https://www.googleapis.com/auth/classroom.announcements.readonly',
  'https://www.googleapis.com/auth/classroom.materials.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/drive.appdata',
  'openid', 'email', 'profile'
];

export const DAILY_EMAIL_LIMIT = 3;

export const DEFAULT_ALERT_SETTINGS = {
  due3Days: true,
  due1Day: true,
  dueToday: true,
  overdue1Day: true,
  newPosts: true,
  sundayDigest: true,
  includeExams: true
};

export const COURSE_COLOR_PALETTE = ['emerald', 'blue', 'amber', 'rose', 'purple'];
