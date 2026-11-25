const VALID_WEEKDAYS = {
  sun: 'sun',
  mon: 'mon',
  tue: 'tue',
  wed: 'wed',
  thu: 'thu',
  fri: 'fri',
  sat: 'sat'
};

const ISO_DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const NAIVE_DATETIME_RE = /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?$/;
const HAS_TZ_OFFSET_RE = /(?:[zZ]|[+-]\d{2}:?\d{2})$/;

export const DEFAULT_TIMEZONE = 'Asia/Bangkok';

const pad2 = (n) => String(n).padStart(2, '0');

/**
 * Validates an IANA timezone identifier, falling back safely to Asia/Bangkok.
 */
export function normalizeTimezone(tz, fallback = DEFAULT_TIMEZONE) {
  const candidate = typeof tz === 'string' ? tz.trim() : '';
  if (!candidate) return fallback;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: candidate }).format(new Date(0));
    return candidate;
  } catch {
    return fallback;
  }
}

/**
 * Extracts calendar & clock components for a Date/timestamp in a target IANA timezone.
 * Handles DST and midnight '24' formatting quirks cleanly.
 */
export function getZonedDateParts(dateInput = new Date(), timeZone = DEFAULT_TIMEZONE) {
  const safeTz = normalizeTimezone(timeZone);
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(date.getTime())) return null;

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: safeTz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  });

  const partsMap = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== 'literal') {
      partsMap[part.type] = part.value;
    }
  }

  const year = parseInt(partsMap.year, 10);
  const month = parseInt(partsMap.month, 10);
  const day = parseInt(partsMap.day, 10);
  const rawHour = parseInt(partsMap.hour, 10);
  const hour = rawHour === 24 ? 0 : rawHour;
  const minute = parseInt(partsMap.minute, 10);
  const second = parseInt(partsMap.second, 10);
  const wkRaw = String(partsMap.weekday || '').toLowerCase().slice(0, 3);
  const weekdayKey = VALID_WEEKDAYS[wkRaw] || 'mon';

  const dateStr = `${year}-${pad2(month)}-${pad2(day)}`;
  const timeStr = `${pad2(hour)}:${pad2(minute)}`;

  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    weekdayKey,
    dateStr,
    timeStr,
    minutesOfDay: hour * 60 + minute,
    timeZone: safeTz
  };
}

/**
 * Returns YYYY-MM-DD in the target timezone.
 */
export function getZonedDateStr(dateInput = new Date(), timeZone = DEFAULT_TIMEZONE) {
  const parts = getZonedDateParts(dateInput, timeZone);
  return parts ? parts.dateStr : '';
}

/**
 * Converts wall-clock date/time components in `timeZone` into an exact UTC epoch timestamp (ms),
 * refining across DST boundaries when applicable.
 */
export function zonedWallTimeToUtcMs(
  { year, month, day, hour = 0, minute = 0, second = 0, ms = 0 },
  timeZone = DEFAULT_TIMEZONE
) {
  const safeTz = normalizeTimezone(timeZone);
  const targetWallUtc = Date.UTC(year, month - 1, day, hour, minute, second, ms);
  let guess = targetWallUtc;

  for (let i = 0; i < 2; i++) {
    const parts = getZonedDateParts(new Date(guess), safeTz);
    if (!parts) break;
    const actualWallUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
      ms
    );
    const diff = actualWallUtc - targetWallUtc;
    guess -= diff;
    if (diff === 0) break;
  }

  return guess;
}

/**
 * Pure calendar-day difference (laterIso - earlierIso) between two YYYY-MM-DD strings.
 */
export function diffIsoCalendarDays(laterIso, earlierIso) {
  if (!laterIso || !earlierIso) return null;
  const m1 = String(laterIso).trim().match(ISO_DATE_ONLY_RE);
  const m2 = String(earlierIso).trim().match(ISO_DATE_ONLY_RE);
  if (!m1 || !m2) return null;

  const utc1 = Date.UTC(parseInt(m1[1], 10), parseInt(m1[2], 10) - 1, parseInt(m1[3], 10));
  const utc2 = Date.UTC(parseInt(m2[1], 10), parseInt(m2[2], 10) - 1, parseInt(m2[3], 10));
  return Math.round((utc1 - utc2) / 86400000);
}

/**
 * Adds (or subtracts) calendar days to a YYYY-MM-DD string.
 */
