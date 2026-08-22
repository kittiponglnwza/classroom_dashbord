import { Link } from 'react-router-dom';
import { CalendarDays } from 'lucide-react';
import { t } from '../utils/i18n';

export default function TodayScheduleWidget({ todayClasses, lang }) {
  return (
    <div className="opacity-0 animate-fade-in" style={{ animationDelay: '150ms' }}>
      {todayClasses.length > 0 ? (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-brand-500/5 border border-brand-500/20 rounded-2xl px-6 py-4 w-full">
          <div className="flex items-center gap-3 min-w-0 flex-1 w-full">
            <CalendarDays size={18} className="text-brand-400 shrink-0" />
            <h3 className="text-sm font-bold text-brand-400 shrink-0">{t('todaySchedule', lang)}:</h3>
            <div className="flex items-center gap-4 overflow-x-auto custom-scrollbar whitespace-nowrap min-w-0 pb-1.5 flex-1">
              {todayClasses.map(cls => (
                <div key={cls.id} className="flex items-center gap-2 text-xs font-semibold text-white/80 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: cls.color }}></span>
                  <span className="truncate max-w-[200px]">{cls.title}</span> ({cls.startTime})
                </div>
              ))}
            </div>
          </div>
          <Link to="/schedule" className="text-xs font-bold text-brand-400 hover:text-brand-300 shrink-0">
            {t('viewFullSchedule', lang)} &rarr;
          </Link>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-4 bg-white/5 border border-white/5 rounded-2xl px-6 py-4">
          <div className="flex items-center gap-3">
            <CalendarDays size={18} className="text-zinc-400" />
            <p className="text-sm text-zinc-400 font-medium">{t('noClassesToday', lang)}</p>
          </div>
          <Link to="/schedule" className="text-xs font-bold text-brand-400 hover:text-brand-300 shrink-0">
            {t('viewFullSchedule', lang)} &rarr;
          </Link>
        </div>
      )}
    </div>
  );
}
