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

export default function NextExamWidget({ allExams, unlistedInfo, hasCheckedExams, isFetchingExams, seatingLookupEnabled, lang }) {
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
        <div
          role="status"
          aria-busy="true"
          aria-label={lang === 'en' ? 'Loading exam schedule' : 'กำลังโหลดตารางสอบ'}
          className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 space-y-4"
        >
          <div className="h-3.5 w-28 bg-[var(--surface-elevated)] rounded" />
          <div className="space-y-2">
            <div className="h-4 w-40 bg-[var(--surface-elevated)] rounded" />
            <div className="h-3 w-32 bg-[var(--surface-elevated)] rounded" />
          </div>
        </div>
      );
    }

    return (
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
          <h3 className="text-xs font-medium text-[var(--text-heading)] flex items-center gap-2">
            <ClipboardCheck size={16} strokeWidth={1.5} className="text-[var(--primary-bright)]" />
            <span>{t('upcomingExamHeader', lang)}</span>
          </h3>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-medium text-[var(--text-primary)]">
            {lang === 'en' ? 'Check your Exam Seating & Rooms' : 'ตรวจสอบตารางและที่นั่งสอบ'}
          </p>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            {seatingLookupEnabled
              ? (lang === 'en'
                  ? 'Connect to KMUTNB database to check your exam schedule, locations, and seat numbers'
                  : 'เชื่อมต่อฐานข้อมูล มจพ. เพื่อตรวจสอบวิชาสอบ ห้องสอบ และเลขที่นั่งสอบของคุณ')
              : t('examLookupUnavailable', lang)}
          </p>
          <Link
            to="/exam-room"
            className="inline-flex items-center gap-1.5 text-xs text-[var(--primary-bright)] hover:underline font-medium pt-1"
          >
            <span>{seatingLookupEnabled
              ? (lang === 'en' ? 'Check Seating now' : 'ตรวจสอบที่นี่')
              : (lang === 'en' ? 'Add exams manually' : 'เพิ่มตารางสอบเอง')}</span>
            <ArrowRight size={14} strokeWidth={1.5} />
          </Link>
        </div>
      </div>
    );
  }

  if (nextExam) {
    return (
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
          <h3 className="text-xs font-medium text-[var(--text-heading)] flex items-center gap-2">
            <ClipboardCheck size={16} strokeWidth={1.5} className="text-[var(--primary-bright)]" />
            <span>{t('upcomingExamHeader', lang)}</span>
          </h3>
          <Link to="/exam-room" className="text-xs text-[var(--primary-bright)] hover:underline font-medium">
            {lang === 'en' ? 'View All' : 'ดูทั้งหมด'}
          </Link>
        </div>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <span className="inline-block text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-[var(--app-bg)] text-[var(--primary-bright)] border border-[var(--border)]">
              {nextExam.courseCode}
            </span>
            <h4 className="font-medium text-[var(--text-heading)] text-sm leading-snug truncate" title={nextExam.courseName}>
              {nextExam.courseName}
            </h4>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs border-t border-[var(--border)] pt-3">
            <div>
              <span className="text-[11px] text-[var(--text-muted)] block">{t('dateCol', lang)}</span>
              <span className="font-mono font-medium text-[var(--text-primary)] truncate block tabular-nums">{nextExam.date}</span>
            </div>
            <div>
              <span className="text-[11px] text-[var(--text-muted)] block">{t('timeCol', lang)}</span>
              <span className="font-mono font-medium text-[var(--text-primary)] truncate block tabular-nums">{nextExam.time}</span>
            </div>
          </div>
          <div className="border-t border-[var(--border)] pt-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 text-xs min-w-0">
              <MapPin size={14} strokeWidth={1.5} className="text-[var(--primary-bright)] shrink-0" />
              <span className="font-mono font-medium text-[var(--text-primary)] truncate">{nextExam.room}</span>
            </div>
            {nextExam.seat && (
              <div className="bg-[var(--app-bg)] border border-[var(--border-strong)] px-3 py-1 rounded-lg text-right shrink-0">
                <span className="text-[11px] text-[var(--text-muted)] block leading-none">{t('seatCol', lang)}</span>
                <span className="text-sm font-mono font-medium text-[var(--text-heading)] tabular-nums">{nextExam.seat}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (unlistedInfo) {
    return (
      <div className="bg-rose-500/8 border border-rose-500/25 rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between border-b border-rose-500/20 pb-3">
          <h3 className="text-xs font-medium text-rose-400 flex items-center gap-2">
            <AlertCircle size={16} strokeWidth={1.5} className="text-rose-400" />
            <span>{t('upcomingExamHeader', lang)}</span>
          </h3>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-medium text-[var(--text-heading)] leading-snug">
            {t('noSeatingAlert', lang)}
          </p>
          <p className="text-xs text-rose-300 leading-relaxed">
            {lang === 'en'
              ? 'No exam schedule found. You might need to submit an exam petition.'
              : 'ไม่พบรายชื่อในระบบ มจพ. โปรดตรวจเช็คเพื่อยื่นคำร้องขอเข้าสอบ'}
          </p>
          <Link
            to="/exam-room"
            className="inline-flex items-center gap-1.5 text-xs text-rose-400 hover:underline font-medium pt-1"
          >
            <span>{lang === 'en' ? 'View Petition Links' : 'ดูข้อมูลวิธียื่นคำร้อง'}</span>
            <ArrowRight size={14} strokeWidth={1.5} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 space-y-3">
      <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
        <h3 className="text-xs font-medium text-[var(--text-heading)] flex items-center gap-2">
          <ClipboardCheck size={16} strokeWidth={1.5} className="text-[var(--text-muted)]" />
          <span>{t('upcomingExamHeader', lang)}</span>
        </h3>
      </div>
      <div className="py-2 text-center">
        <p className="text-xs text-[var(--text-secondary)]">{t('noUpcomingExams', lang)}</p>
      </div>
    </div>
  );
}
