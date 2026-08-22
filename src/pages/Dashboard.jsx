import { useState } from 'react';
import AssignmentCard from '../components/AssignmentCard';
import KanbanBoard from '../components/KanbanBoard';
import TaskFilters from '../components/TaskFilters';
import TodayScheduleWidget from '../components/TodayScheduleWidget';
import CreateTaskModal from '../components/CreateTaskModal';
import { Plus, RefreshCw, AlertTriangle } from 'lucide-react';
import { t } from '../utils/i18n';
import { isDueToday, isOverdue } from '../utils/dateUtils';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { useClassroom } from '../contexts/ClassroomContext';
import { useClassroomUI } from '../contexts/ClassroomUIContext';
import { useTodayClasses } from '../hooks/useTodayClasses';

export default function Dashboard() {
  const { isLoggedIn, profile } = useAuth();
  const { lang } = useSettings();
  const { schedule, handleStatusChange, handleAddAssignment, isSyncing, syncClassroom } = useClassroom();
  const { visibleAssignments, visibleCourses } = useClassroomUI();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [sortBy, setSortBy] = useState('due-asc');
  const [viewType, setViewType] = useState('list');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const todayClasses = useTodayClasses(schedule, profile);

  // Filter assignments
  const filteredAssignments = visibleAssignments.filter(assignment => {
    const matchesSearch = assignment.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          assignment.course.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCourse = selectedCourse === 'all' || assignment.course === selectedCourse;
    const matchesStatus = selectedStatus === 'all' || assignment.status === selectedStatus;
    return matchesSearch && matchesCourse && matchesStatus;
  });

  // Sort assignments
  const sortedAssignments = [...filteredAssignments].sort((a, b) => {
    if (sortBy === 'due-asc') {
      return new Date(a.dueDate) - new Date(b.dueDate);
    } else if (sortBy === 'due-desc') {
      return new Date(b.dueDate) - new Date(a.dueDate);
    } else if (sortBy === 'points-desc') {
      return b.points - a.points;
    }
    return 0;
  });

  // Extract critical groups (not filtered by general status filter to avoid missing overdue alerts)
  const allFilteredAssignments = visibleAssignments.filter(a => {
    const matchesSearch = a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          a.course.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCourse = selectedCourse === 'all' || a.course === selectedCourse;
    return matchesSearch && matchesCourse;
  });

  const overdueTasks = allFilteredAssignments.filter(a => isOverdue(a.dueDate) && a.status !== 'done');
  const todayTasks = allFilteredAssignments.filter(a => isDueToday(a.dueDate) && !isOverdue(a.dueDate) && a.status !== 'done');

  // Split assignments for Kanban columns
  const todoTasks = sortedAssignments.filter(a => a.status === 'todo');
  const doingTasks = sortedAssignments.filter(a => a.status === 'doing');
  const doneTasks = sortedAssignments.filter(a => a.status === 'done');

  return (
    <div className="space-y-8 relative max-w-7xl mx-auto py-4">
      {/* Abstract Background Elements */}
      <div className="fixed top-0 left-1/4 w-[600px] h-[600px] ambient-glow-brand rounded-full pointer-events-none -z-10"></div>
      <div className="fixed bottom-0 right-1/4 w-[600px] h-[600px] ambient-glow-emerald rounded-full pointer-events-none -z-10"></div>

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 opacity-0 animate-fade-in" style={{ animationDelay: '50ms' }}>
        <div>
          <h1 className="text-3xl font-bold font-heading text-white tracking-tight">{t('assignmentsTitle', lang)}</h1>
          <p className="text-sm text-dark-muted mt-1">{t('assignmentsDesc', lang)}</p>
        </div>
        <div className="flex items-center gap-3">
          {isLoggedIn && (
            <button
              onClick={syncClassroom}
              disabled={isSyncing}
              className="flex items-center gap-2 hover:bg-white/5 text-brand-400 hover:text-brand-300 font-bold text-xs px-4 py-2.5 rounded-xl transition-all duration-300 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
              {t('syncClassroom', lang)}
            </button>
          )}
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 bg-brand-500 hover:bg-brand-400 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all duration-300 cursor-pointer"
          >
            <Plus size={16} />
            {t('createTask', lang)}
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
      {(viewType === 'grid' || viewType === 'list') && (
        <div className="space-y-6">
          {overdueTasks.length > 0 && (
            <div className="space-y-4 bg-rose-500/5 backdrop-blur-md border border-rose-500/10 rounded-3xl p-6 lg:p-8 opacity-0 animate-fade-in" style={{ animationDelay: '350ms' }}>
              <h3 className="text-sm font-bold text-rose-400 flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-rose-500/10 flex items-center justify-center">
                  <AlertTriangle size={16} className="animate-bounce" />
                </div>
                {t('overdueTasksTitle', lang)}
              </h3>
              <div className={viewType === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5" : "flex flex-col gap-3"}>
                {overdueTasks.map(task => (
                  <AssignmentCard key={task.id} assignment={task} onStatusChange={handleStatusChange} lang={lang} viewMode={viewType} />
                ))}
              </div>
            </div>
          )}

          {todayTasks.length > 0 && (
            <div className="space-y-4 bg-amber-500/5 backdrop-blur-md border border-amber-500/10 rounded-3xl p-6 lg:p-8 opacity-0 animate-fade-in" style={{ animationDelay: '400ms' }}>
              <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <AlertTriangle size={16} />
                </div>
                {t('dueTodayTitle', lang)}
              </h3>
              <div className={viewType === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5" : "flex flex-col gap-3"}>
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
        <div className="space-y-5 opacity-0 animate-fade-in" style={{ animationDelay: '450ms' }}>
          <h3 className="text-sm font-bold text-zinc-300 flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-brand-500"></span>
            {t('allCourseAssignments', lang, { count: sortedAssignments.length })}
          </h3>
          {sortedAssignments.length > 0 ? (
            <div className={viewType === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" : "flex flex-col gap-4"}>
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
            <div className="bg-dark-card/30 backdrop-blur-md border border-white/5 rounded-3xl p-16 text-center shadow-lg">
              <p className="text-zinc-400 text-sm font-medium">{t('noAssignmentsFound', lang)}</p>
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
