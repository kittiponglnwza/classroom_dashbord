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
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
          {lang === 'en' ? 'Official Seat' : 'ที่นั่งสอบทางการ'}
        </span>
      );
    }
    if (isReg) {
      const hasRoom = Boolean(exam.room && String(exam.room).trim() && String(exam.room).trim() !== '-');
      return (
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-[#007ACC]/15 text-[#3794FF] border border-[#007ACC]/30">
          {hasRoom ? 'Reg' : (lang === 'en' ? 'Reg · Room TBA' : 'Reg · รอห้องสอบ')}
        </span>
      );
    }
    if (exam.isManual) {
      return (
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-[#1E1E1E] text-[#9D9D9D] border border-[#3C3C3C]">
          {t('manualTag', lang)}
        </span>
      );
    }
    return null;
  };

  const renderActions = (iconSize) => (
    <div className="flex items-center gap-1.5 shrink-0">
      {calendarUrl && (
        <a
          href={calendarUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1.5 rounded-lg bg-[#1E1E1E] border border-[#3C3C3C] text-[#3794FF] hover:bg-[#094771]/40 transition-colors cursor-pointer"
          title={t('addToCalendarBtn', lang) || 'Add to Google Calendar'}
          aria-label={t('addToCalendarBtn', lang) || 'Add to Google Calendar'}
        >
          <CalendarPlus size={iconSize} />
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
              <Check size={iconSize} />
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="p-1.5 rounded-lg bg-[#1E1E1E] border border-[#3C3C3C] text-[#9D9D9D] hover:text-[#FFFFFF] transition-colors cursor-pointer"
              title={t('cancelBtn', lang)}
              aria-label={t('cancelBtn', lang)}
            >
              <X size={iconSize} />
            </button>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => onEdit(exam)}
              className="p-1.5 rounded-lg bg-[#1E1E1E] border border-[#3C3C3C] text-[#9D9D9D] hover:text-[#FFFFFF] transition-colors cursor-pointer"
              title={t('editExamBtn', lang)}
              aria-label={t('editExamBtn', lang)}
            >
              <Edit size={iconSize} />
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="p-1.5 rounded-lg bg-[#1E1E1E] border border-[#3C3C3C] text-rose-400 hover:bg-rose-500/15 transition-colors cursor-pointer"
              title={t('deleteExamBtn', lang)}
              aria-label={t('deleteExamBtn', lang)}
            >
              <Trash2 size={iconSize} />
            </button>
          </>
        )
      )}
    </div>
  );

  if (layout === 'list') {
    return (
      <div className="bg-[#252526] border border-[#3C3C3C] hover:border-[#007ACC]/70 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors relative overflow-hidden">
        <div className={`absolute top-0 left-0 bottom-0 w-1 ${cardStyle.strip}`} />

        <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 min-w-0 pl-2">
          <div className="min-w-[150px] max-w-[280px]">
            <div className="flex items-center gap-1.5 mb-1">
              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-md border ${cardStyle.badge}`}>
                {exam.courseCode}
              </span>
              {renderSourceBadge()}
            </div>
            <h4 className="font-semibold text-[#FFFFFF] text-sm leading-snug truncate" title={exam.courseName}>
              {exam.courseName}
            </h4>
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-[#9D9D9D]">
            <div className="flex items-center gap-1.5">
              <Calendar size={13} className={cardStyle.accentText} />
              <span className="text-[#D4D4D4] font-medium">{exam.date}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock size={13} className={cardStyle.accentText} />
              <span className="text-[#D4D4D4] font-medium">{exam.time}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <MapPin size={13} className={cardStyle.accentText} />
              <span className="truncate max-w-[140px] text-[#D4D4D4] font-medium" title={exam.room || '-'}>{exam.room || '-'}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 border-t sm:border-t-0 border-[#3C3C3C] pt-3 sm:pt-0">
          {exam.seat && (
            <div className="flex flex-col items-start sm:items-end bg-[#1E1E1E] px-3 py-1 rounded-xl border border-[#3C3C3C]">
              <span className="text-[10px] text-[#858585] font-medium">{t('seatCol', lang)}</span>
              <span className="text-xs font-semibold text-[#FFFFFF]">{exam.seat}</span>
            </div>
          )}
          {renderActions(14)}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#252526] border border-[#3C3C3C] hover:border-[#007ACC]/70 rounded-2xl p-5 flex flex-col justify-between transition-colors relative overflow-hidden h-full">
      <div className={`absolute top-0 left-0 right-0 h-1 ${cardStyle.strip}`} />

      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-md border ${cardStyle.badge}`}>
                {exam.courseCode}
              </span>
              {renderSourceBadge()}
            </div>
            <h4 className="font-semibold text-[#FFFFFF] text-sm leading-snug truncate pt-1" title={exam.courseName}>
              {exam.courseName}
            </h4>
          </div>

          {renderActions(13)}
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs border-t border-[#3C3C3C] pt-3.5">
          <div className="flex items-start gap-2">
            <Calendar size={13} className={`shrink-0 mt-0.5 ${cardStyle.accentText}`} />
            <div>
              <span className="text-[11px] text-[#858585] block">{t('dateCol', lang)}</span>
              <span className="font-medium text-[#D4D4D4]">{exam.date}</span>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <Clock size={13} className={`shrink-0 mt-0.5 ${cardStyle.accentText}`} />
            <div>
              <span className="text-[11px] text-[#858585] block">{t('timeCol', lang)}</span>
              <span className="font-medium text-[#D4D4D4]">{exam.time}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-[#3C3C3C] mt-4 pt-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs">
          <MapPin size={13} className={cardStyle.accentText} />
          <span className="font-medium text-[#D4D4D4]">{exam.room || '-'}</span>
        </div>

        {exam.seat && (
          <div className="bg-[#1E1E1E] border border-[#3C3C3C] px-3 py-1 rounded-xl text-right">
            <span className="text-[10px] text-[#858585] block leading-none mb-0.5">{t('seatCol', lang)}</span>
            <span className="text-xs font-semibold text-[#FFFFFF]">{exam.seat}</span>
          </div>
        )}
      </div>
    </div>
  );
}
