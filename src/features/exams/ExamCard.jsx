import { Calendar, Clock, MapPin, Edit, Trash2, CalendarPlus } from 'lucide-react';
import { getGoogleCalendarUrl } from '../../utils/calendarUrl';
import { t } from '../../utils/i18n';
import { EXAM_CARD_COLORS } from '../../constants';

const getCardStyle = (index) => {
  return EXAM_CARD_COLORS[index % EXAM_CARD_COLORS.length];
};

export default function ExamCard({ exam, index, lang, onEdit, onDelete, layout = 'grid' }) {
  const cardStyle = getCardStyle(index);

  if (layout === 'list') {
    return (
      <div className="bg-white border border-[#D2D2D7]/80 hover:border-[#0071E3]/40 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors shadow-2xs relative overflow-hidden">
        <div className={`absolute top-0 left-0 bottom-0 w-1 ${cardStyle.strip}`} />

        <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 min-w-0 pl-2">
          <div className="min-w-[150px] max-w-[280px]">
            <div className="flex items-center gap-1.5 mb-1">
              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-md border ${cardStyle.badge}`}>
                {exam.courseCode}
              </span>
              {exam.isManual && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-[#F5F5F7] text-[#6E6E73] border border-[#D2D2D7]">
                  {t('manualTag', lang)}
                </span>
              )}
            </div>
            <h4 className="font-semibold text-[#1D1D1F] text-sm leading-snug truncate">
              {exam.courseName}
            </h4>
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-[#6E6E73]">
            <div className="flex items-center gap-1.5">
              <Calendar size={13} className={cardStyle.accentText} />
              <span className="text-[#1D1D1F] font-medium">{exam.date}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock size={13} className={cardStyle.accentText} />
              <span className="text-[#1D1D1F] font-medium">{exam.time}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <MapPin size={13} className={cardStyle.accentText} />
              <span className="truncate max-w-[140px] text-[#1D1D1F] font-medium">{exam.room || '-'}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 border-t sm:border-t-0 border-[#D2D2D7]/60 pt-3 sm:pt-0">
          {exam.seat && (
            <div className="flex flex-col items-start sm:items-end bg-[#F5F5F7] px-3 py-1 rounded-xl border border-[#D2D2D7]">
              <span className="text-[10px] text-[#6E6E73] font-medium">{t('seatCol', lang)}</span>
              <span className="text-xs font-semibold text-[#1D1D1F]">{exam.seat}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <a
              href={getGoogleCalendarUrl(exam)}
              target="_blank"
              rel="noreferrer"
              className="p-1.5 rounded-lg bg-[#F5F5F7] border border-[#D2D2D7] text-[#0071E3] hover:bg-blue-50 transition-colors cursor-pointer"
              title={t('addToCalendarBtn', lang) || 'Add to Google Calendar'}
            >
              <CalendarPlus size={14} />
            </a>
            {exam.isManual && (
              <>
                <button
                  type="button"
                  onClick={() => onEdit(exam)}
                  className="p-1.5 rounded-lg bg-[#F5F5F7] border border-[#D2D2D7] text-[#6E6E73] hover:text-[#1D1D1F] transition-colors cursor-pointer"
                  title={t('editExamBtn', lang)}
                >
                  <Edit size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(exam.id)}
                  className="p-1.5 rounded-lg bg-[#F5F5F7] border border-[#D2D2D7] text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                  title={t('deleteExamBtn', lang)}
                >
                  <Trash2 size={14} />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-[#D2D2D7]/80 hover:border-[#0071E3]/40 rounded-2xl p-5 flex flex-col justify-between transition-colors shadow-2xs relative overflow-hidden h-full">
      <div className={`absolute top-0 left-0 right-0 h-1 ${cardStyle.strip}`} />

      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-md border ${cardStyle.badge}`}>
                {exam.courseCode}
              </span>
              {exam.isManual && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-[#F5F5F7] text-[#6E6E73] border border-[#D2D2D7]">
                  {t('manualTag', lang)}
                </span>
              )}
            </div>
            <h4 className="font-semibold text-[#1D1D1F] text-sm leading-snug truncate pt-1">
              {exam.courseName}
            </h4>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <a
              href={getGoogleCalendarUrl(exam)}
              target="_blank"
              rel="noreferrer"
              className="p-1.5 rounded-lg bg-[#F5F5F7] border border-[#D2D2D7] text-[#0071E3] hover:bg-blue-50 transition-colors cursor-pointer"
              title={t('addToCalendarBtn', lang) || 'Add to Google Calendar'}
            >
              <CalendarPlus size={13} />
            </a>

            {exam.isManual && (
              <>
                <button
                  type="button"
                  onClick={() => onEdit(exam)}
                  className="p-1.5 rounded-lg bg-[#F5F5F7] border border-[#D2D2D7] text-[#6E6E73] hover:text-[#1D1D1F] transition-colors cursor-pointer"
                  title={t('editExamBtn', lang)}
                >
                  <Edit size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(exam.id)}
                  className="p-1.5 rounded-lg bg-[#F5F5F7] border border-[#D2D2D7] text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                  title={t('deleteExamBtn', lang)}
                >
                  <Trash2 size={13} />
                </button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs border-t border-[#D2D2D7]/60 pt-3.5">
          <div className="flex items-start gap-2">
            <Calendar size={13} className={`shrink-0 mt-0.5 ${cardStyle.accentText}`} />
            <div>
              <span className="text-[11px] text-[#6E6E73] block">{t('dateCol', lang)}</span>
              <span className="font-medium text-[#1D1D1F]">{exam.date}</span>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <Clock size={13} className={`shrink-0 mt-0.5 ${cardStyle.accentText}`} />
            <div>
              <span className="text-[11px] text-[#6E6E73] block">{t('timeCol', lang)}</span>
              <span className="font-medium text-[#1D1D1F]">{exam.time}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-[#D2D2D7]/60 mt-4 pt-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs">
          <MapPin size={13} className={cardStyle.accentText} />
          <span className="font-medium text-[#1D1D1F]">{exam.room || '-'}</span>
        </div>

        {exam.seat && (
          <div className="bg-[#F5F5F7] border border-[#D2D2D7] px-3 py-1 rounded-xl text-right">
            <span className="text-[10px] text-[#6E6E73] block leading-none mb-0.5">{t('seatCol', lang)}</span>
            <span className="text-xs font-semibold text-[#1D1D1F]">{exam.seat}</span>
          </div>
        )}
      </div>
    </div>
  );
}
