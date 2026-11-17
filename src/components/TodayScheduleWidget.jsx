import { Link } from 'react-router-dom';
import { CalendarDays, ArrowRight } from 'lucide-react';
import { t } from '../utils/i18n';

export default function TodayScheduleWidget({ todayClasses, lang }) {
  return (
    <div>
      {todayClasses.length > 0 ? (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white border border-[#D2D2D7]/80 rounded-2xl px-5 py-3.5 shadow-2xs w-full">
          <div className="flex items-center gap-3 min-w-0 flex-1 w-full">
            <CalendarDays size={16} className="text-[#0071E3] shrink-0" />
            <h3 className="text-xs font-semibold text-[#1D1D1F] shrink-0">{t('todaySchedule', lang)}:</h3>
            <div className="flex items-center gap-4 overflow-x-auto whitespace-nowrap min-w-0 flex-1">
              {todayClasses.map(cls => (
                <div key={cls.id} className="flex items-center gap-2 text-xs font-medium text-[#1D1D1F] shrink-0">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cls.color || '#0071E3' }} />
                  <span className="truncate max-w-[200px]">{cls.title}</span>
                  <span className="text-[#6E6E73]">({cls.startTime})</span>
                </div>
              ))}
            </div>
          </div>
          <Link to="/schedule" className="text-xs font-medium text-[#0071E3] hover:underline shrink-0 inline-flex items-center gap-1">
            <span>{t('viewFullSchedule', lang)}</span>
            <ArrowRight size={12} />
          </Link>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-4 bg-white border border-[#D2D2D7]/80 rounded-2xl px-5 py-3.5 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <CalendarDays size={16} className="text-[#6E6E73]" />
            <p className="text-xs text-[#6E6E73] font-medium">{t('noClassesToday', lang)}</p>
          </div>
          <Link to="/schedule" className="text-xs font-medium text-[#0071E3] hover:underline shrink-0 inline-flex items-center gap-1">
            <span>{t('viewFullSchedule', lang)}</span>
            <ArrowRight size={12} />
          </Link>
        </div>
      )}
    </div>
  );
}
