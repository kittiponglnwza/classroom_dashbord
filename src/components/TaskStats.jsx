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
      color: 'text-[#0071E3] bg-blue-50 border-blue-200/70'
    },
    {
      label: t('todo', lang),
      value: todo,
      icon: ListTodo,
      color: 'text-[#6E6E73] bg-[#F5F5F7] border-[#D2D2D7]'
    },
    {
      label: lang === 'en' ? 'Exam Countdown' : 'นับถอยหลังสอบ',
      value: examCountdownStr,
      subValue: closestExamName ? (lang === 'en' ? `for ${closestExamName}` : `วิชา ${closestExamName}`) : '',
      icon: Timer,
      color: 'text-amber-700 bg-amber-50 border-amber-200/70'
    },
    {
      label: t('completed', lang),
      value: done,
      icon: CheckCircle2,
      color: 'text-emerald-700 bg-emerald-50 border-emerald-200/70'
    }
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-white border border-[#D2D2D7]/80 rounded-2xl p-5 shadow-2xs"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-[#6E6E73] font-medium mb-1">{stat.label}</p>
                <h4 className="text-xl font-semibold text-[#1D1D1F] truncate" title={String(stat.value)}>
                  {stat.value}
                </h4>
                {stat.subValue && (
                  <p className="text-[11px] text-[#6E6E73] truncate mt-0.5" title={stat.subValue}>
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

      <div className="bg-white border border-[#D2D2D7]/80 rounded-2xl p-5 shadow-2xs">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="font-medium text-[#1D1D1F]">{t('completionProgress', lang)}</span>
          <span className="font-semibold text-[#0071E3]">{percent}% ({done}/{total} {t('doneStatus', lang)})</span>
        </div>
        <div className="w-full bg-[#F5F5F7] border border-[#D2D2D7]/70 rounded-full h-2.5 overflow-hidden">
          <div
            className="bg-[#0071E3] h-full rounded-full transition-all duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    </div>
  );
});

export default TaskStats;
