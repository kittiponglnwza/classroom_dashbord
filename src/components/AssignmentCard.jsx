import { Link } from 'react-router-dom';
import { Calendar, Paperclip, AlertCircle } from 'lucide-react';
import { t } from '../utils/i18n';

export default function AssignmentCard({ assignment, onStatusChange, lang = 'en' }) {
  const { id, title, course, dueDate, status, points, attachments, courseColor, googleLink } = assignment;

  // Calculate detailed due countdown
  const getDueStatus = () => {
    if (status === 'done') {
      return { text: t('completed', lang), class: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', isOverdue: false };
    }

    if (!dueDate) {
      return { text: t('noDueDate', lang), class: 'bg-zinc-500/10 text-dark-muted border-dark-border', isOverdue: false };
    }

    const now = new Date();
    const due = new Date(dueDate);
    const diffMs = due - now;

    // Overdue
    if (diffMs < 0) {
      const diffDays = Math.abs(Math.floor(diffMs / (1000 * 60 * 60 * 24)));
      if (diffDays === 0) {
        const diffHrs = Math.abs(Math.floor(diffMs / (1000 * 60 * 60)));
        return { 
          text: t('overdueHrs', lang, { hrs: diffHrs }), 
          class: 'bg-rose-500/10 text-rose-400 border-rose-500/20 font-bold animate-pulse', 
          isOverdue: true 
        };
      }
      return { 
        text: t('overdueDays', lang, { days: diffDays }), 
        class: 'bg-rose-500/10 text-rose-400 border-rose-500/20 font-bold animate-pulse', 
        isOverdue: true 
      };
    }

    // Less than 24 hours left (due today/hours countdown)
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHrs < 24) {
      if (diffHrs === 0) {
        const diffMins = Math.floor(diffMs / (1000 * 60));
        return { 
          text: t('minsLeftToday', lang, { mins: diffMins }), 
          class: 'bg-amber-500/20 text-amber-400 border-amber-500/30 font-bold', 
          isOverdue: false 
        };
      }
      return { 
        text: t('hrsLeftToday', lang, { hrs: diffHrs }), 
        class: 'bg-amber-500/20 text-amber-400 border-amber-500/30 font-bold', 
        isOverdue: false 
      };
    }

    // Due tomorrow
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 1) {
      return { 
        text: t('dueTomorrow', lang), 
        class: 'bg-amber-500/10 text-amber-400 border-amber-500/20 font-semibold', 
        isOverdue: false 
      };
    }

    // Normal countdown in days
    return { 
      text: t('daysLeft', lang, { days: diffDays }), 
      class: 'bg-zinc-500/10 text-dark-muted border-dark-border', 
      isOverdue: false 
    };
  };

  const dueStatus = getDueStatus();

  // Helper to map course color
  const getCourseBadgeColor = (color) => {
    switch (color) {
      case 'emerald': return 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/25';
      case 'blue': return 'text-blue-400 bg-blue-500/10 border border-blue-500/25';
      case 'amber': return 'text-amber-400 bg-amber-500/10 border border-amber-500/25';
      case 'rose': return 'text-rose-400 bg-rose-500/10 border border-rose-500/25';
      case 'purple': return 'text-purple-400 bg-purple-500/10 border border-purple-500/25';
      default: return 'text-zinc-400 bg-zinc-500/10 border border-zinc-500/25';
    }
  };

  // Border and background state mapping
  const getCardStyles = () => {
    if (dueStatus.isOverdue) {
      return 'border-rose-500/30 bg-rose-950/5 hover:border-rose-500/60 shadow-lg shadow-rose-950/10';
    }
    
    switch (courseColor) {
      case 'emerald': return 'hover:border-emerald-500/40';
      case 'blue': return 'hover:border-blue-500/40';
      case 'amber': return 'hover:border-amber-500/40';
      case 'rose': return 'hover:border-rose-500/40';
      case 'purple': return 'hover:border-purple-500/40';
      default: return 'hover:border-brand-500/40';
    }
  };

  return (
    <div className={`bg-dark-card border border-dark-border rounded-xl p-5 hover:shadow-xl transition-all duration-300 flex flex-col justify-between group ${getCardStyles()}`}>
      <div>
        {/* Header: Course Name & Status Dropdown */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${getCourseBadgeColor(courseColor)}`}>
            {course}
          </span>
          <div className="relative">
            <select
              value={status}
              onChange={(e) => onStatusChange(id, e.target.value)}
              className={`text-xs px-2.5 py-1 rounded-lg bg-dark-sidebar border border-dark-border text-white cursor-pointer focus:outline-none focus:border-brand-500 transition-colors font-medium ${
                status === 'todo' ? 'text-zinc-400' :
                status === 'doing' ? 'text-amber-400' : 'text-emerald-400'
              }`}
            >
              <option value="todo">{t('todo', lang)}</option>
              <option value="doing">{t('doing', lang)}</option>
              <option value="done">{t('done', lang)}</option>
            </select>
          </div>
        </div>

        {/* Title */}
        <Link 
          to={`/assignments/${id}`}
          className="text-white hover:text-brand-400 transition-colors font-semibold text-[15px] leading-snug block mb-4 group-hover:translate-x-0.5 transform duration-200"
        >
          {title}
        </Link>
      </div>

      {/* Footer Info */}
      <div className="border-t border-dark-border/60 pt-4 flex items-center justify-between mt-auto">
        {/* Due Date Indicator */}
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2.5 py-1 rounded-lg border font-medium flex items-center gap-1.5 ${dueStatus.class}`}>
            {dueStatus.isOverdue ? <AlertCircle size={12} /> : <Calendar size={12} />}
            {dueStatus.text}
          </span>
        </div>

        {/* Points & Source Link */}
        <div className="flex items-center gap-3 text-dark-muted">
          {attachments && attachments.length > 0 && (
            <span className="flex items-center gap-1 text-[11px]" title={`${attachments.length} attachments`}>
              <Paperclip size={11} />
              {attachments.length}
            </span>
          )}
          {googleLink && (
            <a 
              href={googleLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-brand-400 hover:text-brand-300 underline font-medium"
              onClick={(e) => e.stopPropagation()}
            >
              Classroom
            </a>
          )}
          <span className="text-[11px] font-semibold bg-dark-sidebar border border-dark-border px-2 py-0.5 rounded-md text-zinc-300">
            {points} pts
          </span>
        </div>
      </div>
    </div>
  );
}
