import { useMemo, useState, useEffect } from 'react';
import { examRepository } from '../repositories/examRepository';
import { parseExamDate } from '../utils/examDate';
import { JS_DAY_MAP } from '../constants/dateConstants';
import { matchSchedulesAndExams } from '../utils/scheduleMatcher';
import { isScheduleEntryActiveOnDate } from '../utils/courseEndDate';
import { getMergedExams } from '../utils/examMerger';

const toLocalDateStr = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const normalizeExamTime = (raw, fallback) => {
  if (!raw || typeof raw !== 'string') return fallback;
  const match = raw.trim().match(/^(\d{1,2})[:.](\d{2})$/);
  if (!match) return fallback;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (h < 0 || h > 23 || m < 0 || m > 59) return fallback;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

export function useTodayClasses(schedule, profile) {
  const [todayStamp, setTodayStamp] = useState(() => toLocalDateStr(new Date()));
  const [examTick, setExamTick] = useState(0);

  useEffect(() => {
    const checkDateRollover = () => {
      const current = toLocalDateStr(new Date());
      setTodayStamp(prev => (prev !== current ? current : prev));
    };
    const handleExamsUpdated = () => setExamTick(v => v + 1);
    const intervalId = setInterval(checkDateRollover, 60000);
    window.addEventListener('focus', checkDateRollover);
    window.addEventListener('classroom_hub_exams_updated', handleExamsUpdated);
    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', checkDateRollover);
      window.removeEventListener('classroom_hub_exams_updated', handleExamsUpdated);
    };
  }, []);

  return useMemo(() => {
    void examTick;
    const [year, month, day] = todayStamp.split('-').map(Number);
    const now = new Date(year, month - 1, day);
    const d = now.getDay(); // 0=Sun
    const todayKey = JS_DAY_MAP[d];
    const todayDateStr = todayStamp;
    const activeEmail = (profile?.email || '').toLowerCase().trim();

    // 1. Load cached exams
    let allExams = [];
    let examEntries = [];
    if (activeEmail) {
      const cachedResult = examRepository.getCachedExams(activeEmail);
      if (cachedResult.success && cachedResult.data) {
        const examList = cachedResult.data.exams || [];
        const manualExamList = cachedResult.data.manualExams || [];
        allExams = getMergedExams(examList, manualExamList);

        examEntries = allExams.map(ex => {
          let startTime = '09:00';
          let endTime = '12:00';
          if (ex.time && typeof ex.time === 'string') {
            const parts = ex.time.split(/[-–]/).map(s => s.trim());
            if (parts.length === 2) {
              startTime = normalizeExamTime(parts[0], startTime);
              endTime = normalizeExamTime(parts[1], endTime);
            }
          }

          let dateVal = '';
          if (ex.rawIsoDate && /^\d{4}-\d{2}-\d{2}/.test(ex.rawIsoDate)) {
            dateVal = ex.rawIsoDate.split('T')[0];
          } else if (ex.date) {
            const parsed = parseExamDate(ex.date);
            if (parsed) {
              dateVal = toLocalDateStr(parsed);
            }
          }

          if (!dateVal) return null;

          const [yy, mm, dd] = dateVal.split('-').map(Number);
          const ed = (yy && mm && dd) ? new Date(yy, mm - 1, dd) : new Date(dateVal);
          if (Number.isNaN(ed.getTime())) return null;
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
            color: '#F14C4C',
            notes: ex.seat ? `Seat/Row: ${ex.seat}` : '',
            isExam: true
          };
        }).filter(Boolean);
      }
    }

    // 2. Separate today's exams and today's classes (excluding soft-deleted and ended courses)
    const todayExams = examEntries.filter(entry => entry.day === todayKey && entry.date === todayDateStr);
    const todayRegular = (schedule || []).filter(entry => {
      if (entry.day !== todayKey) return false;
      return isScheduleEntryActiveOnDate(entry, todayDateStr, allExams);
    });

    // 3. Override class if exam for the same course is today
    return matchSchedulesAndExams(todayRegular, todayExams);
  }, [schedule, profile, todayStamp, examTick]);
}
