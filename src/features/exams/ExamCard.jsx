import { useState } from 'react';
import { Calendar, Clock, MapPin, Edit, Trash2, CalendarPlus, Check, X } from 'lucide-react';
import { getGoogleCalendarUrl } from '../../utils/calendarUrl';
import { t } from '../../utils/i18n';
import { EXAM_CARD_COLORS } from '../../constants';

const getCardStyle = (index) => {
  return EXAM_CARD_COLORS[index % EXAM_CARD_COLORS.length];
};

export default function ExamCard({ exam, index, lang, onEdit, onDelete, layout = 'grid' }) {
  const cardStyle = getCardStyle(index);
  const calendarUrl = getGoogleCalendarUrl(exam);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const renderSourceBadge = () => {
    const isReg = exam.source === 'kmutnb-reg' || String(exam.id || '').startsWith('reg-exam-');
    const isSciBase = exam.source === 'scibase' || (!exam.isManual && !isReg);
    if (isSciBase) {
      return (
        <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-emerald-500/12 text-emerald-400 border border-emerald-500/25">
          {lang === 'en' ? 'Official Seat' : 'ที่นั่งสอบทางการ'}
        </span>
      );
    }
    if (isReg) {
      const hasRoom = Boolean(exam.room && String(exam.room).trim() && String(exam.room).trim() !== '-');
      return (
        <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-[var(--primary)]/12 text-[var(--primary-bright)] border border-[var(--primary)]/25">
          {hasRoom ? 'Reg' : (lang === 'en' ? 'Reg · Room TBA' : 'Reg · รอห้องสอบ')}
        </span>
      );
    }
    if (exam.isManual) {
      return (
        <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-[var(--app-bg)] text-[var(--text-secondary)] border border-[var(--border)]">
          {t('manualTag', lang)}
        </span>
      );
    }
    return null;
  };

  const renderActions = () => (
    <div className="flex items-center gap-1.5 shrink-0">
      {calendarUrl && (
        <a
          href={calendarUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1.5 rounded-lg bg-[var(--app-bg)] border border-[var(--border)] text-[var(--primary-bright)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
          title={t('addToCalendarBtn', lang) || 'Add to Google Calendar'}
          aria-label={t('addToCalendarBtn', lang) || 'Add to Google Calendar'}
        >
          <CalendarPlus size={14} strokeWidth={1.5} />
        </a>
      )}
      {exam.isManual && (
        confirmDelete ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onDelete(exam.id)}
              className="p-1.5 rounded-lg bg-rose-600 text-white hover:bg-rose-500 transition-colors cursor-pointer"
              title={t('confirmBtn', lang)}
              aria-label={t('confirmBtn', lang)}
            >
              <Check size={14} strokeWidth={1.5} />
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="p-1.5 rounded-lg bg-[var(--app-bg)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-heading)] transition-colors cursor-pointer"
              title={t('cancelBtn', lang)}
              aria-label={t('cancelBtn', lang)}
            >
              <X size={14} strokeWidth={1.5} />
            </button>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => onEdit(exam)}
              className="p-1.5 rounded-lg bg-[var(--app-bg)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-heading)] transition-colors cursor-pointer"
              title={t('editExamBtn', lang)}
              aria-label={t('editExamBtn', lang)}
            >
              <Edit size={14} strokeWidth={1.5} />
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="p-1.5 rounded-lg bg-[var(--app-bg)] border border-[var(--border)] text-rose-400 hover:bg-rose-500/12 transition-colors cursor-pointer"
              title={t('deleteExamBtn', lang)}
              aria-label={t('deleteExamBtn', lang)}
            >
              <Trash2 size={14} strokeWidth={1.5} />
            </button>
          </>
        )
      )}
    </div>
  );

  if (layout === 'list') {
    return (
      <div className="bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--border-strong)] rounded-xl p-4 sm:p-5 transition-colors relative overflow-hidden">
        <div className={`absolute top-0 left-0 bottom-0 w-0.5 ${cardStyle.strip}`} />

        <div className="pl-2 grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] lg:grid-cols-[minmax(0,1.25fr)_auto_minmax(11.5rem,0.75fr)] items-center gap-x-4 gap-y-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[11px] font-mono font-medium px-2 py-0.5 rounded border ${cardStyle.badge}`}>
                {exam.courseCode}
              </span>
              {renderSourceBadge()}
            </div>
            <h4 className="font-medium text-[var(--text-heading)] text-sm leading-snug truncate" title={exam.courseName}>
              {exam.courseName}
            </h4>
          </div>

          <div className="sm:col-span-2 lg:col-span-1 sm:order-3 lg:order-2 flex flex-wrap sm:grid sm:grid-cols-[7.5rem_6.25rem_minmax(6.5rem,1fr)] lg:grid-cols-[7.5rem_6.25rem_6.5rem] items-center gap-x-4 gap-y-1.5 text-xs text-[var(--text-secondary)] font-mono tabular-nums">
            <div className="flex items-center gap-1.5 min-w-0">
              <Calendar size={14} strokeWidth={1.5} className="text-[var(--text-muted)] shrink-0" />
              <span className="text-[var(--text-primary)] whitespace-nowrap truncate">{exam.date}</span>
            </div>
            <div className="flex items-center gap-1.5 min-w-0">
              <Clock size={14} strokeWidth={1.5} className="text-[var(--text-muted)] shrink-0" />
              <span className="text-[var(--text-primary)] whitespace-nowrap truncate">{exam.time}</span>
            </div>
            <div className="flex items-center gap-1.5 min-w-0">
              <MapPin size={14} strokeWidth={1.5} className="text-[var(--text-muted)] shrink-0" />
              <span className="truncate text-[var(--text-primary)]" title={exam.room || '-'}>{exam.room || '-'}</span>
            </div>
          </div>

          <div className="sm:order-2 lg:order-3 flex items-center justify-between sm:justify-end gap-3 shrink-0 border-t sm:border-t-0 border-[var(--border)] pt-3 sm:pt-0">
            {exam.seat && (
              <div className="flex flex-col items-start sm:items-end bg-[var(--app-bg)] px-3 py-1 rounded-lg border border-[var(--border-strong)]">
                <span className="text-[11px] text-[var(--text-muted)]">{t('seatCol', lang)}</span>
                <span className="text-sm font-mono font-medium text-[var(--text-heading)] tabular-nums">{exam.seat}</span>
              </div>
            )}
            {renderActions()}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--border-strong)] rounded-xl p-5 flex flex-col justify-between transition-colors relative overflow-hidden h-full">
      <div className={`absolute top-0 left-0 right-0 h-0.5 ${cardStyle.strip}`} />

      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[11px] font-mono font-medium px-2 py-0.5 rounded border ${cardStyle.badge}`}>
                {exam.courseCode}
              </span>
              {renderSourceBadge()}
            </div>
            <h4 className="font-medium text-[var(--text-heading)] text-sm leading-snug truncate" title={exam.courseName}>
              {exam.courseName}
            </h4>
          </div>

          {renderActions()}
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs border-t border-[var(--border)] pt-3.5">
          <div className="flex items-start gap-2">
            <Calendar size={14} strokeWidth={1.5} className="text-[var(--text-muted)] shrink-0 mt-0.5" />
            <div>
              <span className="text-[11px] text-[var(--text-muted)] block">{t('dateCol', lang)}</span>
              <span className="font-mono font-medium text-[var(--text-primary)] tabular-nums">{exam.date}</span>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <Clock size={14} strokeWidth={1.5} className="text-[var(--text-muted)] shrink-0 mt-0.5" />
            <div>
              <span className="text-[11px] text-[var(--text-muted)] block">{t('timeCol', lang)}</span>
              <span className="font-mono font-medium text-[var(--text-primary)] tabular-nums">{exam.time}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-[var(--border)] mt-4 pt-3.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs min-w-0">
          <MapPin size={14} strokeWidth={1.5} className="text-[var(--primary-bright)] shrink-0" />
          <span className="font-mono font-medium text-[var(--text-primary)] truncate">{exam.room || '-'}</span>
        </div>

        {exam.seat && (
          <div className="bg-[var(--app-bg)] border border-[var(--border-strong)] px-3 py-1 rounded-lg text-right shrink-0">
            <span className="text-[11px] text-[var(--text-muted)] block leading-none mb-0.5">{t('seatCol', lang)}</span>
            <span className="text-sm font-mono font-medium text-[var(--text-heading)] tabular-nums">{exam.seat}</span>
          </div>
        )}
      </div>
    </div>
  );
}
