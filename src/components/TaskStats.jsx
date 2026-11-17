import React from 'react';
import { CheckCircle2, ListTodo, ClipboardList, Timer } from 'lucide-react';
import { t } from '../utils/i18n';
import { parseExamDate } from '../utils/examDate';

const TaskStats = React.memo(function TaskStats({ assignments = [], lang = 'en', exams = [] }) {
  const total = assignments.length;
  const todo = assignments.filter(a => a.status === 'todo').length;
  const done = assignments.filter(a => a.status === 'done').length;

  const percent = total > 0 ? Math.round((done / total) * 100) : 0;

  let examCountdownStr = lang === 'en' ? 'No Exam' : 'ไม่มีสอบ';
  let closestExamName = '';

  if (exams && exams.length > 0) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcomingExams = exams.filter(exam => {
      const parsedDate = parseExamDate(exam.rawIsoDate || exam.date);
      return parsedDate ? parsedDate >= today : false;
    });

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
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-[#252526] border border-[#3C3C3C] rounded-2xl p-5"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-[#9D9D9D] font-medium mb-1">{stat.label}</p>
                <h4 className="text-xl font-semibold text-[#FFFFFF] truncate" title={String(stat.value)}>
                  {stat.value}
                </h4>
                {stat.subValue && (
                  <p className="text-[11px] text-[#858585] truncate mt-0.5" title={stat.subValue}>
                    {stat.subValue}
                  </p>
                )}
              </div>
              <div className={`p-2.5 rounded-xl border ${stat.color} shrink-0`}>
                <stat.icon size={18} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-[#252526] border border-[#3C3C3C] rounded-2xl p-5">
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
