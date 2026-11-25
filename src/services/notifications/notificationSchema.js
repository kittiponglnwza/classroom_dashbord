import { DEFAULT_TIMEZONE, normalizeClockStr, normalizeTimezone } from './timeUtils';

export const PRIORITY = {
  P0_CRITICAL: 'P0',
  P1_HIGH: 'P1',
  P2_NORMAL: 'P2',
  P3_DIGEST: 'P3'
};

export const PRIORITY_RANK = {
  P0: 0,
  P1: 1,
  P2: 2,
  P3: 3
};

/**
 * Resolves priority class (P0..P3) for a notification event type & stage.
 */
export function resolveNotificationPriority(eventType, stage = '') {
  const key = `${eventType}:${stage}`.toLowerCase();

  // P0 — Critical: Exam today, Assignment due today, Rescheduled/Cancelled/Deleted alerts
  if (
    stage === 'exam_today' ||
    stage === 'due_today' ||
    stage === 'deadline_changed' ||
    stage === 'exam_changed' ||
    stage === 'exam_cancelled' ||
    stage === 'deleted' ||
    key.includes('schedule_changed')
  ) {
    return PRIORITY.P0_CRITICAL;
  }

  // P1 — High: Approaching assignment deadlines (1-3d, overdue), Exam in 1-3d, Class starting soon
  if (
    stage === 'due_1d' ||
    stage === 'due_1_day' ||
    stage === 'due_3d' ||
    stage === 'due_3_days' ||
    stage === 'overdue' ||
    stage === 'overdue_1_day' ||
    stage === 'exam_1d' ||
    stage === 'exam_3d' ||
    stage.startsWith('lead_') ||
    eventType === 'class_reminder'
  ) {
    return PRIORITY.P1_HIGH;
  }

  // P3 — Digest: Morning briefing, Daily digest, Weekly Sunday digest
  if (
    eventType === 'briefing' ||
    eventType === 'digest' ||
    stage === 'morning' ||
    stage === 'daily' ||
    stage === 'weekly' ||
    key.includes('sunday_digest')
  ) {
    return PRIORITY.P3_DIGEST;
  }

  // P2 — Normal: 7-day reminders, New assignments/announcements/materials, Submission status
  return PRIORITY.P2_NORMAL;
}

/**
 * Checks whether an event priority meets the user's minimum configured threshold.
 * E.g. minPriority = 'P2' allows P0, P1, P2 and suppresses P3.
 */
export function isPriorityAllowed(priority, minPriority = PRIORITY.P3_DIGEST) {
  const eventRank = PRIORITY_RANK[priority] ?? PRIORITY_RANK.P2;
  const maxAllowedRank = PRIORITY_RANK[minPriority] ?? PRIORITY_RANK.P3;
  return eventRank <= maxAllowedRank;
}

export const DEFAULT_ALERT_SETTINGS = {
  schemaVersion: 3,

  // Master & Delivery Authority
  discordEnabled: false,
  discordWebhookUrl: '',
  // 'browser' = Web evaluates & sends automatically on sync/open;
  // 'apps_script' = 24/7 Cloud Script is the exclusive automated sender (prevents Web+Cloud duplicates)
  deliveryAuthority: 'browser',
  embedWebhookInScript: false,
  syncWebhookToDrive: true,

  // Assignment Reminders & Lifecycle
  due7Days: true,
  due3Days: true,
  due1Day: true,
  dueToday: true,
  overdue1Day: true, // Covers overdue catch-up (1+ days overdue, once per deadline fingerprint)
  notifyDeadlineChanges: true,
  notifyDeletedAssignments: true,
  notifySubmissionStatus: false,

  // Classroom Activity (granular + legacy `newPosts` umbrella)
  newPosts: true,
  newAssignments: true,
  newAnnouncements: true,
  newMaterials: true,

  // Morning Briefing & Class Schedule
  morningBriefingEnabled: true,
  morningBriefingTime: '07:00',
  morningBriefingSendOnFreeDays: true,
  classReminderEnabled: false,
  classReminderLeadMinutes: 30,
  classReminderFinal5m: false,

  // Examination Countdown
  includeExams: true,
  examCountdownEnabled: true,
  exam7Days: true,
  exam3Days: true,
  exam1Day: true,
  examToday: true,
  notifyExamChanges: true,

  // Digests
  dailyDigestEnabled: false,
  dailyDigestTime: '20:00',
  sundayDigest: true,
  weeklyDigestDay: 'sun',
  weeklyDigestTime: '18:00',

  // Google Calendar (preserved verbatim)
  calendarReminderEnabled: true,
  calendarReminderValue: 10,
  calendarReminderUnit: 'minutes',

  // Advanced: Timezone, Quiet Hours, Priority & Retries
  timezone: DEFAULT_TIMEZONE,
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '06:30',
  quietHoursAllowCritical: true,
  minPriority: PRIORITY.P3_DIGEST,
  maxRetries: 3
};

