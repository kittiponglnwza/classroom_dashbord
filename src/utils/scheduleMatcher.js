const parseMinutesSafe = (timeStr) => {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const match = timeStr.trim().match(/^(\d{1,2})[:.](\d{2})$/);
  if (!match) return null;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
};

/**
 * Merges regular classes and exams for a single day, filtering out classes 
 * that conflict with exams (either by course code/title or by time overlap).
 * @param {Array} todayRegular - Array of regular class schedule entries for the day
 * @param {Array} todayExams - Array of exam entries for the day
 * @returns {Array} Sorted list of combined classes and exams
 */
export function matchSchedulesAndExams(todayRegular = [], todayExams = []) {
  const safeRegular = Array.isArray(todayRegular) ? todayRegular : [];
  const safeExams = Array.isArray(todayExams) ? todayExams : [];

  const filteredRegular = safeRegular.filter(regEntry => {
    const hasConflict = safeExams.some(exam => {
      // 1. Match by code or title
      const codeMatch = regEntry?.courseCode && exam?.courseCode && 
        String(regEntry.courseCode).toLowerCase().trim() === String(exam.courseCode).toLowerCase().trim();
        
      const titleMatch = regEntry?.title && exam?.title && 
        String(regEntry.title).toLowerCase().trim() === String(exam.title).toLowerCase().trim();
        
      if (codeMatch || titleMatch) return true;

      // 2. Match by time overlap
      const startReg = parseMinutesSafe(regEntry?.startTime);
      const endReg = parseMinutesSafe(regEntry?.endTime);
      const startExam = parseMinutesSafe(exam?.startTime);
      const endExam = parseMinutesSafe(exam?.endTime);

      if (startReg === null || endReg === null || startExam === null || endExam === null) {
        return false;
      }

      // Overlap logic: A starts before B ends, and A ends after B starts
      return startReg < endExam && endReg > startExam;
    });
    
    return !hasConflict;
  });

  return [...filteredRegular, ...safeExams].sort((a, b) => {
    const aStart = parseMinutesSafe(a?.startTime);
    const bStart = parseMinutesSafe(b?.startTime);
    if (aStart === null && bStart === null) return 0;
    if (aStart === null) return 1;
    if (bStart === null) return -1;
    return aStart - bStart;
  });
}
