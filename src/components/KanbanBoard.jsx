import React from 'react';
import AssignmentCard from './AssignmentCard';
import { ListTodo, Clock, CheckCircle } from 'lucide-react';
import { t } from '../utils/i18n';

const KanbanBoard = React.memo(function KanbanBoard({ todoTasks, doingTasks, doneTasks, handleStatusChange, lang }) {
  const columns = [
    {
      key: 'todo',
      title: t('todo', lang),
      dotClass: 'bg-[#858585]',
      badgeClass: 'bg-[#1E1E1E] text-[#D4D4D4] border border-[#3C3C3C]',
      tasks: todoTasks,
      emptyIcon: ListTodo
    },
    {
      key: 'doing',
      title: t('doing', lang),
      dotClass: 'bg-amber-400',
      badgeClass: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
      tasks: doingTasks,
      emptyIcon: Clock
    },
    {
      key: 'done',
      title: t('completed', lang),
      dotClass: 'bg-emerald-400',
      badgeClass: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
      tasks: doneTasks,
      emptyIcon: CheckCircle
    }
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
      {columns.map(col => {
        const EmptyIcon = col.emptyIcon;
        return (
          <div
            key={col.key}
            className="bg-[#252526] border border-[#3C3C3C] rounded-2xl p-3.5 sm:p-4 lg:p-5 flex flex-col h-full min-h-[160px] lg:min-h-[420px]"
          >
            <div className="flex items-center justify-between mb-4 border-b border-[#3C3C3C] pb-3">
              <div className="flex items-center gap-2.5">
                <span className={`w-2.5 h-2.5 rounded-full ${col.dotClass}`} />
                <span className="font-semibold text-sm text-[#FFFFFF]">{col.title}</span>
              </div>
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${col.badgeClass}`}>
                {col.tasks.length}
              </span>
            </div>
            <div className="space-y-3.5 overflow-y-auto flex-1 max-h-[560px] pr-1">
              {col.tasks.map(task => (
                <AssignmentCard
                  key={task.id}
                  assignment={task}
                  onStatusChange={handleStatusChange}
                  lang={lang}
                  viewMode="kanban"
                />
              ))}
              {col.tasks.length === 0 && (
                <div className="border border-[#3C3C3C] border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center text-xs text-[#858585] py-12 bg-[#1E1E1E]/60">
                  <EmptyIcon size={24} className="text-[#858585] mb-2 opacity-60" />
                  {t('emptyColumn', lang)}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
});

export default KanbanBoard;
