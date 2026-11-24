import { logger } from '../utils/logger';
import { parseExamDate } from '../utils/examDate';
import {
  addDaysIso,
  collectPausedDatesForDay,
  isDateInRanges,
  resolveCourseEndDate,
  resolveEntryPauseRanges,
} from '../utils/courseEndDate';
import { getMergedExams } from '../utils/examMerger';
import { getAlertSettings, getHiddenCourses, getToken } from '../utils/storage';
import { httpClient } from '../utils/httpClient';
import { AppError } from '../utils/errors';

const CALENDAR_EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
const TIMEZONE = 'Asia/Bangkok';
const SOURCE_TAG = 'classroom-hub';
const MAX_CALENDAR_REMINDER_MINUTES = 40320; // Google Calendar API limit: 4 weeks (28 days)

const DAY_TO_RRULE = { mon: 'MO', tue: 'TU', wed: 'WE', thu: 'TH', fri: 'FR', sat: 'SA', sun: 'SU' };
const DAY_TO_JS_INDEX = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

/**
 * Low-level fetch wrapper for the Google Calendar API via httpClient.
 * Provides timeout, 401 silent token refresh, 429/5xx backoff retry, and 204 support.
 */
async function calendarRequest(tokenRef, path, options = {}) {
  const latest = getToken();
  const activeToken =
    latest && (latest !== tokenRef.initialStoredToken || !tokenRef.token)
      ? latest
      : tokenRef.token;

  return await httpClient.request(path, {
    ...options,
    headers: {
      'Authorization': `Bearer ${activeToken}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
}

// ── LocalStorage-backed map of "our" events: key -> { eventId, sig } ──
function eventMapKey(email) {
  return `classroom_hub_calendar_event_map_${(email || '').toLowerCase().trim()}`;
}

function loadEventMap(email) {
  try {
    const raw = localStorage.getItem(eventMapKey(email));
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    logger.warn('[Calendar Sync] Failed to parse local event map, resetting.', e);
    return {};
  }
}

function saveEventMap(email, map) {
  try {
    localStorage.setItem(eventMapKey(email), JSON.stringify(map));
  } catch (e) {
    logger.error('[Calendar Sync] Failed to persist local event map.', e);
  }
}

function signatureOf(body) {
  return JSON.stringify({
    s: body.summary,
    d: body.description || '',
    l: body.location || '',
    st: body.start,
    en: body.end,
    r: body.recurrence || null,
    rem: body.reminders || null
  });
}

function formatUtcTimestampAsBangkokNaive(ms) {
  const bkk = new Date(ms + 7 * 60 * 60 * 1000);
  const y = bkk.getUTCFullYear();
  const m = String(bkk.getUTCMonth() + 1).padStart(2, '0');
  const d = String(bkk.getUTCDate()).padStart(2, '0');
  const hh = String(bkk.getUTCHours()).padStart(2, '0');
  const mm = String(bkk.getUTCMinutes()).padStart(2, '0');
  const ss = String(bkk.getUTCSeconds()).padStart(2, '0');
  return `${y}-${m}-${d}T${hh}:${mm}:${ss}`;
}

// ── Event builders ──────────────────────────────────────────────

function normalizeClockTime(rawTime) {
  if (!rawTime || typeof rawTime !== 'string') return null;
  const match = rawTime.trim().match(/^(\d{1,2})[:.](\d{2})$/);
  if (!match) return null;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function getAnchorDate(entry) {
  let baseMs = Date.now();
  if (entry.id && String(entry.id).startsWith('sched-')) {
    const ts = parseInt(String(entry.id).split('-')[1], 10);
    if (!Number.isNaN(ts) && ts > 1e12) {
      baseMs = ts;
    }
  }
  const bkkBase = new Date(baseMs + 7 * 60 * 60 * 1000);
  const baseIdx = bkkBase.getUTCDay();
  const targetIdx = DAY_TO_JS_INDEX[entry.day];
  if (targetIdx === undefined) return null;
  const diff = (targetIdx - baseIdx + 7) % 7;
  const shifted = new Date(Date.UTC(bkkBase.getUTCFullYear(), bkkBase.getUTCMonth(), bkkBase.getUTCDate() + diff));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(shifted.getUTCDate()).padStart(2, '0')}`;
}

function buildRecurringClassEvent(entry, allExams = []) {
  const startTime = normalizeClockTime(entry.startTime);
  const endTime = normalizeClockTime(entry.endTime);
  let anchorDate = getAnchorDate(entry);
  if (!startTime || !endTime || !anchorDate || startTime >= endTime) return null;

  const pauseRanges = resolveEntryPauseRanges(entry, allExams);

  // If the first anchor date falls inside a Midterm pause week, advance DTSTART to the next active week
  for (let step = 0; step < 10 && isDateInRanges(anchorDate, pauseRanges); step++) {
    anchorDate = addDaysIso(anchorDate, 7);
  }
  if (!anchorDate) return null;

  const stopCandidates = [];

  if (entry.deletedAt && /^\d{4}-\d{2}-\d{2}$/.test(entry.deletedAt)) {
    // End strictly before `entry.deletedAt` in Bangkok time (00:00:00+07:00 minus 1s = previous day 23:59:59+07:00)
    const deletedStopMs = Date.parse(`${entry.deletedAt}T00:00:00+07:00`) - 1000;
    if (!Number.isNaN(deletedStopMs)) {
      stopCandidates.push(deletedStopMs);
    }
  }

  const effectiveEndDate = resolveCourseEndDate(entry, allExams);
  if (effectiveEndDate && /^\d{4}-\d{2}-\d{2}$/.test(effectiveEndDate)) {
    // Inclusive of `effectiveEndDate` (stops after 23:59:59+07:00 on `effectiveEndDate`)
    const endDateStopMs = Date.parse(`${effectiveEndDate}T23:59:59+07:00`);
    if (!Number.isNaN(endDateStopMs)) {
      stopCandidates.push(endDateStopMs);
    }
  }

  let rrule = `RRULE:FREQ=WEEKLY;BYDAY=${DAY_TO_RRULE[entry.day]}`;
  let stopMs = null;

  if (stopCandidates.length > 0) {
    stopMs = Math.min(...stopCandidates);
    const anchorStartMs = Date.parse(`${anchorDate}T${startTime}:00+07:00`);
    // Prevent invalid RRULE where UNTIL < DTSTART and prune already-ended courses
    if (!Number.isNaN(anchorStartMs) && anchorStartMs > stopMs) {
      return null;
    }
    const untilStr = new Date(stopMs).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    rrule += `;UNTIL=${untilStr}`;
  }

  const recurrence = [rrule];

  // Add RFC 5545 EXDATE entries to pause regular classes during Midterm Exam Week(s)
  // while keeping the weekly series resuming normally right after midterms!
  if (pauseRanges.length > 0) {
    const compactStartTime = `${startTime.replace(':', '')}00`;
    const excludedDates = collectPausedDatesForDay(entry.day, pauseRanges).filter((exIso) => {
      if (exIso < anchorDate) return false;
      if (stopMs !== null) {
        const occMs = Date.parse(`${exIso}T${startTime}:00+07:00`);
        if (!Number.isNaN(occMs) && occMs > stopMs) return false;
      }
      return true;
    });

    if (excludedDates.length > 0) {
      const exDateValues = excludedDates.map((iso) => `${iso.replace(/-/g, '')}T${compactStartTime}`).join(',');
      recurrence.push(`EXDATE;TZID=${TIMEZONE}:${exDateValues}`);
    }
  }

  return {
    summary: entry.title || entry.courseCode || 'Class',
    location: entry.room || '',
    description: [entry.courseCode, entry.notes].filter(Boolean).join('\n'),
    start: { dateTime: `${anchorDate}T${startTime}:00`, timeZone: TIMEZONE },
    end: { dateTime: `${anchorDate}T${endTime}:00`, timeZone: TIMEZONE },
    recurrence,
    extendedProperties: { private: { chSource: SOURCE_TAG, chType: 'schedule', chId: String(entry.id) } }
  };
}

function buildOneOffTimedEvent(entry, typeLabel) {
  const startTime = normalizeClockTime(entry.startTime);
  const endTime = normalizeClockTime(entry.endTime);
  if (!entry.date || !/^\d{4}-\d{2}-\d{2}$/.test(entry.date) || !startTime || !endTime || startTime >= endTime) {
    return null;
  }
  return {
    summary: entry.title || entry.courseCode || (typeLabel === 'exam' ? 'Exam' : 'Class'),
    location: entry.room || '',
    description: [entry.courseCode, entry.notes].filter(Boolean).join('\n'),
    start: { dateTime: `${entry.date}T${startTime}:00`, timeZone: TIMEZONE },
    end: { dateTime: `${entry.date}T${endTime}:00`, timeZone: TIMEZONE },
    extendedProperties: { private: { chSource: SOURCE_TAG, chType: typeLabel, chId: String(entry.id) } }
  };
}

function buildAssignmentEvent(assignment) {
  if (!assignment?.dueDate || typeof assignment.dueDate !== 'string') return null;
  const trimmedDue = assignment.dueDate.trim();
  const hasTime = trimmedDue.includes('T');
  let start, end;

  if (hasTime) {
    const hasOffset = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(trimmedDue);
    if (hasOffset) {
      const parsed = new Date(trimmedDue);
      if (!Number.isNaN(parsed.getTime())) {
        start = { dateTime: formatUtcTimestampAsBangkokNaive(parsed.getTime()), timeZone: TIMEZONE };
        end = { dateTime: formatUtcTimestampAsBangkokNaive(parsed.getTime() + 30 * 60 * 1000), timeZone: TIMEZONE };
      }
    }

    if (!start) {
      const normalizedDue = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmedDue)
        ? `${trimmedDue}:00`
        : trimmedDue.slice(0, 19);
      const match = normalizedDue.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/);
      if (!match) return null;
      const [, y, m, d, hh, mm, ss] = match.map(Number);
      const wallUtcMs = Date.UTC(y, m - 1, d, hh, mm, ss);
      const endWall = new Date(wallUtcMs + 30 * 60 * 1000);
      const endIso = `${endWall.getUTCFullYear()}-${String(endWall.getUTCMonth() + 1).padStart(2, '0')}-${String(endWall.getUTCDate()).padStart(2, '0')}T${String(endWall.getUTCHours()).padStart(2, '0')}:${String(endWall.getUTCMinutes()).padStart(2, '0')}:${String(endWall.getUTCSeconds()).padStart(2, '0')}`;
      start = { dateTime: normalizedDue, timeZone: TIMEZONE };
      end = { dateTime: endIso, timeZone: TIMEZONE };
    }
  } else {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmedDue)) return null;
    start = { date: trimmedDue };
    const [y, m, d] = trimmedDue.split('-').map(Number);
    const nextDay = new Date(Date.UTC(y, m - 1, d + 1));
    end = {
      date: `${nextDay.getUTCFullYear()}-${String(nextDay.getUTCMonth() + 1).padStart(2, '0')}-${String(nextDay.getUTCDate()).padStart(2, '0')}`
    };
  }

  return {
    summary: `[Assignment] ${assignment.title}`,
    description: [assignment.course, assignment.description].filter(Boolean).join('\n'),
    start,
    end,
    extendedProperties: { private: { chSource: SOURCE_TAG, chType: 'assignment', chId: String(assignment.id) } }
  };
}

