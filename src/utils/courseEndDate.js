import { parseExamDate } from './examDate';

export const COURSE_END_OFFSET_DAYS = 7;

const ISO_DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;
const MIDTERM_CLUSTER_GAP_DAYS = 14;
const DAY_KEY_TO_UTC_INDEX = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

function normalizeCode(code) {
  return String(code || '').trim().toLowerCase();
}

/**
 * Validates that a string is a real YYYY-MM-DD calendar date (no rollover like 2027-02-31).
 */
export function isValidIsoDate(dateStr) {
  if (typeof dateStr !== 'string') return false;
  const match = dateStr.trim().match(ISO_DATE_REGEX);
  if (!match) return false;
  const y = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const d = parseInt(match[3], 10);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

function isoToUtcMs(isoDateStr) {
  const [y, m, d] = isoDateStr.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function daysBeforeIso(candidateIso, refIso) {
  return Math.round((isoToUtcMs(refIso) - isoToUtcMs(candidateIso)) / 86400000);
}

function getIsoDayOfWeek(isoDateStr) {
  const [y, m, d] = isoDateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/**
 * Adds (or subtracts when negative) `days` calendar days to a YYYY-MM-DD string using UTC math.
 */
export function addDaysIso(isoDateStr, days) {
  if (!isValidIsoDate(isoDateStr) || !Number.isFinite(days)) return '';
  const [y, m, d] = isoDateStr.trim().split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/**
 * Subtracts `days` calendar days from a YYYY-MM-DD string using UTC math (immune to DST/TZ drift).
 */
export function subtractDaysIso(isoDateStr, days = COURSE_END_OFFSET_DAYS) {
  return addDaysIso(isoDateStr, -days);
}

function getMondayOfWeekIso(isoDateStr) {
  const dow = getIsoDayOfWeek(isoDateStr);
  const diffToMon = dow === 0 ? -6 : 1 - dow;
  return addDaysIso(isoDateStr, diffToMon);
}

function getSundayOfWeekIso(isoDateStr) {
  const dow = getIsoDayOfWeek(isoDateStr);
  const diffToSun = dow === 0 ? 0 : 7 - dow;
  return addDaysIso(isoDateStr, diffToSun);
}

/**
 * Extracts a normalized YYYY-MM-DD date string from an Exam record.
 */
export function resolveExamIsoDate(exam) {
  if (!exam || typeof exam !== 'object') return '';
  if (typeof exam.rawIsoDate === 'string') {
    const prefix = exam.rawIsoDate.trim().split('T')[0];
    if (isValidIsoDate(prefix)) return prefix;
  }
  if (typeof exam.date === 'string' && exam.date.trim()) {
    const rawTrimmed = exam.date.trim().split('T')[0];
    if (isValidIsoDate(rawTrimmed)) return rawTrimmed;
    const parsed = parseExamDate(exam.date);
    if (parsed) {
      const yy = parsed.getFullYear();
      const mm = String(parsed.getMonth() + 1).padStart(2, '0');
      const dd = String(parsed.getDate()).padStart(2, '0');
      return `${yy}-${mm}-${dd}`;
    }
  }
  return '';
}

/**
 * Classifies an exam as 'midterm', 'final', or 'unknown'.
 */
export function classifyExamKind(exam) {
  if (!exam || typeof exam !== 'object') return 'unknown';
  const rawType = String(exam.examType || '').trim().toLowerCase();
  if (rawType === 'final') return 'final';
  if (rawType === 'midterm') return 'midterm';

  const idStr = String(exam.id || '').toLowerCase();
  if (idStr.includes('-final-')) return 'final';
  if (idStr.includes('-midterm-')) return 'midterm';

  const label = `${exam.courseName || ''} ${exam.subjectName || ''} ${exam.title || ''}`;
  if (/\bfinal\b|ปลายภาค/i.test(label)) return 'final';
  if (/\bmidterm\b|กลางภาค/i.test(label)) return 'midterm';

  return 'unknown';
}

/**
 * Computes Midterm exam pause windows (Mon–Sun week spans) from Midterm exams.
 * Contiguous midterm exams within 14 days of each other form one pause window so
 * regular classes pause during Midterm week and resume normally right afterward.
 */
export function resolveMidtermPauseRanges(allExams = []) {
  if (!Array.isArray(allExams) || allExams.length === 0) return [];

  const midtermDates = Array.from(
    new Set(
      allExams
        .filter((ex) => classifyExamKind(ex) === 'midterm')
        .map((ex) => resolveExamIsoDate(ex))
        .filter((iso) => isValidIsoDate(iso))
    )
  ).sort();

  if (midtermDates.length === 0) return [];

  // Group into contiguous clusters (<= 14 days apart)
  const clusters = [[midtermDates[0]]];
  for (let i = 1; i < midtermDates.length; i++) {
    const prevCluster = clusters[clusters.length - 1];
    const lastDate = prevCluster[prevCluster.length - 1];
    const gap = daysBeforeIso(lastDate, midtermDates[i]);
    if (gap <= MIDTERM_CLUSTER_GAP_DAYS) {
      prevCluster.push(midtermDates[i]);
    } else {
      clusters.push([midtermDates[i]]);
    }
  }

  // Snap each cluster to Mon..Sun exam week and merge overlapping/adjacent ranges
  const rawRanges = clusters.map((cluster) => ({
    start: getMondayOfWeekIso(cluster[0]),
    end: getSundayOfWeekIso(cluster[cluster.length - 1]),
    examStart: cluster[0],
    examEnd: cluster[cluster.length - 1],
  }));

  const merged = [];
  for (const r of rawRanges) {
    const prev = merged[merged.length - 1];
    if (prev && daysBeforeIso(prev.end, r.start) <= 1) {
      if (r.end > prev.end) prev.end = r.end;
      if (r.examEnd > prev.examEnd) prev.examEnd = r.examEnd;
    } else {
      merged.push({ ...r });
    }
  }

  return merged;
}

/**
 * Resolves the Midterm pause ranges applicable to a specific recurring schedule entry.
 * Applies to KMUTNB Reg courses and any recurring course matching an exam code in `allExams`,
 * while leaving unrelated personal recurring events untouched.
 */
export function resolveEntryPauseRanges(entry, allExams = []) {
  if (!entry || entry.date || entry.isExam || entry.isAssignment) return [];
  if (entry._pauseRangesResolved) {
    return Array.isArray(entry._pauseRanges) ? entry._pauseRanges : [];
  }

  const midtermRanges = resolveMidtermPauseRanges(allExams);
  if (midtermRanges.length === 0) return [];

  const isRegCourse = entry.source === 'kmutnb-reg' || String(entry.id || '').startsWith('reg-');
  if (isRegCourse) return midtermRanges;

  const entryCode = normalizeCode(entry.courseCode);
  if (entryCode) {
    const hasMatchingExam = allExams.some(
      (ex) => normalizeCode(ex?.subjectCode || ex?.courseCode) === entryCode
    );
    if (hasMatchingExam) return midtermRanges;
  }

  return [];
}

export function isDateInRanges(dateStr, ranges = []) {
  if (!dateStr || !Array.isArray(ranges) || ranges.length === 0) return false;
  return ranges.some((r) => dateStr >= r.start && dateStr <= r.end);
}

/**
 * Returns whether a recurring schedule entry is temporarily paused on `dateStr` (e.g. Midterm Exam Week).
 */
export function isEntryPausedOnDate(entry, dateStr, allExams = []) {
  if (!entry || !dateStr || entry.date || entry.isExam || entry.isAssignment) return false;
  const ranges = resolveEntryPauseRanges(entry, allExams);
  return isDateInRanges(dateStr, ranges);
}

/**
 * Collects all YYYY-MM-DD occurrence dates for a given weekday key ('mon'..'sun')
 * that fall inside any of `pauseRanges`.
 */
export function collectPausedDatesForDay(dayKey, pauseRanges = []) {
  const targetDow = DAY_KEY_TO_UTC_INDEX[dayKey];
  if (targetDow === undefined || !Array.isArray(pauseRanges) || pauseRanges.length === 0) {
    return [];
  }

  const found = new Set();
  for (const range of pauseRanges) {
    if (!isValidIsoDate(range?.start) || !isValidIsoDate(range?.end) || range.start > range.end) {
      continue;
    }
    let cur = range.start;
    for (let step = 0; step < 60 && cur && cur <= range.end; step++) {
      if (getIsoDayOfWeek(cur) === targetDow) {
        found.add(cur);
      }
      cur = addDaysIso(cur, 1);
    }
  }

  return Array.from(found).sort();
}

/**
 * Resolves the effective course closing date (inclusive last day of recurring classes)
 * along with its provenance:
 *  - 'explicit': saved directly on `entry.endDate`
 *  - 'course-exam': 1 week (7 days) before this course's Final Exam
 *  - 'semester-finals': 1 week before the semester's earliest Final Exam (fallback for KMUTNB Reg courses with no final exam)
 *  - 'none': no closing date
 */
export function resolveCourseExamInfo(entry, allExams = [], offsetDays = COURSE_END_OFFSET_DAYS) {
  const empty = { endDate: '', source: 'none', examDate: '' };
  if (!entry || entry.date || entry.isExam || entry.isAssignment) return empty;

  // 1. Respect explicit user override ("no end date")
  if (entry.noAutoEndDate === true) return empty;

  // 2. Explicit saved endDate
  if (isValidIsoDate(entry.endDate)) {
    return { endDate: entry.endDate.trim(), source: 'explicit', examDate: '' };
  }

  if (!Array.isArray(allExams) || allExams.length === 0) return empty;

  const entryCode = normalizeCode(entry.courseCode);
  const isRegCourse = entry.source === 'kmutnb-reg' || String(entry.id || '').startsWith('reg-');

  const normalizedExams = allExams
    .map((ex) => {
      const isoDate = resolveExamIsoDate(ex);
      if (!isoDate) return null;
      return {
        isoDate,
        kind: classifyExamKind(ex),
        code: normalizeCode(ex.subjectCode || ex.courseCode),
      };
    })
    .filter(Boolean);

  if (normalizedExams.length === 0) return empty;

  const allFinalDates = normalizedExams
    .filter((ex) => ex.kind === 'final')
    .map((ex) => ex.isoDate)
    .sort();
  const earliestSemesterFinal = allFinalDates[0] || '';

  // 3. Match this course's own exams by courseCode
  if (entryCode) {
    const courseExams = normalizedExams.filter((ex) => ex.code && ex.code === entryCode);

    // 3a. Explicit Final Exam(s) for this course -> latest final minus 7 days
    const courseFinals = courseExams
      .filter((ex) => ex.kind === 'final')
      .map((ex) => ex.isoDate)
      .sort();
    if (courseFinals.length > 0) {
      const finalIso = courseFinals[courseFinals.length - 1];
      return {
        endDate: subtractDaysIso(finalIso, offsetDays),
        source: 'course-exam',
        examDate: finalIso,
      };
    }

    // 3b. Untagged exam(s) for this course (e.g., SciBase seating or custom manual exam)
    // Skip untagged exams >30 days before known semester finals (those belong to Midterm period)
    const courseUnknown = courseExams
      .filter((ex) => ex.kind === 'unknown')
      .map((ex) => ex.isoDate)
      .filter((iso) => !earliestSemesterFinal || daysBeforeIso(iso, earliestSemesterFinal) <= 30)
      .sort();
    if (courseUnknown.length > 0) {
      const examIso = courseUnknown[courseUnknown.length - 1];
      return {
        endDate: subtractDaysIso(examIso, offsetDays),
        source: 'course-exam',
        examDate: examIso,
      };
    }
  }

  // 4. Fallback for KMUTNB Reg courses without a listed Final Exam (e.g., PE / project / midterm-only)
  if (isRegCourse && earliestSemesterFinal) {
    return {
      endDate: subtractDaysIso(earliestSemesterFinal, offsetDays),
      source: 'semester-finals',
      examDate: earliestSemesterFinal,
    };
  }

  return empty;
}

/**
 * Convenience wrapper returning only the effective YYYY-MM-DD endDate string (or '').
 */
export function resolveCourseEndDate(entry, allExams = [], offsetDays = COURSE_END_OFFSET_DAYS) {
  return resolveCourseExamInfo(entry, allExams, offsetDays).endDate;
}

/**
 * Returns whether a schedule entry is active on a specific YYYY-MM-DD date.
 * - `deletedAt` is exclusive (`dateStr >= deletedAt` -> inactive)
 * - `endDate` is inclusive (`dateStr > effectiveEndDate` -> inactive)
 * - Midterm exam week pause ranges temporarily pause recurring classes (resuming afterward)
 */
export function isScheduleEntryActiveOnDate(entry, dateStr, allExams = []) {
  if (!entry || !dateStr) return false;
  if (entry.deletedAt && dateStr >= entry.deletedAt) return false;

  if (entry.isExam || entry.isAssignment || entry.date) {
    return entry.date === dateStr;
  }

  const effectiveEnd = entry._endDateResolved
    ? (entry._effectiveEndDate || '')
    : resolveCourseEndDate(entry, allExams);

  if (effectiveEnd && dateStr > effectiveEnd) {
    return false;
  }

  if (isEntryPausedOnDate(entry, dateStr, allExams)) {
    return false;
  }

  return true;
}

/**
 * Formats an ISO YYYY-MM-DD date for display in Thai (BE) or English.
 */
export function formatCourseEndDateLabel(isoDateStr, lang = 'th', { withYear = false } = {}) {
  if (!isValidIsoDate(isoDateStr)) return '';
  const [y, m, d] = isoDateStr.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  return dateObj.toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US', {
    day: 'numeric',
    month: 'short',
    ...(withYear ? { year: 'numeric' } : {}),
  });
}
