import { DiscordService } from '../services/DiscordService';
import { sanitizeExternalUrl } from './sanitize';
import { resolveExamIsoDate } from './courseEndDate';
import { DEFAULT_TIMEZONE, normalizeClockStr, normalizeTimezone } from '../services/notifications/timeUtils';

/**
 * Sanitizes a compact schedule & exam fallback snapshot for optional Apps Script offline fallback
 * (contains zero credentials, zero tokens, zero student IDs — only course codes/titles/times/rooms).
 */
function sanitizeAcademicFallback(schedule = [], mergedExams = []) {
  const safeSchedule = (Array.isArray(schedule) ? schedule : [])
    .filter((s) => s && s.day && s.startTime && s.endTime && !s.deletedAt)
    .slice(0, 40)
    .map((s) => ({
      id: String(s.id || '').slice(0, 48),
      title: String(s.title || s.courseCode || 'Class').slice(0, 80),
      courseCode: String(s.courseCode || '').slice(0, 24),
      day: String(s.day || '').slice(0, 8),
      date: s.date ? String(s.date).slice(0, 10) : '',
      endDate: s.endDate ? String(s.endDate).slice(0, 10) : '',
      startTime: String(s.startTime || '').slice(0, 5),
      endTime: String(s.endTime || '').slice(0, 5),
      room: String(s.room || '').slice(0, 60)
    }));

  const safeExams = (Array.isArray(mergedExams) ? mergedExams : [])
    .map((ex) => {
      const iso = resolveExamIsoDate(ex);
      if (!iso) return null;
      return {
        id: String(ex.id || '').slice(0, 64),
        subject: String(ex.subjectName || ex.courseName || ex.courseCode || 'Exam').slice(0, 90),
        courseCode: String(ex.subjectCode || ex.courseCode || '').slice(0, 24),
        dateIso: iso,
        dateLabel: String(ex.date || iso).slice(0, 40),
        time: String(ex.time || '').slice(0, 30),
        room: String(ex.room || '').slice(0, 60),
        seat: String(ex.seat || '').slice(0, 60)
      };
    })
    .filter(Boolean)
    .slice(0, 30);

  return { schedule: safeSchedule, exams: safeExams };
}

/**
 * Generates a self-contained, production-ready Google Apps Script (`Code.gs`) for 24/7 background
 * notifications via Discord Webhook (and optionally Gmail), supporting:
 * - Assignment Reminders (7d / 3d / 1d / Due Today / Overdue catch-up + deadline-change re-arming)
 * - Classroom Activity (New Assignments, Announcements, and CourseWorkMaterials)
 * - 07:00 Morning Briefing & Pre-Class Reminders (via Google Calendar `chSource=classroom-hub` + fallback)
 * - Examination Countdown (7d / 3d / 1d / Exam Day)
 * - Weekly Academic Report (Sunday Digest)
 * - LockService concurrency protection, chunked PropertiesService ledger, Quiet Hours, and Secret Hygiene.
 */