function normalizeExamEntry(ex) {
  let startTime = '09:00';
  let endTime = '12:00';
  if (ex.time && typeof ex.time === 'string') {
    const parts = ex.time.split(/[-–]/).map(s => normalizeClockTime(s));
    if (parts.length === 2 && parts[0] && parts[1] && parts[0] < parts[1]) {
      startTime = parts[0];
      endTime = parts[1];
    }
  }

  let dateVal = '';
  if (ex.rawIsoDate && /^\d{4}-\d{2}-\d{2}/.test(ex.rawIsoDate)) {
    dateVal = ex.rawIsoDate.split('T')[0];
  } else if (ex.date) {
    const parsed = parseExamDate(ex.date);
    if (parsed) dateVal = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
  }
  if (!dateVal) return null;

  return {
    id: `exam-${ex.id}`,
    title: ex.subjectName || ex.courseName || 'Exam',
    courseCode: ex.subjectCode || ex.courseCode || '',
    date: dateVal,
    startTime,
    endTime,
    room: ex.room ? `${ex.room}${ex.seat ? ` (${ex.seat})` : ''}` : '',
    notes: ex.seat ? `Seat/Row: ${ex.seat}` : ''
  };
}

// ── Remote reconciliation & duplicate cleanup ───────────────────

async function listRemoteHubEvents(tokenRef) {
  const remoteByKey = new Map();
  const unkeyedIds = [];
  let pageToken = null;

  do {
    const url = new URL(CALENDAR_EVENTS_URL);
    url.searchParams.append('privateExtendedProperty', `chSource=${SOURCE_TAG}`);
    url.searchParams.set('maxResults', '2500');
    url.searchParams.set('singleEvents', 'false');
    if (pageToken) {
      url.searchParams.set('pageToken', pageToken);
    }

    const data = await calendarRequest(tokenRef, url.toString());
    const items = data?.items || [];
    for (const ev of items) {
      if (!ev?.id || ev.status === 'cancelled') continue;
      const priv = ev.extendedProperties?.private || {};
      if (priv.chType && priv.chId) {
        const key = `${priv.chType}:${priv.chId}`;
        if (!remoteByKey.has(key)) remoteByKey.set(key, []);
        remoteByKey.get(key).push(ev);
      } else {
        unkeyedIds.push(ev.id);
      }
    }
    pageToken = data?.nextPageToken || null;
  } while (pageToken);

  return { remoteByKey, unkeyedIds };
}

