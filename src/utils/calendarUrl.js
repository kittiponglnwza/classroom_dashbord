import { parseExamDate } from './examDate';

const formatCalendarTimePart = (raw, fallback) => {
  if (!raw || typeof raw !== 'string') return fallback;
  const match = raw.trim().match(/^(\d{1,2})[:.](\d{2})$/);
  if (!match) return fallback;
  const hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return fallback;
  return `${String(hour).padStart(2, '0')}${String(minute).padStart(2, '0')}00`;
};

export const getGoogleCalendarUrl = (exam) => {
  if (!exam) return null;

  let startTime = '090000';
  let endTime = '120000';
  if (exam.time && typeof exam.time === 'string') {
    const parts = exam.time.split(/[-–]/).map(s => s.trim());
    if (parts.length === 2) {
      startTime = formatCalendarTimePart(parts[0], startTime);
      endTime = formatCalendarTimePart(parts[1], endTime);
    }
  }

  let dateVal = '';
  if (exam.rawIsoDate && /^\d{4}-\d{2}-\d{2}/.test(exam.rawIsoDate)) {
    dateVal = exam.rawIsoDate.split('T')[0].replace(/-/g, '');
  } else if (exam.date) {
    const parsed = parseExamDate(exam.date);
    if (parsed) {
      dateVal = `${parsed.getFullYear()}${String(parsed.getMonth() + 1).padStart(2, '0')}${String(parsed.getDate()).padStart(2, '0')}`;
    }
  }

  if (!dateVal || !/^\d{8}$/.test(dateVal)) return null;

  const dates = `${dateVal}T${startTime}/${dateVal}T${endTime}`;
  const title = encodeURIComponent(exam.courseName || exam.subjectName || 'Exam');
  const details = encodeURIComponent(`${exam.courseCode || ''}\nSeat: ${exam.seat || 'N/A'}`);
  const location = encodeURIComponent(exam.room || '');

  // use ctz=Asia/Bangkok to ensure correct time regardless of user's local browser timezone
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}&location=${location}&ctz=Asia/Bangkok`;
};
