import { Link } from 'react-router-dom';
import { CalendarDays, ArrowRight } from 'lucide-react';
import { t } from '../utils/i18n';

export default function TodayScheduleWidget({ todayClasses, lang }) {
  return (
    <div>
      {todayClasses.length > 0 ? (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#252526] border border-[#3C3C3C] rounded-2xl px-5 py-3.5 w-full">
          <div className="flex items-center gap-3 min-w-0 flex-1 w-full">
            <CalendarDays size={16} className="text-[#3794FF] shrink-0" />
            <h3 className="text-xs font-semibold text-[#FFFFFF] shrink-0">{t('todaySchedule', lang)}:</h3>
            <div className="flex items-center gap-4 overflow-x-auto whitespace-nowrap min-w-0 flex-1">
              {todayClasses.map(cls => (
                <div key={cls.id} className="flex items-center gap-2 text-xs font-medium text-[#D4D4D4] shrink-0">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cls.color || '#007ACC' }} />
                  <span className="truncate max-w-[200px]">{cls.title}</span>
                  <span className="text-[#858585]">({cls.startTime})</span>
                </div>
              ))}
            </div>
          </div>
          <Link to="/schedule" className="text-xs font-medium text-[#3794FF] hover:underline shrink-0 inline-flex items-center gap-1">
            <span>{t('viewFullSchedule', lang)}</span>
            <ArrowRight size={12} />
          </Link>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-4 bg-[#252526] border border-[#3C3C3C] rounded-2xl px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <CalendarDays size={16} className="text-[#858585]" />
            <p className="text-xs text-[#9D9D9D] font-medium">{t('noClassesToday', lang)}</p>
          </div>
          <Link to="/schedule" className="text-xs font-medium text-[#3794FF] hover:underline shrink-0 inline-flex items-center gap-1">
            <span>{t('viewFullSchedule', lang)}</span>
            <ArrowRight size={12} />
          </Link>
        </div>
      )}
    </div>
  );
}