async function deleteRemoteEventById(tokenRef, eventId, contextLabel) {
  try {
    await calendarRequest(tokenRef, `${CALENDAR_EVENTS_URL}/${eventId}`, { method: 'DELETE' });
  } catch (err) {
    if (err instanceof AppError && (err.code === 404 || err.code === 410)) {
      return; // Already deleted on remote
    }
    logger.warn(`[Calendar Sync] Delete failed for ${contextLabel} (${eventId}).`, err.message);
    throw err;
  }
}

// ── Upsert / delete against the Calendar API ────────────────────

async function upsertEvent(tokenRef, key, body, map) {
  const sig = signatureOf(body);
  const existing = map[key];

  if (existing && existing.eventId) {
    if (existing.sig === sig) return; // unchanged, skip network call
    try {
      await calendarRequest(tokenRef, `${CALENDAR_EVENTS_URL}/${existing.eventId}`, {
        method: 'PATCH',
        body: JSON.stringify(body)
      });
      map[key] = { eventId: existing.eventId, sig };
      return;
    } catch (err) {
      const isGone = err instanceof AppError && (err.code === 404 || err.code === 410);
      if (!isGone) {
        // Do NOT create duplicate copies on rate-limit, auth, or transient network errors
        throw err;
      }
      logger.warn(`[Calendar Sync] Event ${key} missing on remote (${err.code}). Recreating...`);
    }
  }

  const created = await calendarRequest(tokenRef, CALENDAR_EVENTS_URL, {
    method: 'POST',
    body: JSON.stringify(body)
  });
  if (created && created.id) {
    map[key] = { eventId: created.id, sig };
  }
}

