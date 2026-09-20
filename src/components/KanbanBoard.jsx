import React from 'react';
import AssignmentCard from './AssignmentCard';
import { ListTodo, Clock, CheckCircle } from 'lucide-react';
import { t } from '../utils/i18n';

const KanbanBoard = React.memo(function KanbanBoard({ todoTasks, doingTasks, doneTasks, handleStatusChange, lang }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 opacity-0 animate-fade-in" style={{ animationDelay: '350ms' }}>
      <div className="bg-dark-sidebar/30 border border-dark-border/40 rounded-3xl p-4 lg:p-5 flex flex-col h-full min-h-[500px]">
        <div className="flex items-center justify-between mb-6 border-b border-white/5 pb-4">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-zinc-400 shadow-[0_0_8px_rgba(161,161,170,0.5)]" />
            <span className="font-bold text-white tracking-wide">{t('todo', lang)}</span>
          </div>
          <span className="bg-white/10 text-white text-xs px-3 py-1 rounded-full font-bold">
            {todoTasks.length}
          </span>
        </div>
        <div className="space-y-5 overflow-y-auto flex-1 max-h-[600px] pr-2 custom-scrollbar">
          {todoTasks.map(task => (
            <AssignmentCard key={task.id} assignment={task} onStatusChange={handleStatusChange} lang={lang} viewMode="kanban" />
          ))}
          {todoTasks.length === 0 && (
            <div className="border border-white/10 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center text-sm font-medium text-zinc-500 py-12 bg-white/[0.02]">
              <ListTodo size={32} className="text-zinc-600 mb-3 opacity-50" />
              {t('emptyColumn', lang)}
            </div>
          )}
        </div>
      </div>

      <div className="bg-dark-sidebar/30 border border-dark-border/40 rounded-3xl p-4 lg:p-5 flex flex-col h-full min-h-[500px]">
        <div className="flex items-center justify-between mb-6 border-b border-white/5 pb-4">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]" />
            <span className="font-bold text-white tracking-wide">{t('doing', lang)}</span>
          </div>
          <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs px-3 py-1 rounded-full font-bold">
            {doingTasks.length}
          </span>
        </div>
        <div className="space-y-5 overflow-y-auto flex-1 max-h-[600px] pr-2 custom-scrollbar">
          {doingTasks.map(task => (
            <AssignmentCard key={task.id} assignment={task} onStatusChange={handleStatusChange} lang={lang} viewMode="kanban" />
          ))}
          {doingTasks.length === 0 && (
            <div className="border border-white/10 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center text-sm font-medium text-zinc-500 py-12 bg-white/[0.02]">
              <Clock size={32} className="text-zinc-600 mb-3 opacity-50" />
              {t('emptyColumn', lang)}
            </div>
          )}
        </div>
      </div>

      <div className="bg-dark-sidebar/30 border border-dark-border/40 rounded-3xl p-4 lg:p-5 flex flex-col h-full min-h-[500px]">
        <div className="flex items-center justify-between mb-6 border-b border-white/5 pb-4">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
            <span className="font-bold text-white tracking-wide">{t('completed', lang)}</span>
          </div>
          <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs px-3 py-1 rounded-full font-bold">
            {doneTasks.length}
          </span>
        </div>
        <div className="space-y-5 overflow-y-auto flex-1 max-h-[600px] pr-2 custom-scrollbar">
          {doneTasks.map(task => (
            <AssignmentCard key={task.id} assignment={task} onStatusChange={handleStatusChange} lang={lang} viewMode="kanban" />
          ))}
          {doneTasks.length === 0 && (
            <div className="border border-white/10 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center text-sm font-medium text-zinc-500 py-12 bg-white/[0.02]">
              <CheckCircle size={32} className="text-zinc-600 mb-3 opacity-50" />
              {t('emptyColumn', lang)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default KanbanBoard;
