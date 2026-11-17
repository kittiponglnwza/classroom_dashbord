import { Link } from 'react-router-dom';
import { ClipboardCheck, AlertCircle, MapPin, ArrowRight } from 'lucide-react';
import { t } from '../utils/i18n';
import { parseExamDate } from '../utils/examDate';

const isExamUpcoming = (exam, now) => {
  const parsedDate = parseExamDate(exam.rawIsoDate || exam.date);
  if (!parsedDate) return false;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (parsedDate > today) return true;
  if (parsedDate < today) return false;
  if (exam.time && typeof exam.time === 'string') {
    const parts = exam.time.split(/[-–]/).map(s => s.trim());
    const endMatch = parts[1]?.match(/^(\d{1,2})[:.](\d{2})$/);
    if (endMatch) {
      const endDt = new Date(
        now.getFullYear(), now.getMonth(), now.getDate(),
        parseInt(endMatch[1], 10), parseInt(endMatch[2], 10), 0, 0
      );
      return endDt >= now;
    }
  }
  return true;
};

export default function NextExamWidget({ allExams, unlistedInfo, hasCheckedExams, isFetchingExams, lang }) {
  let nextExam = null;

  if (hasCheckedExams) {
    const now = new Date();
    const upcomingExams = allExams.filter(exam => isExamUpcoming(exam, now));

    upcomingExams.sort((a, b) => {
      const dateA = parseExamDate(a.rawIsoDate || a.date) || new Date(8640000000000000);
      const dateB = parseExamDate(b.rawIsoDate || b.date) || new Date(8640000000000000);
      return dateA - dateB;
    });

    if (upcomingExams.length > 0) {
      nextExam = upcomingExams[0];
    }
  }

  if (!hasCheckedExams) {
    if (isFetchingExams) {
      return (
        <div className="bg-[#252526] border border-[#3C3C3C] rounded-2xl p-6 space-y-4 animate-pulse">
          <div className="h-3.5 w-28 bg-[#2D2D2D] rounded" />
          <div className="space-y-2">
            <div className="h-4 w-40 bg-[#2D2D2D] rounded" />
            <div className="h-3 w-32 bg-[#2D2D2D] rounded" />
          </div>
        </div>
      );
    }

    return (
      <div className="bg-[#252526] border border-[#3C3C3C] rounded-2xl p-6 space-y-3">
        <div className="flex items-center justify-between border-b border-[#3C3C3C] pb-3">
          <h3 className="text-xs font-semibold text-[#FFFFFF] flex items-center gap-2">
            <ClipboardCheck size={15} className="text-[#3794FF]" />
            <span>{t('upcomingExamHeader', lang)}</span>
          </h3>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold text-[#D4D4D4]">
            {lang === 'en' ? 'Check your Exam Seating & Rooms' : 'ตรวจสอบตารางและที่นั่งสอบ'}
          </p>
          <p className="text-xs text-[#9D9D9D] leading-relaxed">
            {lang === 'en'
              ? 'Connect to KMUTNB database to check your exam schedule, locations, and seat numbers.'
              : 'เชื่อมต่อฐานข้อมูล มจพ. เพื่อตรวจสอบวิชาสอบ ห้องสอบ และเลขที่นั่งสอบของคุณ'}
          </p>
          <Link
            to="/exam-room"
            className="inline-flex items-center gap-1 text-xs text-[#3794FF] hover:underline font-medium pt-1"
          >
            <span>{lang === 'en' ? 'Check Seating now' : 'ตรวจสอบที่นี่'}</span>
            <ArrowRight size={12} />
          </Link>
        </div>
      </div>
    );
  }

  if (nextExam) {
    return (
      <div className="bg-[#252526] border border-[#3C3C3C] rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-[#3C3C3C] pb-3">
          <h3 className="text-xs font-semibold text-[#FFFFFF] flex items-center gap-2">
            <ClipboardCheck size={15} className="text-[#3794FF]" />
            <span>{t('upcomingExamHeader', lang)}</span>
          </h3>
          <Link to="/exam-room" className="text-xs text-[#3794FF] hover:underline font-medium">
            {lang === 'en' ? 'View All' : 'ดูทั้งหมด'}
          </Link>
        </div>
        <div className="space-y-3">
          <div className="space-y-1">
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-[#007ACC]/20 text-[#3794FF] border border-[#007ACC]/40">
              {nextExam.courseCode}
            </span>
            <h4 className="font-semibold text-[#FFFFFF] text-sm leading-snug truncate pt-1" title={nextExam.courseName}>
              {nextExam.courseName}
            </h4>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs border-t border-[#3C3C3C] pt-3">
            <div>
              <span className="text-[11px] text-[#858585] block">{t('dateCol', lang)}</span>
              <span className="font-medium text-[#D4D4D4] truncate block">{nextExam.date}</span>
            </div>
            <div>
              <span className="text-[11px] text-[#858585] block">{t('timeCol', lang)}</span>
              <span className="font-medium text-[#D4D4D4] truncate block">{nextExam.time}</span>
            </div>
          </div>
          <div className="border-t border-[#3C3C3C] pt-3 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs">
              <MapPin size={13} className="text-[#3794FF] shrink-0" />
              <span className="font-medium text-[#D4D4D4] truncate max-w-[120px]">{nextExam.room}</span>
            </div>
            {nextExam.seat && (
              <div className="bg-[#1E1E1E] border border-[#3C3C3C] px-2.5 py-1 rounded-lg text-right shrink-0">
                <span className="text-[10px] text-[#858585] block leading-none">{t('seatCol', lang)}</span>
                <span className="text-xs font-semibold text-[#FFFFFF]">{nextExam.seat}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (unlistedInfo) {
    return (
      <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-6 space-y-3">
        <div className="flex items-center justify-between border-b border-rose-500/25 pb-3">
          <h3 className="text-xs font-semibold text-rose-400 flex items-center gap-2">
            <AlertCircle size={15} className="text-rose-400" />
            <span>{t('upcomingExamHeader', lang)}</span>
          </h3>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold text-[#FFFFFF] leading-snug">
            {t('noSeatingAlert', lang)}
          </p>
          <p className="text-xs text-rose-300 leading-relaxed">
            {lang === 'en'
              ? 'No exam schedule found. You might need to submit an exam petition.'
              : 'ไม่พบรายชื่อในระบบ มจพ. โปรดตรวจเช็คเพื่อยื่นคำร้องขอเข้าสอบ'}
          </p>
          <Link
            to="/exam-room"
            className="inline-flex items-center gap-1 text-xs text-rose-400 hover:underline font-semibold pt-1"
          >
            <span>{lang === 'en' ? 'View Petition Links' : 'ดูข้อมูลวิธียื่นคำร้อง'}</span>
            <ArrowRight size={12} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#252526] border border-[#3C3C3C] rounded-2xl p-6 space-y-3">
      <div className="flex items-center justify-between border-b border-[#3C3C3C] pb-3">
        <h3 className="text-xs font-semibold text-[#FFFFFF] flex items-center gap-2">
          <ClipboardCheck size={15} className="text-[#858585]" />
          <span>{t('upcomingExamHeader', lang)}</span>
        </h3>
      </div>
      <div className="py-2 text-center">
        <p className="text-xs text-[#9D9D9D]">{t('noUpcomingExams', lang)}</p>
      </div>
    </div>
  );
}
