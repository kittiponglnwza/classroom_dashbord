import { t } from './i18n';

const DATE_ONLY_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

export const parseLocalDateInput = (input, { endOfDayForDateOnly = false } = {}) => {
  if (!input) return null;
  if (input instanceof Date) {
    return Number.isNaN(input.getTime()) ? null : new Date(input.getTime());
  }
  if (typeof input === 'string') {
    const match = input.trim().match(DATE_ONLY_REGEX);
    if (match) {
      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1;
      const day = parseInt(match[3], 10);
      return endOfDayForDateOnly
        ? new Date(year, month, day, 23, 59, 59, 999)
        : new Date(year, month, day, 0, 0, 0, 0);
    }
  }
  const parsed = new Date(input);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const getCalendarDaysDiff = (dateStr1, dateStr2) => {
  const d1 = parseLocalDateInput(dateStr1);
  const d2 = parseLocalDateInput(dateStr2);
  if (!d1 || !d2) return null;
  d1.setHours(0, 0, 0, 0);
  d2.setHours(0, 0, 0, 0);
  return Math.round((d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24));
};

export const isOverdue = (dueDate) => {
  if (!dueDate) return false;
  const due = parseLocalDateInput(dueDate, { endOfDayForDateOnly: true });
  if (!due) return false;
  return due.getTime() < Date.now();
};

export const isDueToday = (dueDate) => {
  if (!dueDate) return false;
  return getCalendarDaysDiff(dueDate, new Date()) === 0;
};

export const formatRelativeTime = (timestamp, lang = 'en') => {
  if (!timestamp) return t('neverSynced', lang);
  const date = parseLocalDateInput(timestamp);
  if (!date) return t('neverSynced', lang);
  return date.toLocaleTimeString(lang === 'en' ? 'en-US' : 'th-TH', { 
    hour: '2-digit', minute: '2-digit', second: '2-digit' 
  }) + ' ' + date.toLocaleDateString(lang === 'en' ? 'en-US' : 'th-TH', { 
    day: 'numeric', month: 'short' 
  });
};

export const calculateDueState = (dueDate, status) => {
  if (status === 'done') return { type: 'done', isOverdue: false };
  if (!dueDate) return { type: 'noDate', isOverdue: false };

  const now = new Date();
  const due = parseLocalDateInput(dueDate, { endOfDayForDateOnly: true });
  if (!due) return { type: 'noDate', isOverdue: false };

  const diffMs = due.getTime() - now.getTime();
  const calendarDiff = getCalendarDaysDiff(dueDate, now) ?? 0;

  if (diffMs < 0) {
    const diffDays = Math.max(0, Math.abs(calendarDiff));
    const diffHrs = Math.max(1, Math.abs(Math.floor(diffMs / (1000 * 60 * 60))));
    return { type: 'overdue', diffDays, diffHrs, isOverdue: true };
  }

  if (calendarDiff === 0) {
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.max(0, Math.floor(diffMs / (1000 * 60)));
    return { type: 'dueToday', diffHrs, diffMins, isOverdue: false };
  }

  if (calendarDiff === 1) {
    return { type: 'dueTomorrow', diffDays: 1, isOverdue: false };
  }

  return { type: 'dueLater', diffDays: calendarDiff, isOverdue: false };
};

