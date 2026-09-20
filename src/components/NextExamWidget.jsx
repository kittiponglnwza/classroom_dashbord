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
      return parsedDate ? parsedDate >= today : true;
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
        <div className="bg-dark-card/40 backdrop-blur-xl border border-white/5 rounded-3xl p-6 lg:p-8 space-y-4 relative overflow-hidden shadow-2xl animate-pulse">
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-white/10 rounded-full" />
              <div className="h-3 w-24 bg-white/10 rounded-full" />
            </div>
          </div>
          <div className="space-y-3">
            <div className="h-4 w-40 bg-white/10 rounded-full" />
            <div className="h-2 w-32 bg-white/10 rounded-full" />
          </div>
          <div className="pt-2">
            <div className="h-2 w-20 bg-brand-500/20 rounded-full" />
          </div>
        </div>
      );
    }

    return (
      <div className="bg-dark-card/40 backdrop-blur-xl border border-white/5 rounded-3xl p-6 lg:p-8 space-y-4 relative overflow-hidden group hover:border-white/10 transition-all duration-500 shadow-2xl">
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-brand-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-brand-500/20 transition-all duration-500" />
        <div className="flex items-center justify-between border-b border-white/5 pb-4">
          <h3 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-2">
            <ClipboardCheck size={14} className="text-brand-400" />
            <span>{t('upcomingExamHeader', lang)}</span>
          </h3>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold text-zinc-100 leading-snug">
            {lang === 'en' ? 'Check your Exam Seating & Rooms' : 'ตรวจสอบตารางและที่นั่งสอบ'}
          </p>
          <p className="text-[11px] text-dark-muted leading-relaxed">
            {lang === 'en' 
              ? 'Connect to KMUTNB database to check your exam schedule, locations, and seat numbers.' 
              : 'เชื่อมต่อฐานข้อมูล มจพ. เพื่อตรวจสอบวิชาสอบ ห้องสอบ และเลขที่นั่งสอบของคุณ'}
          </p>
          <Link
            to="/exam-room"
            className="inline-flex items-center gap-1.5 text-xs text-brand-400 hover:text-brand-300 font-semibold pt-1 transition-colors hover:translate-x-0.5"
          >
            {lang === 'en' ? 'Check Seating now' : 'ตรวจสอบที่นี่'}
            <ArrowRight size={12} />
          </Link>
        </div>
      </div>
    );
  }

  if (nextExam) {
    return (
      <div className="bg-dark-card/40 backdrop-blur-xl border border-white/5 hover:border-brand-500/30 rounded-3xl p-6 lg:p-8 space-y-5 relative overflow-hidden group transition-all duration-500 shadow-2xl">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-brand-500/40" />
        <div className="flex items-center justify-between border-b border-white/5 pb-4">
          <h3 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-2">
            <ClipboardCheck size={14} className="text-brand-400" />
            <span>{t('upcomingExamHeader', lang)}</span>
          </h3>
          <Link 
            to="/exam-room" 
            className="text-[10px] text-brand-400 hover:text-brand-300 font-medium transition-colors"
          >
            {lang === 'en' ? 'View All' : 'ดูทั้งหมด'}
          </Link>
        </div>
        <div className="space-y-3">
          <div className="space-y-1">
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/20 uppercase tracking-wide">
              {nextExam.courseCode}
            </span>
            <h4 className="font-bold text-white text-xs leading-snug truncate pt-0.5" title={nextExam.courseName}>
              {nextExam.courseName}
            </h4>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px] border-t border-dark-border/30 pt-2.5">
            <div className="space-y-0.5">
              <span className="text-[8px] uppercase font-bold text-dark-muted tracking-wider block">{t('dateCol', lang)}</span>
              <span className="font-medium text-zinc-300 truncate block">{nextExam.date}</span>
            </div>
            <div className="space-y-0.5">
              <span className="text-[8px] uppercase font-bold text-dark-muted tracking-wider block">{t('timeCol', lang)}</span>
              <span className="font-medium text-zinc-300 truncate block">{nextExam.time}</span>
            </div>
          </div>
          <div className="border-t border-dark-border/30 pt-2.5 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[11px]">
              <MapPin size={12} className="text-brand-400 shrink-0" />
              <span className="font-medium text-zinc-300 truncate max-w-[100px]">{nextExam.room}</span>
            </div>
            <div className="bg-brand-500/5 border border-brand-500/20 px-2 py-0.5 rounded-lg text-right shrink-0">
              <span className="text-[7px] uppercase font-bold text-brand-400 block tracking-wider leading-none">{t('seatCol', lang)}</span>
              <span className="text-[10px] font-black text-white">{nextExam.seat}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (unlistedInfo) {
    return (
      <div className="bg-rose-500/10 backdrop-blur-xl border border-rose-500/20 rounded-3xl p-6 lg:p-8 space-y-4 relative overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between border-b border-rose-500/10 pb-4">
          <h3 className="text-xs font-semibold text-rose-400 uppercase tracking-wider flex items-center gap-2">
            <AlertCircle size={14} className="text-rose-400" />
            <span>{t('upcomingExamHeader', lang)}</span>
          </h3>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-bold text-white leading-snug">
            {t('noSeatingAlert', lang)}
          </p>
          <p className="text-[11px] text-rose-400/80 leading-relaxed">
            {lang === 'en' 
              ? 'No exam schedule found. You might need to submit an exam petition.' 
              : 'ไม่พบรายชื่อในระบบ มจพ. โปรดตรวจเช็คเพื่อยื่นคำร้องขอเข้าสอบ'}
          </p>
          <Link
            to="/exam-room"
            className="inline-flex items-center gap-1.5 text-xs text-rose-300 hover:text-rose-200 font-semibold pt-1 transition-colors hover:translate-x-0.5"
          >
            {lang === 'en' ? 'View Petition Links' : 'ดูข้อมูลวิธียื่นคำร้อง'}
            <ArrowRight size={12} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-dark-card/40 backdrop-blur-xl border border-white/5 rounded-3xl p-6 lg:p-8 space-y-4 relative overflow-hidden shadow-2xl hover:border-white/10 transition-all duration-500">
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <h3 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-2">
          <ClipboardCheck size={14} className="text-dark-muted" />
          <span>{t('upcomingExamHeader', lang)}</span>
        </h3>
      </div>
      <div className="py-2 text-center">
        <p className="text-xs text-dark-muted font-medium">{t('noUpcomingExams', lang)}</p>
      </div>
    </div>
  );
}
