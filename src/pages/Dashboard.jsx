import { useState } from 'react';
import AssignmentCard from '../components/AssignmentCard';
import KanbanBoard from '../components/KanbanBoard';
import TaskFilters from '../components/TaskFilters';
import TodayScheduleWidget from '../components/TodayScheduleWidget';
import CreateTaskModal from '../components/CreateTaskModal';
import { Plus, RefreshCw, AlertTriangle, ClipboardList, Clock } from 'lucide-react';
import { t } from '../utils/i18n';

import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { useClassroom } from '../contexts/ClassroomContext';
import { useClassroomUI } from '../contexts/ClassroomUIContext';
import { useTodayClasses } from '../hooks/useTodayClasses';
import { useDashboardFilters } from '../hooks/useDashboardFilters';

export default function Dashboard() {
  const { isLoggedIn, profile } = useAuth();
  const { lang } = useSettings();
  const { schedule, handleStatusChange, handleAddAssignment, isSyncing, syncClassroom } = useClassroom();
  const { visibleAssignments, visibleCourses } = useClassroomUI();

  const [isModalOpen, setIsModalOpen] = useState(false);

  const {
    searchQuery, setSearchQuery,
    selectedCourse, setSelectedCourse,
    selectedStatus, setSelectedStatus,
    sortBy, setSortBy,
    viewType, setViewType,
    clearFilters,
    sortedAssignments,
    overdueTasks,
    todayTasks,
    todoTasks,
    doingTasks,
    doneTasks
  } = useDashboardFilters(visibleAssignments);

  const todayClasses = useTodayClasses(schedule, profile);

  const criticalTaskIds = new Set([
    ...overdueTasks.map(t => t.id),
    ...todayTasks.map(t => t.id)
  ]);
  const mainListAssignments = sortedAssignments.filter(a => !criticalTaskIds.has(a.id));
  const hasActiveFilters = Boolean(searchQuery || selectedCourse !== 'all' || selectedStatus !== 'all');

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[#FFFFFF] tracking-tight">{t('assignmentsTitle', lang)}</h1>
          <p className="text-xs text-[#9D9D9D] mt-1">{t('assignmentsDesc', lang)}</p>
        </div>
        <div className="flex items-center gap-2.5">
          {isLoggedIn && (
            <button
              type="button"
              onClick={() => syncClassroom()}
              disabled={isSyncing}
              className="flex items-center gap-1.5 bg-[#252526] hover:bg-[#2A2D2E] border border-[#3C3C3C] text-[#D4D4D4] font-medium text-xs px-3.5 py-2.5 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw size={14} className={isSyncing ? 'animate-spin text-[#3794FF]' : 'text-[#9D9D9D]'} />
              <span>{t('syncClassroom', lang)}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-1.5 bg-[#007ACC] hover:bg-[#1177BB] text-white font-medium text-xs px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
          >
            <Plus size={15} />
            <span>{t('createTask', lang)}</span>
          </button>
        </div>
      </div>

      <TodayScheduleWidget todayClasses={todayClasses} lang={lang} />

      <TaskFilters
        searchQuery={searchQuery} setSearchQuery={setSearchQuery}
        selectedCourse={selectedCourse} setSelectedCourse={setSelectedCourse}
        selectedStatus={selectedStatus} setSelectedStatus={setSelectedStatus}
        sortBy={sortBy} setSortBy={setSortBy}
        viewType={viewType} setViewType={setViewType}
        clearFilters={clearFilters}
        visibleCourses={visibleCourses} lang={lang}
      />

      {/* Critical Rows (Visible in Grid and List views) */}
      {(viewType === 'grid' || viewType === 'list') && (overdueTasks.length > 0 || todayTasks.length > 0) && (
        <div className="space-y-4">
          {overdueTasks.length > 0 && (
            <div className="space-y-3 bg-rose-500/10 border border-rose-500/30 rounded-2xl p-5">
              <h3 className="text-xs font-semibold text-rose-400 flex items-center gap-2">
                <AlertTriangle size={15} className="text-rose-400" />
                <span>{t('overdueTasksTitle', lang)} ({overdueTasks.length})</span>
              </h3>
              <div className={viewType === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4' : 'flex flex-col gap-2.5'}>
                {overdueTasks.map(task => (
                  <AssignmentCard key={task.id} assignment={task} onStatusChange={handleStatusChange} lang={lang} viewMode={viewType} />
                ))}
              </div>
            </div>
          )}

          {todayTasks.length > 0 && (
            <div className="space-y-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5">
              <h3 className="text-xs font-semibold text-amber-400 flex items-center gap-2">
                <Clock size={15} className="text-amber-400" />
                <span>{t('dueTodayTitle', lang)} ({todayTasks.length})</span>
              </h3>
              <div className={viewType === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4' : 'flex flex-col gap-2.5'}>
                {todayTasks.map(task => (
                  <AssignmentCard key={task.id} assignment={task} onStatusChange={handleStatusChange} lang={lang} viewMode={viewType} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Grid or List View Main Content */}
      {(viewType === 'grid' || viewType === 'list') && (
        <div className="space-y-3.5">
          <h3 className="text-xs font-semibold text-[#9D9D9D] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#3794FF]" />
            <span>{t('allCourseAssignments', lang, { count: mainListAssignments.length })}</span>
          </h3>
          {sortedAssignments.length === 0 ? (
            <div className="bg-[#252526] border border-[#3C3C3C] border-dashed rounded-2xl p-12 flex flex-col items-center justify-center text-center">
              <ClipboardList size={36} className="text-[#858585] mb-3 opacity-60" />
              <p className="text-[#9D9D9D] text-xs font-medium mb-4">{t('noAssignmentsFound', lang)}</p>
              <div className="flex items-center gap-2.5">
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="bg-[#1E1E1E] hover:bg-[#2A2D2E] border border-[#3C3C3C] text-[#D4D4D4] rounded-xl px-4 py-2 text-xs font-medium transition-colors cursor-pointer"
                  >
                    {t('clearFilters', lang)}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsModalOpen(true)}
                  className="bg-[#007ACC] hover:bg-[#1177BB] text-white rounded-xl px-4 py-2 text-xs font-medium transition-colors cursor-pointer"
                >
                  {t('createTask', lang)}
                </button>
              </div>
            </div>
          ) : mainListAssignments.length > 0 ? (
            <div className={viewType === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4' : 'flex flex-col gap-2.5'}>
              {mainListAssignments.map((assignment) => (
                <AssignmentCard
                  key={assignment.id}
                  assignment={assignment}
                  onStatusChange={handleStatusChange}
                  lang={lang}
                  viewMode={viewType}
                />
              ))}
            </div>
          ) : null}
        </div>
      )}

      {/* Kanban Board View */}
      {viewType === 'kanban' && (
        <KanbanBoard
          todoTasks={todoTasks} doingTasks={doingTasks} doneTasks={doneTasks}
          handleStatusChange={handleStatusChange} lang={lang}
        />
      )}

      {/* Create Task Modal */}
      <CreateTaskModal
        isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}
        visibleCourses={visibleCourses} lang={lang} onAddAssignment={handleAddAssignment}
      />
    </div>
  );
}
