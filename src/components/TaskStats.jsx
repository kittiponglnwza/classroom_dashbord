import React from 'react';
import { CheckCircle2, ListTodo, ClipboardList, Timer } from 'lucide-react';
import { t } from '../utils/i18n';
import { parseExamDate } from '../utils/examDate';

const isExamStillUpcoming = (exam, now) => {
  const parsedDate = parseExamDate(exam.rawIsoDate || exam.date);
  if (!parsedDate) return false;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (parsedDate > today) return true;
  if (parsedDate < today) return false;
  // On exam day: check whether exam end time has already elapsed
  if (exam.time && typeof exam.time === 'string') {
    const parts = exam.time.split(/[-–]/).map(s => s.trim());
    const endMatch = parts[1]?.match(/^(\d{1,2})[:.](\d{2})$/);
    if (endMatch) {
      const endDt = new Date(
        now.getFullYear(), now.getMonth(), now.getDate(),
        parseInt(endMatch[1], 10), parseInt(endMatch[2], 10), 0, 0
      );
      return endDt >= now;
    }
  }
  return true;
};

const TaskStats = React.memo(function TaskStats({ assignments = [], lang = 'en', exams = [] }) {
  const actionable = assignments.filter(a => a.status !== 'read');
  const total = actionable.length;
  const todo = actionable.filter(a => a.status === 'todo').length;
  const done = actionable.filter(a => a.status === 'done').length;

  const percent = total > 0 ? Math.round((done / total) * 100) : 0;

  let examCountdownStr = lang === 'en' ? 'No Exam' : 'ไม่มีสอบ';
  let closestExamName = '';

  if (exams && exams.length > 0) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const upcomingExams = exams.filter(exam => isExamStillUpcoming(exam, now));

    upcomingExams.sort((a, b) => {
      const dateA = parseExamDate(a.rawIsoDate || a.date) || new Date(8640000000000000);
      const dateB = parseExamDate(b.rawIsoDate || b.date) || new Date(8640000000000000);
      return dateA - dateB;
    });

    if (upcomingExams.length > 0) {
      const closest = upcomingExams[0];
      const targetDate = parseExamDate(closest.rawIsoDate || closest.date);

      if (targetDate) {
        closestExamName = closest.courseName;
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
      accent: false,
    },
    {
      label: t('todo', lang),
      value: todo,
      icon: ListTodo,
      accent: false,
    },
    {
      label: lang === 'en' ? 'Exam Countdown' : 'นับถอยหลังสอบ',
      value: examCountdownStr,
      subValue: closestExamName ? (lang === 'en' ? `for ${closestExamName}` : `วิชา ${closestExamName}`) : '',
      icon: Timer,
      accent: Boolean(closestExamName),
    },
    {
      label: t('completed', lang),
      value: done,
      icon: CheckCircle2,
      accent: false,
    }
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 sm:p-5 flex flex-col justify-between gap-3"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-[var(--text-secondary)] font-normal truncate">{stat.label}</p>
                <Icon
                  size={16}
                  strokeWidth={1.5}
                  className={stat.accent ? 'text-[var(--primary-bright)] shrink-0' : 'text-[var(--text-muted)] shrink-0'}
                />
              </div>
              <div className="min-w-0">
                <h4
                  className="text-2xl sm:text-[28px] font-medium text-[var(--text-heading)] leading-none tabular-nums truncate"
                  title={String(stat.value)}
                >
                  {stat.value}
                </h4>
                {stat.subValue && (
                  <p className="text-[11px] text-[var(--text-muted)] truncate mt-2" title={stat.subValue}>
                    {stat.subValue}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 sm:p-5">
        <div className="flex items-center justify-between text-xs mb-2.5">
          <span className="font-medium text-[var(--text-primary)]">{t('completionProgress', lang)}</span>
          <span className="font-mono font-medium text-[var(--primary-bright)] tabular-nums">
            {percent}% ({done}/{total} {t('doneStatus', lang)})
          </span>
        </div>
        <div className="w-full bg-[var(--app-bg)] border border-[var(--border)] rounded-full h-2 overflow-hidden">
          <div
            className="bg-[var(--primary)] h-full rounded-full transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    </div>
  );
});

export default TaskStats;
