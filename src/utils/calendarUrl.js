import { parseExamDate } from './examDate';

export const getGoogleCalendarUrl = (exam) => {
  let startTime = '090000';
  let endTime = '120000';
  if (exam.time) {
    const parts = exam.time.split('-').map(s => s.trim().replace(':', ''));
    if (parts.length === 2) {
      startTime = (parts[0].padEnd(4, '0')) + '00';
      endTime = (parts[1].padEnd(4, '0')) + '00';
    }
  }

  let dateVal = '';
  if (exam.rawIsoDate) {
    dateVal = exam.rawIsoDate.split('T')[0].replace(/-/g, '');
  } else if (exam.date) {
    const parsed = parseExamDate(exam.date);
    if (parsed) {
      dateVal = `${parsed.getFullYear()}${String(parsed.getMonth() + 1).padStart(2, '0')}${String(parsed.getDate()).padStart(2, '0')}`;
    }
  }
  
  if (!dateVal) return '#';

  const dates = `${dateVal}T${startTime}/${dateVal}T${endTime}`;
  const title = encodeURIComponent(exam.courseName || exam.subjectName || 'Exam');
  const details = encodeURIComponent(`${exam.courseCode || ''}\nSeat: ${exam.seat || 'N/A'}`);
  const location = encodeURIComponent(exam.room || '');

  // use ctz=Asia/Bangkok to ensure correct time regardless of user's local browser timezone
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}&location=${location}&ctz=Asia/Bangkok`;
};
