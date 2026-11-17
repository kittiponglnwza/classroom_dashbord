import React from 'react';
import AssignmentCard from './AssignmentCard';
import { ListTodo, Clock, CheckCircle } from 'lucide-react';
import { t } from '../utils/i18n';

const KanbanBoard = React.memo(function KanbanBoard({ todoTasks, doingTasks, doneTasks, handleStatusChange, lang }) {
  const columns = [
    {
      key: 'todo',
      title: t('todo', lang),
      dotClass: 'bg-zinc-400',
      badgeClass: 'bg-[#F5F5F7] text-[#1D1D1F] border border-[#D2D2D7]',
      tasks: todoTasks,
      emptyIcon: ListTodo
    },
    {
      key: 'doing',
      title: t('doing', lang),
      dotClass: 'bg-amber-500',
      badgeClass: 'bg-amber-50 text-amber-800 border border-amber-200',
      tasks: doingTasks,
      emptyIcon: Clock
    },
    {
      key: 'done',
      title: t('completed', lang),
      dotClass: 'bg-emerald-600',
      badgeClass: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
      tasks: doneTasks,
      emptyIcon: CheckCircle
    }
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {columns.map(col => {
        const EmptyIcon = col.emptyIcon;
        return (
          <div
            key={col.key}
            className="bg-white border border-[#D2D2D7]/80 rounded-2xl p-4 lg:p-5 flex flex-col h-full min-h-[420px] shadow-2xs"
          >
            <div className="flex items-center justify-between mb-4 border-b border-[#D2D2D7]/60 pb-3">
              <div className="flex items-center gap-2.5">
                <span className={`w-2.5 h-2.5 rounded-full ${col.dotClass}`} />
                <span className="font-semibold text-sm text-[#1D1D1F]">{col.title}</span>
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
                <div className="border border-[#D2D2D7] border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center text-xs text-[#6E6E73] py-12 bg-[#F5F5F7]/50">
                  <EmptyIcon size={24} className="text-[#6E6E73] mb-2 opacity-60" />
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
