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
    strip: 'bg-[#0071E3]',
    glow: '',
    badge: 'bg-blue-50 text-[#0071E3] border-blue-200',
    accentText: 'text-[#0071E3]'
  },
  {
    theme: 'purple',
    strip: 'bg-purple-600',
    glow: '',
    badge: 'bg-purple-50 text-purple-700 border-purple-200',
    accentText: 'text-purple-700'
  },
  {
    theme: 'emerald',
    strip: 'bg-emerald-600',
    glow: '',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    accentText: 'text-emerald-700'
  },
  {
    theme: 'amber',
    strip: 'bg-amber-500',
    glow: '',
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
    accentText: 'text-amber-700'
  },
  {
    theme: 'rose',
    strip: 'bg-rose-600',
    glow: '',
    badge: 'bg-rose-50 text-rose-700 border-rose-200',
    accentText: 'text-rose-700'
  },
  {
    theme: 'indigo',
    strip: 'bg-[#0071E3]',
    glow: '',
    badge: 'bg-blue-50 text-[#0071E3] border-blue-200',
    accentText: 'text-[#0071E3]'
  }
];
