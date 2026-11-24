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
      color: 'text-[#3794FF] bg-[#007ACC]/20 border-[#007ACC]/40'
    },
    {
      label: t('todo', lang),
      value: todo,
      icon: ListTodo,
      color: 'text-[#9D9D9D] bg-[#1E1E1E] border-[#3C3C3C]'
    },
    {
      label: lang === 'en' ? 'Exam Countdown' : 'นับถอยหลังสอบ',
      value: examCountdownStr,
      subValue: closestExamName ? (lang === 'en' ? `for ${closestExamName}` : `วิชา ${closestExamName}`) : '',
      icon: Timer,
      color: 'text-amber-400 bg-amber-500/15 border-amber-500/30'
    },
    {
      label: t('completed', lang),
      value: done,
      icon: CheckCircle2,
      color: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30'
    }
  ];

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-[#252526] border border-[#3C3C3C] rounded-2xl p-3.5 sm:p-5"
          >
            <div className="flex items-center justify-between gap-2 sm:gap-3">
              <div className="min-w-0">
                <p className="text-[11px] sm:text-xs text-[#9D9D9D] font-medium mb-1 truncate">{stat.label}</p>
                <h4 className="text-lg sm:text-xl font-semibold text-[#FFFFFF] truncate" title={String(stat.value)}>
                  {stat.value}
                </h4>
                {stat.subValue && (
                  <p className="text-[11px] text-[#858585] truncate mt-0.5" title={stat.subValue}>
                    {stat.subValue}
                  </p>
                )}
              </div>
              <div className={`p-2 sm:p-2.5 rounded-xl border ${stat.color} shrink-0`}>
                <stat.icon size={16} className="sm:w-[18px] sm:h-[18px]" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-[#252526] border border-[#3C3C3C] rounded-2xl p-3.5 sm:p-5">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="font-medium text-[#D4D4D4]">{t('completionProgress', lang)}</span>
          <span className="font-semibold text-[#3794FF]">{percent}% ({done}/{total} {t('doneStatus', lang)})</span>
        </div>
        <div className="w-full bg-[#1E1E1E] border border-[#3C3C3C] rounded-full h-2.5 overflow-hidden">
          <div
            className="bg-[#007ACC] h-full rounded-full transition-all duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    </div>
  );
});

export default TaskStats;