export function getAppsScriptTemplate(hiddenCourseIds = [], options = {}) {
  const safeHiddenIds = Array.isArray(hiddenCourseIds)
    ? hiddenCourseIds.map((id) => String(id).trim()).filter(Boolean)
    : [];
  const hiddenArrayStr = JSON.stringify(safeHiddenIds);

  const webhookCheck = DiscordService.validateWebhookUrl(options?.discordWebhookUrl || '');
  const shouldEmbedWebhook = options?.embedWebhook !== false;
  const safeWebhookUrl =
    shouldEmbedWebhook && webhookCheck.valid && webhookCheck.url
      ? webhookCheck.url
      : 'YOUR_DISCORD_WEBHOOK_URL_HERE';

  const enableDiscord = options?.enableDiscord !== undefined ? Boolean(options.enableDiscord) : true;
  const enableEmail = options?.enableEmail !== undefined ? Boolean(options.enableEmail) : false;
  const notifyNewPosts = options?.notifyNewPosts !== undefined ? Boolean(options.notifyNewPosts) : true;
  const notifyNewAssignments = options?.notifyNewAssignments !== undefined ? Boolean(options.notifyNewAssignments) : notifyNewPosts;
  const notifyNewAnnouncements = options?.notifyNewAnnouncements !== undefined ? Boolean(options.notifyNewAnnouncements) : notifyNewPosts;
  const notifyNewMaterials = options?.notifyNewMaterials !== undefined ? Boolean(options.notifyNewMaterials) : notifyNewPosts;

  const due7Days = options?.due7Days !== undefined ? Boolean(options.due7Days) : false;
  const due3Days = options?.due3Days !== undefined ? Boolean(options.due3Days) : true;
  const due1Day = options?.due1Day !== undefined ? Boolean(options.due1Day) : true;
  const dueToday = options?.dueToday !== undefined ? Boolean(options.dueToday) : true;
  const overdueEnabled = options?.overdue1Day !== undefined ? Boolean(options.overdue1Day) : true;

  const enableMorningBriefing = options?.morningBriefingEnabled !== undefined ? Boolean(options.morningBriefingEnabled) : false;
  const morningBriefingTime = normalizeClockStr(options?.morningBriefingTime, '07:00');
  const morningBriefingFreeDays =
    options?.morningBriefingSendOnFreeDays !== undefined ? Boolean(options.morningBriefingSendOnFreeDays) : true;

  const enableClassReminder = options?.classReminderEnabled !== undefined ? Boolean(options.classReminderEnabled) : false;
  const classReminderLeadMinutes = Math.min(Math.max(Number(options?.classReminderLeadMinutes ?? 30) || 30, 5), 120);
  const classReminderFinal5m = options?.classReminderFinal5m !== undefined ? Boolean(options.classReminderFinal5m) : false;

  const enableExamCountdown = options?.examCountdownEnabled !== undefined ? Boolean(options.examCountdownEnabled) : false;
  const examStages = {
    d7: options?.exam7Days !== undefined ? Boolean(options.exam7Days) : true,
    d3: options?.exam3Days !== undefined ? Boolean(options.exam3Days) : true,
    d1: options?.exam1Day !== undefined ? Boolean(options.exam1Day) : true,
    d0: options?.examToday !== undefined ? Boolean(options.examToday) : true
  };

  const enableDailyDigest = options?.dailyDigestEnabled !== undefined ? Boolean(options.dailyDigestEnabled) : false;
  const dailyDigestTime = normalizeClockStr(options?.dailyDigestTime, '20:00');
  const enableWeeklyDigest = options?.sundayDigest !== undefined ? Boolean(options.sundayDigest) : false;
  const validWeekdays = new Set(['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']);
  const weeklyDigestDay = validWeekdays.has(String(options?.weeklyDigestDay || '').toLowerCase())
    ? String(options.weeklyDigestDay).toLowerCase()
    : 'sun';
  const weeklyDigestTime = normalizeClockStr(options?.weeklyDigestTime, '18:00');

  const quietHoursEnabled = Boolean(options?.quietHoursEnabled ?? false);
  const quietHoursStart = normalizeClockStr(options?.quietHoursStart, '22:00');
  const quietHoursEnd = normalizeClockStr(options?.quietHoursEnd, '06:30');
  const quietHoursAllowCritical = options?.quietHoursAllowCritical !== undefined ? Boolean(options.quietHoursAllowCritical) : true;
  const validPriorities = new Set(['P0', 'P1', 'P2', 'P3']);
  const minPriority = validPriorities.has(String(options?.minPriority || '').toUpperCase())
    ? String(options.minPriority).toUpperCase()
    : 'P3';

  const timeZone = normalizeTimezone(options?.timezone, DEFAULT_TIMEZONE);
  const maxRetries = Math.min(Math.max(Number(options?.maxRetries ?? 2), 1), 4);
  const safeDashboardUrl = sanitizeExternalUrl(options?.dashboardUrl) || 'https://classrooms-hub.vercel.app/';
  const safeAvatarUrl = DiscordService.resolveAvatarUrl(options?.avatarUrl);

  const fallbackSnapshot = sanitizeAcademicFallback(options?.schedule, options?.mergedExams);

  return `/**
 * ============================================================================
 * Classroom Hub: 24/7 Personal Academic Assistant (Google Apps Script)
 * ============================================================================
 *
 * Quick 24/7 Setup Instructions:
 * 1. Open https://script.google.com -> click "New Project" and paste this file into Code.gs (Save Ctrl+S).
 * 2. Left sidebar "Services (+)" -> Add "Google Classroom API" (required)
 *    and "Google Calendar API" (recommended for live Timetable & Exam Seating sync).
 * 3. If you did NOT embed the Webhook URL when copying:
 *    Open Project Settings (gear icon) -> Script Properties -> Add property:
 *      Property: DISCORD_WEBHOOK_URL
 *      Value:    https://discord.com/api/webhooks/<ID>/<TOKEN>
 * 4. One-Click 24/7 Activation:
 *    Select "install24x7Trigger" in the top toolbar dropdown and click "Run" ONCE!
 *    (Grant Google permission when prompted -> it automatically creates a 15-minute 24/7 trigger
 *    and sends an instant confirmation message to your Discord channel.)
 */

var CONFIG = {
  DISCORD_WEBHOOK_URL: ${JSON.stringify(safeWebhookUrl)},
  ENABLE_DISCORD: ${JSON.stringify(enableDiscord)},
  ENABLE_EMAIL: ${JSON.stringify(enableEmail)},
  NOTIFY_NEW_POSTS: ${JSON.stringify(notifyNewPosts)},
  NOTIFY_NEW_ASSIGNMENTS: ${JSON.stringify(notifyNewAssignments)},
  NOTIFY_NEW_ANNOUNCEMENTS: ${JSON.stringify(notifyNewAnnouncements)},
  NOTIFY_NEW_MATERIALS: ${JSON.stringify(notifyNewMaterials)},
  DUE_7_DAYS: ${JSON.stringify(due7Days)},
  DUE_3_DAYS: ${JSON.stringify(due3Days)},
  DUE_1_DAY: ${JSON.stringify(due1Day)},
  DUE_TODAY: ${JSON.stringify(dueToday)},
  OVERDUE_ENABLED: ${JSON.stringify(overdueEnabled)},
  ENABLE_MORNING_BRIEFING: ${JSON.stringify(enableMorningBriefing)},
  MORNING_BRIEFING_TIME: ${JSON.stringify(morningBriefingTime)},
  MORNING_BRIEFING_FREE_DAYS: ${JSON.stringify(morningBriefingFreeDays)},
  ENABLE_CLASS_REMINDER: ${JSON.stringify(enableClassReminder)},
  CLASS_REMINDER_LEAD_MINUTES: ${JSON.stringify(classReminderLeadMinutes)},
  CLASS_REMINDER_FINAL_5M: ${JSON.stringify(classReminderFinal5m)},
  ENABLE_EXAM_COUNTDOWN: ${JSON.stringify(enableExamCountdown)},
  EXAM_STAGES: ${JSON.stringify(examStages)},
  ENABLE_DAILY_DIGEST: ${JSON.stringify(enableDailyDigest)},
  DAILY_DIGEST_TIME: ${JSON.stringify(dailyDigestTime)},
  ENABLE_WEEKLY_DIGEST: ${JSON.stringify(enableWeeklyDigest)},
  WEEKLY_DIGEST_DAY: ${JSON.stringify(weeklyDigestDay)},
  WEEKLY_DIGEST_TIME: ${JSON.stringify(weeklyDigestTime)},
  QUIET_HOURS_ENABLED: ${JSON.stringify(quietHoursEnabled)},
  QUIET_HOURS_START: ${JSON.stringify(quietHoursStart)},
  QUIET_HOURS_END: ${JSON.stringify(quietHoursEnd)},
  QUIET_HOURS_ALLOW_CRITICAL: ${JSON.stringify(quietHoursAllowCritical)},
  MIN_PRIORITY: ${JSON.stringify(minPriority)},
  HIDDEN_COURSE_IDS: ${hiddenArrayStr},
  DASHBOARD_URL: ${JSON.stringify(safeDashboardUrl)},
  AVATAR_URL: ${JSON.stringify(safeAvatarUrl)},
  TIMEZONE: ${JSON.stringify(timeZone)},
  MAX_RETRIES: ${JSON.stringify(maxRetries)},
  STORAGE_KEY_V2: 'ch_notified_records_v2',
  LEDGER_CHUNK_PREFIX: 'ch_ledger_v3_',
  LEDGER_CHUNK_COUNT: 4,
  MAX_STORED_RECORDS: 600,
  FALLBACK_SNAPSHOT: ${JSON.stringify(fallbackSnapshot)}
};

function escapeHtmlScript(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function sanitizeSafeUrl(url) {
  if (!url) return '';
  var s = String(url).trim();
  return /^https?:\\/\\//i.test(s) ? s : '';
}

function scrubWebhookSecrets_(text) {
  if (!text) return '';
  return String(text).replace(
    /https?:\\/\\/(?:ptb\\.|canary\\.)?discord(?:app)?\\.com\\/api(?:\\/v\\d+)?\\/webhooks\\/\\d+\\/[A-Za-z0-9._-]+/gi,
    '[REDACTED_WEBHOOK]'
  );
}

function truncateText(str, maxLen, fallback) {
  var fb = fallback !== undefined ? fallback : '-';
  if (str === null || str === undefined) return fb;
  var clean = String(str).trim();
  if (!clean) return fb;
  if (clean.length <= maxLen) return clean;
  return clean.substring(0, Math.max(1, maxLen - 1)) + '…';
}

/**
 * One-time helper to store your Discord Webhook URL in Script Properties instead of source code.
 */
function setupDiscordWebhook(webhookUrl) {
  if (!isValidDiscordWebhook(webhookUrl)) {
    Logger.log('[FAIL] Invalid Discord Webhook URL format.');
    return false;
  }
  PropertiesService.getScriptProperties().setProperty('DISCORD_WEBHOOK_URL', String(webhookUrl).trim());
  Logger.log('[OK] Saved DISCORD_WEBHOOK_URL to Script Properties. Remove any plaintext URL from Code.gs.');
  return true;
}

function resolveDiscordWebhookUrl() {
  try {
    var fromProps = PropertiesService.getScriptProperties().getProperty('DISCORD_WEBHOOK_URL');
    if (fromProps && isValidDiscordWebhook(fromProps)) {
      return String(fromProps).trim();
    }
  } catch (e) {}
  var fromConfig = String(CONFIG.DISCORD_WEBHOOK_URL || '').trim();
  if (fromConfig && fromConfig !== 'YOUR_DISCORD_WEBHOOK_URL_HERE') {
    return fromConfig;
  }
  return '';
}

function isValidDiscordWebhook(url) {
  if (!url) return false;
  return /^https:\\/\\/(?:ptb\\.|canary\\.)?discord(?:app)?\\.com\\/api(?:\\/v\\d+)?\\/webhooks\\/\\d+\\/[A-Za-z0-9._-]+/i.test(String(url).trim());
}

function formatIsoDateInTz_(dateObj, tz) {
  try {
    var s = Utilities.formatDate(dateObj, tz || CONFIG.TIMEZONE, 'yyyy-MM-dd');
    if (/^\\d{4}-\\d{2}-\\d{2}$/.test(s)) return s;
  } catch (e) {}
  var bkk = new Date(dateObj.getTime() + 7 * 60 * 60 * 1000);
  return bkk.toISOString().slice(0, 10);
}

function getMinutesOfDayInTz_(dateObj, tz) {
  try {
    var hm = Utilities.formatDate(dateObj, tz || CONFIG.TIMEZONE, 'HH:mm');
    var m = String(hm).match(/^(\\d{1,2}):(\\d{2})$/);
    if (m) return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  } catch (e) {}
  var bkk = new Date(dateObj.getTime() + 7 * 60 * 60 * 1000);
  return bkk.getUTCHours() * 60 + bkk.getUTCMinutes();
}

function parseClockMins_(hhmm, fallback) {
  var m = String(hhmm || '').trim().match(/^(\\d{1,2}):(\\d{2})$/);
  if (!m) return fallback;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

function diffIsoDays_(laterIso, earlierIso) {
  var a = String(laterIso || '').split('-');
  var b = String(earlierIso || '').split('-');
  if (a.length !== 3 || b.length !== 3) return null;
  var u1 = Date.UTC(parseInt(a[0], 10), parseInt(a[1], 10) - 1, parseInt(a[2], 10));
  var u2 = Date.UTC(parseInt(b[0], 10), parseInt(b[1], 10) - 1, parseInt(b[2], 10));
  return Math.round((u1 - u2) / 86400000);
}

function isQuietHoursBlocked_(now, isCritical) {
  if (!CONFIG.QUIET_HOURS_ENABLED) return false;
  if (isCritical && CONFIG.QUIET_HOURS_ALLOW_CRITICAL) return false;
  var startM = parseClockMins_(CONFIG.QUIET_HOURS_START, 22 * 60);
  var endM = parseClockMins_(CONFIG.QUIET_HOURS_END, 6 * 60 + 30);
  if (startM === endM) return false;
  var curM = getMinutesOfDayInTz_(now, CONFIG.TIMEZONE);
  if (startM < endM) return curM >= startM && curM < endM;
  return curM >= startM || curM < endM;
}

function getWeekdayKeyInTz_(dateObj, tz) {
  var validDays = { sun: 1, mon: 1, tue: 1, wed: 1, thu: 1, fri: 1, sat: 1 };
  try {
    var s = String(Utilities.formatDate(dateObj, tz || CONFIG.TIMEZONE, 'EEE') || '')
      .toLowerCase()
      .slice(0, 3);
    if (validDays[s]) return s;
  } catch (e) {}
  var dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  var bkk = new Date(dateObj.getTime() + 7 * 60 * 60 * 1000);
  return dayNames[bkk.getUTCDay()];
}

function isPriorityAllowedInScript_(priority) {
  var ranks = { P0: 0, P1: 1, P2: 2, P3: 3 };
  var pRank = ranks[priority] !== undefined ? ranks[priority] : 2;
  var minRank = ranks[CONFIG.MIN_PRIORITY] !== undefined ? ranks[CONFIG.MIN_PRIORITY] : 3;
  return pRank <= minRank;
}

/**
 * Multi-chunk PropertiesService ledger (avoids 9KB single-property quota limit)
 * while maintaining seamless read compatibility with legacy STORAGE_KEY_V2.
 */
function loadLedgerMap_(props) {
  var merged = {};
  try {
    var legacy = JSON.parse(props.getProperty(CONFIG.STORAGE_KEY_V2) || '{}');
    for (var lk in legacy) {
      if (Object.prototype.hasOwnProperty.call(legacy, lk)) merged[lk] = legacy[lk];
    }
  } catch (e) {}

  for (var c = 0; c < CONFIG.LEDGER_CHUNK_COUNT; c++) {
    try {
      var raw = props.getProperty(CONFIG.LEDGER_CHUNK_PREFIX + c);
      if (!raw) continue;
      var parsed = JSON.parse(raw);
      for (var k in parsed) {
        if (Object.prototype.hasOwnProperty.call(parsed, k)) merged[k] = parsed[k];
      }
    } catch (e) {}
  }
  return merged;
}

function saveLedgerMap_(props, mapObj) {
  var keys = Object.keys(mapObj || {});
  if (keys.length > CONFIG.MAX_STORED_RECORDS) {
    keys = keys.slice(keys.length - CONFIG.MAX_STORED_RECORDS);
  }
  var chunks = [];
  for (var i = 0; i < CONFIG.LEDGER_CHUNK_COUNT; i++) chunks.push({});
  for (var idx = 0; idx < keys.length; idx++) {
    var k = keys[idx];
    chunks[idx % CONFIG.LEDGER_CHUNK_COUNT][k] = mapObj[k];
  }
  for (var c = 0; c < CONFIG.LEDGER_CHUNK_COUNT; c++) {
    props.setProperty(CONFIG.LEDGER_CHUNK_PREFIX + c, JSON.stringify(chunks[c]));
  }
  // Keep compact recent mirror in STORAGE_KEY_V2 for diagnostic compatibility
  var v2Mirror = {};
  var tail = keys.slice(-200);
  for (var t = 0; t < tail.length; t++) v2Mirror[tail[t]] = mapObj[tail[t]];
  props.setProperty(CONFIG.STORAGE_KEY_V2, JSON.stringify(v2Mirror));
}

/**
 * Posts payload to Discord Webhook with HTTP 429 Retry-After & 5xx exponential backoff.
 */
function postDiscordWebhookWithRetry(webhookUrl, payload) {
  if (!isValidDiscordWebhook(webhookUrl)) {
    Logger.log('[Discord][ERROR] Invalid or missing Webhook URL. Set DISCORD_WEBHOOK_URL in Script Properties.');
    return { ok: false, status: 0, error: 'INVALID_WEBHOOK_URL' };
  }

  var options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  var totalAttempts = Math.max(2, (CONFIG.MAX_RETRIES || 2) + 1);
  for (var attempt = 1; attempt <= totalAttempts; attempt++) {
    try {
      var response = UrlFetchApp.fetch(webhookUrl, options);
      var status = response.getResponseCode();
      var bodyText = response.getContentText() || '';

      if (status >= 200 && status < 300) {
        Logger.log('[Discord][OK] Sent webhook successfully (HTTP ' + status + ' on attempt ' + attempt + ').');
        return { ok: true, status: status };
      }

      if (status === 429 && attempt < totalAttempts) {
        var sleepMs = 1500;
        try {
          var parsed429 = JSON.parse(bodyText);
          if (parsed429 && typeof parsed429.retry_after === 'number') {
            sleepMs = Math.min(5000, Math.max(500, Math.ceil(parsed429.retry_after * 1000)));
          }
        } catch (e) {}
        Logger.log('[Discord][WARN] Rate limited (HTTP 429). Sleeping ' + sleepMs + 'ms before retry...');
        Utilities.sleep(sleepMs);
        continue;
      }

      if (status >= 500 && status <= 599 && attempt < totalAttempts) {
        var backoffMs = Math.min(4000, 600 * Math.pow(2, attempt - 1));
        Logger.log('[Discord][WARN] Upstream HTTP ' + status + '. Sleeping ' + backoffMs + 'ms before retry...');
        Utilities.sleep(backoffMs);
        continue;
      }

      Logger.log('[Discord][ERROR] HTTP ' + status + ' Response: ' + scrubWebhookSecrets_(bodyText));
      return { ok: false, status: status, error: scrubWebhookSecrets_(bodyText) };
    } catch (err) {
      var cleanErr = scrubWebhookSecrets_(err.toString());
      Logger.log('[Discord][EXCEPTION] Attempt ' + attempt + ' failed: ' + cleanErr);
      if (attempt === totalAttempts) {
        return { ok: false, status: -1, error: cleanErr };
      }
      Utilities.sleep(Math.min(3000, 800 * attempt));
    }
  }
  return { ok: false, status: -1, error: 'UNKNOWN_FAILURE' };
}

/**
 * Reads synced Schedule & Exam events from Google Calendar (pushed by Classroom Hub web sync)
 * and falls back per-feed to CONFIG.FALLBACK_SNAPSHOT when Calendar service is disabled or has
 * not synced Classroom Hub events yet (fixes empty-Calendar shadowing bug).
 */
function readHubAcademicCalendar_(now) {
  var todayIso = formatIsoDateInTz_(now, CONFIG.TIMEZONE);
  var todayKey = getWeekdayKeyInTz_(now, CONFIG.TIMEZONE);

  var snap = CONFIG.FALLBACK_SNAPSHOT || { schedule: [], exams: [] };
  var snapClasses = [];
  var schedList = snap.schedule || [];
  for (var s = 0; s < schedList.length; s++) {
    var entry = schedList[s];
    if (entry.endDate && todayIso > entry.endDate) continue;
    if ((entry.date && entry.date === todayIso) || (!entry.date && entry.day === todayKey)) {
      snapClasses.push(entry);
    }
  }

  var snapExams = [];
  var examList = snap.exams || [];
  for (var x = 0; x < examList.length; x++) {
    if (examList[x].dateIso && examList[x].dateIso >= todayIso) {
      snapExams.push(examList[x]);
    }
  }

  if (typeof Calendar !== 'undefined' && Calendar.Events && typeof Calendar.Events.list === 'function') {
    try {
      var startWindow = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      var endWindow = new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000).toISOString();
      var calRes = Calendar.Events.list('primary', {
        privateExtendedProperty: 'chSource=classroom-hub',
        timeMin: startWindow,
        timeMax: endWindow,
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 250
      });
      var items = (calRes && calRes.items) ? calRes.items : [];
      var calTodayClasses = [];
      var calUpcomingExams = [];
      var hasSyncedSchedule = false;
      var hasSyncedExams = false;

      for (var i = 0; i < items.length; i++) {
        var ev = items[i];
        if (!ev || ev.status === 'cancelled' || !ev.start || !ev.start.dateTime) continue;
        var priv = (ev.extendedProperties && ev.extendedProperties.private) ? ev.extendedProperties.private : {};
        var evStart = new Date(ev.start.dateTime);
        var evIso = formatIsoDateInTz_(evStart, CONFIG.TIMEZONE);

        if (priv.chType === 'schedule') {
          hasSyncedSchedule = true;
          if (evIso === todayIso) {
            calTodayClasses.push({
              id: priv.chId || ev.id,
              title: ev.summary || 'Class',
              courseCode: priv.chCode || '',
              startTime: priv.chStart || Utilities.formatDate(evStart, CONFIG.TIMEZONE, 'HH:mm'),
              endTime: priv.chEnd || '',
              room: priv.chRoom || ev.location || ''
            });
          }
        } else if (priv.chType === 'exam') {
          hasSyncedExams = true;
          if (evIso >= todayIso) {
            calUpcomingExams.push({
              id: priv.chId || ev.id,
              subject: ev.summary || 'Examination',
              courseCode: priv.chCode || '',
              dateIso: evIso,
              dateLabel: evIso,
              time: (priv.chStart && priv.chEnd) ? (priv.chStart + ' - ' + priv.chEnd) : '',
              room: priv.chRoom || ev.location || '',
              seat: priv.chSeat || ''
            });
          }
        }
      }

      return {
        todayClasses: hasSyncedSchedule ? calTodayClasses : snapClasses,
        upcomingExams: hasSyncedExams ? calUpcomingExams : snapExams,
        source: (hasSyncedSchedule || hasSyncedExams) ? 'calendar_api' : 'snapshot'
      };
    } catch (calErr) {
      Logger.log('[INFO] Calendar API unavailable, using fallback snapshot: ' + calErr.toString());
    }
  }

  return { todayClasses: snapClasses, upcomingExams: snapExams, source: 'snapshot' };
}

/**
 * One-Click 24/7 Trigger Installer:
 * Select "install24x7Trigger" in the Apps Script toolbar and click "Run" ONCE.
 * Automatically removes duplicate triggers, schedules sendClassroomDigest every 15 minutes 24/7,
 * verifies your Discord Webhook, and posts a live activation message to Discord.
 */
function install24x7Trigger() {
  Logger.log('=== [Classroom Hub: install24x7Trigger] ===');
  var webhookUrl = resolveDiscordWebhookUrl();
  if (!isValidDiscordWebhook(webhookUrl)) {
    Logger.log('[ERROR] Discord Webhook URL is not configured yet!');
    Logger.log('-> Option A (Easiest): On Classroom Hub web Settings, check "Embed Discord Webhook URL" and re-copy this script.');
    Logger.log('-> Option B: In Apps Script Project Settings (gear icon) -> Script Properties -> add DISCORD_WEBHOOK_URL.');
    return false;
  }

  var triggerCreated = false;
  if (typeof ScriptApp !== 'undefined' && ScriptApp && typeof ScriptApp.newTrigger === 'function') {
    var existing = ScriptApp.getProjectTriggers ? ScriptApp.getProjectTriggers() : [];
    var removedCount = 0;
    for (var i = 0; i < existing.length; i++) {
      if (existing[i].getHandlerFunction && existing[i].getHandlerFunction() === 'sendClassroomDigest') {
        ScriptApp.deleteTrigger(existing[i]);
        removedCount++;
      }
    }
    ScriptApp.newTrigger('sendClassroomDigest').timeBased().everyMinutes(15).create();
    triggerCreated = true;
    Logger.log('[OK] Installed 24/7 Time-Driven Trigger (every 15 minutes). Cleaned ' + removedCount + ' old trigger(s).');
  } else {
    Logger.log('[WARN] ScriptApp trigger API unavailable in this environment.');
  }

  var nowStr = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'dd MMM yyyy HH:mm:ss');
  postDiscordWebhookWithRetry(webhookUrl, {
    username: 'Classroom Hub (24/7 Cloud)',
    avatar_url: CONFIG.AVATAR_URL,
    embeds: [{
      title: '24/7 Cloud Assistant Activated',
      description: 'Google Apps Script is now scheduled to check your Google Classroom, timetable, and exam countdowns **every 15 minutes — 24 hours a day**, even when your browser and PC are off.',
      url: CONFIG.DASHBOARD_URL,
      color: 5163440,
      fields: [
        {
          name: 'Active 24/7 Schedule',
          value: '• Morning Briefing: **' + (CONFIG.ENABLE_MORNING_BRIEFING ? CONFIG.MORNING_BRIEFING_TIME : 'Disabled') + '**\\n' +
                 '• Pre-Class Alert: **' + (CONFIG.ENABLE_CLASS_REMINDER ? (CONFIG.CLASS_REMINDER_LEAD_MINUTES + 'm before class') : 'Disabled') + '**\\n' +
                 '• Deadlines & New Posts: **Every 15 min**\\n' +
                 '• Weekly Report: **' + (CONFIG.ENABLE_WEEKLY_DIGEST ? (CONFIG.WEEKLY_DIGEST_DAY.toUpperCase() + ' ' + CONFIG.WEEKLY_DIGEST_TIME) : 'Disabled') + '**',
          inline: false
        },
        {
          name: 'Activated At',
          value: nowStr + ' (' + CONFIG.TIMEZONE + ')',
          inline: false
        }
      ],
      footer: { text: 'Classroom Hub • Tip: Set web Delivery Authority to "24/7 Google Apps Script only" to avoid duplicates' },
      timestamp: new Date().toISOString()
    }]
  });

  sendClassroomDigest();
  return triggerCreated;
}

function uninstall24x7Trigger() {
  if (typeof ScriptApp === 'undefined' || !ScriptApp || typeof ScriptApp.getProjectTriggers !== 'function') return 0;
  var existing = ScriptApp.getProjectTriggers();
  var removed = 0;
  for (var i = 0; i < existing.length; i++) {
    if (existing[i].getHandlerFunction && existing[i].getHandlerFunction() === 'sendClassroomDigest') {
      ScriptApp.deleteTrigger(existing[i]);
      removed++;
    }
  }
  Logger.log('[OK] Removed ' + removed + ' sendClassroomDigest trigger(s).');
  return removed;
}

function testDiscordWebhook() {
  var webhookUrl = resolveDiscordWebhookUrl();
  Logger.log('=== [Classroom Hub: testDiscordWebhook] ===');
  if (!isValidDiscordWebhook(webhookUrl)) {
    Logger.log('[FAIL] Missing or invalid Discord Webhook URL.');
    Logger.log('Expected format: https://discord.com/api/webhooks/<ID>/<TOKEN> (set in Script Properties: DISCORD_WEBHOOK_URL)');
    return;
  }

  var nowStr = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'dd MMM yyyy HH:mm:ss');
  var payload = {
    username: 'Classroom Hub (24/7 Cloud)',
    avatar_url: CONFIG.AVATAR_URL,
    embeds: [{
      title: 'Discord + Google Apps Script Connected',
      description: 'Classroom Hub 24/7 background assistant is active and ready to deliver scheduled notifications.',
      url: CONFIG.DASHBOARD_URL,
      color: 3462553,
      fields: [
        {
          name: 'Configuration',
          value: '• Discord Alert: **' + (CONFIG.ENABLE_DISCORD ? 'Enabled' : 'Disabled') + '**\\n' +
                 '• Morning Briefing: **' + (CONFIG.ENABLE_MORNING_BRIEFING ? CONFIG.MORNING_BRIEFING_TIME : 'Disabled') + '**\\n' +
                 '• Exam Countdown: **' + (CONFIG.ENABLE_EXAM_COUNTDOWN ? 'Enabled' : 'Disabled') + '**\\n' +
                 '• Hidden Courses Excluded: **' + CONFIG.HIDDEN_COURSE_IDS.length + '**',
          inline: false
        },
        {
          name: 'Verified At',
          value: nowStr + ' (' + CONFIG.TIMEZONE + ')',
          inline: false
        }
      ],
      footer: { text: 'Classroom Hub • 24/7 Cloud Diagnostic' },
      timestamp: new Date().toISOString()
    }]
  };

  var res = postDiscordWebhookWithRetry(webhookUrl, payload);
  Logger.log('Test Result: ' + JSON.stringify(res));
}

function debugDryRun() {
  Logger.log('=== [Classroom Hub: debugDryRun (NO MESSAGES WILL BE SENT)] ===');
  var scan = collectClassroomAlerts({ dryRun: true });
  Logger.log('Active Courses Found: ' + scan.activeCourseCount + ' | Hidden Courses Skipped: ' + scan.skippedCourseCount);
  Logger.log('Pending Deadline Items Ready to Notify: ' + scan.pendingAssignments.length);
  for (var i = 0; i < scan.pendingAssignments.length; i++) {
    var a = scan.pendingAssignments[i];
    Logger.log('  [' + a.bucket + '] ' + a.courseName + ' -> ' + a.title + ' | Due: ' + a.dueDate + ' (' + a.daysLeftLabel + ')');
  }
  Logger.log('New Classroom Activity Items Ready to Notify: ' + scan.newActivity.length);
  for (var j = 0; j < scan.newActivity.length; j++) {
    var n = scan.newActivity[j];
    Logger.log('  [' + n.kind + '] ' + n.courseName + ' -> ' + n.title);
  }
  Logger.log('Exam Countdown Alerts Ready: ' + scan.examAlerts.length);
  Logger.log('=== [End of Dry Run] ===');
}

function resetSentHistory() {
  var props = PropertiesService.getScriptProperties();
  var todayKey = 'ch_sent_' + formatIsoDateInTz_(new Date(), CONFIG.TIMEZONE);
  props.deleteProperty(CONFIG.STORAGE_KEY_V2);
  props.deleteProperty(todayKey);
  for (var c = 0; c < CONFIG.LEDGER_CHUNK_COUNT; c++) {
    props.deleteProperty(CONFIG.LEDGER_CHUNK_PREFIX + c);
  }
  Logger.log('[RESET] Cleared notification ledger (' + CONFIG.STORAGE_KEY_V2 + ', chunked v3 ledger, and ' + todayKey + ').');
}

function collectClassroomAlerts(opts) {
  var isDryRun = Boolean(opts && opts.dryRun);
  var hiddenCourseIds = CONFIG.HIDDEN_COURSE_IDS || [];
  var props = PropertiesService.getScriptProperties();
  var now = new Date();
  var todayIso = formatIsoDateInTz_(now, CONFIG.TIMEZONE);
  var sentTodayKey = 'ch_sent_' + todayIso;

  var sentLegacyIds = [];
  try {
    sentLegacyIds = JSON.parse(props.getProperty(sentTodayKey) || '[]');
  } catch (e) {
    sentLegacyIds = [];
  }
  var sentV2Map = loadLedgerMap_(props);

  var courses = [];
  var coursePageToken = null;
  do {
    var listOpts = { courseStates: ['ACTIVE'] };
    if (coursePageToken) listOpts.pageToken = coursePageToken;
    var response = Classroom.Courses.list(listOpts);
    if (response.courses) courses = courses.concat(response.courses);
    coursePageToken = response.nextPageToken;
  } while (coursePageToken);

  var pendingAssignments = [];
  var openTasksList = [];
  var newActivity = [];
  var allOpenCourseworkCount = 0;
  var activeCourseCount = 0;
  var skippedCourseCount = 0;
  var recentPostCutoffMs = now.getTime() - (24 * 60 * 60 * 1000);

  for (var i = 0; i < courses.length; i++) {
    var course = courses[i];
    if (hiddenCourseIds.indexOf(course.id) !== -1) {
      skippedCourseCount++;
      Logger.log('Skipping hidden course: ' + course.name + ' (' + course.id + ')');
      continue;
    }
    activeCourseCount++;

    // Batch-fetch student submissions per course ('-') to avoid N+1 Classroom API quota exhaustion,
    // with automatic per-item fallback when running in test mocks without courseWorkId.
    var courseSubMap = null;
    try {
      var batchSubRes = Classroom.Courses.CourseWork.StudentSubmissions.list(course.id, '-', { userId: 'me' });
      var batchSubs = (batchSubRes && batchSubRes.studentSubmissions) ? batchSubRes.studentSubmissions : [];
      if (batchSubs.length > 0 && batchSubs[0].courseWorkId) {
        courseSubMap = {};
        for (var sIdx = 0; sIdx < batchSubs.length; sIdx++) {
          courseSubMap[batchSubs[sIdx].courseWorkId] = batchSubs[sIdx].state;
        }
      }
    } catch (batchErr) {
      courseSubMap = null;
    }

    var courseWorks = [];
    var cwPageToken = null;
    try {
      do {
        var cwOpts = cwPageToken ? { pageToken: cwPageToken } : {};
        var cwResponse = Classroom.Courses.CourseWork.list(course.id, cwOpts);
        if (cwResponse.courseWork) courseWorks = courseWorks.concat(cwResponse.courseWork);
        cwPageToken = cwResponse.nextPageToken;
      } while (cwPageToken);
    } catch (err) {
      Logger.log('[WARN] Could not list coursework for ' + course.name + ': ' + err.toString());
      continue;
    }

    for (var j = 0; j < courseWorks.length; j++) {
      var work = courseWorks[j];

      // Check new assignment creation (last 24h)
      if (
        CONFIG.NOTIFY_NEW_POSTS &&
        CONFIG.NOTIFY_NEW_ASSIGNMENTS &&
        isPriorityAllowedInScript_('P2') &&
        work.creationTime
      ) {
        var cwCreatedMs = new Date(work.creationTime).getTime();
        var newCwKey = 'assignment:' + work.id + ':new';
        if (cwCreatedMs >= recentPostCutoffMs && !sentV2Map[newCwKey]) {
          newActivity.push({
            id: work.id,
            kind: 'ASSIGNMENT',
            dedupKey: newCwKey,
            courseName: course.name || 'Course',
            title: truncateText(work.title || 'New Assignment', 140, 'New Assignment'),
            link: sanitizeSafeUrl(work.alternateLink)
          });
        }
      }

      if (!work.dueDate) {
        if (courseSubMap !== null) {
          var noDueState = courseSubMap[work.id];
          if (noDueState !== 'TURNED_IN' && noDueState !== 'RETURNED') {
            allOpenCourseworkCount++;
            if (openTasksList.length < 40) {
              openTasksList.push({
                id: work.id,
                title: work.title || 'Untitled Assignment',
                courseName: course.name || 'Course',
                dueIso: '',
                dueDateLabel: 'No due date',
                diffDays: null,
                link: sanitizeSafeUrl(work.alternateLink)
              });
            }
          }
        }
        continue;
      }

      var dueYear = work.dueDate.year;
      var dueMonth = work.dueDate.month - 1;
      var dueDay = work.dueDate.day;
      var dueDate;
      if (work.dueTime && (work.dueTime.hours !== undefined || work.dueTime.minutes !== undefined)) {
        dueDate = new Date(Date.UTC(dueYear, dueMonth, dueDay, work.dueTime.hours || 0, work.dueTime.minutes || 0, work.dueTime.seconds || 0));
      } else {
        // Date-only due date: end of Asia/Bangkok day (23:59:59+07:00 = 16:59:59Z)
        dueDate = new Date(Date.UTC(dueYear, dueMonth, dueDay, 16, 59, 59));
      }

      var dueIso = formatIsoDateInTz_(dueDate, CONFIG.TIMEZONE);
      var diffDays = diffIsoDays_(dueIso, todayIso);
      if (diffDays === null) continue;

      var bucket = null;
      var daysLeftLabel = '';
      var isCritical = false;
      var bucketPriority = 'P2';

      if (diffDays === 7 && CONFIG.DUE_7_DAYS) {
        bucket = 'due_7d';
        daysLeftLabel = 'Due in 7 days';
        bucketPriority = 'P2';
      } else if (diffDays === 3 && CONFIG.DUE_3_DAYS) {
        bucket = 'due_3d';
        daysLeftLabel = 'Due in 3 days';
        bucketPriority = 'P1';
      } else if (diffDays === 1 && CONFIG.DUE_1_DAY) {
        bucket = 'due_1d';
        daysLeftLabel = 'Due tomorrow';
        bucketPriority = 'P1';
      } else if (diffDays === 0 && CONFIG.DUE_TODAY) {
        bucket = 'due_today';
        daysLeftLabel = 'Due today';
        isCritical = true;
        bucketPriority = 'P0';
      } else if (diffDays < 0 && diffDays >= -30 && CONFIG.OVERDUE_ENABLED) {
        bucket = 'overdue';
        daysLeftLabel = 'Overdue (' + Math.abs(diffDays) + 'd)';
        bucketPriority = 'P1';
      }

      // Check submission state before alerting
      var isDone = false;
      if (courseSubMap !== null) {
        var cachedState = courseSubMap[work.id];
        if (cachedState === 'TURNED_IN' || cachedState === 'RETURNED') isDone = true;
      } else if (bucket || CONFIG.ENABLE_MORNING_BRIEFING || CONFIG.ENABLE_DAILY_DIGEST || CONFIG.ENABLE_WEEKLY_DIGEST) {
        try {
          var subRes = Classroom.Courses.CourseWork.StudentSubmissions.list(course.id, work.id, { userId: 'me' });
          var subs = subRes.studentSubmissions || [];
          if (subs.length > 0 && (subs[0].state === 'TURNED_IN' || subs[0].state === 'RETURNED')) {
            isDone = true;
          }
        } catch (subErr) {
          Logger.log('[WARN] Could not check submission state for ' + work.id + ': ' + subErr.toString());
        }
      }

      if (!isDone && diffDays >= -30) {
        allOpenCourseworkCount++;
        if (openTasksList.length < 40) {
          openTasksList.push({
            id: work.id,
            title: work.title || 'Untitled Assignment',
            courseName: course.name || 'Course',
            dueIso: dueIso,
            dueDateLabel: Utilities.formatDate(dueDate, CONFIG.TIMEZONE, 'dd MMM HH:mm'),
            diffDays: diffDays,
            link: sanitizeSafeUrl(work.alternateLink)
          });
        }
      }

      if (!bucket || isDone || !isPriorityAllowedInScript_(bucketPriority)) continue;

      // Key includes dueIso so extended deadlines re-arm cleanly while static deadlines never repeat
      var dedupKey = 'assignment:' + work.id + ':' + bucket + ':' + dueIso;
      var legacyKey = work.id + ':' + bucket;
      if (sentV2Map[dedupKey] || sentV2Map[legacyKey] || sentLegacyIds.indexOf(work.id + ':' + dueIso) !== -1) {
        continue;
      }
      if (isQuietHoursBlocked_(now, isCritical)) continue;

      pendingAssignments.push({
        id: work.id,
        dedupKey: dedupKey,
        dueIso: dueIso,
        bucket: bucket,
        isCritical: isCritical,
        title: work.title || 'Untitled Assignment',
        courseName: course.name || 'Course',
        courseCode: course.section || '',
        dueDate: Utilities.formatDate(dueDate, CONFIG.TIMEZONE, 'dd MMM HH:mm'),
        daysLeft: diffDays,
        daysLeftLabel: daysLeftLabel,
        points: typeof work.maxPoints === 'number' ? String(work.maxPoints) + ' pts' : 'Ungraded',
        link: sanitizeSafeUrl(work.alternateLink)
      });
    }

    // Scan Recent Announcements (Last 24 hours)
    if (
      CONFIG.NOTIFY_NEW_POSTS &&
      CONFIG.NOTIFY_NEW_ANNOUNCEMENTS &&
      isPriorityAllowedInScript_('P2') &&
      !isQuietHoursBlocked_(now, false)
    ) {
      try {
        var annRes = Classroom.Courses.Announcements.list(course.id, { pageSize: 10 });
        var anns = annRes.announcements || [];
        for (var aIdx = 0; aIdx < anns.length; aIdx++) {
          var ann = anns[aIdx];
          var annKey = 'announcement:' + ann.id + ':new';
          if (sentV2Map[annKey] || sentV2Map['ann:' + ann.id]) continue;
          var createdMs = ann.creationTime ? new Date(ann.creationTime).getTime() : 0;
          if (createdMs >= recentPostCutoffMs) {
            newActivity.push({
              id: ann.id,
              kind: 'ANNOUNCEMENT',
              dedupKey: annKey,
              courseName: course.name || 'Course',
              title: truncateText(ann.text || 'New announcement', 140, 'New announcement'),
              link: sanitizeSafeUrl(ann.alternateLink)
            });
          }
        }
      } catch (annErr) {}
    }

    // Scan Recent CourseWorkMaterials (Last 24 hours, when Classroom Materials API is available)
    if (
      CONFIG.NOTIFY_NEW_POSTS &&
      CONFIG.NOTIFY_NEW_MATERIALS &&
      isPriorityAllowedInScript_('P2') &&
      !isQuietHoursBlocked_(now, false) &&
      Classroom.Courses.CourseWorkMaterials &&
      typeof Classroom.Courses.CourseWorkMaterials.list === 'function'
    ) {
      try {
        var matRes = Classroom.Courses.CourseWorkMaterials.list(course.id, { pageSize: 10 });
        var mats = matRes.courseWorkMaterial || [];
        for (var mIdx = 0; mIdx < mats.length; mIdx++) {
          var mat = mats[mIdx];
          var matKey = 'material:' + mat.id + ':new';
          if (sentV2Map[matKey]) continue;
          var mCreatedMs = mat.creationTime ? new Date(mat.creationTime).getTime() : 0;
          if (mCreatedMs >= recentPostCutoffMs) {
            newActivity.push({
              id: mat.id,
              kind: 'MATERIAL',
              dedupKey: matKey,
              courseName: course.name || 'Course',
              title: truncateText(mat.title || 'New course material', 140, 'New material'),
              link: sanitizeSafeUrl(mat.alternateLink)
            });
          }
        }
      } catch (matErr) {}
    }
  }

  // Scan Calendar / Snapshot for Exam Countdowns, Pre-Class Reminders & Morning Briefing
  var calData = readHubAcademicCalendar_(now);
  var nowMinsInCollect = getMinutesOfDayInTz_(now, CONFIG.TIMEZONE);
  var examAlerts = [];
  if (CONFIG.ENABLE_EXAM_COUNTDOWN) {
    for (var eIdx = 0; eIdx < calData.upcomingExams.length; eIdx++) {
      var ex = calData.upcomingExams[eIdx];
      var eDiff = diffIsoDays_(ex.dateIso, todayIso);
      if (eDiff === null || eDiff < 0) continue;
      var eStage = null;
      var ePrio = 'P2';
      if (eDiff === 7 && CONFIG.EXAM_STAGES.d7) { eStage = 'exam_7d'; ePrio = 'P2'; }
      else if (eDiff === 3 && CONFIG.EXAM_STAGES.d3) { eStage = 'exam_3d'; ePrio = 'P1'; }
      else if (eDiff === 1 && CONFIG.EXAM_STAGES.d1) { eStage = 'exam_1d'; ePrio = 'P1'; }
      else if (eDiff === 0 && CONFIG.EXAM_STAGES.d0) { eStage = 'exam_today'; ePrio = 'P0'; }
      if (!eStage || !isPriorityAllowedInScript_(ePrio)) continue;

      var examKey = 'exam:' + (ex.courseCode || ex.id) + ':' + eStage + ':' + ex.dateIso;
      if (sentV2Map[examKey]) continue;
      if (isQuietHoursBlocked_(now, eDiff === 0)) continue;
      examAlerts.push({
        dedupKey: examKey,
        stage: eStage,
        daysLeft: eDiff,
        exam: ex
      });
    }
  }

  var classAlerts = [];
  if (CONFIG.ENABLE_CLASS_REMINDER) {
    var leadMins = Number(CONFIG.CLASS_REMINDER_LEAD_MINUTES) || 30;
    for (var cIdx = 0; cIdx < calData.todayClasses.length; cIdx++) {
      var clsItem = calData.todayClasses[cIdx];
      if (!clsItem || !clsItem.startTime) continue;
      var startM = parseClockMins_(clsItem.startTime, -1);
      if (startM < 0) continue;
      var minsUntil = startM - nowMinsInCollect;
      var clsId = clsItem.id || clsItem.courseCode || clsItem.title || 'class';

      if (
        minsUntil > 0 &&
        minsUntil <= leadMins &&
        !(CONFIG.CLASS_REMINDER_FINAL_5M && minsUntil <= 5 && leadMins > 5) &&
        isPriorityAllowedInScript_('P1') &&
        !isQuietHoursBlocked_(now, false)
      ) {
        var leadKey = 'class_reminder:' + clsId + ':lead_' + leadMins + 'm:' + todayIso + '_' + clsItem.startTime;
        if (!sentV2Map[leadKey]) {
          classAlerts.push({
            dedupKey: leadKey,
            minsUntil: minsUntil,
            isFinal5m: false,
            cls: clsItem
          });
        }
      }

      if (
        CONFIG.CLASS_REMINDER_FINAL_5M &&
        minsUntil > 0 &&
        minsUntil <= 5 &&
        isPriorityAllowedInScript_('P0') &&
        !isQuietHoursBlocked_(now, true)
      ) {
        var finalKey = 'class_reminder:' + clsId + ':lead_5m:' + todayIso + '_' + clsItem.startTime;
        if (!sentV2Map[finalKey]) {
          classAlerts.push({
            dedupKey: finalKey,
            minsUntil: minsUntil,
            isFinal5m: true,
            cls: clsItem
          });
        }
      }
    }
  }

  return {
    now: now,
    todayIso: todayIso,
    activeCourseCount: activeCourseCount,
    skippedCourseCount: skippedCourseCount,
    allOpenCourseworkCount: allOpenCourseworkCount,
    openTasksList: openTasksList,
    pendingAssignments: pendingAssignments,
    newActivity: newActivity,
    examAlerts: examAlerts,
    classAlerts: classAlerts,
    todayClasses: calData.todayClasses,
    upcomingExams: calData.upcomingExams,
    sentTodayKey: sentTodayKey,
    sentLegacyIds: sentLegacyIds,
    sentV2Map: sentV2Map,
    isDryRun: isDryRun
  };
}

/**
 * Primary Time-Driven Trigger Entrypoint (protected by LockService mutex when available).
 */
function sendClassroomDigest() {
  var lock = null;
  if (typeof LockService !== 'undefined' && LockService && typeof LockService.getScriptLock === 'function') {
    lock = LockService.getScriptLock();
    if (!lock.tryLock(15000)) {
      Logger.log('[SKIP] Another sendClassroomDigest execution is already running.');
      return;
    }
  }

  try {
    var email = '';
    try {
      email = Session.getActiveUser().getEmail();
    } catch (e) {}

    var scan = collectClassroomAlerts({ dryRun: false });
    var pendingAssignments = scan.pendingAssignments;
    var newActivity = scan.newActivity;
    var examAlerts = scan.examAlerts;
    var classAlerts = scan.classAlerts || [];
    var openTasksList = scan.openTasksList || [];
    var sentV2 = scan.sentV2Map || {};
    var nowMins = getMinutesOfDayInTz_(scan.now, CONFIG.TIMEZONE);
    var todayWeekday = getWeekdayKeyInTz_(scan.now, CONFIG.TIMEZONE);

    var briefingMins = parseClockMins_(CONFIG.MORNING_BRIEFING_TIME, 7 * 60);
    var briefingKey = 'briefing:morning:daily:' + scan.todayIso;
    var hasMorningContent =
      scan.todayClasses.length > 0 ||
      scan.allOpenCourseworkCount > 0 ||
      scan.upcomingExams.length > 0;
    var allowMorningToday =
      scan.todayClasses.length > 0 ||
      (CONFIG.MORNING_BRIEFING_FREE_DAYS !== false && hasMorningContent);
    var shouldSendMorningBriefing =
      CONFIG.ENABLE_MORNING_BRIEFING &&
      isPriorityAllowedInScript_('P3') &&
      allowMorningToday &&
      nowMins >= briefingMins &&
      !sentV2[briefingKey] &&
      !isQuietHoursBlocked_(scan.now, false);

    var dailyMins = parseClockMins_(CONFIG.DAILY_DIGEST_TIME, 20 * 60);
    var dailyKey = 'digest:daily:summary:' + scan.todayIso;
    var shouldSendDailyDigest =
      CONFIG.ENABLE_DAILY_DIGEST &&
      isPriorityAllowedInScript_('P3') &&
      nowMins >= dailyMins &&
      !sentV2[dailyKey] &&
      !isQuietHoursBlocked_(scan.now, false) &&
      (scan.allOpenCourseworkCount > 0 || scan.upcomingExams.length > 0);

    var weeklyMins = parseClockMins_(CONFIG.WEEKLY_DIGEST_TIME, 18 * 60);
    var weeklyKey = 'digest:weekly:summary:' + scan.todayIso;
    var shouldSendWeeklyDigest =
      CONFIG.ENABLE_WEEKLY_DIGEST &&
      isPriorityAllowedInScript_('P3') &&
      todayWeekday === CONFIG.WEEKLY_DIGEST_DAY &&
      nowMins >= weeklyMins &&
      !sentV2[weeklyKey] &&
      !isQuietHoursBlocked_(scan.now, false) &&
      (scan.allOpenCourseworkCount > 0 || scan.upcomingExams.length > 0 || scan.todayClasses.length > 0);

    if (
      pendingAssignments.length === 0 &&
      newActivity.length === 0 &&
      examAlerts.length === 0 &&
      classAlerts.length === 0 &&
      !shouldSendMorningBriefing &&
      !shouldSendDailyDigest &&
      !shouldSendWeeklyDigest
    ) {
      Logger.log('No new pending notifications due on this tick.');
      return;
    }

    var deliveredKeys = [];
    var deliveredAny = false;
    var webhookUrl = resolveDiscordWebhookUrl();

    if (CONFIG.ENABLE_DISCORD && isValidDiscordWebhook(webhookUrl)) {
      var embeds = [];

      if (shouldSendMorningBriefing) {
        var classLines = [];
        for (var cIdx = 0; cIdx < Math.min(scan.todayClasses.length, 8); cIdx++) {
          var cls = scan.todayClasses[cIdx];
          classLines.push('• \\x60' + (cls.startTime || '--:--') + '-' + (cls.endTime || '--:--') + '\\x60 **' + cls.title + '**' + (cls.room ? ' — \\x60' + cls.room + '\\x60' : ''));
        }
        var mbFields = [
          {
            name: "Today's Schedule",
            value: classLines.length > 0 ? classLines.join('\\n') : 'No scheduled classes today.',
            inline: false
          }
        ];
        if (openTasksList.length > 0) {
          var dueSoonLines = [];
          for (var otIdx = 0; otIdx < openTasksList.length && dueSoonLines.length < 6; otIdx++) {
            var ot = openTasksList[otIdx];
            if (ot.diffDays !== null && ot.diffDays <= 7) {
              var otLink = ot.link ? '[' + truncateText(ot.title, 55, 'Task') + '](' + ot.link + ')' : ('**' + truncateText(ot.title, 55, 'Task') + '**');
              dueSoonLines.push('• ' + otLink + ' (' + truncateText(ot.courseName, 30, 'Course') + ') — \\x60' + ot.dueDateLabel + '\\x60');
            }
          }
          if (dueSoonLines.length > 0) {
            mbFields.push({
              name: 'Due Soon & Overdue Tasks',
              value: truncateText(dueSoonLines.join('\\n'), 1000, '-'),
              inline: false
            });
          }
        }
        if (scan.upcomingExams.length > 0) {
          var mbExamLines = [];
          for (var meIdx = 0; meIdx < Math.min(scan.upcomingExams.length, 4); meIdx++) {
            var mex = scan.upcomingExams[meIdx];
            mbExamLines.push('• **' + truncateText(mex.subject, 55, 'Exam') + '** — \\x60' + mex.dateIso + '\\x60' + (mex.room ? ' (' + mex.room + ')' : ''));
          }
          mbFields.push({
            name: 'Upcoming Examinations',
            value: truncateText(mbExamLines.join('\\n'), 1000, '-'),
            inline: false
          });
        }
        embeds.push({
          title: 'Morning Briefing — ' + scan.todayIso,
          url: CONFIG.DASHBOARD_URL,
          description: '**' + scan.todayClasses.length + '** classes today  •  **' + scan.allOpenCourseworkCount + '** open tasks  •  **' + scan.upcomingExams.length + '** upcoming exams',
          color: 5030794,
          fields: mbFields,
          footer: { text: 'Classroom Hub • Morning Briefing • ' + CONFIG.TIMEZONE },
          timestamp: new Date().toISOString()
        });
      }

      for (var caIdx = 0; caIdx < Math.min(classAlerts.length, 5); caIdx++) {
        var ca = classAlerts[caIdx];
        embeds.push({
          title: 'Class in ' + ca.minsUntil + ' min — ' + truncateText(ca.cls.title, 180, 'Class'),
          url: CONFIG.DASHBOARD_URL,
          color: ca.isFinal5m ? 15026253 : 15051067,
          fields: [
            { name: 'Time', value: '\\x60' + (ca.cls.startTime || '--:--') + (ca.cls.endTime ? ' - ' + ca.cls.endTime : '') + '\\x60', inline: true },
            { name: 'Room', value: ca.cls.room || 'TBA', inline: true },
            { name: 'Course Code', value: ca.cls.courseCode || '-', inline: true }
          ],
          footer: { text: 'Classroom Hub • 24/7 Pre-Class Reminder' },
          timestamp: new Date().toISOString()
        });
      }

      if (pendingAssignments.length > 0) {
        var hasCritical = false;
        var fields = [];
        for (var idx = 0; idx < Math.min(pendingAssignments.length, 15); idx++) {
          var item = pendingAssignments[idx];
          if (item.isCritical || item.bucket === 'overdue') hasCritical = true;
          var fieldTitle = truncateText(item.courseName + ' — ' + item.title, 250, 'Assignment');
          var linkPart = item.link ? ' • [Open in Classroom](' + item.link + ')' : '';
          var fieldVal = truncateText(
            'Deadline: **' + item.dueDate + '** (' + item.daysLeftLabel + ') | Not Submitted • ' + item.points + linkPart,
            1000,
            '-'
          );
          fields.push({ name: fieldTitle, value: fieldVal, inline: false });
        }
        embeds.push({
          title: 'Assignment Reminders (' + pendingAssignments.length + ')',
          description: 'Pending coursework requiring attention • [Open Classroom Hub](' + CONFIG.DASHBOARD_URL + ')',
          url: CONFIG.DASHBOARD_URL,
          color: hasCritical ? 15026253 : 15051067,
          fields: fields,
          footer: { text: 'Classroom Hub • 24/7 Assignment Monitor' },
          timestamp: new Date().toISOString()
        });
      }

      for (var exIdx = 0; exIdx < Math.min(examAlerts.length, 5); exIdx++) {
        var ea = examAlerts[exIdx];
        var badge = ea.daysLeft === 0 ? 'EXAM TODAY' : ('Exam in ' + ea.daysLeft + 'd');
        embeds.push({
          title: '[' + badge + '] ' + truncateText(ea.exam.subject, 190, 'Examination'),
          color: ea.daysLeft === 0 ? 15026253 : 15051067,
          fields: [
            { name: 'Date & Time', value: (ea.exam.dateLabel || ea.exam.dateIso) + '\\n\\x60' + (ea.exam.time || 'TBA') + '\\x60', inline: true },
            { name: 'Room', value: ea.exam.room || 'TBA', inline: true },
            { name: 'Seat', value: ea.exam.seat || 'Not assigned yet', inline: true }
          ],
          footer: { text: 'Classroom Hub • Examination Countdown' },
          timestamp: new Date().toISOString()
        });
      }

      if (newActivity.length > 0) {
        var actFields = [];
        for (var nIdx = 0; nIdx < Math.min(newActivity.length, 15); nIdx++) {
          var actItem = newActivity[nIdx];
          var actLink = actItem.link ? ' ([Open](' + actItem.link + '))' : '';
          actFields.push({
            name: truncateText('[' + actItem.kind + '] ' + actItem.courseName, 250, 'Course'),
            value: truncateText(actItem.title + actLink, 1000, '-'),
            inline: false
          });
        }
        embeds.push({
          title: 'New Classroom Activity (' + newActivity.length + ')',
          url: CONFIG.DASHBOARD_URL,
          color: 3899903,
          fields: actFields,
          footer: { text: 'Classroom Hub • New Classroom Activity' },
          timestamp: new Date().toISOString()
        });
      }

      if (shouldSendDailyDigest || shouldSendWeeklyDigest) {
        var sumLines = [];
        for (var stIdx = 0; stIdx < Math.min(openTasksList.length, 10); stIdx++) {
          var st = openTasksList[stIdx];
          var stLink = st.link ? '[' + truncateText(st.title, 55, 'Task') + '](' + st.link + ')' : ('**' + truncateText(st.title, 55, 'Task') + '**');
          sumLines.push('• ' + stLink + ' (' + truncateText(st.courseName, 30, 'Course') + ') — \\x60' + st.dueDateLabel + '\\x60');
        }
        var digestFields = [
          {
            name: 'Unfinished Coursework (' + scan.allOpenCourseworkCount + ')',
            value: sumLines.length > 0 ? truncateText(sumLines.join('\\n'), 1000, '-') : 'All caught up — no pending coursework!',
            inline: false
          }
        ];
        if (scan.upcomingExams.length > 0) {
          var wExamLines = [];
          for (var weIdx = 0; weIdx < Math.min(scan.upcomingExams.length, 5); weIdx++) {
            var wex = scan.upcomingExams[weIdx];
            wExamLines.push('• **' + truncateText(wex.subject, 55, 'Exam') + '** — \\x60' + wex.dateIso + '\\x60' + (wex.room ? ' | Room: ' + wex.room : '') + (wex.seat ? ' | Seat: ' + wex.seat : ''));
          }
          digestFields.push({
            name: 'Upcoming Examinations (' + scan.upcomingExams.length + ')',
            value: truncateText(wExamLines.join('\\n'), 1000, '-'),
            inline: false
          });
        }
        if (shouldSendDailyDigest) {
          embeds.push({
            title: 'Daily Academic Summary — ' + scan.todayIso,
            url: CONFIG.DASHBOARD_URL,
            color: 5793266,
            fields: digestFields,
            footer: { text: 'Classroom Hub • Daily Digest • ' + CONFIG.TIMEZONE },
            timestamp: new Date().toISOString()
          });
        }
        if (shouldSendWeeklyDigest) {
          embeds.push({
            title: 'Weekly Academic Report',
            description: '**' + scan.allOpenCourseworkCount + '** open coursework item(s)  •  **' + scan.upcomingExams.length + '** upcoming exam(s)',
            url: CONFIG.DASHBOARD_URL,
            color: 5793266,
            fields: digestFields,
            footer: { text: 'Classroom Hub • 24/7 Weekly Academic Report • ' + CONFIG.TIMEZONE },
            timestamp: new Date().toISOString()
          });
        }
      }

      // Batch in groups of <=10 embeds to respect Discord API limits
      var allDiscordOk = true;
      for (var b = 0; b < embeds.length; b += 10) {
        var res = postDiscordWebhookWithRetry(webhookUrl, {
          username: 'Classroom Hub',
          avatar_url: CONFIG.AVATAR_URL,
          embeds: embeds.slice(b, b + 10)
        });
        if (!res.ok) {
          allDiscordOk = false;
          break;
        }
      }

      if (allDiscordOk) {
        deliveredAny = true;
        if (shouldSendMorningBriefing) deliveredKeys.push(briefingKey);
        if (shouldSendDailyDigest) deliveredKeys.push(dailyKey);
        if (shouldSendWeeklyDigest) deliveredKeys.push(weeklyKey);
        for (var ck = 0; ck < classAlerts.length; ck++) deliveredKeys.push(classAlerts[ck].dedupKey);
        for (var m = 0; m < pendingAssignments.length; m++) deliveredKeys.push(pendingAssignments[m].dedupKey);
        for (var p = 0; p < newActivity.length; p++) deliveredKeys.push(newActivity[p].dedupKey);
        for (var x = 0; x < examAlerts.length; x++) deliveredKeys.push(examAlerts[x].dedupKey);
      }
    }

    if (CONFIG.ENABLE_EMAIL && email && pendingAssignments.length > 0) {
      var htmlBody = '<html><head><meta charset="utf-8"></head><body style="background-color: #11141C; color: #E2E5EE; font-family: -apple-system, BlinkMacSystemFont, Arial, sans-serif; margin: 0; padding: 20px;">' +
        '<div style="max-width: 600px; margin: 0 auto; background-color: #171B24; border: 1px solid #2A3140; border-radius: 12px; padding: 28px;">' +
        '<div style="text-align: center; border-bottom: 1px solid #2A3140; padding-bottom: 18px; margin-bottom: 20px;">' +
        '<div style="font-size: 13px; font-weight: 600; color: #60A5FA;">Classroom Hub</div>' +
        '<div style="font-size: 18px; font-weight: 600; color: #EEF0F5; margin-top: 8px;">Upcoming Coursework Deadlines</div>' +
        '</div><div>';

      for (var k = 0; k < pendingAssignments.length; k++) {
        var mailItem = pendingAssignments[k];
        htmlBody += '<div style="background-color: #11141C; border: 1px solid #2A3140; border-radius: 8px; padding: 15px; margin-bottom: 14px;">' +
          '<div style="display: inline-block; background-color: #1B2942; color: #60A5FA; font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 6px; margin-bottom: 8px;">' + escapeHtmlScript(mailItem.courseName) + '</div>' +
          '<div style="font-size: 14px; font-weight: 600; color: #EEF0F5; margin-bottom: 8px;">' + escapeHtmlScript(mailItem.title) + '</div>' +
          '<div style="font-size: 12px; color: #A1AAB9; margin-bottom: 12px;">' +
          'Deadline: <strong style="color: #FBBF24;">' + escapeHtmlScript(mailItem.dueDate) + '</strong> (' + escapeHtmlScript(mailItem.daysLeftLabel) + ') &nbsp;|&nbsp; ' + escapeHtmlScript(mailItem.points) +
          '</div>' +
          (mailItem.link ? '<a href="' + escapeHtmlScript(mailItem.link) + '" target="_blank" rel="noopener noreferrer" style="display: inline-block; background-color: #2563EB; color: #FFFFFF !important; text-decoration: none; padding: 6px 14px; border-radius: 6px; font-size: 12px; font-weight: 500;">Open in Classroom</a>' : '') +
          '</div>';
      }

      htmlBody += '</div></div></body></html>';

      MailApp.sendEmail({
        to: email,
        subject: '[Classroom Hub] Upcoming Coursework Deadlines (' + pendingAssignments.length + ')',
        htmlBody: htmlBody
      });
      deliveredAny = true;
      for (var em = 0; em < pendingAssignments.length; em++) {
        if (deliveredKeys.indexOf(pendingAssignments[em].dedupKey) === -1) {
          deliveredKeys.push(pendingAssignments[em].dedupKey);
        }
      }
      Logger.log('Notification email sent successfully to: ' + email);
    }

    // Persist deduplication state ONLY after confirmed delivery
    if (deliveredAny && deliveredKeys.length > 0) {
      var props = PropertiesService.getScriptProperties();
      var nowIso = new Date().toISOString();
      var sentIds = scan.sentLegacyIds || [];
      for (var dIdx = 0; dIdx < deliveredKeys.length; dIdx++) {
        sentV2[deliveredKeys[dIdx]] = nowIso;
      }
      for (var sIdx = 0; sIdx < pendingAssignments.length; sIdx++) {
        sentIds.push(pendingAssignments[sIdx].id + ':' + pendingAssignments[sIdx].dueIso);
      }
      props.setProperty(scan.sentTodayKey, JSON.stringify(sentIds.slice(-200)));
      saveLedgerMap_(props, sentV2);
    } else if (!deliveredAny) {
      Logger.log('[WARN] No notification channel succeeded; ledger not updated so next run can retry.');
    }
  } catch (error) {
    Logger.log('Error running script: ' + scrubWebhookSecrets_(error.toString()));
  } finally {
    if (lock) {
      try { lock.releaseLock(); } catch (e) {}
    }
  }
}
`;
}
