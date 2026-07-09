import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import AssignmentCard from '../components/AssignmentCard';
import { Search, Filter, ArrowUpDown, LayoutGrid, Kanban, Plus, X, RefreshCw, AlertTriangle, CalendarDays, Clock, BookOpen } from 'lucide-react';
import { t } from '../utils/i18n';
import { isDueToday, isOverdue } from '../utils/dateUtils';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { useClassroom } from '../contexts/ClassroomContext';
import { examRepository } from '../repositories/examRepository';
import { parseExamDate } from '../utils/examDate';

// JS day index (0=Sun) → our day key
const JS_DAY_MAP = [null, 'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export default function Dashboard() {
  const { isLoggedIn, profile } = useAuth();
  const { lang } = useSettings();
  const { visibleAssignments, visibleCourses, schedule, handleStatusChange, handleAddAssignment, isSyncing, syncClassroom } = useClassroom();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [sortBy, setSortBy] = useState('due-asc');
  const [viewType, setViewType] = useState('grid');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State for new assignment
  const [newTitle, setNewTitle] = useState('');
  const [newCourse, setNewCourse] = useState(visibleCourses[0]?.name || '');
  const [newDueDate, setNewDueDate] = useState('');
  const [newPoints, setNewPoints] = useState(100);
  const [newDescription, setNewDescription] = useState('');

  // Compute today's schedule including one-off class overrides and exam integrations
  const todayClasses = useMemo(() => {
    const d = new Date().getDay(); // 0=Sun
    const todayKey = d === 0 ? 'sun' : JS_DAY_MAP[d];
    const todayDateStr = new Date().toISOString().split('T')[0];
    const activeEmail = (profile?.email || '').toLowerCase().trim();

    // 1. Load cached exams
    let examEntries = [];
    if (activeEmail) {
      const cachedResult = examRepository.getCachedExams(activeEmail);
      if (cachedResult.success && cachedResult.data) {
        const examList = cachedResult.data.exams || [];
        const manualExamList = cachedResult.data.manualExams || [];
        const allExams = [...examList, ...manualExamList];

        examEntries = allExams.map(ex => {
          let startTime = '09:00';
          let endTime = '12:00';
          if (ex.time) {
            const parts = ex.time.split('-').map(s => s.trim());
            if (parts.length === 2) {
              startTime = parts[0];
              endTime = parts[1];
            }
          }

          let dateVal = '';
          if (ex.rawIsoDate) {
            dateVal = ex.rawIsoDate.split('T')[0];
          } else if (ex.date) {
            const parsed = parseExamDate(ex.date);
            if (parsed) {
              dateVal = parsed.toISOString().split('T')[0];
            }
          }

          if (!dateVal) return null;

          const ed = new Date(dateVal);
          const dayIndex = ed.getDay();
          const dayKey = dayIndex === 0 ? 'sun' : JS_DAY_MAP[dayIndex];

          return {
            id: `exam-${ex.id}`,
            title: ex.subjectName || ex.courseName || 'Exam',
            courseCode: ex.subjectCode || ex.courseCode || '',
            day: dayKey,
            date: dateVal,
            startTime,
            endTime,
            room: ex.room ? `${ex.room} ${ex.seat ? `(${ex.seat})` : ''}` : '',
            color: '#ef4444', // Red for exams
            notes: ex.seat ? `Seat/Row: ${ex.seat}` : '',
            isExam: true
          };
        }).filter(Boolean);
      }
    }

    // 2. Separate today's exams and today's classes
    const todayExams = examEntries.filter(entry => entry.day === todayKey && entry.date === todayDateStr);
    const todayRegular = (schedule || []).filter(entry => entry.day === todayKey && (!entry.date || entry.date === todayDateStr));

    // 3. Override class if exam for the same course is today
    const filteredRegular = todayRegular.filter(regEntry => {
      const hasConflict = todayExams.some(exam => {
        // 1. Match by code or title
        const codeMatch = regEntry.courseCode && exam.courseCode && 
          regEntry.courseCode.toLowerCase().trim() === exam.courseCode.toLowerCase().trim();
          
        const titleMatch = regEntry.title && exam.title && 
          regEntry.title.toLowerCase().trim() === exam.title.toLowerCase().trim();
          
        if (codeMatch || titleMatch) return true;

        // 2. Match by time overlap
        const [regHStart, regMStart] = regEntry.startTime.split(':').map(Number);
        const [regHEnd, regMEnd] = regEntry.endTime.split(':').map(Number);
        const [examHStart, examMStart] = exam.startTime.split(':').map(Number);
        const [examHEnd, examMEnd] = exam.endTime.split(':').map(Number);

        const startReg = regHStart * 60 + regMStart;
        const endReg = regHEnd * 60 + regMEnd;
        const startExam = examHStart * 60 + examMStart;
        const endExam = examHEnd * 60 + examMEnd;

        return startReg < endExam && endReg > startExam;
      });
      return !hasConflict;
    });

    return [...filteredRegular, ...todayExams]
      .sort((a, b) => {
        const [aH, aM] = a.startTime.split(':').map(Number);
        const [bH, bM] = b.startTime.split(':').map(Number);
        return (aH * 60 + aM) - (bH * 60 + bM);
      });
  }, [schedule, profile]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!newTitle || !newCourse || !newDueDate) return;

    const courseObj = visibleCourses.find(c => c.name === newCourse);
    const color = courseObj ? courseObj.color : 'blue';

    // Format newDueDate to date with end of day time
    const formattedDueDate = `${newDueDate}T23:59:59`;

    handleAddAssignment({
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
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-heading text-white">{t('assignmentsTitle', lang)}</h1>
          <p className="text-xs text-dark-muted">{t('assignmentsDesc', lang)}</p>
        </div>
        <div className="flex items-center gap-3">
          {isLoggedIn && (
            <button
              onClick={syncClassroom}
              disabled={isSyncing}
              className="flex items-center gap-1.5 bg-dark-card hover:bg-dark-hover text-brand-400 hover:text-brand-300 font-semibold text-xs px-4 py-2.5 rounded-lg border border-dark-border transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
              {t('syncClassroom', lang)}
            </button>
          )}
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white font-semibold text-xs px-4 py-2.5 rounded-lg transition-colors shadow-md shadow-brand-500/10 cursor-pointer"
          >
            <Plus size={16} />
            {t('createTask', lang)}
          </button>
        </div>
      </div>

      {/* Today's Schedule Widget */}
      <div className="bg-dark-card/20 border border-dark-border/30 rounded-2xl p-5 shadow-lg animate-fade-in relative overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CalendarDays size={16} className="text-brand-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">{t('todaySchedule', lang)}</h3>
          </div>
          <Link
            to="/schedule"
            className="text-[10px] font-bold text-brand-400 hover:text-brand-300 transition-colors uppercase tracking-wider"
          >
            {t('viewFullSchedule', lang)}
          </Link>
        </div>

        {todayClasses.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {todayClasses.map(cls => (
              <div
                key={cls.id}
                className="flex items-center justify-between bg-dark-sidebar/40 border border-dark-border/40 rounded-xl p-3 hover:border-brand-500/20 transition-all"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-1.5 h-8 rounded-full shrink-0" style={{ backgroundColor: cls.color }} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-bold text-white truncate leading-tight">{cls.title}</p>
                      {cls.date && (
                        <span className="text-[7.5px] px-1 py-0.25 rounded font-extrabold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0 select-none">
                          {lang === 'en' ? 'Once' : 'พิเศษ'}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-dark-muted font-mono font-medium">
                      <span className="flex items-center gap-1">
                        <Clock size={10} />
                        {cls.startTime} - {cls.endTime}
                      </span>
                      {cls.room && (
                        <span className="bg-dark-bg/60 px-1 py-0.25 rounded">{cls.room}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-3 text-center bg-dark-sidebar/10 border border-dark-border/20 rounded-xl">
            <p className="text-xs text-dark-muted font-semibold">{t('noClassesToday', lang)}</p>
          </div>
        )}
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
            placeholder={t('searchPlaceholder', lang)}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-dark-sidebar border border-dark-border rounded-lg pl-9 pr-4 py-2 text-xs text-white placeholder-dark-muted focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20 transition-all"
          />
        </div>

        {/* Filters and Sorting */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 bg-dark-sidebar border border-dark-border px-2.5 py-1.5 rounded-lg">
            <Filter size={13} className="text-dark-muted" />
            <select
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              className="bg-transparent text-xs text-zinc-200 focus:outline-none cursor-pointer pr-1"
            >
              <option value="all">{t('allSubjects', lang)}</option>
              {visibleCourses.map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>

          {viewType !== 'kanban' && (
            <div className="flex items-center gap-1.5 bg-dark-sidebar border border-dark-border px-2.5 py-1.5 rounded-lg">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="bg-transparent text-xs text-zinc-200 focus:outline-none cursor-pointer"
              >
                <option value="all">{t('allStatuses', lang)}</option>
                <option value="todo">{t('todo', lang)}</option>
                <option value="doing">{t('doing', lang)}</option>
                <option value="done">{t('done', lang)}</option>
              </select>
            </div>
          )}

          <div className="flex items-center gap-1.5 bg-dark-sidebar border border-dark-border px-2.5 py-1.5 rounded-lg">
            <ArrowUpDown size={13} className="text-dark-muted" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-transparent text-xs text-zinc-200 focus:outline-none cursor-pointer"
            >
              <option value="due-asc">{t('sortByDueAsc', lang)}</option>
              <option value="due-desc">{t('sortByDueDesc', lang)}</option>
              <option value="points-desc">{t('sortByPointsDesc', lang)}</option>
            </select>
          </div>

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
          {overdueTasks.length > 0 && (
            <div className="space-y-3 bg-rose-500/5 border border-rose-500/10 rounded-2xl p-5">
              <h3 className="text-xs font-bold text-rose-400 flex items-center gap-2 uppercase tracking-wider">
                <AlertTriangle size={15} className="animate-bounce" />
                {t('overdueTasksTitle', lang)}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {overdueTasks.map(task => (
                  <AssignmentCard key={task.id} assignment={task} onStatusChange={handleStatusChange} lang={lang} />
                ))}
              </div>
            </div>
          )}

          {todayTasks.length > 0 && (
            <div className="space-y-3 bg-amber-500/5 border border-amber-500/10 rounded-2xl p-5">
              <h3 className="text-xs font-bold text-amber-400 flex items-center gap-2 uppercase tracking-wider">
                <AlertTriangle size={15} />
                {t('dueTodayTitle', lang)}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {todayTasks.map(task => (
                  <AssignmentCard key={task.id} assignment={task} onStatusChange={handleStatusChange} lang={lang} />
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
            {t('allCourseAssignments', lang, { count: sortedAssignments.length })}
          </h3>
          {sortedAssignments.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {sortedAssignments.map((assignment) => (
                <AssignmentCard
                  key={assignment.id}
                  assignment={assignment}
                  onStatusChange={handleStatusChange}
                  lang={lang}
                />
              ))}
            </div>
          ) : (
            <div className="bg-dark-card border border-dark-border rounded-xl p-12 text-center">
              <p className="text-dark-muted text-sm">{t('noAssignmentsFound', lang)}</p>
            </div>
          )}
        </div>
      )}

      {/* Kanban Board View */}
      {viewType === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-dark-sidebar/40 border border-dark-border/60 rounded-xl p-4 flex flex-col h-full min-h-[500px]">
            <div className="flex items-center justify-between mb-4 border-b border-dark-border pb-2.5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-zinc-400" />
                <span className="font-semibold text-sm text-white">{t('todo', lang)}</span>
              </div>
              <span className="bg-zinc-800 text-zinc-300 text-xs px-2 py-0.5 rounded-full font-bold">
                {todoTasks.length}
              </span>
            </div>
            <div className="space-y-4 overflow-y-auto flex-1 max-h-[600px] pr-1">
              {todoTasks.map(task => (
                <AssignmentCard key={task.id} assignment={task} onStatusChange={handleStatusChange} lang={lang} />
              ))}
              {todoTasks.length === 0 && (
                <div className="border border-dark-border/40 border-dashed rounded-lg p-5 text-center text-xs text-dark-muted py-8">
                  {t('emptyColumn', lang)}
                </div>
              )}
            </div>
          </div>

          <div className="bg-dark-sidebar/40 border border-dark-border/60 rounded-xl p-4 flex flex-col h-full min-h-[500px]">
            <div className="flex items-center justify-between mb-4 border-b border-dark-border pb-2.5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <span className="font-semibold text-sm text-white">{t('doing', lang)}</span>
              </div>
              <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs px-2 py-0.5 rounded-full font-bold">
                {doingTasks.length}
              </span>
            </div>
            <div className="space-y-4 overflow-y-auto flex-1 max-h-[600px] pr-1">
              {doingTasks.map(task => (
                <AssignmentCard key={task.id} assignment={task} onStatusChange={handleStatusChange} lang={lang} />
              ))}
              {doingTasks.length === 0 && (
                <div className="border border-dark-border/40 border-dashed rounded-lg p-5 text-center text-xs text-dark-muted py-8">
                  {t('emptyColumn', lang)}
                </div>
              )}
            </div>
          </div>

          <div className="bg-dark-sidebar/40 border border-dark-border/60 rounded-xl p-4 flex flex-col h-full min-h-[500px]">
            <div className="flex items-center justify-between mb-4 border-b border-dark-border pb-2.5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                <span className="font-semibold text-sm text-white">{t('completed', lang)}</span>
              </div>
              <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs px-2 py-0.5 rounded-full font-bold">
                {doneTasks.length}
              </span>
            </div>
            <div className="space-y-4 overflow-y-auto flex-1 max-h-[600px] pr-1">
              {doneTasks.map(task => (
                <AssignmentCard key={task.id} assignment={task} onStatusChange={handleStatusChange} lang={lang} />
              ))}
              {doneTasks.length === 0 && (
                <div className="border border-dark-border/40 border-dashed rounded-lg p-5 text-center text-xs text-dark-muted py-8">
                  {t('emptyColumn', lang)}
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
              <h3 className="font-semibold font-heading text-lg text-white">{t('createTaskTitle', lang)}</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-dark-muted hover:text-white p-1 rounded-lg hover:bg-dark-hover transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-dark-muted mb-1.5 uppercase">{lang === 'en' ? 'Title *' : 'หัวข้อการบ้าน *'}</label>
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
                  <label className="block text-xs font-semibold text-dark-muted mb-1.5 uppercase">{lang === 'en' ? 'Subject *' : 'วิชา *'}</label>
                  <select
                    value={newCourse}
                    onChange={(e) => setNewCourse(e.target.value)}
                    className="w-full bg-dark-sidebar border border-dark-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500 cursor-pointer"
                  >
                    {visibleCourses.map(c => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-dark-muted mb-1.5 uppercase">{lang === 'en' ? 'Due Date *' : 'กำหนดส่ง *'}</label>
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
                <label className="block text-xs font-semibold text-dark-muted mb-1.5 uppercase">{lang === 'en' ? 'Points' : 'คะแนนเต็ม'}</label>
                <input
                  type="number"
                  min="0"
                  value={newPoints}
                  onChange={(e) => setNewPoints(e.target.value)}
                  className="w-full bg-dark-sidebar border border-dark-border rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-dark-muted mb-1.5 uppercase">{lang === 'en' ? 'Description' : 'คำอธิบาย'}</label>
                <textarea
                  rows="3"
                  placeholder={lang === 'en' ? 'Describe details about this assignment...' : 'อธิบายรายละเอียดของการบ้านนี้...'}
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
                  {lang === 'en' ? 'Cancel' : 'ยกเลิก'}
                </button>
                <button
                  type="submit"
                  className="bg-brand-500 hover:bg-brand-600 text-white font-medium text-xs px-4 py-2 rounded-lg transition-colors shadow-md shadow-brand-500/10"
                >
                  {lang === 'en' ? 'Create' : 'สร้าง'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