export function shiftIsoDate(isoDateStr, deltaDays) {
  const m = String(isoDateStr || '').trim().match(ISO_DATE_ONLY_RE);
  if (!m || !Number.isFinite(deltaDays)) return '';
  const dt = new Date(Date.UTC(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10) + deltaDays));
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

/**
 * Returns the Sunday YYYY-MM-DD of the week containing `dateInput` in `timeZone`
 * (using Sunday-anchored week stamp compatible with legacy `sunday_digest` keys, or ISO week start).
 */
export function getZonedSundayDateStr(dateInput = new Date(), timeZone = DEFAULT_TIMEZONE) {
  const parts = getZonedDateParts(dateInput, timeZone);
  if (!parts) return '';
  const dayOffsetMap = { sun: 0, mon: -1, tue: -2, wed: -3, thu: -4, fri: -5, sat: -6 };
  return shiftIsoDate(parts.dateStr, dayOffsetMap[parts.weekdayKey] ?? 0);
}

/**
 * Parses an assignment/academic dueDate into canonical timezone-aware metadata:
 * - Date-only `YYYY-MM-DD` -> 23:59:59 in `timeZone`
 * - Naive ISO `YYYY-MM-DDTHH:mm(:ss)` -> wall-clock in `timeZone`
 * - Offset/UTC ISO `...Z` / `...+07:00` -> exact instant projected into `timeZone`
 */
export function parseAcademicDueDate(dueInput, timeZone = DEFAULT_TIMEZONE) {
  if (!dueInput) return null;
  const safeTz = normalizeTimezone(timeZone);

  if (dueInput instanceof Date) {
    if (Number.isNaN(dueInput.getTime())) return null;
    const parts = getZonedDateParts(dueInput, safeTz);
    if (!parts) return null;
    return {
      dueMs: dueInput.getTime(),
      dateStr: parts.dateStr,
      timeStr: parts.timeStr,
      hasExplicitTime: true,
      fingerprint: `${parts.dateStr}T${parts.timeStr}`,
      timeZone: safeTz
    };
  }

  if (typeof dueInput !== 'string') return null;
  const trimmed = dueInput.trim();
  if (!trimmed) return null;

  const dateOnlyMatch = trimmed.match(ISO_DATE_ONLY_RE);
  if (dateOnlyMatch) {
    const year = parseInt(dateOnlyMatch[1], 10);
    const month = parseInt(dateOnlyMatch[2], 10);
    const day = parseInt(dateOnlyMatch[3], 10);
    const check = new Date(Date.UTC(year, month - 1, day));
    if (
      check.getUTCFullYear() !== year ||
      check.getUTCMonth() !== month - 1 ||
      check.getUTCDate() !== day
    ) {
      return null;
    }
    const dueMs = zonedWallTimeToUtcMs({ year, month, day, hour: 23, minute: 59, second: 59, ms: 999 }, safeTz);
    const dateStr = `${year}-${pad2(month)}-${pad2(day)}`;
    return {
      dueMs,
      dateStr,
      timeStr: '23:59',
      hasExplicitTime: false,
      fingerprint: dateStr,
      timeZone: safeTz
    };
  }

  if (!HAS_TZ_OFFSET_RE.test(trimmed)) {
    const naiveMatch = trimmed.match(NAIVE_DATETIME_RE);
    if (naiveMatch) {
      const year = parseInt(naiveMatch[1], 10);
      const month = parseInt(naiveMatch[2], 10);
      const day = parseInt(naiveMatch[3], 10);
      const hour = parseInt(naiveMatch[4], 10);
      const minute = parseInt(naiveMatch[5], 10);
      const second = naiveMatch[6] ? parseInt(naiveMatch[6], 10) : 0;
      if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) {
        return null;
      }
      const dueMs = zonedWallTimeToUtcMs({ year, month, day, hour, minute, second }, safeTz);
      const dateStr = `${year}-${pad2(month)}-${pad2(day)}`;
      const timeStr = `${pad2(hour)}:${pad2(minute)}`;
      return {
        dueMs,
        dateStr,
        timeStr,
        hasExplicitTime: true,
        fingerprint: `${dateStr}T${timeStr}`,
        timeZone: safeTz
      };
    }
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  const parts = getZonedDateParts(parsed, safeTz);
  if (!parts) return null;

  return {
    dueMs: parsed.getTime(),
    dateStr: parts.dateStr,
    timeStr: parts.timeStr,
    hasExplicitTime: true,
    fingerprint: `${parts.dateStr}T${parts.timeStr}`,
    timeZone: safeTz
  };
}

