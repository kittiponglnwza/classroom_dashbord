import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import AssignmentCard from '../components/AssignmentCard';
import { Search, Filter, ArrowUpDown, LayoutGrid, Kanban, Plus, X, RefreshCw, AlertTriangle, CalendarDays, Clock } from 'lucide-react';
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
              className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-brand-400 hover:text-brand-300 font-semibold text-xs px-5 py-3 rounded-2xl border border-white/5 transition-all duration-300 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw size={16} className={isSyncing ? 'animate-spin' : ''} />
              {t('syncClassroom', lang)}
            </button>
          )}
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 bg-brand-500 hover:bg-brand-400 text-white font-bold text-xs px-5 py-3 rounded-2xl transition-all duration-300 shadow-lg shadow-brand-500/20 hover:-translate-y-0.5 cursor-pointer"
          >
            <Plus size={18} />
            {t('createTask', lang)}
          </button>
        </div>
      </div>

      {/* Today's Schedule Widget */}
      <div className="bg-dark-card/40 backdrop-blur-xl border border-white/5 rounded-3xl p-6 lg:p-8 shadow-2xl opacity-0 animate-fade-in relative overflow-hidden group hover:border-brand-500/20 transition-all duration-500" style={{ animationDelay: '150ms' }}>
        <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity duration-500 pointer-events-none">
          <CalendarDays size={100} className="text-brand-500 blur-2xl group-hover:blur-xl transition-all" />
        </div>

        <div className="flex items-center justify-between mb-6 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-500/10 flex items-center justify-center">
              <CalendarDays size={20} className="text-brand-400" />
            </div>
            <h3 className="text-sm font-bold text-white tracking-wide">{t('todaySchedule', lang)}</h3>
          </div>
          <Link
            to="/schedule"
            className="text-xs font-bold text-brand-400 hover:text-white transition-colors flex items-center gap-1"
          >
            {t('viewFullSchedule', lang)}
          </Link>
        </div>

        <div className="relative z-10">
          {todayClasses.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {todayClasses.map(cls => (
                <div
                  key={cls.id}
                  className="flex items-center justify-between bg-white/5 border border-white/5 rounded-2xl p-4 hover:bg-white/10 hover:border-white/10 transition-all duration-300 group/item"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-1.5 h-10 rounded-full shrink-0 group-hover/item:scale-y-110 transition-transform" style={{ backgroundColor: cls.color }} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-bold text-white truncate">{cls.title}</p>
                        {cls.date && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
                            {lang === 'en' ? 'Once' : 'พิเศษ'}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-zinc-400 font-medium">
                        <span className="flex items-center gap-1.5">
                          <Clock size={12} className="text-zinc-500" />
                          {cls.startTime} - {cls.endTime}
                        </span>
                        {cls.room && (
                          <span className="bg-black/30 px-2 py-0.5 rounded-full text-[10px] text-zinc-300">{cls.room}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-6 text-center bg-white/5 border border-white/5 rounded-2xl">
              <p className="text-sm text-zinc-400 font-medium">{t('noClassesToday', lang)}</p>
            </div>
          )}
        </div>
      </div>

      {/* Control Bar: Filters, Search, Views */}
      {/* Control Bar: Filters, Search, Views */}
      <div className="bg-dark-card/30 backdrop-blur-md border border-white/5 rounded-3xl p-4 lg:p-5 flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between opacity-0 animate-fade-in" style={{ animationDelay: '250ms' }}>
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-dark-muted">
            <Search size={18} />
          </span>
          <input
            type="text"
            placeholder={t('searchPlaceholder', lang)}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/5 border border-white/5 rounded-2xl pl-11 pr-4 py-3 text-sm text-white placeholder-dark-muted focus:outline-none focus:border-brand-500 focus:bg-white/10 transition-all duration-300"
          />
        </div>

        {/* Filters and Sorting */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-white/5 border border-white/5 px-3 py-2.5 rounded-2xl transition-all hover:bg-white/10">
            <Filter size={16} className="text-zinc-400" />
            <select
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              className="bg-transparent text-sm text-zinc-200 focus:outline-none cursor-pointer pr-1"
            >
              <option value="all">{t('allSubjects', lang)}</option>
              {visibleCourses.map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>

          {viewType !== 'kanban' && (
            <div className="flex items-center gap-2 bg-white/5 border border-white/5 px-3 py-2.5 rounded-2xl transition-all hover:bg-white/10">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="bg-transparent text-sm text-zinc-200 focus:outline-none cursor-pointer"
              >
                <option value="all">{t('allStatuses', lang)}</option>
                <option value="todo">{t('todo', lang)}</option>
                <option value="doing">{t('doing', lang)}</option>
                <option value="done">{t('done', lang)}</option>
              </select>
            </div>
          )}

          <div className="flex items-center gap-2 bg-white/5 border border-white/5 px-3 py-2.5 rounded-2xl transition-all hover:bg-white/10">
            <ArrowUpDown size={16} className="text-zinc-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-transparent text-sm text-zinc-200 focus:outline-none cursor-pointer"
            >
              <option value="due-asc">{t('sortByDueAsc', lang)}</option>
              <option value="due-desc">{t('sortByDueDesc', lang)}</option>
              <option value="points-desc">{t('sortByPointsDesc', lang)}</option>
            </select>
          </div>

          <div className="flex items-center border border-white/5 rounded-2xl p-1 bg-white/5 ml-auto md:ml-0">
            <button
              onClick={() => setViewType('grid')}
              className={`p-2 rounded-xl transition-all duration-300 ${viewType === 'grid' ? 'bg-white/10 text-brand-400 shadow-sm' : 'text-zinc-400 hover:text-white'}`}
              title="Grid View"
            >
              <LayoutGrid size={18} />
            </button>
            <button
              onClick={() => setViewType('kanban')}
              className={`p-2 rounded-xl transition-all duration-300 ${viewType === 'kanban' ? 'bg-white/10 text-brand-400 shadow-sm' : 'text-zinc-400 hover:text-white'}`}
              title="Kanban Board"
            >
              <Kanban size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Critical Rows (Only visible in Grid view to keep board columns clean) */}
      {viewType === 'grid' && (
        <div className="space-y-6">
          {overdueTasks.length > 0 && (
            <div className="space-y-4 bg-rose-500/5 backdrop-blur-md border border-rose-500/10 rounded-3xl p-6 lg:p-8 opacity-0 animate-fade-in" style={{ animationDelay: '350ms' }}>
              <h3 className="text-sm font-bold text-rose-400 flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-rose-500/10 flex items-center justify-center">
                  <AlertTriangle size={16} className="animate-bounce" />
                </div>
                {t('overdueTasksTitle', lang)}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {overdueTasks.map(task => (
                  <AssignmentCard key={task.id} assignment={task} onStatusChange={handleStatusChange} lang={lang} />
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {todayTasks.map(task => (
                  <AssignmentCard key={task.id} assignment={task} onStatusChange={handleStatusChange} lang={lang} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Grid View */}
      {viewType === 'grid' && (
        <div className="space-y-5 opacity-0 animate-fade-in" style={{ animationDelay: '450ms' }}>
          <h3 className="text-sm font-bold text-zinc-300 flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-brand-500"></span>
            {t('allCourseAssignments', lang, { count: sortedAssignments.length })}
          </h3>
          {sortedAssignments.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
            <div className="bg-dark-card/30 backdrop-blur-md border border-white/5 rounded-3xl p-16 text-center shadow-lg">
              <p className="text-zinc-400 text-sm font-medium">{t('noAssignmentsFound', lang)}</p>
            </div>
          )}
        </div>
      )}

      {/* Kanban Board View */}
      {viewType === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 opacity-0 animate-fade-in" style={{ animationDelay: '350ms' }}>
          <div className="bg-dark-card/30 backdrop-blur-xl border border-white/5 rounded-3xl p-5 lg:p-6 flex flex-col h-full min-h-[500px] shadow-lg">
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
                <AssignmentCard key={task.id} assignment={task} onStatusChange={handleStatusChange} lang={lang} />
              ))}
              {todoTasks.length === 0 && (
                <div className="border border-white/10 border-dashed rounded-2xl p-8 text-center text-sm font-medium text-zinc-500 py-12">
                  {t('emptyColumn', lang)}
                </div>
              )}
            </div>
          </div>

          <div className="bg-dark-card/30 backdrop-blur-xl border border-white/5 rounded-3xl p-5 lg:p-6 flex flex-col h-full min-h-[500px] shadow-lg">
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
                <AssignmentCard key={task.id} assignment={task} onStatusChange={handleStatusChange} lang={lang} />
              ))}
              {doingTasks.length === 0 && (
                <div className="border border-white/10 border-dashed rounded-2xl p-8 text-center text-sm font-medium text-zinc-500 py-12">
                  {t('emptyColumn', lang)}
                </div>
              )}
            </div>
          </div>

          <div className="bg-dark-card/30 backdrop-blur-xl border border-white/5 rounded-3xl p-5 lg:p-6 flex flex-col h-full min-h-[500px] shadow-lg">
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
                <AssignmentCard key={task.id} assignment={task} onStatusChange={handleStatusChange} lang={lang} />
              ))}
              {doneTasks.length === 0 && (
                <div className="border border-white/10 border-dashed rounded-2xl p-8 text-center text-sm font-medium text-zinc-500 py-12">
                  {t('emptyColumn', lang)}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Task Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-dark-card border border-white/10 rounded-3xl w-full max-w-lg overflow-hidden animate-fade-in relative shadow-[0_0_40px_rgba(0,0,0,0.5)]">
            <div className="flex items-center justify-between p-6 border-b border-white/5">
              <h3 className="font-bold text-xl text-white tracking-tight">{t('createTaskTitle', lang)}</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-400 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div className="space-y-1.5 group/input relative">
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider group-focus-within/input:text-brand-400 transition-colors">{lang === 'en' ? 'Title *' : 'หัวข้อการบ้าน *'}</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Linux Lab 5"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-transparent border-b border-white/20 pb-2 pt-1 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-brand-500 transition-all rounded-none"
                />
                <div className="absolute bottom-0 left-0 h-[2px] w-0 bg-brand-500 transition-all duration-300 group-focus-within/input:w-full"></div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1.5 group/input relative">
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider group-focus-within/input:text-brand-400 transition-colors">{lang === 'en' ? 'Subject *' : 'วิชา *'}</label>
                  <select
                    value={newCourse}
                    onChange={(e) => setNewCourse(e.target.value)}
                    className="w-full bg-transparent border-b border-white/20 pb-2 pt-1 text-sm text-white focus:outline-none focus:border-brand-500 cursor-pointer transition-all rounded-none"
                  >
                    {visibleCourses.map(c => (
                      <option key={c.id} value={c.name} className="bg-dark-sidebar">{c.name}</option>
                    ))}
                  </select>
                  <div className="absolute bottom-0 left-0 h-[2px] w-0 bg-brand-500 transition-all duration-300 group-focus-within/input:w-full"></div>
                </div>
                <div className="space-y-1.5 group/input relative">
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider group-focus-within/input:text-brand-400 transition-colors">{lang === 'en' ? 'Due Date *' : 'กำหนดส่ง *'}</label>
                  <input
                    type="date"
                    required
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="w-full bg-transparent border-b border-white/20 pb-2 pt-1 text-sm text-white focus:outline-none focus:border-brand-500 cursor-pointer transition-all rounded-none"
                  />
                  <div className="absolute bottom-0 left-0 h-[2px] w-0 bg-brand-500 transition-all duration-300 group-focus-within/input:w-full"></div>
                </div>
              </div>

              <div className="space-y-1.5 group/input relative">
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider group-focus-within/input:text-brand-400 transition-colors">{lang === 'en' ? 'Points' : 'คะแนนเต็ม'}</label>
                <input
                  type="number"
                  min="0"
                  value={newPoints}
                  onChange={(e) => setNewPoints(e.target.value)}
                  className="w-full bg-transparent border-b border-white/20 pb-2 pt-1 text-sm text-white focus:outline-none focus:border-brand-500 transition-all rounded-none"
                />
                <div className="absolute bottom-0 left-0 h-[2px] w-0 bg-brand-500 transition-all duration-300 group-focus-within/input:w-full"></div>
              </div>

              <div className="space-y-1.5 group/input relative">
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider group-focus-within/input:text-brand-400 transition-colors">{lang === 'en' ? 'Description' : 'คำอธิบาย'}</label>
                <textarea
                  rows="3"
                  placeholder={lang === 'en' ? 'Describe details about this assignment...' : 'อธิบายรายละเอียดของการบ้านนี้...'}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full bg-transparent border-b border-white/20 pb-2 pt-1 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-brand-500 resize-none transition-all rounded-none"
                />
                <div className="absolute bottom-0 left-0 h-[2px] w-0 bg-brand-500 transition-all duration-300 group-focus-within/input:w-full"></div>
              </div>

              <div className="flex justify-end gap-3 pt-6 mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-3 rounded-2xl text-sm font-bold text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
                >
                  {lang === 'en' ? 'Cancel' : 'ยกเลิก'}
                </button>
                <button
                  type="submit"
                  className="bg-brand-500 hover:bg-brand-400 text-white font-bold text-sm px-6 py-3 rounded-2xl transition-all duration-300 shadow-lg shadow-brand-500/20 hover:-translate-y-0.5"
                >
                  {lang === 'en' ? 'Create Task' : 'สร้างงาน'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
