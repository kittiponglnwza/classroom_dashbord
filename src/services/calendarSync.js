import { logger } from '../utils/logger';
import { parseExamDate } from '../utils/examDate';
import { getAlertSettings } from '../utils/storage';

const CALENDAR_EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
const TIMEZONE = 'Asia/Bangkok';
const SOURCE_TAG = 'classroom-hub';

const DAY_TO_RRULE = { mon: 'MO', tue: 'TU', wed: 'WE', thu: 'TH', fri: 'FR', sat: 'SA', sun: 'SU' };
const DAY_TO_JS_INDEX = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

/**
 * Low-level fetch wrapper for the Calendar API.
 * Kept separate from the shared httpClient because DELETE calls return
 * an empty 204 body, which would break httpClient's `response.json()` parsing.
 */
async function calendarRequest(accessToken, path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  if (response.status === 204) return null; // DELETE success, no body
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Calendar API error (${response.status}): ${text}`);
  }
  if (response.status === 201 || response.status === 200) {
    return await response.json().catch(() => null);
  }
  return null;
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
    l: body.location || '',
    st: body.start,
    en: body.end,
    r: body.recurrence || null
  });
}

// ── Event builders ──────────────────────────────────────────────

function nextDateForDay(dayKey) {
  const today = new Date();
  const todayIdx = today.getDay();
  const targetIdx = DAY_TO_JS_INDEX[dayKey];
  const diff = (targetIdx - todayIdx + 7) % 7;
  const d = new Date(today);
  d.setDate(today.getDate() + diff);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function buildRecurringClassEvent(entry) {
  const anchorDate = nextDateForDay(entry.day);
  return {
    summary: entry.title || entry.courseCode || 'Class',
    location: entry.room || '',
    description: [entry.courseCode, entry.notes].filter(Boolean).join('\n'),
    start: { dateTime: `${anchorDate}T${entry.startTime}:00`, timeZone: TIMEZONE },
    end: { dateTime: `${anchorDate}T${entry.endTime}:00`, timeZone: TIMEZONE },
    recurrence: [`RRULE:FREQ=WEEKLY;BYDAY=${DAY_TO_RRULE[entry.day]}`],
    extendedProperties: { private: { chSource: SOURCE_TAG, chType: 'schedule', chId: String(entry.id) } }
  };
}

function buildOneOffTimedEvent(entry, typeLabel) {
  return {
    summary: entry.title || entry.courseCode || (typeLabel === 'exam' ? 'Exam' : 'Class'),
    location: entry.room || '',
    description: [entry.courseCode, entry.notes].filter(Boolean).join('\n'),
    start: { dateTime: `${entry.date}T${entry.startTime}:00`, timeZone: TIMEZONE },
    end: { dateTime: `${entry.date}T${entry.endTime}:00`, timeZone: TIMEZONE },
    extendedProperties: { private: { chSource: SOURCE_TAG, chType: typeLabel, chId: String(entry.id) } }
  };
}

function buildAssignmentEvent(assignment) {
  const hasTime = typeof assignment.dueDate === 'string' && assignment.dueDate.includes('T');
  let start, end;

  if (hasTime) {
    start = { dateTime: assignment.dueDate, timeZone: TIMEZONE };
    const endDate = new Date(assignment.dueDate);
    endDate.setMinutes(endDate.getMinutes() + 30);
    end = { dateTime: `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}T${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}:00`, timeZone: TIMEZONE };
  } else {
    start = { date: assignment.dueDate };
    const endDate = new Date(`${assignment.dueDate}T00:00:00`);
    endDate.setDate(endDate.getDate() + 1);
    end = { date: `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}` };
  }

  return {
    summary: `📌 ${assignment.title}`,
    description: [assignment.course, assignment.description].filter(Boolean).join('\n'),
    start,
    end,
    extendedProperties: { private: { chSource: SOURCE_TAG, chType: 'assignment', chId: String(assignment.id) } }
  };
}

/**
 * Normalizes a raw exam record (from the KMUTNB exam parser or a manual entry)
 * into the same {id, title, courseCode, date, startTime, endTime, room, notes} shape
 * used by the Schedule page, so it can reuse buildOneOffTimedEvent.
 */
function normalizeExamEntry(ex) {
  let startTime = '09:00';
  let endTime = '12:00';
  if (ex.time) {
    const parts = ex.time.split('-').map(s => s.trim());
    if (parts.length === 2) {
      startTime = parts[0];
      endTime = parts[1];
    }
  }

  let dateVal = '';
  if (ex.rawIsoDate) {
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

// ── Upsert / delete against the Calendar API ────────────────────

async function upsertEvent(accessToken, key, body, map) {
  const sig = signatureOf(body);
  const existing = map[key];

  if (existing && existing.eventId) {
    if (existing.sig === sig) return; // unchanged, skip network call
    try {
      await calendarRequest(accessToken, `${CALENDAR_EVENTS_URL}/${existing.eventId}`, {
        method: 'PATCH',
        body: JSON.stringify(body)
      });
      map[key] = { eventId: existing.eventId, sig };
      return;
    } catch (err) {
      logger.warn(`[Calendar Sync] Patch failed for ${key} (event may have been removed manually). Recreating...`, err.message);
      // fall through and create a fresh event below
    }
  }

  const created = await calendarRequest(accessToken, CALENDAR_EVENTS_URL, {
    method: 'POST',
    body: JSON.stringify(body)
  });
  if (created && created.id) {
    map[key] = { eventId: created.id, sig };
  }
}

async function deleteEvent(accessToken, key, map) {
  const existing = map[key];
  if (!existing || !existing.eventId) {
    delete map[key];
    return;
  }
  try {
    await calendarRequest(accessToken, `${CALENDAR_EVENTS_URL}/${existing.eventId}`, { method: 'DELETE' });
  } catch (err) {
    logger.warn(`[Calendar Sync] Delete failed for ${key} (may already be gone).`, err.message);
  }
  delete map[key];
}

/**
 * Main entry point: pushes schedule entries, exams, and assignment due dates
 * into the user's primary Google Calendar. Safe to call repeatedly —
 * unchanged items are skipped, changed items are patched, removed items
 * are deleted, using a local id->eventId map for tracking.
 */
export async function syncClassroomDataToCalendar(accessToken, email, { schedule = [], assignments = [], exams = [], manualExams = [] } = {}) {
  if (!accessToken || !email) return;

  const map = loadEventMap(email);
  const activeKeys = new Set();
  
  const alertSettings = getAlertSettings(email);
  let reminders;

  if (!alertSettings.calendarReminderEnabled) {
    reminders = { useDefault: false };
  } else {
    let minutes = parseInt(alertSettings.calendarReminderValue, 10) || 10;
    if (alertSettings.calendarReminderUnit === 'hours') minutes *= 60;
    else if (alertSettings.calendarReminderUnit === 'days') minutes *= 24 * 60;
    
    reminders = {
      useDefault: false,
      overrides: [{ method: 'popup', minutes }]
    };
  }

  try {
    // 1. Weekly class schedule (or one-off overrides with a specific date)
    for (const entry of schedule) {
      if (!entry || !entry.startTime || !entry.endTime || !entry.day) continue;
      if (entry.startTime === entry.endTime) continue; // skip empty time range
      const key = `schedule:${entry.id}`;
      activeKeys.add(key);
      const body = entry.date
        ? buildOneOffTimedEvent(entry, 'schedule')
        : buildRecurringClassEvent(entry);
      body.reminders = reminders;
      await upsertEvent(accessToken, key, body, map);
    }

    // 2. Exams (auto-fetched + manually added)
    const allExams = [...(exams || []), ...(manualExams || [])];
    for (const ex of allExams) {
      const normalized = normalizeExamEntry(ex);
      if (!normalized) continue;
      if (normalized.startTime === normalized.endTime) continue; // skip empty time range
      const key = `exam:${normalized.id}`;
      activeKeys.add(key);
      const body = buildOneOffTimedEvent(normalized, 'exam');
      body.reminders = reminders;
      await upsertEvent(accessToken, key, body, map);
    }

    // 3. Assignment due dates
    for (const a of assignments) {
      if (!a || !a.dueDate) continue;
      const key = `assignment:${a.id}`;
      activeKeys.add(key);
      const body = buildAssignmentEvent(a);
      body.reminders = reminders;
      await upsertEvent(accessToken, key, body, map);
    }

    // 4. Clean up events whose source item no longer exists
    for (const key of Object.keys(map)) {
      if (!activeKeys.has(key)) {
        await deleteEvent(accessToken, key, map);
      }
    }

    saveEventMap(email, map);
    logger.info(`[Calendar Sync] Sync complete. ${activeKeys.size} events tracked.`);
  } catch (err) {
    logger.error('[Calendar Sync] Sync failed:', err.message || err);
    saveEventMap(email, map); // keep whatever progress was made
    throw err;
  }
}

/**
 * Resets all synced events by deleting them from the user's calendar
 * and clearing the local tracking map.
 */
export async function resetCalendarEvents(accessToken, email) {
  if (!accessToken || !email) return;

  const map = loadEventMap(email);
  const keys = Object.keys(map);
  
  if (keys.length === 0) {
    logger.info('[Calendar Sync] No local events tracked to reset.');
    return;
  }

  logger.info(`[Calendar Sync] Resetting ${keys.length} calendar events...`);
  
  for (const key of keys) {
    await deleteEvent(accessToken, key, map);
  }

  saveEventMap(email, map); // should be empty now
  logger.info('[Calendar Sync] Calendar reset complete.');
}