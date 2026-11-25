import React from 'react';
import AssignmentCard from './AssignmentCard';
import { ListTodo, Clock, CheckCircle } from 'lucide-react';
import { t } from '../utils/i18n';

const KanbanBoard = React.memo(function KanbanBoard({ todoTasks, doingTasks, doneTasks, handleStatusChange, lang }) {
  const columns = [
    {
      key: 'todo',
      title: t('todo', lang),
      dotClass: 'bg-[var(--text-muted)]',
      tasks: todoTasks,
      emptyIcon: ListTodo
    },
    {
      key: 'doing',
      title: t('doing', lang),
      dotClass: 'bg-amber-400',
      tasks: doingTasks,
      emptyIcon: Clock
    },
    {
      key: 'done',
      title: t('completed', lang),
      dotClass: 'bg-emerald-400',
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
            className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 lg:p-5 flex flex-col h-full min-h-[160px] lg:min-h-[420px]"
          >
            <div className="flex items-center justify-between mb-4 border-b border-[var(--border)] pb-3">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${col.dotClass}`} />
                <span className="font-medium text-sm text-[var(--text-heading)]">{col.title}</span>
              </div>
              <span className="text-xs font-mono text-[var(--text-muted)] tabular-nums">
                {col.tasks.length}
              </span>
            </div>
            <div className="space-y-3 overflow-y-auto flex-1 max-h-[560px] pr-1">
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
                <div className="border border-[var(--border)] border-dashed rounded-lg p-8 flex flex-col items-center justify-center text-center text-xs text-[var(--text-muted)] py-12 bg-[var(--app-bg)]">
                  <EmptyIcon size={20} strokeWidth={1.5} className="text-[var(--text-muted)] mb-2" />
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
