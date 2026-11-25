import { Link } from 'react-router-dom';
import { CalendarDays, ArrowRight } from 'lucide-react';
import { t } from '../utils/i18n';

export default function TodayScheduleWidget({ todayClasses, lang }) {
  return (
    <div>
      {todayClasses.length > 0 ? (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3 w-full">
          <div className="flex items-center gap-3 min-w-0 flex-1 w-full">
            <CalendarDays size={16} strokeWidth={1.5} className="text-[var(--primary-bright)] shrink-0" />
            <h3 className="text-xs font-medium text-[var(--text-heading)] shrink-0">{t('todaySchedule', lang)}:</h3>
            <div className="flex items-center gap-4 overflow-x-auto whitespace-nowrap min-w-0 flex-1">
              {todayClasses.map(cls => (
                <div key={cls.id} className="flex items-center gap-2 text-xs text-[var(--text-primary)] shrink-0">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cls.color || '#2563EB' }} />
                  <span className="truncate max-w-[200px] font-medium">{cls.title}</span>
                  <span className="text-[var(--text-muted)] font-mono tabular-nums">({cls.startTime})</span>
                </div>
              ))}
            </div>
          </div>
          <Link to="/schedule" className="text-xs font-medium text-[var(--primary-bright)] hover:underline shrink-0 inline-flex items-center gap-1">
            <span>{t('viewFullSchedule', lang)}</span>
            <ArrowRight size={14} strokeWidth={1.5} />
          </Link>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-4 bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3">
          <div className="flex items-center gap-2.5">
            <CalendarDays size={16} strokeWidth={1.5} className="text-[var(--text-muted)]" />
            <p className="text-xs text-[var(--text-secondary)] font-normal">{t('noClassesToday', lang)}</p>
          </div>
          <Link to="/schedule" className="text-xs font-medium text-[var(--primary-bright)] hover:underline shrink-0 inline-flex items-center gap-1">
            <span>{t('viewFullSchedule', lang)}</span>
            <ArrowRight size={14} strokeWidth={1.5} />
          </Link>
        </div>
      )}
    </div>
  );
}