/**
 * Computes integer calendar-day delta (dueDate - now) in `timeZone`,
 * plus exact millisecond delta so same-day overdue vs upcoming today is unambiguous.
 */
export function evaluateDueTiming(dueInput, nowInput = new Date(), timeZone = DEFAULT_TIMEZONE) {
  const safeTz = normalizeTimezone(timeZone);
  const parsedDue = parseAcademicDueDate(dueInput, safeTz);
  const nowDate = nowInput instanceof Date ? nowInput : new Date(nowInput);
  const nowParts = getZonedDateParts(nowDate, safeTz);
  if (!parsedDue || !nowParts) return null;

  const calendarDaysDiff = diffIsoCalendarDays(parsedDue.dateStr, nowParts.dateStr);
  const diffMs = parsedDue.dueMs - nowDate.getTime();
  const isPastDeadline = diffMs < 0;

  return {
    ...parsedDue,
    nowDateStr: nowParts.dateStr,
    calendarDaysDiff,
    diffMs,
    isPastDeadline
  };
}

/**
 * Parses HH:MM (or H:MM / HH.MM) into minutes since midnight (0..1439).
 */
export function parseClockMinutes(clockStr, fallback = null) {
  if (typeof clockStr !== 'string') return fallback;
  const m = clockStr.trim().match(/^(\d{1,2})[:.](\d{2})$/);
  if (!m) return fallback;
  const hh = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return fallback;
  return hh * 60 + mm;
}

/**
 * Normalizes a HH:MM clock string, returning fallback if invalid.
 */
export function normalizeClockStr(clockStr, fallback = '07:00') {
  const mins = parseClockMinutes(clockStr, null);
  if (mins === null) return fallback;
  return `${pad2(Math.floor(mins / 60))}:${pad2(mins % 60)}`;
}

/**
 * Checks if current wall-clock time in `timeZone` has reached or passed `targetClockStr` (HH:MM).
 */
export function hasTimePassedToday(nowInput = new Date(), targetClockStr = '07:00', timeZone = DEFAULT_TIMEZONE) {
  const parts = getZonedDateParts(nowInput, timeZone);
  const targetMins = parseClockMinutes(targetClockStr, 7 * 60);
  if (!parts || targetMins === null) return false;
  return parts.minutesOfDay >= targetMins;
}

/**
 * Evaluates whether `nowInput` falls inside configured quiet hours in `timeZone`.
 * Supports both intra-day (e.g. 13:00-15:00) and overnight (e.g. 22:00-06:30) windows.
 */
export function isWithinQuietHours(
  nowInput = new Date(),
  quietConfig = {},
  timeZone = DEFAULT_TIMEZONE
) {
  if (!quietConfig?.quietHoursEnabled) return false;
  const startMins = parseClockMinutes(quietConfig.quietHoursStart, 22 * 60);
  const endMins = parseClockMinutes(quietConfig.quietHoursEnd, 6 * 60 + 30);
  if (startMins === null || endMins === null || startMins === endMins) return false;

  const parts = getZonedDateParts(nowInput, timeZone);
  if (!parts) return false;
  const cur = parts.minutesOfDay;

  if (startMins < endMins) {
    return cur >= startMins && cur < endMins;
  }
  return cur >= startMins || cur < endMins;
}

/**
 * Formats an academic deadline or timestamp cleanly in `timeZone` for Discord embeds.
 */
export function formatZonedDateTimeLabel(dueInput, timeZone = DEFAULT_TIMEZONE, lang = 'en') {
  const safeTz = normalizeTimezone(timeZone);
  const parsed = parseAcademicDueDate(dueInput, safeTz);
  if (!parsed) return typeof dueInput === 'string' && dueInput.trim() ? dueInput.trim() : 'No due date';

  const locale = lang === 'th' ? 'th-TH' : 'en-US';
  const dt = new Date(parsed.dueMs);
  const dateLabel = dt.toLocaleDateString(locale, {
    timeZone: safeTz,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  if (!parsed.hasExplicitTime) {
    return `${dateLabel} (23:59)`;
  }
  return `${dateLabel}, ${parsed.timeStr}`;
}