const VALID_DAYS = new Set(['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']);
const VALID_PRIORITIES = new Set(['P0', 'P1', 'P2', 'P3']);
const VALID_AUTHORITIES = new Set(['browser', 'apps_script']);

/**
 * Safely migrates & normalizes stored alert settings without resetting any existing user preference.
 */
export function migrateAlertSettings(stored = null, legacySundayTime = '18:00') {
  const safeSundayTime = normalizeClockStr(legacySundayTime, '18:00');
  if (!stored || typeof stored !== 'object') {
    return {
      ...DEFAULT_ALERT_SETTINGS,
      weeklyDigestTime: safeSundayTime
    };
  }

  const raw = { ...stored };

  // Synchronize legacy `newPosts` umbrella with granular Classroom Activity flags
  const hasGranularActivity =
    typeof raw.newAssignments === 'boolean' ||
    typeof raw.newAnnouncements === 'boolean' ||
    typeof raw.newMaterials === 'boolean';

  const baseNewPosts = typeof raw.newPosts === 'boolean' ? raw.newPosts : true;
  const newAssignments = typeof raw.newAssignments === 'boolean' ? raw.newAssignments : baseNewPosts;
  const newAnnouncements = typeof raw.newAnnouncements === 'boolean' ? raw.newAnnouncements : baseNewPosts;
  const newMaterials = typeof raw.newMaterials === 'boolean' ? raw.newMaterials : baseNewPosts;

  // If caller explicitly set `newPosts: false` without granular overrides, turn all off;
  // otherwise `newPosts` is true whenever at least one granular activity channel is enabled.
  const resolvedNewPosts = hasGranularActivity
    ? (newAssignments || newAnnouncements || newMaterials)
    : baseNewPosts;

  const leadRaw = parseInt(raw.classReminderLeadMinutes, 10);
  const classReminderLeadMinutes = Number.isFinite(leadRaw)
    ? Math.min(Math.max(leadRaw, 5), 120)
    : DEFAULT_ALERT_SETTINGS.classReminderLeadMinutes;

  const retriesRaw = parseInt(raw.maxRetries, 10);
  const maxRetries = Number.isFinite(retriesRaw)
    ? Math.min(Math.max(retriesRaw, 0), 5)
    : DEFAULT_ALERT_SETTINGS.maxRetries;

  return {
    ...DEFAULT_ALERT_SETTINGS,
    ...raw,
    schemaVersion: 3,
    discordEnabled: Boolean(raw.discordEnabled ?? DEFAULT_ALERT_SETTINGS.discordEnabled),
    discordWebhookUrl: typeof raw.discordWebhookUrl === 'string' ? raw.discordWebhookUrl : '',
    deliveryAuthority: VALID_AUTHORITIES.has(raw.deliveryAuthority)
      ? raw.deliveryAuthority
      : DEFAULT_ALERT_SETTINGS.deliveryAuthority,
    embedWebhookInScript: Boolean(raw.embedWebhookInScript ?? false),
    syncWebhookToDrive: Boolean(raw.syncWebhookToDrive ?? true),

    due7Days: Boolean(raw.due7Days ?? DEFAULT_ALERT_SETTINGS.due7Days),
    due3Days: Boolean(raw.due3Days ?? DEFAULT_ALERT_SETTINGS.due3Days),
    due1Day: Boolean(raw.due1Day ?? DEFAULT_ALERT_SETTINGS.due1Day),
    dueToday: Boolean(raw.dueToday ?? DEFAULT_ALERT_SETTINGS.dueToday),
    overdue1Day: Boolean(raw.overdue1Day ?? DEFAULT_ALERT_SETTINGS.overdue1Day),
    notifyDeadlineChanges: Boolean(raw.notifyDeadlineChanges ?? DEFAULT_ALERT_SETTINGS.notifyDeadlineChanges),
    notifyDeletedAssignments: Boolean(raw.notifyDeletedAssignments ?? DEFAULT_ALERT_SETTINGS.notifyDeletedAssignments),
    notifySubmissionStatus: Boolean(raw.notifySubmissionStatus ?? DEFAULT_ALERT_SETTINGS.notifySubmissionStatus),

    newPosts: resolvedNewPosts,
    newAssignments: resolvedNewPosts ? newAssignments : false,
    newAnnouncements: resolvedNewPosts ? newAnnouncements : false,
    newMaterials: resolvedNewPosts ? newMaterials : false,

    morningBriefingEnabled: Boolean(raw.morningBriefingEnabled ?? DEFAULT_ALERT_SETTINGS.morningBriefingEnabled),
    morningBriefingTime: normalizeClockStr(raw.morningBriefingTime, DEFAULT_ALERT_SETTINGS.morningBriefingTime),
    morningBriefingSendOnFreeDays: Boolean(
      raw.morningBriefingSendOnFreeDays ?? DEFAULT_ALERT_SETTINGS.morningBriefingSendOnFreeDays
    ),
    classReminderEnabled: Boolean(raw.classReminderEnabled ?? DEFAULT_ALERT_SETTINGS.classReminderEnabled),
    classReminderLeadMinutes,
    classReminderFinal5m: Boolean(raw.classReminderFinal5m ?? DEFAULT_ALERT_SETTINGS.classReminderFinal5m),

    includeExams: Boolean(raw.includeExams ?? DEFAULT_ALERT_SETTINGS.includeExams),
    examCountdownEnabled: Boolean(raw.examCountdownEnabled ?? DEFAULT_ALERT_SETTINGS.examCountdownEnabled),
    exam7Days: Boolean(raw.exam7Days ?? DEFAULT_ALERT_SETTINGS.exam7Days),
    exam3Days: Boolean(raw.exam3Days ?? DEFAULT_ALERT_SETTINGS.exam3Days),
    exam1Day: Boolean(raw.exam1Day ?? DEFAULT_ALERT_SETTINGS.exam1Day),
    examToday: Boolean(raw.examToday ?? DEFAULT_ALERT_SETTINGS.examToday),
    notifyExamChanges: Boolean(raw.notifyExamChanges ?? DEFAULT_ALERT_SETTINGS.notifyExamChanges),

    dailyDigestEnabled: Boolean(raw.dailyDigestEnabled ?? DEFAULT_ALERT_SETTINGS.dailyDigestEnabled),
    dailyDigestTime: normalizeClockStr(raw.dailyDigestTime, DEFAULT_ALERT_SETTINGS.dailyDigestTime),
    sundayDigest: Boolean(raw.sundayDigest ?? DEFAULT_ALERT_SETTINGS.sundayDigest),
    weeklyDigestDay: VALID_DAYS.has(raw.weeklyDigestDay) ? raw.weeklyDigestDay : 'sun',
    weeklyDigestTime: normalizeClockStr(raw.weeklyDigestTime || safeSundayTime, safeSundayTime),

    timezone: normalizeTimezone(raw.timezone, DEFAULT_TIMEZONE),
    quietHoursEnabled: Boolean(raw.quietHoursEnabled ?? DEFAULT_ALERT_SETTINGS.quietHoursEnabled),
    quietHoursStart: normalizeClockStr(raw.quietHoursStart, DEFAULT_ALERT_SETTINGS.quietHoursStart),
    quietHoursEnd: normalizeClockStr(raw.quietHoursEnd, DEFAULT_ALERT_SETTINGS.quietHoursEnd),
    quietHoursAllowCritical: Boolean(raw.quietHoursAllowCritical ?? DEFAULT_ALERT_SETTINGS.quietHoursAllowCritical),
    minPriority: VALID_PRIORITIES.has(raw.minPriority) ? raw.minPriority : PRIORITY.P3_DIGEST,
    maxRetries
  };
}
