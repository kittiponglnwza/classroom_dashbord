import { classifyExamKind, resolveExamIsoDate, subtractDaysIso } from './courseEndDate';

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

function distanceToRangeDays(iso, range) {
  if (!iso || !range) return Infinity;
  if (iso >= range.min && iso <= range.max) return 0;
  if (iso < range.min) return daysBetweenIso(iso, range.min);
  return daysBetweenIso(range.max, iso);
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

export function isRegImportedExam(exam) {
  return exam?.source === 'kmutnb-reg' || String(exam?.id || '').startsWith('reg-exam-');
}

/**
 * Returns true if a Student-ID fetched (SciBase) exam and another exam
 * represent the same course exam on the same date.
 */
export function isSameExamSlot(sciExam, otherExam) {
  const sciIso = resolveExamIsoDate(sciExam);
  const otherIso = resolveExamIsoDate(otherExam);
  if (!sciIso || !otherIso || sciIso !== otherIso) return false;

  const sciCode = normalizeExamCode(sciExam);
  const otherCode = normalizeExamCode(otherExam);
  if (sciCode && otherCode) {
    return sciCode === otherCode;
  }

  const sciName = normalizeExamTitle(sciExam);
  const otherName = normalizeExamTitle(otherExam);
  if (sciName.length >= 5 && otherName.length >= 5 && (sciName.includes(otherName) || otherName.includes(sciName))) {
    const sciStart = extractStartMinutes(sciExam?.time);
    const otherStart = extractStartMinutes(otherExam?.time);
    return sciStart === null || otherStart === null || sciStart === otherStart;
  }

  return false;
}

function inferSciExamRound(sciEx, sciIso, regExams, midRange, finRange) {
  const explicit = classifyExamKind(sciEx);
  if (explicit === 'midterm' || explicit === 'final') return explicit;

  // 1. Exact course+date match against Reg exam
  const matchedReg = regExams.find((r) => isSameExamSlot(sciEx, r));
  if (matchedReg) {
    const regKind = classifyExamKind(matchedReg);
    if (regKind === 'midterm' || regKind === 'final') return regKind;
  }

  // 2. Date proximity to Reg's Midterm or Final period (within 21 days)
  if (sciIso && (midRange || finRange)) {
    const distMid = distanceToRangeDays(sciIso, midRange);
    const distFin = distanceToRangeDays(sciIso, finRange);
    if (distMid <= 21 && distMid <= distFin) return 'midterm';
    if (distFin <= 21 && distFin < distMid) return 'final';
  }

  return 'unknown';
}

/**
 * Reconciles Student-ID fetched exams (SciBase official seating) with KMUTNB Reg & custom manual exams:
 *
 *  - SciBase-Primary rule: Whenever SciBase has fresh/upcoming official exam data (`date >= today`),
 *    SciBase is used as the sole primary source ("ตัวตั้ง") for the exam round(s) it covers
 *    (Midterm and/or Final), replacing Reg placeholder exams for that round while preserving Reg exams
 *    for any *unpublished* round (e.g. keeping Reg Finals while SciBase has only published Midterms).
 *  - Reg-Fallback rule: When SciBase is empty, unlisted, or only holds stale previous-semester records
 *    (`< today`) while current/upcoming Reg exams exist, stale SciBase records are discarded and the app
 *    falls back cleanly to KMUTNB Reg exams.
 *  - Custom manual exams (non-Reg) are preserved unless superseded by an identical SciBase (course, date) slot.
 */
export function mergeExamSources(sciExams = [], manualExams = [], options = {}) {
  const safeSci = Array.isArray(sciExams) ? sciExams : [];
  const safeManual = Array.isArray(manualExams) ? manualExams : [];
  const todayIso = options.todayIso || getTodayLocalIso();

  const regExams = safeManual.filter(isRegImportedExam);
  const customManualExams = safeManual.filter((ex) => !isRegImportedExam(ex));

  const regMidDates = regExams
    .filter((ex) => classifyExamKind(ex) === 'midterm')
    .map((ex) => resolveExamIsoDate(ex))
    .filter(Boolean)
    .sort();
  const regFinDates = regExams
    .filter((ex) => classifyExamKind(ex) === 'final')
    .map((ex) => resolveExamIsoDate(ex))
    .filter(Boolean)
    .sort();

  const midRange = regMidDates.length > 0 ? { min: regMidDates[0], max: regMidDates[regMidDates.length - 1] } : null;
  const finRange = regFinDates.length > 0 ? { min: regFinDates[0], max: regFinDates[regFinDates.length - 1] } : null;

  const upcomingRegDates = regExams
    .map((ex) => resolveExamIsoDate(ex))
    .filter((iso) => iso && iso >= todayIso)
    .sort();
  const hasUpcomingReg = upcomingRegDates.length > 0;

  const sciMeta = safeSci.map((ex) => ({
    ex,
    iso: resolveExamIsoDate(ex),
  }));

  const freshSciIsos = sciMeta
    .map((item) => item.iso)
    .filter((iso) => iso && iso >= todayIso)
    .sort();
  const hasFreshSciBase = freshSciIsos.length > 0;

  // ── CASE A: SciBase has fresh/upcoming official seating → SciBase is PRIMARY ("ตัวตั้งทั้งหมด") ──
  if (hasFreshSciBase) {
    // Keep exams from the same active exam window (allow up to 14 days before earliest upcoming exam
    // so an exam taken earlier this same Midterm/Final week isn't dropped mid-week)
    const activeWindowStart = subtractDaysIso(freshSciIsos[0], 14);
    const coveredRounds = new Set();
    let ignoredStaleSciBaseCount = 0;

    const primarySciExams = [];
    for (const item of sciMeta) {
      if (item.iso && activeWindowStart && item.iso < activeWindowStart) {
        ignoredStaleSciBaseCount++;
        continue;
      }

      const round = inferSciExamRound(item.ex, item.iso, regExams, midRange, finRange);
      if (round === 'midterm' || round === 'final') {
        coveredRounds.add(round);
      }

      const enrichedSci = {
        ...item.ex,
        ...(item.iso && !item.ex.rawIsoDate ? { rawIsoDate: item.iso } : {}),
        ...(round !== 'unknown' ? { examType: round } : {}),
        source: 'scibase',
      };
      primarySciExams.push(enrichedSci);
    }

    // If fresh SciBase exams exist but couldn't be tied to a specific round, SciBase replaces all Reg exams
    const coversAllReg = coveredRounds.size === 0;
    let replacedRegCount = 0;
    const fallbackRegRoundsSet = new Set();

    const remainingRegExams = regExams.filter((regEx) => {
      if (coversAllReg) {
        replacedRegCount++;
        return false;
      }
      const regKind = classifyExamKind(regEx);
      if (coveredRounds.has(regKind)) {
        replacedRegCount++;
        return false;
      }
      if (primarySciExams.some((sciEx) => isSameExamSlot(sciEx, regEx))) {
        replacedRegCount++;
        return false;
      }
      if (regKind === 'midterm' || regKind === 'final') {
        fallbackRegRoundsSet.add(regKind);
      }
      return true;
    });

    // Keep user's custom manual exams unless superseded by the exact same SciBase exam slot
    const remainingCustomExams = customManualExams.filter(
      (manEx) => !primarySciExams.some((sciEx) => isSameExamSlot(sciEx, manEx))
    );

    return {
      exams: [...primarySciExams, ...remainingRegExams, ...remainingCustomExams],
      stats: {
        mode: 'scibase-primary',
        primarySciBaseCount: primarySciExams.length,
        coveredRounds: coversAllReg ? ['all'] : Array.from(coveredRounds),
        fallbackRegRounds: Array.from(fallbackRegRoundsSet),
        replacedRegCount,
        ignoredStaleSciBaseCount,
      },
    };
  }

  // ── CASE B: SciBase is empty/unlisted OR stale past-semester while active Reg exams exist → Reg Fallback ──
  if (hasUpcomingReg) {
    const datedSciCount = sciMeta.filter((item) => Boolean(item.iso)).length;
    const fallbackRegRounds = Array.from(
      new Set(
        regExams
          .map((ex) => classifyExamKind(ex))
          .filter((k) => k === 'midterm' || k === 'final')
      )
    );

    return {
      exams: [...safeManual],
      stats: {
        mode: 'reg-fallback',
        primarySciBaseCount: 0,
        coveredRounds: [],
        fallbackRegRounds,
        replacedRegCount: 0,
        ignoredStaleSciBaseCount: datedSciCount,
      },
    };
  }

  // ── CASE C: No upcoming Reg exams (SciBase-only / legacy / undated test objects) ──
  const dedupedManual = safeManual.filter(
    (manEx) => !safeSci.some((sciEx) => isSameExamSlot(sciEx, manEx))
  );
  const combined = [...safeSci, ...dedupedManual];

  const mode = safeSci.length > 0
    ? 'scibase-only'
    : (dedupedManual.length > 0 ? 'manual-only' : 'empty');

  return {
    exams: combined,
    stats: {
      mode,
      primarySciBaseCount: safeSci.length,
      coveredRounds: [],
      fallbackRegRounds: [],
      replacedRegCount: 0,
      ignoredStaleSciBaseCount: 0,
    },
  };
}

/**
 * Convenience wrapper returning only the unified, deduplicated Exam array.
 */
export function getMergedExams(sciExams = [], manualExams = [], options = {}) {
  return mergeExamSources(sciExams, manualExams, options).exams;
}
