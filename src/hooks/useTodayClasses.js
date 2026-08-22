import { useMemo } from 'react';
import { examRepository } from '../repositories/examRepository';
import { parseExamDate } from '../utils/examDate';
import { JS_DAY_MAP } from '../constants/dateConstants';
import { matchSchedulesAndExams } from '../utils/scheduleMatcher';

export function useTodayClasses(schedule, profile) {
  return useMemo(() => {
    const d = new Date().getDay(); // 0=Sun
    const todayKey = JS_DAY_MAP[d];
    const todayDateStr = new Date().toISOString().split('T')[0];
    const activeEmail = (profile?.email || '').toLowerCase().trim();

    // 1. Load cached exams
    let examEntries = [];
    if (activeEmail) {
      const cachedResult = examRepository.getCachedExams(activeEmail);
      if (cachedResult.success && cachedResult.data) {
        const examList = cachedResult.data.exams || [];
        const manualExamList = cachedResult.data.manualExams || [];
        const allExams = [...examList, ...manualExamList];

        examEntries = allExams.map(ex => {
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
            if (parsed) {
              dateVal = parsed.toISOString().split('T')[0];
            }
          }

          if (!dateVal) return null;

          const ed = new Date(dateVal);
          const dayIndex = ed.getDay();
          const dayKey = JS_DAY_MAP[dayIndex];

          return {
            id: `exam-${ex.id}`,
            title: ex.subjectName || ex.courseName || 'Exam',
            courseCode: ex.subjectCode || ex.courseCode || '',
            day: dayKey,
            date: dateVal,
            startTime,
            endTime,
            room: ex.room ? `${ex.room} ${ex.seat ? `(${ex.seat})` : ''}` : '',
            color: '#ef4444', // Red for exams
            notes: ex.seat ? `Seat/Row: ${ex.seat}` : '',
            isExam: true
          };
        }).filter(Boolean);
      }
    }

    // 2. Separate today's exams and today's classes
    const todayExams = examEntries.filter(entry => entry.day === todayKey && entry.date === todayDateStr);
    const todayRegular = (schedule || []).filter(entry => entry.day === todayKey && (!entry.date || entry.date === todayDateStr));

    // 3. Override class if exam for the same course is today
    return matchSchedulesAndExams(todayRegular, todayExams);
  }, [schedule, profile]);
}
