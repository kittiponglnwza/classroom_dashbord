import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Calendar, Paperclip, AlertCircle, CheckCircle2, Clock, ExternalLink, BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import { t } from '../utils/i18n';
import { calculateDueState } from '../utils/dateUtils';

const COURSE_DOT_COLORS = {
  emerald: 'bg-emerald-600',
  blue: 'bg-[#0071E3]',
  amber: 'bg-amber-500',
  rose: 'bg-rose-600',
  purple: 'bg-purple-600',
  zinc: 'bg-zinc-400'
};

const AssignmentCard = React.memo(function AssignmentCard({ assignment, onStatusChange, lang = 'en', viewMode = 'grid' }) {
  const { id, title, course, dueDate, status, points, attachments, courseColor, googleLink } = assignment;
  const location = useLocation();
  const linkState = {
    from: `${location.pathname}${location.search}`,
    fromCourse: course
  };

  const getStatusDotColor = () => {
    switch (status) {
      case 'todo': return 'bg-zinc-400';
      case 'doing': return 'bg-amber-500';
      case 'done': return 'bg-emerald-600';
      default: return 'bg-zinc-400';
    }
  };

  const getStatusTextColor = () => {
    switch (status) {
      case 'todo': return 'text-[#6E6E73]';
      case 'doing': return 'text-amber-700';
      case 'done': return 'text-emerald-700';
      default: return 'text-[#6E6E73]';
    }
  };

  const getDueStatus = () => {
    const state = calculateDueState(dueDate, status);

    switch (state.type) {
      case 'done':
        return {
          text: t('completed', lang),
          colorClass: 'text-emerald-700 font-medium',
          icon: <CheckCircle2 size={13} className="text-emerald-600" />,
          isOverdue: false
        };
      case 'noDate':
        return {
          text: t('noDueDate', lang),
          colorClass: 'text-[#6E6E73] font-medium',
          icon: <Calendar size={13} className="text-[#6E6E73]" />,
          isOverdue: false
        };
      case 'overdue':
        return {
          text: state.diffDays === 0
            ? t('overdueHrs', lang, { hrs: state.diffHrs })
            : t('overdueDays', lang, { days: state.diffDays }),
          colorClass: 'text-rose-600 font-semibold',
          icon: <AlertCircle size={13} className="text-rose-600 shrink-0" />,
          isOverdue: true
        };
      case 'dueToday':
        return {
          text: state.diffHrs === 0
            ? t('minsLeftToday', lang, { mins: state.diffMins })
            : t('hrsLeftToday', lang, { hrs: state.diffHrs }),
          colorClass: 'text-amber-700 font-semibold',
          icon: <Clock size={13} className="text-amber-600" />,
          isOverdue: false
        };
      case 'dueTomorrow':
        return {
          text: t('dueTomorrow', lang),
          colorClass: 'text-amber-700 font-medium',
          icon: <Calendar size={13} className="text-amber-600" />,
          isOverdue: false
        };
      case 'dueLater':
        return {
          text: t('daysLeft', lang, { days: state.diffDays }),
          colorClass: 'text-[#0071E3] font-medium',
          icon: <Calendar size={13} className="text-[#0071E3]" />,
          isOverdue: false
        };
      default:
        return { text: '', colorClass: '', icon: null, isOverdue: false };
    }
  };

  const dueStatus = getDueStatus();

  const getCardBorderClass = () => {
    if (dueStatus.isOverdue) {
      return 'border-rose-200 hover:border-rose-300';
    }
    return 'border-[#D2D2D7]/80 hover:border-[#0071E3]/40';
  };

  const [isListExpanded, setIsListExpanded] = useState(false);

  if (viewMode === 'list' && !isListExpanded) {
    return (
      <div
        className={`group bg-white border rounded-xl px-4 py-3 flex items-center justify-between gap-4 transition-colors shadow-2xs ${getCardBorderClass()}`}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-8 h-8 rounded-lg bg-[#F5F5F7] border border-[#D2D2D7]/60 flex items-center justify-center shrink-0 text-[#0071E3]">
            <BookOpen size={15} />
          </div>
          <div className="min-w-0 flex-1">
            <Link
              to={`/assignments/${id}`}
              state={linkState}
              className="text-sm font-semibold text-[#1D1D1F] hover:text-[#0071E3] truncate block transition-colors"
            >
              {title}
            </Link>
            <div className="flex items-center gap-2 text-xs text-[#6E6E73] mt-0.5">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${COURSE_DOT_COLORS[courseColor] || COURSE_DOT_COLORS.zinc}`} />
              <span className="truncate">{course}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden sm:flex items-center gap-1.5">
            {dueStatus.icon}
            <span className={`text-xs ${dueStatus.colorClass}`}>{dueStatus.text}</span>
          </div>

          <div
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1.5 bg-[#F5F5F7] border border-[#D2D2D7] px-2.5 py-1 rounded-lg shrink-0"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${getStatusDotColor()} shrink-0`} />
            <select
              value={status}
              onChange={(e) => onStatusChange(id, e.target.value)}
              className={`text-xs font-medium bg-transparent border-0 p-0 focus:outline-none cursor-pointer select-none ${getStatusTextColor()}`}
            >
              <option value="todo">{t('todo', lang)}</option>
              <option value="doing">{t('doing', lang)}</option>
              <option value="done">{t('done', lang)}</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => setIsListExpanded(true)}
            aria-label={lang === 'en' ? 'Expand details' : 'ดูรายละเอียด'}
            className="p-1.5 rounded-lg text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-[#F5F5F7] transition-colors cursor-pointer"
          >
            <ChevronDown size={16} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`bg-white border rounded-2xl p-5 shadow-2xs transition-colors flex flex-col justify-between group ${
        viewMode === 'grid' ? 'h-full' : ''
      } ${getCardBorderClass()}`}
    >
      {viewMode === 'list' && (
        <div className="flex justify-between items-center -mt-1 mb-3 border-b border-[#D2D2D7]/60 pb-2.5">
          <span className="text-xs font-medium text-[#6E6E73]">{course}</span>
          <button
            type="button"
            onClick={() => setIsListExpanded(false)}
            className="p-1 text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-[#F5F5F7] rounded-lg transition-colors cursor-pointer"
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
            <span className="text-xs font-medium text-[#6E6E73] truncate" title={course}>
              {course}
            </span>
          </div>

          <div className="flex items-center gap-1.5 bg-[#F5F5F7] border border-[#D2D2D7]/80 px-2.5 py-1 rounded-lg hover:border-[#D2D2D7] transition-colors shrink-0">
            <span className={`w-1.5 h-1.5 rounded-full ${getStatusDotColor()} shrink-0`} />
            <select
              value={status}
              onChange={(e) => onStatusChange(id, e.target.value)}
              className={`text-xs font-medium bg-transparent border-0 p-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3] cursor-pointer pr-1 select-none ${getStatusTextColor()}`}
            >
              <option value="todo">{t('todo', lang)}</option>
              <option value="doing">{t('doing', lang)}</option>
              <option value="done">{t('done', lang)}</option>
            </select>
          </div>
        </div>

        <Link
          to={`/assignments/${id}`}
          state={linkState}
          className="text-[#1D1D1F] hover:text-[#0071E3] transition-colors font-semibold text-sm leading-snug block"
        >
          {title}
        </Link>
      </div>

      <div className="border-t border-[#D2D2D7]/60 pt-3.5 flex items-center justify-between mt-4">
        <div className="flex items-center gap-1.5 text-xs">
          {dueStatus.icon}
          <span className={`text-xs ${dueStatus.colorClass}`}>
            {dueStatus.text}
          </span>
        </div>

        <div className="flex items-center gap-3 text-[#6E6E73] shrink-0">
          {attachments && attachments.length > 0 && (
            <span className="flex items-center gap-1 text-xs" title={`${attachments.length} attachments`}>
              <Paperclip size={12} className="text-[#6E6E73]" />
              {attachments.length}
            </span>
          )}

          {googleLink && (
            <a
              href={googleLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[#0071E3] hover:underline font-medium flex items-center gap-0.5 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              Classroom
              <ExternalLink size={10} />
            </a>
          )}

          <span className="text-xs font-medium text-[#6E6E73]">
            {points} {lang === 'en' ? 'pts' : 'คะแนน'}
          </span>
        </div>
      </div>
    </div>
  );
});

export default AssignmentCard;