export function buildCalendarReminders(alertSettings = {}) {
  if (!alertSettings.calendarReminderEnabled) {
    return { useDefault: false, overrides: [] };
  }
  const rawVal = parseInt(alertSettings.calendarReminderValue, 10);
  let minutes = Number.isFinite(rawVal) ? rawVal : 10;
  if (alertSettings.calendarReminderUnit === 'hours') minutes *= 60;
  else if (alertSettings.calendarReminderUnit === 'days') minutes *= 24 * 60;
  minutes = Math.min(Math.max(minutes, 0), MAX_CALENDAR_REMINDER_MINUTES);

  return {
    useDefault: false,
    overrides: [{ method: 'popup', minutes }]
  };
}

/**
 * Main entry point: pushes schedule entries, exams, and pending assignment due dates
 * into the user's primary Google Calendar. Reconciles against existing Calendar events
 * so duplicates from earlier syncs and items deleted/hidden/done on the web are purged.
 */
export async function syncClassroomDataToCalendar(
  accessToken,
  email,
  { schedule = [], assignments = [], exams = [], manualExams = [], hiddenCourses = null } = {}
) {
  if (!accessToken || !email) return;

  const lowerEmail = email.toLowerCase().trim();
  const tokenRef = { token: accessToken, initialStoredToken: getToken() };
  const map = loadEventMap(lowerEmail);

  const alertSettings = getAlertSettings(lowerEmail);
  const reminders = buildCalendarReminders(alertSettings);
  const hiddenCourseIds = Array.isArray(hiddenCourses) ? hiddenCourses : getHiddenCourses(lowerEmail);

  const desiredEvents = [];
  const allExams = getMergedExams(exams || [], manualExams || []);

  // 1. Weekly class schedule (or one-off overrides with a specific date)
  for (const entry of schedule) {
    if (!entry || !entry.startTime || !entry.endTime || !entry.day) continue;
    try {
      const body = entry.date
        ? buildOneOffTimedEvent(entry, 'schedule')
        : buildRecurringClassEvent(entry, allExams);
      if (!body) continue;
      body.reminders = reminders;
      desiredEvents.push({ key: `schedule:${entry.id}`, body });
    } catch (err) {
      logger.warn('[Calendar Sync] Skipping invalid schedule entry:', entry?.id, err);
    }
  }

  // 2. Exams (auto-fetched + manually added)
  for (const ex of allExams) {
    try {
      const normalized = normalizeExamEntry(ex);
      if (!normalized) continue;
      const body = buildOneOffTimedEvent(normalized, 'exam');
      if (!body) continue;
      body.reminders = reminders;
      desiredEvents.push({ key: `exam:${normalized.id}`, body });
    } catch (err) {
      logger.warn('[Calendar Sync] Skipping invalid exam entry:', ex?.id, err);
    }
  }

  // 3. Pending assignment due dates (exclude completed/read tasks and hidden courses)
  for (const a of assignments) {
    if (!a || !a.dueDate) continue;
    if (a.status === 'done' || a.status === 'read') continue;
    if (a.courseId && hiddenCourseIds.includes(a.courseId)) continue;
    try {
      const body = buildAssignmentEvent(a);
      if (!body) continue;
      body.reminders = reminders;
      desiredEvents.push({ key: `assignment:${a.id}`, body });
    } catch (err) {
      logger.warn('[Calendar Sync] Skipping invalid assignment due date:', a?.id, err);
    }
  }

  const activeKeys = new Set(desiredEvents.map(d => d.key));

  try {
    // 4. Reconcile against actual Google Calendar events (deletes orphaned/deleted items + deduplicates!)
    const { remoteByKey, unkeyedIds } = await listRemoteHubEvents(tokenRef);

    for (const [key, remoteList] of remoteByKey.entries()) {
      if (!activeKeys.has(key)) {
        for (const ev of remoteList) {
          await deleteRemoteEventById(tokenRef, ev.id, key);
        }
        delete map[key];
      } else {
        const mappedId = map[key]?.eventId;
        const keeper = remoteList.find(ev => ev.id === mappedId) || remoteList[0];
        // Purge all extra duplicates of this key on Google Calendar
        for (const ev of remoteList) {
          if (ev.id !== keeper.id) {
            await deleteRemoteEventById(tokenRef, ev.id, `${key} (duplicate)`);
          }
        }
        // Adopt existing remote event into map if local map lost track (prevents multi-browser dupes)
        if (!map[key] || map[key].eventId !== keeper.id) {
          map[key] = { eventId: keeper.id, sig: null };
        }
      }
    }

    // Delete any unkeyed hub events that aren't validly tracked in local map
    const validMappedIds = new Set(Object.values(map).map(m => m?.eventId).filter(Boolean));
    for (const orphanId of unkeyedIds) {
      if (!validMappedIds.has(orphanId)) {
        await deleteRemoteEventById(tokenRef, orphanId, 'orphan');
      }
    }

    // Clean up any stale local map entries whose keys are no longer active
    for (const key of Object.keys(map)) {
      if (!activeKeys.has(key)) {
        if (map[key]?.eventId) {
          await deleteRemoteEventById(tokenRef, map[key].eventId, key);
        }
        delete map[key];
      }
    }

    // 5. Upsert active events (skipping unchanged signatures)
    for (const { key, body } of desiredEvents) {
      await upsertEvent(tokenRef, key, body, map);
    }

    saveEventMap(lowerEmail, map);
    logger.info(`[Calendar Sync] Sync complete. ${activeKeys.size} events tracked.`);
  } catch (err) {
    logger.error('[Calendar Sync] Sync failed:', err.message || err);
    saveEventMap(lowerEmail, map);
    throw err;
  }
}

