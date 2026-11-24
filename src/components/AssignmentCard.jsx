import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Calendar, Paperclip, AlertCircle, CheckCircle2, Clock, ExternalLink, BookOpen, ChevronDown, ChevronUp, Pin } from 'lucide-react';
import { t } from '../utils/i18n';
import { calculateDueState } from '../utils/dateUtils';
import { sanitizeExternalUrl } from '../utils/sanitize';
import { useClassroomUI } from '../contexts/ClassroomUIContext';

const COURSE_DOT_COLORS = {
  emerald: 'bg-emerald-400',
  blue: 'bg-[#3794FF]',
  amber: 'bg-amber-400',
  rose: 'bg-rose-400',
  purple: 'bg-purple-400',
  zinc: 'bg-[#858585]'
};

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
      case 'todo': return 'bg-[#858585]';
      case 'doing': return 'bg-amber-400';
      case 'done': return 'bg-emerald-400';
      case 'read': return 'bg-sky-400';
      default: return 'bg-[#858585]';
    }
  };

  const getStatusTextColor = () => {
    switch (status) {
      case 'todo': return 'text-[#9D9D9D]';
      case 'doing': return 'text-amber-400';
      case 'done': return 'text-emerald-400';
      case 'read': return 'text-sky-400';
      default: return 'text-[#9D9D9D]';
    }
  };

  const getDueStatus = () => {
    const state = calculateDueState(dueDate, status);

    switch (state.type) {
      case 'done':
        return {
          text: t('completed', lang),
          colorClass: 'text-emerald-400 font-medium',
          icon: <CheckCircle2 size={13} className="text-emerald-400" />,
          isOverdue: false
        };
      case 'read':
        return {
          text: t('read', lang),
          colorClass: 'text-sky-400 font-medium',
          icon: <BookOpen size={13} className="text-sky-400" />,
          isOverdue: false
        };
      case 'noDate':
        return {
          text: t('noDueDate', lang),
          colorClass: 'text-[#858585] font-medium',
          icon: <Calendar size={13} className="text-[#858585]" />,
          isOverdue: false
        };
      case 'overdue':
        return {
          text: state.diffDays === 0
            ? t('overdueHrs', lang, { hrs: state.diffHrs })
            : t('overdueDays', lang, { days: state.diffDays }),
          colorClass: 'text-rose-400 font-semibold',
          icon: <AlertCircle size={13} className="text-rose-400 shrink-0" />,
          isOverdue: true
        };
      case 'dueToday':
        return {
          text: state.diffHrs === 0
            ? t('minsLeftToday', lang, { mins: state.diffMins })
            : t('hrsLeftToday', lang, { hrs: state.diffHrs }),
          colorClass: 'text-amber-400 font-semibold',
          icon: <Clock size={13} className="text-amber-400" />,
          isOverdue: false
        };
      case 'dueTomorrow':
        return {
          text: t('dueTomorrow', lang),
          colorClass: 'text-amber-400 font-medium',
          icon: <Calendar size={13} className="text-amber-400" />,
          isOverdue: false
        };
      case 'dueLater':
        return {
          text: t('daysLeft', lang, { days: state.diffDays }),
          colorClass: 'text-[#3794FF] font-medium',
          icon: <Calendar size={13} className="text-[#3794FF]" />,
          isOverdue: false
        };
      default:
        return { text: '', colorClass: '', icon: null, isOverdue: false };
    }
  };

  const dueStatus = getDueStatus();

  const getCardBorderClass = () => {
    if (dueStatus.isOverdue) {
      return 'border-rose-500/40 hover:border-rose-400/60';
    }
    if (isPinned) {
      return 'border-amber-500/35 hover:border-amber-400/55';
    }
    return 'border-[#3C3C3C] hover:border-[#007ACC]/70';
  };

  const [isListExpanded, setIsListExpanded] = useState(false);

  if (viewMode === 'list' && !isListExpanded) {
    return (
      <div
        className={`group bg-[#252526] border rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between gap-2.5 sm:gap-4 transition-colors ${getCardBorderClass()}`}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-8 h-8 rounded-lg bg-[#1E1E1E] border border-[#3C3C3C] flex items-center justify-center shrink-0 text-[#3794FF]">
            <BookOpen size={15} />
          </div>
          <div className="min-w-0 flex-1">
            <Link
              to={`/assignments/${id}`}
              state={linkState}
              className="text-sm font-semibold text-[#D4D4D4] hover:text-[#3794FF] truncate block transition-colors"
            >
              {title}
            </Link>
            <div className="flex items-center gap-2 text-xs text-[#858585] mt-0.5">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${COURSE_DOT_COLORS[courseColor] || COURSE_DOT_COLORS.zinc}`} />
              <span className="truncate">{course}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <div className="hidden sm:flex items-center gap-1.5">
            {dueStatus.icon}
            <span className={`text-xs ${dueStatus.colorClass}`}>{dueStatus.text}</span>
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
                  ? 'text-amber-400 bg-amber-500/15 border-amber-500/30'
                  : 'text-[#858585] hover:text-[#D4D4D4] bg-[#1E1E1E] border-[#3C3C3C]'
              }`}
            >
              <Pin size={13} className={isPinned ? 'fill-amber-400/30' : ''} />
            </button>
          )}

          <div
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1.5 bg-[#1E1E1E] border border-[#3C3C3C] px-2.5 py-1 rounded-lg shrink-0"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${getStatusDotColor()} shrink-0`} />
            <select
              aria-label={`${title} status`}
              value={status}
              onChange={(e) => onStatusChange(id, e.target.value)}
              className={`text-xs font-medium bg-transparent border-0 p-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007ACC] cursor-pointer select-none ${getStatusTextColor()}`}
            >
              <option value="todo" className="bg-[#252526] text-[#D4D4D4]">{t('todo', lang)}</option>
              <option value="doing" className="bg-[#252526] text-[#D4D4D4]">{t('doing', lang)}</option>
              <option value="done" className="bg-[#252526] text-[#D4D4D4]">{t('done', lang)}</option>
              <option value="read" className="bg-[#252526] text-[#D4D4D4]">{t('read', lang)}</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => setIsListExpanded(true)}
            aria-label={lang === 'en' ? 'Expand details' : 'ดูรายละเอียด'}
            className="p-1.5 rounded-lg text-[#9D9D9D] hover:text-[#FFFFFF] hover:bg-[#2A2D2E] transition-colors cursor-pointer"
          >
            <ChevronDown size={16} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`bg-[#252526] border rounded-2xl p-3.5 sm:p-5 transition-colors flex flex-col justify-between group ${
        viewMode === 'grid' ? 'h-full' : ''
      } ${getCardBorderClass()}`}
    >
      {viewMode === 'list' && (
        <div className="flex justify-between items-center -mt-1 mb-3 border-b border-[#3C3C3C] pb-2.5">
          <span className="text-xs font-medium text-[#9D9D9D]">{course}</span>
          <button
            type="button"
            onClick={() => setIsListExpanded(false)}
            className="p-1 text-[#9D9D9D] hover:text-[#FFFFFF] hover:bg-[#2A2D2E] rounded-lg transition-colors cursor-pointer"
            title={lang === 'en' ? 'Collapse' : 'ย่อ'}
          >
            <ChevronUp size={16} />
          </button>
        </div>
      )}

      <div className="space-y-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`w-2 h-2 rounded-full shrink-0 ${COURSE_DOT_COLORS[courseColor] || COURSE_DOT_COLORS.zinc}`} />
            <span className="text-xs font-medium text-[#9D9D9D] truncate" title={course}>
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
                    ? 'text-amber-400 bg-amber-500/15 border-amber-500/30'
                    : 'text-[#858585] hover:text-[#D4D4D4] bg-[#1E1E1E] border-[#3C3C3C]'
                }`}
              >
                <Pin size={13} className={isPinned ? 'fill-amber-400/30' : ''} />
              </button>
            )}

            <div className="flex items-center gap-1.5 bg-[#1E1E1E] border border-[#3C3C3C] px-2.5 py-1 rounded-lg hover:border-[#454545] transition-colors shrink-0">
              <span className={`w-1.5 h-1.5 rounded-full ${getStatusDotColor()} shrink-0`} />
              <select
                aria-label={`${title} status`}
                value={status}
                onChange={(e) => onStatusChange(id, e.target.value)}
                className={`text-xs font-medium bg-transparent border-0 p-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007ACC] cursor-pointer pr-1 select-none ${getStatusTextColor()}`}
              >
                <option value="todo" className="bg-[#252526] text-[#D4D4D4]">{t('todo', lang)}</option>
                <option value="doing" className="bg-[#252526] text-[#D4D4D4]">{t('doing', lang)}</option>
                <option value="done" className="bg-[#252526] text-[#D4D4D4]">{t('done', lang)}</option>
                <option value="read" className="bg-[#252526] text-[#D4D4D4]">{t('read', lang)}</option>
              </select>
            </div>
          </div>
        </div>

        <Link
          to={`/assignments/${id}`}
          state={linkState}
          className="text-[#D4D4D4] hover:text-[#3794FF] transition-colors font-semibold text-sm leading-snug block"
        >
          {title}
        </Link>
      </div>

      <div className="border-t border-[#3C3C3C] pt-3 sm:pt-3.5 flex flex-wrap items-center justify-between gap-2 mt-3.5 sm:mt-4">
        <div className="flex items-center gap-1.5 text-xs">
          {dueStatus.icon}
          <span className={`text-xs ${dueStatus.colorClass}`}>
            {dueStatus.text}
          </span>
        </div>

        <div className="flex items-center gap-3 text-[#858585] shrink-0">
          {attachments && attachments.length > 0 && (
            <span className="flex items-center gap-1 text-xs" title={`${attachments.length} attachments`}>
              <Paperclip size={12} className="text-[#858585]" />
              {attachments.length}
            </span>
          )}

          {safeGoogleLink && (
            <a
              href={safeGoogleLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[#3794FF] hover:underline font-medium flex items-center gap-0.5 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              Classroom
              <ExternalLink size={10} />
            </a>
          )}

          <span className="text-xs font-medium text-[#9D9D9D]">
            {pointsLabel}
          </span>
        </div>
      </div>
    </div>
  );
});

export default AssignmentCard;
