import { resolveExamIsoDate } from './courseEndDate';

function getTodayLocalIso() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function isoToUtcMs(isoDateStr) {
  const [y, m, d] = isoDateStr.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function daysBetweenIso(earlierIso, laterIso) {
  return Math.round((isoToUtcMs(laterIso) - isoToUtcMs(earlierIso)) / 86400000);
}

/**
 * Normalizes a course code for cross-source matching.
 * Strips leading zeros on numeric codes so KMUTNB SciBase (e.g. "40613203")
 * matches KMUTNB Reg (e.g. "040613203") seamlessly.
 */
export function normalizeExamCode(exam) {
  const raw = String(exam?.courseCode || exam?.subjectCode || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '');
  if (!raw || raw === 'classroom') return '';
  if (/^\d+$/.test(raw)) {
    return raw.replace(/^0+/, '') || '0';
  }
  return raw;
}

function normalizeExamTitle(exam) {
  return String(exam?.courseName || exam?.subjectName || exam?.title || '')
    .replace(/\((?:midterm|final|กลางภาค|ปลายภาค)\)/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function extractStartMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const match = timeStr.match(/(\d{1,2})[:.](\d{2})/);
  if (!match) return null;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

function isRegImportedExam(exam) {
  return exam?.source === 'kmutnb-reg' || String(exam?.id || '').startsWith('reg-exam-');
}

function hasMeaningfulValue(val) {
  const s = String(val || '').trim();
  return Boolean(s && s !== '-' && s !== '—');
}

/**
 * Returns true if a Student-ID fetched (SciBase) exam and a Reg/manual exam
 * represent the same course exam on the same date.
 */
export function isSameExamSlot(sciExam, manualExam) {
  const sciIso = resolveExamIsoDate(sciExam);
  const manIso = resolveExamIsoDate(manualExam);
  if (!sciIso || !manIso || sciIso !== manIso) return false;

  const sciCode = normalizeExamCode(sciExam);
  const manCode = normalizeExamCode(manualExam);
  if (sciCode && manCode) {
    return sciCode === manCode;
  }

  const sciName = normalizeExamTitle(sciExam);
  const manName = normalizeExamTitle(manualExam);
  if (sciName.length >= 5 && manName.length >= 5 && (sciName.includes(manName) || manName.includes(sciName))) {
    const sciStart = extractStartMinutes(sciExam?.time);
    const manStart = extractStartMinutes(manualExam?.time);
    return sciStart === null || manStart === null || sciStart === manStart;
  }

  return false;
}

/**
 * Reconciles Student-ID fetched exams (SciBase room/seating) with KMUTNB Reg / manual exams:
 *  1. Deduplicates matching (courseCode, date) exams by enriching the Reg/manual exam with
 *     official room & seat info from SciBase (zero duplicates across ExamRoom, Schedule, Home, Calendar).
 *  2. Ignores stale previous-semester SciBase exams whenever current/upcoming KMUTNB Reg exams exist,
 *     preventing last-semester seating data from polluting the active semester schedule & calendar.
 */
export function mergeExamSources(sciExams = [], manualExams = [], options = {}) {
  const safeSci = Array.isArray(sciExams) ? sciExams : [];
  const safeManual = Array.isArray(manualExams) ? manualExams : [];
  const todayIso = options.todayIso || getTodayLocalIso();

  const upcomingRegDates = safeManual
    .filter(isRegImportedExam)
    .map((ex) => resolveExamIsoDate(ex))
    .filter((iso) => iso && iso >= todayIso)
    .sort();

  const hasUpcomingReg = upcomingRegDates.length > 0;
  const earliestUpcomingReg = upcomingRegDates[0] || '';

  const datedSciIsos = safeSci.map((ex) => resolveExamIsoDate(ex)).filter(Boolean);
  const allSciArePast = datedSciIsos.length > 0 && datedSciIsos.every((iso) => iso < todayIso);

  const matchedSciIndexes = new Set();
  let mergedSeatingCount = 0;
  let ignoredStaleSciBaseCount = 0;

  // 1. Enrich manual / KMUTNB Reg exams with official room & seat from matching SciBase exam
  const enrichedManual = safeManual.map((manualEx) => {
    const sciIdx = safeSci.findIndex(
      (sciEx, idx) => !matchedSciIndexes.has(idx) && isSameExamSlot(sciEx, manualEx)
    );
    if (sciIdx === -1) return manualEx;

    matchedSciIndexes.add(sciIdx);
    const sciEx = safeSci[sciIdx];
    const sciHasSeating = hasMeaningfulValue(sciEx.room) || hasMeaningfulValue(sciEx.seat);

    const mergedRoom = hasMeaningfulValue(manualEx.room)
      ? manualEx.room
      : (hasMeaningfulValue(sciEx.room) ? sciEx.room : '');
    const mergedSeat = hasMeaningfulValue(manualEx.seat)
      ? manualEx.seat
      : (hasMeaningfulValue(sciEx.seat) ? sciEx.seat : '');
    const mergedTime = hasMeaningfulValue(manualEx.time)
      ? manualEx.time
      : (hasMeaningfulValue(sciEx.time) ? sciEx.time : '');

    mergedSeatingCount++;
    return {
      ...manualEx,
      room: mergedRoom,
      seat: mergedSeat,
      time: mergedTime,
      seatingSynced: sciHasSeating,
    };
  });

  // 2. Keep unmatched SciBase exams unless they are stale previous-semester records superseded by active Reg exams
  const remainingSci = [];
  safeSci.forEach((sciEx, idx) => {
    if (matchedSciIndexes.has(idx)) return;
    if (hasUpcomingReg) {
      const sciIso = resolveExamIsoDate(sciEx);
      if (
        sciIso &&
        sciIso < todayIso &&
        (allSciArePast || (earliestUpcomingReg && daysBetweenIso(sciIso, earliestUpcomingReg) > 45))
      ) {
        ignoredStaleSciBaseCount++;
        return;
      }
    }
    remainingSci.push(sciEx);
  });

  return {
    exams: [...remainingSci, ...enrichedManual],
    stats: {
      mergedSeatingCount,
      ignoredStaleSciBaseCount,
      activeSciBaseCount: remainingSci.length,
      hasActiveSciBaseSeating: mergedSeatingCount > 0 || remainingSci.length > 0,
    },
  };
}

/**
 * Convenience wrapper returning only the unified, deduplicated Exam array.
 */
export function getMergedExams(sciExams = [], manualExams = [], options = {}) {
  return mergeExamSources(sciExams, manualExams, options).exams;
}