/**
 * Resets all synced events by deleting them from the user's calendar
 * and clearing the local tracking map.
 */
export async function resetCalendarEvents(accessToken, email) {
  if (!accessToken || !email) return;

  const lowerEmail = email.toLowerCase().trim();
  const tokenRef = { token: accessToken, initialStoredToken: getToken() };
  logger.info('[Calendar Sync] Fetching all Classroom Hub events from Google Calendar to reset...');

  let deletedCount = 0;

  try {
    const { remoteByKey, unkeyedIds } = await listRemoteHubEvents(tokenRef);
    const allIds = new Set(unkeyedIds);
    for (const list of remoteByKey.values()) {
      for (const ev of list) allIds.add(ev.id);
    }

    // Also include any IDs still in local map just in case
    const localMap = loadEventMap(lowerEmail);
    for (const item of Object.values(localMap)) {
      if (item?.eventId) allIds.add(item.eventId);
    }

    for (const eventId of allIds) {
      try {
        await deleteRemoteEventById(tokenRef, eventId, `reset:${eventId}`);
        deletedCount++;
      } catch (err) {
        logger.warn(`[Calendar Sync] Failed to delete orphaned event ${eventId}`, err.message);
      }
    }

    saveEventMap(lowerEmail, {});
    logger.info(`[Calendar Sync] Calendar reset complete. Deleted ${deletedCount} events from Google Calendar.`);
  } catch (err) {
    logger.error('[Calendar Sync] Failed to fetch and reset calendar events from API:', err.message || err);
    throw err;
  }
}
