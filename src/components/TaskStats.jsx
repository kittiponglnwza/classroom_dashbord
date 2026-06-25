import { CheckCircle2, Clock, ListTodo, ClipboardList, Timer } from 'lucide-react';
import { t } from '../utils/i18n';
import { parseExamDate } from '../utils/examDate';

export default function TaskStats({ assignments = [], lang = 'en', exams = [] }) {
  const total = assignments.length;
  const todo = assignments.filter(a => a.status === 'todo').length;
  const done = assignments.filter(a => a.status === 'done').length;

  const percent = total > 0 ? Math.round((done / total) * 100) : 0;

  // Find next upcoming exam countdown
  let examCountdownStr = lang === 'en' ? 'No Exam' : 'ไม่มีสอบ';
  let closestExamName = '';

  if (exams && exams.length > 0) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcomingExams = exams.filter(exam => {
      const parsedDate = parseExamDate(exam.rawIsoDate || exam.date);
      return parsedDate ? parsedDate >= today : true;
    });

    upcomingExams.sort((a, b) => {
      const dateA = parseExamDate(a.rawIsoDate || a.date) || new Date(8640000000000000);
      const dateB = parseExamDate(b.rawIsoDate || b.date) || new Date(8640000000000000);
      return dateA - dateB;
    });

    if (upcomingExams.length > 0) {
      const closest = upcomingExams[0];
      closestExamName = closest.courseName;
      const targetDate = parseExamDate(closest.rawIsoDate || closest.date);
      
      if (targetDate) {
        const diffTime = targetDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) {
          examCountdownStr = lang === 'en' ? 'Today' : 'วันนี้';
        } else if (diffDays === 1) {
          examCountdownStr = lang === 'en' ? 'Tomorrow' : 'พรุ่งนี้';
        } else {
          examCountdownStr = lang === 'en' ? `${diffDays} days` : `${diffDays} วัน`;
        }
      }
    }
  }

  const stats = [
    {
      label: t('allAssignments', lang),
      value: total,
      icon: ClipboardList,
      color: 'text-brand-400 bg-brand-500/10 border-brand-500/10'
    },
    {
      label: t('todo', lang),
      value: todo,
      icon: ListTodo,
      color: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/10'
    },
    {
      label: lang === 'en' ? 'Exam Countdown' : 'นับถอยหลังสอบ',
      value: examCountdownStr,
      subValue: closestExamName ? (lang === 'en' ? `for ${closestExamName}` : `วิชา ${closestExamName}`) : '',
      icon: Timer,
      color: 'text-amber-400 bg-amber-500/10 border-amber-500/10'
    },
    {
      label: t('completed', lang),
      value: done,
      icon: CheckCircle2,
      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/10'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Stats Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div 
            key={stat.label}
            className="bg-dark-card border border-dark-border rounded-xl p-5 hover:border-dark-border/80 transition-all duration-300 relative overflow-hidden"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-dark-muted font-medium mb-1">{stat.label}</p>
                <h4 className="text-xl font-bold font-heading text-white truncate max-w-[125px]" title={stat.value}>{stat.value}</h4>
                {stat.subValue && (
                  <p className="text-[9px] text-dark-muted truncate mt-0.5 max-w-[125px]" title={stat.subValue}>
                    {stat.subValue}
                  </p>
                )}
              </div>
              <div className={`p-2.5 rounded-lg border ${stat.color} shrink-0`}>
                <stat.icon size={20} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Progress Bar Container */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-5">
        <div className="flex items-center justify-between text-sm mb-2.5">
          <span className="font-semibold text-white">{t('completionProgress', lang)}</span>
          <span className="font-bold text-brand-400">{percent}% ({done}/{total} {t('doneStatus', lang)})</span>
        </div>
        <div className="w-full bg-dark-sidebar border border-dark-border rounded-full h-3 overflow-hidden">
          <div 
            className="bg-gradient-to-r from-brand-600 to-brand-400 h-full rounded-full transition-all duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    </div>
  );
}
