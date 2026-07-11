import { Calendar, Clock, MapPin, Edit, Trash2 } from 'lucide-react';
import { t } from '../../utils/i18n';
import { EXAM_CARD_COLORS } from '../../constants';

const getCardStyle = (index) => {
  return EXAM_CARD_COLORS[index % EXAM_CARD_COLORS.length];
};

export default function ExamCard({ exam, index, lang, onEdit, onDelete }) {
  const cardStyle = getCardStyle(index);

  return (
    <div className="bg-white/5 backdrop-blur-xl border border-white/10 hover:border-white/20 rounded-3xl p-6 flex flex-col justify-between transition-all duration-300 shadow-xl relative overflow-hidden group hover:shadow-2xl hover:-translate-y-1">
      {/* Course Code Border accent strip */}
      <div className={`absolute top-0 left-0 right-0 h-1 ${cardStyle.strip}`} />
      
      {/* Hover glow effect */}
      <div className={`absolute -top-12 -right-12 w-28 h-28 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none ${cardStyle.glow}`} />

      <div className="space-y-4">
        {/* Course Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide border ${cardStyle.badge}`}>
                {exam.courseCode}
              </span>
              {exam.isManual && (
                <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700 uppercase tracking-wide">
                  {t('manualTag', lang)}
                </span>
              )}
            </div>
            <h4 className="font-bold text-white text-[14px] leading-tight truncate pt-1">
              {exam.courseName}
            </h4>
          </div>

          {/* Manual exam actions */}
          {exam.isManual && (
            <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 shrink-0">
              <button
                onClick={() => onEdit(exam)}
                className="p-1.5 rounded-lg bg-dark-sidebar/60 border border-dark-border/40 text-dark-muted hover:text-white hover:bg-dark-hover transition-colors cursor-pointer"
                title={t('editExamBtn', lang)}
              >
                <Edit size={12} />
              </button>
              <button
                onClick={() => onDelete(exam.id)}
                className="p-1.5 rounded-lg bg-dark-sidebar/60 border border-rose-500/20 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors cursor-pointer"
                title={t('deleteExamBtn', lang)}
              >
                <Trash2 size={12} />
              </button>
            </div>
          )}
        </div>

        {/* Detail Metrics */}
        <div className="grid grid-cols-2 gap-4 text-xs border-t border-white/5 pt-4">
          {/* Date */}
          <div className="flex items-start gap-2 text-dark-muted">
            <Calendar size={13} className={`shrink-0 mt-0.5 ${cardStyle.accentText}`} />
            <div>
              <span className="text-[9px] uppercase font-bold text-dark-muted tracking-wider block">{t('dateCol', lang)}</span>
              <span className="font-semibold text-zinc-300">{exam.date}</span>
            </div>
          </div>

          {/* Time */}
          <div className="flex items-start gap-2 text-dark-muted">
            <Clock size={13} className={`shrink-0 mt-0.5 ${cardStyle.accentText}`} />
            <div>
              <span className="text-[9px] uppercase font-bold text-dark-muted tracking-wider block">{t('timeCol', lang)}</span>
              <span className="font-semibold text-zinc-300">{exam.time}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Room & Seating Details */}
      <div className="border-t border-white/5 mt-5 pt-4 flex items-center justify-between">
        {/* Room Code */}
        <div className="flex items-center gap-2 text-xs">
          <MapPin size={13} className={cardStyle.accentText} />
          <span className="font-semibold text-zinc-200">{exam.room || '-'}</span>
        </div>

        {/* Seat callout */}
        {exam.seat && (
          <div className="bg-white/5 border border-white/10 px-4 py-1.5 rounded-2xl text-right">
            <span className="text-[10px] uppercase font-bold text-zinc-400 block tracking-wider leading-none mb-1">{t('seatCol', lang)}</span>
            <span className="text-sm font-black text-white">{exam.seat}</span>
          </div>
        )}
      </div>
    </div>
  );
}
