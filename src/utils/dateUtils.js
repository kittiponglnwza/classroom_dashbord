import { t } from './i18n';

export const getCalendarDaysDiff = (dateStr1, dateStr2) => {
  const d1 = new Date(dateStr1);
  const d2 = new Date(dateStr2);
  d1.setHours(0, 0, 0, 0);
  d2.setHours(0, 0, 0, 0);
  return Math.round((d1 - d2) / (1000 * 60 * 60 * 24));
};

export const isOverdue = (dueDate) => {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date();
};

export const isDueToday = (dueDate) => {
  if (!dueDate) return false;
  return getCalendarDaysDiff(dueDate, new Date()) === 0;
};

export const getDueStatus = (dueDate, status, lang = 'en') => {
  if (status === 'done') return { label: t('done', lang), color: 'text-emerald-400', isLate: false };
  if (!dueDate) return { label: t('noDueDate', lang), color: 'text-dark-muted', isLate: false };
  
  const daysDiff = getCalendarDaysDiff(dueDate, new Date());
  
  if (daysDiff < 0) {
    return { 
      label: t('overdueBy', lang, { days: Math.abs(daysDiff) }), 
      color: 'text-rose-400 font-bold', 
      isLate: true 
    };
  } else if (daysDiff === 0) {
    return { 
      label: t('dueToday', lang), 
      color: 'text-amber-400 font-bold', 
      isLate: false 
    };
  } else if (daysDiff === 1) {
    return { 
      label: t('dueTomorrow', lang), 
      color: 'text-brand-300 font-medium', 
      isLate: false 
    };
  } else {
    return { 
      label: t('dueInDays', lang, { days: daysDiff }), 
      color: 'text-dark-muted', 
      isLate: false 
    };
  }
};

export const formatRelativeTime = (timestamp, lang = 'en') => {
  if (!timestamp) return t('neverSynced', lang);
  const date = new Date(timestamp);
  return date.toLocaleTimeString(lang === 'en' ? 'en-US' : 'th-TH', { 
    hour: '2-digit', minute: '2-digit', second: '2-digit' 
  }) + ' ' + date.toLocaleDateString(lang === 'en' ? 'en-US' : 'th-TH', { 
    day: 'numeric', month: 'short' 
  });
};
