import { useState } from 'react';
import AssignmentCard from '../components/AssignmentCard';
import KanbanBoard from '../components/KanbanBoard';
import TaskFilters from '../components/TaskFilters';
import TodayScheduleWidget from '../components/TodayScheduleWidget';
import CreateTaskModal from '../components/CreateTaskModal';
import PageHeader from '../components/PageHeader';
import { Plus, RefreshCw, AlertTriangle, ClipboardList, Clock, BookOpen, ChevronDown, ChevronUp, Sparkles, Pin } from 'lucide-react';
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
  const { visibleAssignments, visibleCourses, isItemPinned = () => false } = useClassroomUI();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showReadMaterials, setShowReadMaterials] = useState(false);

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
    doneTasks,
    detectedMaterials = []
  } = useDashboardFilters(visibleAssignments);

  const todayClasses = useTodayClasses(schedule, profile);

  const criticalTaskIds = new Set([
    ...overdueTasks.map(t => t.id),
    ...todayTasks.map(t => t.id)
  ]);

  const readMaterialsList = selectedStatus === 'all'
    ? sortedAssignments.filter(a => a.status === 'read')
    : [];

  const allMainAssignments = sortedAssignments.filter(a => {
    if (criticalTaskIds.has(a.id)) return false;
    if (selectedStatus === 'all' && a.status === 'read') return false;
    return true;
  });

  const pinnedMainAssignments = allMainAssignments.filter(a => isItemPinned(a.id));
  const mainListAssignments = allMainAssignments.filter(a => !isItemPinned(a.id));

  const handleMarkDetectedAsRead = () => {
    detectedMaterials.forEach((item) => {
      handleStatusChange(item.id, 'read');
    });
  };

  const hasActiveFilters = Boolean(searchQuery || selectedCourse !== 'all' || selectedStatus !== 'all');

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('assignmentsTitle', lang)}
        description={t('assignmentsDesc', lang)}
        icon={ClipboardList}
        actions={
          <>
            {isLoggedIn && (
              <button
                type="button"
                onClick={() => syncClassroom()}
                disabled={isSyncing}
                className="flex items-center gap-1.5 bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-primary)] font-medium text-xs px-3.5 py-2.5 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw size={14} className={isSyncing ? 'animate-spin text-[var(--primary-bright)]' : 'text-[var(--text-secondary)]'} />
                <span>{t('syncClassroom', lang)}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="flex items-center justify-center gap-1.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-medium text-xs px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
            >
              <Plus size={15} />
              <span>{t('createTask', lang)}</span>
            </button>
          </>
        }
      />

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

      {/* Smart Auto-Detect Lecture Materials Suggestion */}
      {detectedMaterials.length > 0 && (
        <div
          data-testid="smart-material-suggestion"
          className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2.5 text-xs text-[var(--text-primary)] min-w-0">
            <div className="w-7 h-7 rounded-lg bg-[var(--primary)]/15 border border-[var(--primary)]/30 flex items-center justify-center shrink-0">
              <Sparkles size={13} className="text-[var(--primary-bright)]" />
            </div>
            <div className="min-w-0">
              <span className="font-medium text-[var(--text-heading)]">
                {lang === 'en'
                  ? `Found ${detectedMaterials.length} lecture material post${detectedMaterials.length > 1 ? 's' : ''}`
                  : `พบโพสต์ที่คล้ายไฟล์เรียน/สไลด์ ${detectedMaterials.length} รายการ`}
              </span>
              <span className="text-[var(--text-muted)] ml-1.5 truncate">
                ({detectedMaterials.slice(0, 2).map(m => m.title).join(', ')}{detectedMaterials.length > 2 ? '...' : ''})
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleMarkDetectedAsRead}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--primary-active)]/60 hover:bg-[var(--primary-active)] border border-[var(--primary)]/40 text-[var(--info)] text-xs font-medium transition-colors cursor-pointer shrink-0 whitespace-nowrap"
          >
            <BookOpen size={13} />
            <span>
              {lang === 'en'
                ? `Mark all ${detectedMaterials.length} as Read`
                : `มาร์คเป็น "อ่านแล้ว" ทั้งหมด (${detectedMaterials.length})`}
            </span>
          </button>
        </div>
      )}

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
        <div className="space-y-4">
          {pinnedMainAssignments.length > 0 && (
            <div className="space-y-3 bg-amber-500/5 border border-amber-500/25 rounded-2xl p-4">
              <h3 className="text-xs font-semibold text-amber-300 flex items-center gap-2">
                <Pin size={14} className="text-amber-400 fill-amber-400/30" />
                <span>
                  {lang === 'en'
                    ? `Pinned Assignments (${pinnedMainAssignments.length})`
                    : `งานที่ปักหมุดไว้ (${pinnedMainAssignments.length})`}
                </span>
              </h3>
              <div className={viewType === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4' : 'flex flex-col gap-2.5'}>
                {pinnedMainAssignments.map((assignment) => (
                  <AssignmentCard
                    key={assignment.id}
                    assignment={assignment}
                    onStatusChange={handleStatusChange}
                    lang={lang}
                    viewMode={viewType}
                  />
                ))}
              </div>
            </div>
          )}

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

          {/* Collapsible Drawer for Read / Lecture Materials */}
          {readMaterialsList.length > 0 && (
            <div className="pt-3">
              <button
                type="button"
                onClick={() => setShowReadMaterials(prev => !prev)}
                className="w-full bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] rounded-2xl px-4 py-3 flex items-center justify-between text-xs font-medium text-[var(--text-secondary)] transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <BookOpen size={14} className="text-[var(--primary-bright)]" />
                  <span>
                    {lang === 'en'
                      ? `Read / Lecture Materials (${readMaterialsList.length})`
                      : `อ่านแล้ว / ไฟล์เรียน (${readMaterialsList.length})`}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[var(--text-muted)]">
                  <span>{showReadMaterials ? (lang === 'en' ? 'Hide' : 'ซ่อน') : (lang === 'en' ? 'Show' : 'แสดง')}</span>
                  {showReadMaterials ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                </div>
              </button>

              {showReadMaterials && (
                <div className={`mt-3 ${viewType === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4' : 'flex flex-col gap-2.5'}`}>
                  {readMaterialsList.map((assignment) => (
                    <AssignmentCard
                      key={assignment.id}
                      assignment={assignment}
                      onStatusChange={handleStatusChange}
                      lang={lang}
                      viewMode={viewType}
                    />
                  ))}
                </div>
              )}
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
