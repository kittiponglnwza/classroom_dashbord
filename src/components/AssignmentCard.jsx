import { Link } from 'react-router-dom';
import { Calendar, Paperclip, CheckCircle2, Circle, Clock } from 'lucide-react';

export default function AssignmentCard({ assignment, onStatusChange }) {
  const { id, title, course, dueDate, status, points, attachments, courseColor } = assignment;

  // Calculate days remaining
  const getDueStatus = () => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const due = new Date(dueDate);
    due.setHours(0,0,0,0);
    const diffTime = due - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (status === 'done') {
      return { text: 'Completed', class: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
    }

    if (diffDays < 0) {
      return { text: `Overdue by ${Math.abs(diffDays)}d`, class: 'bg-rose-500/10 text-rose-400 border-rose-500/20 animate-pulse' };
    } else if (diffDays === 0) {
      return { text: 'Due today', class: 'bg-amber-500/10 text-amber-400 border-amber-500/20 font-bold' };
    } else if (diffDays === 1) {
      return { text: 'Due tomorrow', class: 'bg-amber-500/10 text-amber-400 border-amber-500/20' };
    } else {
      return { text: `Due in ${diffDays} days`, class: 'bg-zinc-500/10 text-dark-muted border-dark-border' };
    }
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

  // Border hover mapping
  const getBorderColorHover = (color) => {
    switch (color) {
      case 'emerald': return 'hover:border-emerald-500/40';
      case 'blue': return 'hover:border-blue-500/40';
      case 'amber': return 'hover:border-amber-500/40';
      case 'rose': return 'hover:border-rose-500/40';
      case 'purple': return 'hover:border-purple-500/40';
      default: return 'hover:border-brand-500/40';
    }
  };

  return (
    <div className={`bg-dark-card border border-dark-border rounded-xl p-5 hover:shadow-xl transition-all duration-300 flex flex-col justify-between group ${getBorderColorHover(courseColor)}`}>
      <div>
        {/* Header: Course Name & Status Tag */}
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
              <option value="todo">ยังไม่เริ่ม</option>
              <option value="doing">กำลังทำ</option>
              <option value="done">เสร็จแล้ว</option>
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
            <Calendar size={12} />
            {dueStatus.text}
          </span>
        </div>

        {/* Points & Attachments Info */}
        <div className="flex items-center gap-3 text-dark-muted">
          {attachments && attachments.length > 0 && (
            <span className="flex items-center gap-1 text-[11px]" title={`${attachments.length} attachments`}>
              <Paperclip size={11} />
              {attachments.length}
            </span>
          )}
          <span className="text-[11px] font-semibold bg-dark-sidebar border border-dark-border px-2 py-0.5 rounded-md text-zinc-300">
            {points} pts
          </span>
        </div>
      </div>
    </div>
  );
}
