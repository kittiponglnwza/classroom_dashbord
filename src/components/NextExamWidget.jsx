import { Link } from 'react-router-dom';
import { ClipboardCheck, AlertCircle, MapPin, ArrowRight } from 'lucide-react';
import { t } from '../utils/i18n';
import { parseExamDate } from '../utils/examDate';

export default function NextExamWidget({ allExams, unlistedInfo, hasCheckedExams, isFetchingExams, lang }) {
  let nextExam = null;

  if (hasCheckedExams) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcomingExams = allExams.filter(exam => {
      const parsedDate = parseExamDate(exam.rawIsoDate || exam.date);
      return parsedDate ? parsedDate >= today : false;
    });

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
        <div className="bg-white border border-[#D2D2D7]/80 rounded-2xl p-6 space-y-4 shadow-2xs animate-pulse">
          <div className="h-3.5 w-28 bg-[#F5F5F7] rounded" />
          <div className="space-y-2">
            <div className="h-4 w-40 bg-[#F5F5F7] rounded" />
            <div className="h-3 w-32 bg-[#F5F5F7] rounded" />
          </div>
        </div>
      );
    }

    return (
      <div className="bg-white border border-[#D2D2D7]/80 rounded-2xl p-6 space-y-3 shadow-2xs">
        <div className="flex items-center justify-between border-b border-[#D2D2D7]/60 pb-3">
          <h3 className="text-xs font-semibold text-[#1D1D1F] flex items-center gap-2">
            <ClipboardCheck size={15} className="text-[#0071E3]" />
            <span>{t('upcomingExamHeader', lang)}</span>
          </h3>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold text-[#1D1D1F]">
            {lang === 'en' ? 'Check your Exam Seating & Rooms' : 'ตรวจสอบตารางและที่นั่งสอบ'}
          </p>
          <p className="text-xs text-[#6E6E73] leading-relaxed">
            {lang === 'en'
              ? 'Connect to KMUTNB database to check your exam schedule, locations, and seat numbers.'
              : 'เชื่อมต่อฐานข้อมูล มจพ. เพื่อตรวจสอบวิชาสอบ ห้องสอบ และเลขที่นั่งสอบของคุณ'}
          </p>
          <Link
            to="/exam-room"
            className="inline-flex items-center gap-1 text-xs text-[#0071E3] hover:underline font-medium pt-1"
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
      <div className="bg-white border border-[#D2D2D7]/80 rounded-2xl p-6 space-y-4 shadow-2xs">
        <div className="flex items-center justify-between border-b border-[#D2D2D7]/60 pb-3">
          <h3 className="text-xs font-semibold text-[#1D1D1F] flex items-center gap-2">
            <ClipboardCheck size={15} className="text-[#0071E3]" />
            <span>{t('upcomingExamHeader', lang)}</span>
          </h3>
          <Link to="/exam-room" className="text-xs text-[#0071E3] hover:underline font-medium">
            {lang === 'en' ? 'View All' : 'ดูทั้งหมด'}
          </Link>
        </div>
        <div className="space-y-3">
          <div className="space-y-1">
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-blue-50 text-[#0071E3] border border-blue-200">
              {nextExam.courseCode}
            </span>
            <h4 className="font-semibold text-[#1D1D1F] text-sm leading-snug truncate pt-1" title={nextExam.courseName}>
              {nextExam.courseName}
            </h4>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs border-t border-[#D2D2D7]/60 pt-3">
            <div>
              <span className="text-[11px] text-[#6E6E73] block">{t('dateCol', lang)}</span>
              <span className="font-medium text-[#1D1D1F] truncate block">{nextExam.date}</span>
            </div>
            <div>
              <span className="text-[11px] text-[#6E6E73] block">{t('timeCol', lang)}</span>
              <span className="font-medium text-[#1D1D1F] truncate block">{nextExam.time}</span>
            </div>
          </div>
          <div className="border-t border-[#D2D2D7]/60 pt-3 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs">
              <MapPin size={13} className="text-[#0071E3] shrink-0" />
              <span className="font-medium text-[#1D1D1F] truncate max-w-[120px]">{nextExam.room}</span>
            </div>
            {nextExam.seat && (
              <div className="bg-[#F5F5F7] border border-[#D2D2D7] px-2.5 py-1 rounded-lg text-right shrink-0">
                <span className="text-[10px] text-[#6E6E73] block leading-none">{t('seatCol', lang)}</span>
                <span className="text-xs font-semibold text-[#1D1D1F]">{nextExam.seat}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (unlistedInfo) {
    return (
      <div className="bg-rose-50/70 border border-rose-200 rounded-2xl p-6 space-y-3 shadow-2xs">
        <div className="flex items-center justify-between border-b border-rose-200/70 pb-3">
          <h3 className="text-xs font-semibold text-rose-700 flex items-center gap-2">
            <AlertCircle size={15} className="text-rose-600" />
            <span>{t('upcomingExamHeader', lang)}</span>
          </h3>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold text-[#1D1D1F] leading-snug">
            {t('noSeatingAlert', lang)}
          </p>
          <p className="text-xs text-rose-700 leading-relaxed">
            {lang === 'en'
              ? 'No exam schedule found. You might need to submit an exam petition.'
              : 'ไม่พบรายชื่อในระบบ มจพ. โปรดตรวจเช็คเพื่อยื่นคำร้องขอเข้าสอบ'}
          </p>
          <Link
            to="/exam-room"
            className="inline-flex items-center gap-1 text-xs text-rose-700 hover:underline font-semibold pt-1"
          >
            <span>{lang === 'en' ? 'View Petition Links' : 'ดูข้อมูลวิธียื่นคำร้อง'}</span>
            <ArrowRight size={12} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-[#D2D2D7]/80 rounded-2xl p-6 space-y-3 shadow-2xs">
      <div className="flex items-center justify-between border-b border-[#D2D2D7]/60 pb-3">
        <h3 className="text-xs font-semibold text-[#1D1D1F] flex items-center gap-2">
          <ClipboardCheck size={15} className="text-[#6E6E73]" />
          <span>{t('upcomingExamHeader', lang)}</span>
        </h3>
      </div>
      <div className="py-2 text-center">
        <p className="text-xs text-[#6E6E73]">{t('noUpcomingExams', lang)}</p>
      </div>
    </div>
  );
}
