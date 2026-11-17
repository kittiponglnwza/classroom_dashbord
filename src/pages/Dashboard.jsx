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
    sortedAssignments,
    overdueTasks,
    todayTasks,
    todoTasks,
    doingTasks,
    doneTasks
  } = useDashboardFilters(visibleAssignments);

  const todayClasses = useTodayClasses(schedule, profile);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[#1D1D1F] tracking-tight">{t('assignmentsTitle', lang)}</h1>
          <p className="text-xs text-[#6E6E73] mt-1">{t('assignmentsDesc', lang)}</p>
        </div>
        <div className="flex items-center gap-2.5">
          {isLoggedIn && (
            <button
              type="button"
              onClick={() => syncClassroom()}
              disabled={isSyncing}
              className="flex items-center gap-1.5 bg-white hover:bg-[#F5F5F7] border border-[#D2D2D7] text-[#1D1D1F] font-medium text-xs px-3.5 py-2.5 rounded-xl transition-colors disabled:opacity-50 cursor-pointer shadow-2xs"
            >
              <RefreshCw size={14} className={isSyncing ? 'animate-spin text-[#0071E3]' : 'text-[#6E6E73]'} />
              <span>{t('syncClassroom', lang)}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-1.5 bg-[#0071E3] hover:bg-[#0077ED] text-white font-medium text-xs px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
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
        visibleCourses={visibleCourses} lang={lang}
      />

      {/* Critical Rows (Visible in Grid and List views) */}
      {(viewType === 'grid' || viewType === 'list') && (overdueTasks.length > 0 || todayTasks.length > 0) && (
        <div className="space-y-4">
          {overdueTasks.length > 0 && (
            <div className="space-y-3 bg-rose-50/60 border border-rose-200 rounded-2xl p-5">
              <h3 className="text-xs font-semibold text-rose-700 flex items-center gap-2">
                <AlertTriangle size={15} className="text-rose-600" />
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
            <div className="space-y-3 bg-amber-50/60 border border-amber-200 rounded-2xl p-5">
              <h3 className="text-xs font-semibold text-amber-800 flex items-center gap-2">
                <Clock size={15} className="text-amber-600" />
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
          <h3 className="text-xs font-semibold text-[#6E6E73] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#0071E3]" />
            <span>{t('allCourseAssignments', lang, { count: sortedAssignments.length })}</span>
          </h3>
          {sortedAssignments.length > 0 ? (
            <div className={viewType === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4' : 'flex flex-col gap-2.5'}>
              {sortedAssignments.map((assignment) => (
                <AssignmentCard
                  key={assignment.id}
                  assignment={assignment}
                  onStatusChange={handleStatusChange}
                  lang={lang}
                  viewMode={viewType}
                />
              ))}
            </div>
          ) : (
            <div className="bg-white border border-[#D2D2D7] border-dashed rounded-2xl p-12 flex flex-col items-center justify-center text-center">
              <ClipboardList size={36} className="text-[#6E6E73] mb-3 opacity-60" />
              <p className="text-[#6E6E73] text-xs font-medium mb-4">{t('noAssignmentsFound', lang)}</p>
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="bg-[#0071E3] hover:bg-[#0077ED] text-white rounded-xl px-4 py-2 text-xs font-medium transition-colors cursor-pointer"
              >
                {t('createTask', lang)}
              </button>
            </div>
          )}
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
