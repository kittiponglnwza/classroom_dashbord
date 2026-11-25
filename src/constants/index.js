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
  'https://www.googleapis.com/auth/classroom.topics.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/drive.appdata',
  'openid', 'email', 'profile'
];

export const DAILY_EMAIL_LIMIT = 10;

export const DEFAULT_ALERT_SETTINGS = {
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

export const COURSE_COLOR_PALETTE = ['emerald', 'blue', 'amber', 'rose', 'purple'];

export const EXAM_CARD_COLORS = [
  {
    theme: 'blue',
    strip: 'bg-[var(--primary)]',
    glow: '',
    badge: 'bg-[var(--app-bg)] text-[var(--primary-bright)] border-[var(--border-strong)]',
    accentText: 'text-[var(--primary-bright)]'
  },
  {
    theme: 'emerald',
    strip: 'bg-emerald-500/80',
    glow: '',
    badge: 'bg-[var(--app-bg)] text-emerald-400 border-[var(--border-strong)]',
    accentText: 'text-emerald-400'
  },
  {
    theme: 'amber',
    strip: 'bg-amber-500/80',
    glow: '',
    badge: 'bg-[var(--app-bg)] text-amber-400 border-[var(--border-strong)]',
    accentText: 'text-amber-400'
  },
  {
    theme: 'slate',
    strip: 'bg-[var(--text-muted)]',
    glow: '',
    badge: 'bg-[var(--app-bg)] text-[var(--text-primary)] border-[var(--border-strong)]',
    accentText: 'text-[var(--text-secondary)]'
  },
  {
    theme: 'rose',
    strip: 'bg-rose-500/80',
    glow: '',
    badge: 'bg-[var(--app-bg)] text-rose-400 border-[var(--border-strong)]',
    accentText: 'text-rose-400'
  },
  {
    theme: 'indigo',
    strip: 'bg-[var(--primary)]',
    glow: '',
    badge: 'bg-[var(--app-bg)] text-[var(--primary-bright)] border-[var(--border-strong)]',
    accentText: 'text-[var(--primary-bright)]'
  }
];
