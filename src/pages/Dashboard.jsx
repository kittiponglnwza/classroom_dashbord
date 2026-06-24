import { useState } from 'react';
import AssignmentCard from '../components/AssignmentCard';
import { Search, Filter, ArrowUpDown, LayoutGrid, Kanban, Plus, X, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function Dashboard({ 
  assignments = [], 
  onStatusChange, 
  onAddAssignment, 
  courses = [],
  isLoggedIn = false,
  isSyncing = false,
  onSync = null
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [sortBy, setSortBy] = useState('due-asc'); // 'due-asc', 'due-desc', 'points-desc'
  const [viewType, setViewType] = useState('grid'); // 'grid' or 'kanban'
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State for new assignment
  const [newTitle, setNewTitle] = useState('');
  const [newCourse, setNewCourse] = useState(courses[0]?.name || '');
  const [newDueDate, setNewDueDate] = useState('');
  const [newPoints, setNewPoints] = useState(100);
  const [newDescription, setNewDescription] = useState('');

  // Handle adding new assignment
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!newTitle || !newCourse || !newDueDate) return;

    const courseObj = courses.find(c => c.name === newCourse);
    const color = courseObj ? courseObj.color : 'blue';

    // Format newDueDate to date with end of day time
    const formattedDueDate = `${newDueDate}T23:59:59`;

    onAddAssignment({
      title: newTitle,
      course: newCourse,
      dueDate: formattedDueDate,
      status: 'todo',
      points: Number(newPoints),
      description: newDescription,
      attachments: [],
      courseColor: color
    });

    setNewTitle('');
    setNewDueDate('');
    setNewPoints(100);
    setNewDescription('');
    setIsModalOpen(false);
  };

  // Helper: check if task is due today (local calendar day match)
  const isDueToday = (dueDateStr) => {
    if (!dueDateStr) return false;
    const today = new Date();
    const due = new Date(dueDateStr);
    return today.getFullYear() === due.getFullYear() &&
           today.getMonth() === due.getMonth() &&
           today.getDate() === due.getDate();
  };

  // Helper: check if task is overdue
  const isOverdue = (task) => {
    if (task.status === 'done' || !task.dueDate) return false;
    return new Date(task.dueDate) - new Date() < 0;
  };

  // Filter assignments
  const filteredAssignments = assignments.filter(assignment => {
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
  const allFilteredAssignments = assignments.filter(a => {
    const matchesSearch = a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          a.course.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCourse = selectedCourse === 'all' || a.course === selectedCourse;
    return matchesSearch && matchesCourse;
  });

  const overdueTasks = allFilteredAssignments.filter(a => isOverdue(a));
  const todayTasks = allFilteredAssignments.filter(a => isDueToday(a.dueDate) && a.status !== 'done');

  // Split assignments for Kanban columns
  const todoTasks = sortedAssignments.filter(a => a.status === 'todo');
  const doingTasks = sortedAssignments.filter(a => a.status === 'doing');
  const doneTasks = sortedAssignments.filter(a => a.status === 'done');

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-heading text-white">Assignments</h1>
          <p className="text-xs text-dark-muted">Manage, track, and submit all your coursework.</p>
        </div>
        <div className="flex items-center gap-3">
          {isLoggedIn && onSync && (
            <button
              onClick={onSync}
              disabled={isSyncing}
              className="flex items-center gap-1.5 bg-dark-card hover:bg-dark-hover text-brand-400 hover:text-brand-300 font-semibold text-xs px-4 py-2.5 rounded-lg border border-dark-border transition-colors disabled:opacity-50"
            >
              <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
              Sync Classroom
            </button>
          )}
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white font-semibold text-xs px-4 py-2.5 rounded-lg transition-colors shadow-md shadow-brand-500/10"
          >
            <Plus size={16} />
            Create Task
          </button>
        </div>
      </div>

      {/* Control Bar: Filters, Search, Views */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-4 flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
        {/* Search */}
        <div className="relative flex-1">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-dark-muted">
            <Search size={16} />
          </span>
          <input
            type="text"
            placeholder="Search assignments or subjects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-dark-sidebar border border-dark-border rounded-lg pl-9 pr-4 py-2 text-xs text-white placeholder-dark-muted focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20 transition-all"
          />
        </div>

        {/* Filters and Sorting */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Course Filter */}
          <div className="flex items-center gap-1.5 bg-dark-sidebar border border-dark-border px-2.5 py-1.5 rounded-lg">
            <Filter size={13} className="text-dark-muted" />
            <select
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              className="bg-transparent text-xs text-zinc-200 focus:outline-none cursor-pointer pr-1"
            >
              <option value="all">All Subjects</option>
              {courses.map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          {viewType !== 'kanban' && (
            <div className="flex items-center gap-1.5 bg-dark-sidebar border border-dark-border px-2.5 py-1.5 rounded-lg">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="bg-transparent text-xs text-zinc-200 focus:outline-none cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="todo">ยังไม่เริ่ม (To Do)</option>
                <option value="doing">กำลังทำ (In Progress)</option>
                <option value="done">เสร็จแล้ว (Completed)</option>
              </select>
            </div>
          )}

          {/* Sorting */}
          <div className="flex items-center gap-1.5 bg-dark-sidebar border border-dark-border px-2.5 py-1.5 rounded-lg">
            <ArrowUpDown size={13} className="text-dark-muted" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-transparent text-xs text-zinc-200 focus:outline-none cursor-pointer"
            >
              <option value="due-asc">Due Date (Closest)</option>
              <option value="due-desc">Due Date (Furthest)</option>
              <option value="points-desc">Points (Highest)</option>
            </select>
          </div>

          {/* View Toggles */}
          <div className="flex items-center border border-dark-border rounded-lg p-0.5 bg-dark-sidebar ml-auto md:ml-0">
            <button
              onClick={() => setViewType('grid')}
              className={`p-1.5 rounded-md transition-colors ${viewType === 'grid' ? 'bg-dark-card text-brand-400' : 'text-dark-muted hover:text-white'}`}
              title="Grid View"
            >
              <LayoutGrid size={15} />
            </button>
            <button
              onClick={() => setViewType('kanban')}
              className={`p-1.5 rounded-md transition-colors ${viewType === 'kanban' ? 'bg-dark-card text-brand-400' : 'text-dark-muted hover:text-white'}`}
              title="Kanban Board"
            >
              <Kanban size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Critical Rows (Only visible in Grid view to keep board columns clean) */}
      {viewType === 'grid' && (
        <>
          {/* Overdue Section */}
          {overdueTasks.length > 0 && (
            <div className="space-y-3 bg-rose-500/5 border border-rose-500/10 rounded-2xl p-5">
              <h3 className="text-xs font-bold text-rose-400 flex items-center gap-2 uppercase tracking-wider">
                <AlertTriangle size={15} className="animate-bounce" />
                🔴 Overdue Assignments (เลยกำหนดส่ง)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {overdueTasks.map(task => (
                  <AssignmentCard key={task.id} assignment={task} onStatusChange={onStatusChange} />
                ))}
              </div>
            </div>
          )}

          {/* Today View Section */}
          {todayTasks.length > 0 && (
            <div className="space-y-3 bg-amber-500/5 border border-amber-500/10 rounded-2xl p-5">
              <h3 className="text-xs font-bold text-amber-400 flex items-center gap-2 uppercase tracking-wider">
                <AlertTriangle size={15} />
                ⚠️ Due Today (ส่งภายในวันนี้)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {todayTasks.map(task => (
                  <AssignmentCard key={task.id} assignment={task} onStatusChange={onStatusChange} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Grid View */}
      {viewType === 'grid' && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-dark-muted uppercase tracking-wider">
            All Course Assignments ({sortedAssignments.length})
          </h3>
          {sortedAssignments.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {sortedAssignments.map((assignment) => (
                <AssignmentCard
                  key={assignment.id}
                  assignment={assignment}
                  onStatusChange={onStatusChange}
                />
              ))}
            </div>
          ) : (
            <div className="bg-dark-card border border-dark-border rounded-xl p-12 text-center">
              <p className="text-dark-muted text-sm">No assignments found matching your filters.</p>
            </div>
          )}
        </div>
      )}

      {/* Kanban Board View */}
      {viewType === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Column 1: To Do */}
          <div className="bg-dark-sidebar/40 border border-dark-border/60 rounded-xl p-4 flex flex-col h-full min-h-[500px]">
            <div className="flex items-center justify-between mb-4 border-b border-dark-border pb-2.5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-zinc-400" />
                <span className="font-semibold text-sm text-white">ยังไม่เริ่ม (To Do)</span>
              </div>
              <span className="bg-zinc-800 text-zinc-300 text-xs px-2 py-0.5 rounded-full font-bold">
                {todoTasks.length}
              </span>
            </div>
            <div className="space-y-4 overflow-y-auto flex-1 max-h-[600px] pr-1">
              {todoTasks.map(task => (
                <AssignmentCard key={task.id} assignment={task} onStatusChange={onStatusChange} />
              ))}
              {todoTasks.length === 0 && (
                <div className="border border-dark-border/40 border-dashed rounded-lg p-5 text-center text-xs text-dark-muted py-8">
                  Empty column
                </div>
              )}
            </div>
          </div>

          {/* Column 2: In Progress */}
          <div className="bg-dark-sidebar/40 border border-dark-border/60 rounded-xl p-4 flex flex-col h-full min-h-[500px]">
            <div className="flex items-center justify-between mb-4 border-b border-dark-border pb-2.5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <span className="font-semibold text-sm text-white">กำลังทำ (In Progress)</span>
              </div>
              <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs px-2 py-0.5 rounded-full font-bold">
                {doingTasks.length}
              </span>
            </div>
            <div className="space-y-4 overflow-y-auto flex-1 max-h-[600px] pr-1">
              {doingTasks.map(task => (
                <AssignmentCard key={task.id} assignment={task} onStatusChange={onStatusChange} />
              ))}
              {doingTasks.length === 0 && (
                <div className="border border-dark-border/40 border-dashed rounded-lg p-5 text-center text-xs text-dark-muted py-8">
                  Empty column
                </div>
              )}
            </div>
          </div>

          {/* Column 3: Completed */}
          <div className="bg-dark-sidebar/40 border border-dark-border/60 rounded-xl p-4 flex flex-col h-full min-h-[500px]">
            <div className="flex items-center justify-between mb-4 border-b border-dark-border pb-2.5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                <span className="font-semibold text-sm text-white">เสร็จแล้ว (Completed)</span>
              </div>
              <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs px-2 py-0.5 rounded-full font-bold">
                {doneTasks.length}
              </span>
            </div>
            <div className="space-y-4 overflow-y-auto flex-1 max-h-[600px] pr-1">
              {doneTasks.map(task => (
                <AssignmentCard key={task.id} assignment={task} onStatusChange={onStatusChange} />
              ))}
              {doneTasks.length === 0 && (
                <div className="border border-dark-border/40 border-dashed rounded-lg p-5 text-center text-xs text-dark-muted py-8">
                  Empty column
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Task Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-dark-card border border-dark-border rounded-xl w-full max-w-lg overflow-hidden animate-fade-in relative shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-dark-border">
              <h3 className="font-semibold font-heading text-lg text-white">Create New Assignment</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-dark-muted hover:text-white p-1 rounded-lg hover:bg-dark-hover transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-dark-muted mb-1.5 uppercase">Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Linux Lab 5"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-dark-sidebar border border-dark-border rounded-lg px-3.5 py-2 text-sm text-white placeholder-dark-muted focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-dark-muted mb-1.5 uppercase">Subject *</label>
                  <select
                    value={newCourse}
                    onChange={(e) => setNewCourse(e.target.value)}
                    className="w-full bg-dark-sidebar border border-dark-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500 cursor-pointer"
                  >
                    {courses.map(c => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-dark-muted mb-1.5 uppercase">Due Date *</label>
                  <input
                    type="date"
                    required
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="w-full bg-dark-sidebar border border-dark-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500 cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-dark-muted mb-1.5 uppercase">Points</label>
                <input
                  type="number"
                  min="0"
                  value={newPoints}
                  onChange={(e) => setNewPoints(e.target.value)}
                  className="w-full bg-dark-sidebar border border-dark-border rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-dark-muted mb-1.5 uppercase">Description</label>
                <textarea
                  rows="3"
                  placeholder="Describe details about this assignment..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full bg-dark-sidebar border border-dark-border rounded-lg px-3.5 py-2 text-sm text-white placeholder-dark-muted focus:outline-none focus:border-brand-500 resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-dark-border/40 mt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-dark-muted hover:text-white hover:bg-dark-hover transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-brand-500 hover:bg-brand-600 text-white font-medium text-xs px-4 py-2 rounded-lg transition-colors shadow-md shadow-brand-500/10"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
