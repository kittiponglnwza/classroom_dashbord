import { Link } from 'react-router-dom';
import { useState } from 'react';
import { Calendar, Paperclip, AlertCircle, CheckCircle2, Clock, ExternalLink, BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import { t } from '../utils/i18n';

const COURSE_DOT_COLORS = {
  emerald: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]',
  blue: 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]',
  amber: 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]',
  rose: 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]',
  purple: 'bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]',
  zinc: 'bg-zinc-500'
};

export default function AssignmentCard({ assignment, onStatusChange, lang = 'en', viewMode = 'grid' }) {
  const { id, title, course, dueDate, status, points, attachments, courseColor, googleLink } = assignment;

  const getStatusDotColor = () => {
    switch (status) {
      case 'todo': return 'bg-zinc-400';
      case 'doing': return 'bg-amber-400';
      case 'done': return 'bg-emerald-400';
      default: return 'bg-zinc-400';
    }
  };

  const getStatusTextColor = () => {
    switch (status) {
      case 'todo': return 'text-zinc-400';
      case 'doing': return 'text-amber-400';
      case 'done': return 'text-emerald-400';
      default: return 'text-zinc-400';
    }
  };

  // Calculate detailed due status and display elements
  const getDueStatus = () => {
    if (status === 'done') {
      return { 
        text: t('completed', lang), 
        colorClass: 'text-emerald-400 font-semibold', 
        icon: <CheckCircle2 size={13} className="text-emerald-400" />,
        isOverdue: false 
      };
    }

    if (!dueDate) {
      return { 
        text: t('noDueDate', lang), 
        colorClass: 'text-dark-muted font-medium', 
        icon: <Calendar size={13} className="text-dark-muted" />,
        isOverdue: false 
      };
    }

    const now = new Date();
    const due = new Date(dueDate);
    const diffMs = due - now;

    // Overdue
    if (diffMs < 0) {
      const diffDays = Math.abs(Math.floor(diffMs / (1000 * 60 * 60 * 24)));
      const text = diffDays === 0 
        ? t('overdueHrs', lang, { hrs: Math.abs(Math.floor(diffMs / (1000 * 60 * 60))) })
        : t('overdueDays', lang, { days: diffDays });
      return { 
        text, 
        colorClass: 'text-rose-400 font-extrabold animate-pulse', 
        icon: <AlertCircle size={13} className="text-rose-400 shrink-0" />, 
        isOverdue: true 
      };
    }

    // Less than 24 hours left (due today)
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHrs < 24) {
      const text = diffHrs === 0 
        ? t('minsLeftToday', lang, { mins: Math.floor(diffMs / (1000 * 60)) })
        : t('hrsLeftToday', lang, { hrs: diffHrs });
      return { 
        text, 
        colorClass: 'text-amber-400 font-bold', 
        icon: <Clock size={13} className="text-amber-400" />, 
        isOverdue: false 
      };
    }

    // Due tomorrow
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 1) {
      return { 
        text: t('dueTomorrow', lang), 
        colorClass: 'text-amber-400/90 font-semibold', 
        icon: <Calendar size={13} className="text-amber-400/90" />, 
        isOverdue: false 
      };
    }

    // Normal countdown in days
    return { 
      text: t('daysLeft', lang, { days: diffDays }), 
      colorClass: 'text-dark-muted font-medium', 
      icon: <Calendar size={13} className="text-dark-muted" />, 
      isOverdue: false 
    };
  };

  const dueStatus = getDueStatus();

  // Border and background shadow effects
  const getCardBorderClass = () => {
    if (dueStatus.isOverdue) {
      return 'border-rose-500/20 hover:border-rose-500/40 shadow-[0_4px_20px_rgba(239,68,68,0.04)]';
    }
    
    switch (courseColor) {
      case 'emerald': return 'hover:border-emerald-500/35 hover:shadow-[0_4px_20px_rgba(16,185,129,0.04)]';
      case 'blue': return 'hover:border-blue-500/35 hover:shadow-[0_4px_20px_rgba(59,130,246,0.04)]';
      case 'amber': return 'hover:border-amber-500/35 hover:shadow-[0_4px_20px_rgba(245,158,11,0.04)]';
      case 'rose': return 'hover:border-rose-500/35 hover:shadow-[0_4px_20px_rgba(244,63,94,0.04)]';
      case 'purple': return 'hover:border-purple-500/35 hover:shadow-[0_4px_20px_rgba(168,85,247,0.04)]';
      default: return 'hover:border-brand-500/35 hover:shadow-[0_4px_20px_rgba(99,102,241,0.04)]';
    }
  };

  const [isListExpanded, setIsListExpanded] = useState(false);

  if (viewMode === 'list' && !isListExpanded) {
    return (
      <div 
        onClick={() => setIsListExpanded(true)}
        className={`group bg-dark-card/20 hover:bg-dark-card/40 border border-dark-border/30 rounded-xl p-3.5 flex items-center justify-between cursor-pointer transition-all ${getCardBorderClass()}`}
      >
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-9 h-9 rounded-full bg-dark-sidebar border border-dark-border/60 flex items-center justify-center shrink-0 text-brand-400 group-hover:bg-brand-500/10 group-hover:border-brand-500/20 transition-all">
            <BookOpen size={16} />
          </div>
          <span className="text-[14.5px] font-semibold text-white/90 truncate group-hover:text-brand-400 transition-colors">{title}</span>
        </div>
        <div className="flex items-center gap-4 shrink-0">
           <div className="flex items-center gap-1.5 hidden sm:flex">
             {dueStatus.icon}
             <span className={`text-xs ${dueStatus.colorClass}`}>{dueStatus.text}</span>
           </div>
           <div className="p-1 rounded-md text-zinc-500 group-hover:text-white transition-colors">
             <ChevronDown size={16} />
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-dark-card/40 backdrop-blur-sm border border-dark-border/40 rounded-xl p-5 hover:shadow-[0_8px_30px_rgb(0,0,0,0.3)] transition-all duration-300 flex flex-col justify-between group ${viewMode === 'grid' ? 'h-full' : ''} ${getCardBorderClass()}`}>
      {viewMode === 'list' && (
        <div className="flex justify-between items-center -mt-1 mb-3 border-b border-white/5 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-dark-sidebar flex items-center justify-center shrink-0 text-brand-400">
              <BookOpen size={14} />
            </div>
            <span className="text-sm font-bold text-white">{title}</span>
          </div>
          <button 
            onClick={() => setIsListExpanded(false)} 
            className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
            title={lang === 'en' ? 'Collapse' : 'ย่อ'}
          >
            <ChevronUp size={16} />
          </button>
        </div>
      )}
      <div className="space-y-4">
        {/* Header: Course Name & Status Dropdown */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`w-2 h-2 rounded-full shrink-0 ${COURSE_DOT_COLORS[courseColor] || COURSE_DOT_COLORS.zinc}`} />
            <span className="text-[11px] font-bold text-zinc-300 truncate" title={course}>
              {course}
            </span>
          </div>

          <div className="flex items-center gap-1 bg-dark-sidebar/50 border border-dark-border/30 pl-2.5 pr-1 py-0.5 rounded-lg hover:border-dark-border/60 transition-colors shrink-0">
            <span className={`w-1.5 h-1.5 rounded-full ${getStatusDotColor()} shrink-0`} />
            <select
              value={status}
              onChange={(e) => onStatusChange(id, e.target.value)}
              className={`text-[10px] font-extrabold bg-transparent border-0 p-0 focus:outline-none focus:ring-0 cursor-pointer pr-4 select-none ${getStatusTextColor()}`}
              style={{
                backgroundImage: 'none',
                paddingRight: '2px'
              }}
            >
              <option value="todo" className="bg-dark-card text-zinc-400">{t('todo', lang)}</option>
              <option value="doing" className="bg-dark-card text-amber-400">{t('doing', lang)}</option>
              <option value="done" className="bg-dark-card text-emerald-400">{t('done', lang)}</option>
            </select>
          </div>
        </div>

        {/* Title */}
        <Link 
          to={`/assignments/${id}`}
          className="text-white/90 hover:text-brand-400 transition-colors font-semibold text-[14.5px] leading-snug block group-hover:translate-x-0.5 transform duration-200"
        >
          {title}
        </Link>
      </div>

      {/* Footer Info */}
      <div className="border-t border-dark-border/20 pt-4 flex items-center justify-between mt-5">
        {/* Due Date Indicator (Borderless) */}
        <div className="flex items-center gap-1.5 text-xs">
          {dueStatus.icon}
          <span className={`text-[11px] ${dueStatus.colorClass}`}>
            {dueStatus.text}
          </span>
        </div>

        {/* Points & Source Link */}
        <div className="flex items-center gap-3 text-dark-muted shrink-0">
          {attachments && attachments.length > 0 && (
            <span className="flex items-center gap-1 text-[11.5px]" title={`${attachments.length} attachments`}>
              <Paperclip size={11} className="text-dark-muted/80" />
              {attachments.length}
            </span>
          )}
          
          {googleLink && (
            <a 
              href={googleLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10.5px] text-brand-400 hover:text-brand-300 font-bold flex items-center gap-0.5 hover:underline transition-all"
              onClick={(e) => e.stopPropagation()}
            >
              Classroom
              <ExternalLink size={8} />
            </a>
          )}
          
          <span className="text-[11px] font-bold text-zinc-400">
            {points} {lang === 'en' ? 'pts' : 'คะแนน'}
          </span>
        </div>
      </div>
    </div>
  );
}
