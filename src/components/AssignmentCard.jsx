import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Calendar, Paperclip, AlertCircle, CheckCircle2, Clock, ExternalLink, BookOpen, ChevronDown, ChevronUp, Pin } from 'lucide-react';
import { t } from '../utils/i18n';
import { calculateDueState } from '../utils/dateUtils';
import { sanitizeExternalUrl } from '../utils/sanitize';
import { getCourseDotClass } from '../utils/colors';
import { useClassroomUI } from '../contexts/ClassroomUIContext';

const AssignmentCard = React.memo(function AssignmentCard({ assignment, onStatusChange, lang = 'en', viewMode = 'grid' }) {
  const { id, title, course, dueDate, status, points, attachments, courseColor, googleLink } = assignment;
  const ui = useClassroomUI();
  const isPinned = Boolean(ui?.isItemPinned?.(id));
  const handleTogglePin = ui?.handleTogglePinItem;
  const safeGoogleLink = sanitizeExternalUrl(googleLink);
  const pointsLabel = typeof points === 'number'
    ? `${points} ${lang === 'en' ? 'pts' : 'คะแนน'}`
    : t('ungraded', lang);
  const location = useLocation();
  const linkState = {
    from: `${location.pathname}${location.search}`,
    fromCourse: course
  };

  const getStatusDotColor = () => {
    switch (status) {
      case 'todo': return 'bg-[var(--text-muted)]';
      case 'doing': return 'bg-amber-400';
      case 'done': return 'bg-emerald-400';
      case 'read': return 'bg-sky-400';
      default: return 'bg-[var(--text-muted)]';
    }
  };

  const getStatusTextColor = () => {
    switch (status) {
      case 'todo': return 'text-[var(--text-secondary)]';
      case 'doing': return 'text-amber-400';
      case 'done': return 'text-emerald-400';
      case 'read': return 'text-sky-400';
      default: return 'text-[var(--text-secondary)]';
    }
  };

  const getDueStatus = () => {
    const state = calculateDueState(dueDate, status);

    switch (state.type) {
      case 'done':
        return {
          text: t('completed', lang),
          colorClass: 'text-emerald-400 font-medium',
          icon: <CheckCircle2 size={14} strokeWidth={1.5} className="text-emerald-400 shrink-0" />,
          isOverdue: false
        };
      case 'read':
        return {
          text: t('read', lang),
          colorClass: 'text-sky-400 font-medium',
          icon: <BookOpen size={14} strokeWidth={1.5} className="text-sky-400 shrink-0" />,
          isOverdue: false
        };
      case 'noDate':
        return {
          text: t('noDueDate', lang),
          colorClass: 'text-[var(--text-muted)] font-normal',
          icon: <Calendar size={14} strokeWidth={1.5} className="text-[var(--text-muted)] shrink-0" />,
          isOverdue: false
        };
      case 'overdue':
        return {
          text: state.diffDays === 0
            ? t('overdueHrs', lang, { hrs: state.diffHrs })
            : t('overdueDays', lang, { days: state.diffDays }),
          colorClass: 'text-rose-400 font-medium',
          icon: <AlertCircle size={14} strokeWidth={1.5} className="text-rose-400 shrink-0" />,
          isOverdue: true
        };
      case 'dueToday':
        return {
          text: state.diffHrs === 0
            ? t('minsLeftToday', lang, { mins: state.diffMins })
            : t('hrsLeftToday', lang, { hrs: state.diffHrs }),
          colorClass: 'text-amber-400 font-medium',
          icon: <Clock size={14} strokeWidth={1.5} className="text-amber-400 shrink-0" />,
          isOverdue: false
        };
      case 'dueTomorrow':
        return {
          text: t('dueTomorrow', lang),
          colorClass: 'text-amber-400 font-medium',
          icon: <Calendar size={14} strokeWidth={1.5} className="text-amber-400 shrink-0" />,
          isOverdue: false
        };
      case 'dueLater':
        return {
          text: t('daysLeft', lang, { days: state.diffDays }),
          colorClass: 'text-[var(--primary-bright)] font-medium',
          icon: <Calendar size={14} strokeWidth={1.5} className="text-[var(--primary-bright)] shrink-0" />,
          isOverdue: false
        };
      default:
        return { text: '', colorClass: '', icon: null, isOverdue: false };
    }
  };

  const dueStatus = getDueStatus();

  const getCardBorderClass = () => {
    if (dueStatus.isOverdue) {
      return 'border-rose-500/35 hover:border-rose-400/55';
    }
    if (isPinned) {
      return 'border-amber-500/30 hover:border-amber-400/50';
    }
    return 'border-[var(--border)] hover:border-[var(--border-strong)]';
  };

  const [isListExpanded, setIsListExpanded] = useState(false);

  if (viewMode === 'list' && !isListExpanded) {
    return (
      <div
        className={`group bg-[var(--surface)] border rounded-xl px-4 py-3 flex items-center justify-between gap-3 sm:gap-4 transition-colors ${getCardBorderClass()}`}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-8 h-8 rounded-lg bg-[var(--app-bg)] border border-[var(--border)] flex items-center justify-center shrink-0 text-[var(--primary-bright)]">
            <BookOpen size={15} strokeWidth={1.5} />
          </div>
          <div className="min-w-0 flex-1">
            <Link
              to={`/assignments/${id}`}
              state={linkState}
              className="text-sm font-medium text-[var(--text-heading)] hover:text-[var(--primary-bright)] truncate block transition-colors"
            >
              {title}
            </Link>
            <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] mt-0.5">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${getCourseDotClass(courseColor)}`} />
              <span className="truncate">{course}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden sm:flex items-center gap-1.5">
            {dueStatus.icon}
            <span className={`text-xs tabular-nums ${dueStatus.colorClass}`}>{dueStatus.text}</span>
          </div>

          {handleTogglePin && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleTogglePin(id);
              }}
              aria-label={isPinned ? (lang === 'en' ? 'Unpin' : 'เลิกปักหมุด') : (lang === 'en' ? 'Pin' : 'ปักหมุด')}
              title={isPinned ? (lang === 'en' ? 'Unpin' : 'เลิกปักหมุด') : (lang === 'en' ? 'Pin to top' : 'ปักหมุดไว้บนสุด')}
              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                isPinned
                  ? 'text-amber-400 bg-amber-500/12 border-amber-500/30'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-[var(--app-bg)] border-[var(--border)]'
              }`}
            >
              <Pin size={14} strokeWidth={1.5} className={isPinned ? 'fill-amber-400/25' : ''} />
            </button>
          )}

          <div
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1.5 bg-[var(--app-bg)] border border-[var(--border)] px-2.5 h-8 rounded-lg shrink-0"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${getStatusDotColor()} shrink-0`} />
            <select
              aria-label={`${title} status`}
              value={status}
              onChange={(e) => onStatusChange(id, e.target.value)}
              className={`text-xs font-medium bg-transparent border-0 p-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] cursor-pointer select-none ${getStatusTextColor()}`}
            >
              <option value="todo">{t('todo', lang)}</option>
              <option value="doing">{t('doing', lang)}</option>
              <option value="done">{t('done', lang)}</option>
              <option value="read">{t('read', lang)}</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => setIsListExpanded(true)}
            aria-label={lang === 'en' ? 'Expand details' : 'ดูรายละเอียด'}
            className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-heading)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
          >
            <ChevronDown size={16} strokeWidth={1.5} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`bg-[var(--surface)] border rounded-xl p-4 sm:p-5 transition-colors flex flex-col justify-between group ${
        viewMode === 'grid' ? 'h-full' : ''
      } ${getCardBorderClass()}`}
    >
      {viewMode === 'list' && (
        <div className="flex justify-between items-center -mt-1 mb-3 border-b border-[var(--border)] pb-2.5">
          <span className="text-xs font-medium text-[var(--text-secondary)]">{course}</span>
          <button
            type="button"
            onClick={() => setIsListExpanded(false)}
            className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-heading)] hover:bg-[var(--surface-hover)] rounded-lg transition-colors cursor-pointer"
            title={lang === 'en' ? 'Collapse' : 'ย่อ'}
          >
            <ChevronUp size={16} strokeWidth={1.5} />
          </button>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`w-2 h-2 rounded-full shrink-0 ${getCourseDotClass(courseColor)}`} />
            <span className="text-xs font-normal text-[var(--text-secondary)] truncate" title={course}>
              {course}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {handleTogglePin && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleTogglePin(id);
                }}
                aria-label={isPinned ? (lang === 'en' ? 'Unpin' : 'เลิกปักหมุด') : (lang === 'en' ? 'Pin' : 'ปักหมุด')}
                title={isPinned ? (lang === 'en' ? 'Unpin' : 'เลิกปักหมุด') : (lang === 'en' ? 'Pin to top' : 'ปักหมุดไว้บนสุด')}
                className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                  isPinned
                    ? 'text-amber-400 bg-amber-500/12 border-amber-500/30'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-[var(--app-bg)] border-[var(--border)]'
                }`}
              >
                <Pin size={14} strokeWidth={1.5} className={isPinned ? 'fill-amber-400/25' : ''} />
              </button>
            )}

            <div className="flex items-center gap-1.5 bg-[var(--app-bg)] border border-[var(--border)] px-2.5 h-7 rounded-lg hover:border-[var(--border-strong)] transition-colors shrink-0">
              <span className={`w-1.5 h-1.5 rounded-full ${getStatusDotColor()} shrink-0`} />
              <select
                aria-label={`${title} status`}
                value={status}
                onChange={(e) => onStatusChange(id, e.target.value)}
                className={`text-xs font-medium bg-transparent border-0 p-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] cursor-pointer pr-1 select-none ${getStatusTextColor()}`}
              >
                <option value="todo">{t('todo', lang)}</option>
                <option value="doing">{t('doing', lang)}</option>
                <option value="done">{t('done', lang)}</option>
                <option value="read">{t('read', lang)}</option>
              </select>
            </div>
          </div>
        </div>

        <Link
          to={`/assignments/${id}`}
          state={linkState}
          className="text-[var(--text-heading)] hover:text-[var(--primary-bright)] transition-colors font-medium text-sm leading-snug block"
        >
          {title}
        </Link>
      </div>

      <div className="border-t border-[var(--border)] pt-3 flex flex-wrap items-center justify-between gap-2 mt-4">
        <div className="flex items-center gap-1.5 text-xs">
          {dueStatus.icon}
          <span className={`text-xs tabular-nums ${dueStatus.colorClass}`}>
            {dueStatus.text}
          </span>
        </div>

        <div className="flex items-center gap-3 text-[var(--text-muted)] shrink-0 tabular-nums">
          {attachments && attachments.length > 0 && (
            <span className="flex items-center gap-1 text-xs font-mono" title={`${attachments.length} attachments`}>
              <Paperclip size={13} strokeWidth={1.5} />
              {attachments.length}
            </span>
          )}

          {safeGoogleLink && (
            <a
              href={safeGoogleLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[var(--primary-bright)] hover:underline font-medium flex items-center gap-1 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              Classroom
              <ExternalLink size={12} strokeWidth={1.5} />
            </a>
          )}

          <span className="text-xs font-mono text-[var(--text-secondary)]">
            {pointsLabel}
          </span>
        </div>
      </div>
    </div>
  );
});

export default AssignmentCard;
