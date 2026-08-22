/**
 * Merges regular classes and exams for a single day, filtering out classes 
 * that conflict with exams (either by course code/title or by time overlap).
 * @param {Array} todayRegular - Array of regular class schedule entries for the day
 * @param {Array} todayExams - Array of exam entries for the day
 * @returns {Array} Sorted list of combined classes and exams
 */
export function matchSchedulesAndExams(todayRegular, todayExams) {
  const filteredRegular = todayRegular.filter(regEntry => {
    const hasConflict = todayExams.some(exam => {
      // 1. Match by code or title
      const codeMatch = regEntry.courseCode && exam.courseCode && 
        regEntry.courseCode.toLowerCase().trim() === exam.courseCode.toLowerCase().trim();
        
      const titleMatch = regEntry.title && exam.title && 
        regEntry.title.toLowerCase().trim() === exam.title.toLowerCase().trim();
        
      if (codeMatch || titleMatch) return true;

      // 2. Match by time overlap
      const [regHStart, regMStart] = regEntry.startTime.split(':').map(Number);
      const [regHEnd, regMEnd] = regEntry.endTime.split(':').map(Number);
      const [examHStart, examMStart] = exam.startTime.split(':').map(Number);
      const [examHEnd, examMEnd] = exam.endTime.split(':').map(Number);

      const startReg = regHStart * 60 + regMStart;
      const endReg = regHEnd * 60 + regMEnd;
      const startExam = examHStart * 60 + examMStart;
      const endExam = examHEnd * 60 + examMEnd;

      // Overlap logic: A starts before B ends, and A ends after B starts
      return startReg < endExam && endReg > startExam;
    });
    
    return !hasConflict;
  });

  return [...filteredRegular, ...todayExams].sort((a, b) => {
    const [aH, aM] = a.startTime.split(':').map(Number);
    const [bH, bM] = b.startTime.split(':').map(Number);
    return (aH * 60 + aM) - (bH * 60 + bM);
  });
}
