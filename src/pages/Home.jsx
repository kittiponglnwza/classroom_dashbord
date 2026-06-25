import { Link } from 'react-router-dom';
import TaskStats from '../components/TaskStats';
import AssignmentCard from '../components/AssignmentCard';
import { Calendar, ArrowRight, BookOpen, Megaphone, Clock, Paperclip, ClipboardCheck, MapPin, AlertCircle } from 'lucide-react';
import { t } from '../utils/i18n';

const courseColorStyles = {
  emerald: {
    border: 'border-l-emerald-500',
    text: 'text-emerald-400 dark:text-emerald-400',
    badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  },
  blue: {
    border: 'border-l-blue-500',
    text: 'text-blue-400 dark:text-blue-400',
    badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  },
  amber: {
    border: 'border-l-amber-500',
    text: 'text-amber-400 dark:text-amber-400',
    badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  },
  rose: {
    border: 'border-l-rose-500',
    text: 'text-rose-400 dark:text-rose-400',
    badge: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  },
  purple: {
    border: 'border-l-purple-500',
    text: 'text-purple-400 dark:text-purple-400',
    badge: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  },
};

const getStyles = (color) => {
  return courseColorStyles[color] || courseColorStyles.blue;
};

import { parseExamDate } from '../utils/examDate';


export default function Home({ 
  assignments = [], 
  onStatusChange, 
  courses = [], 
  profile = {},
  resources = [],
  lang = 'en'
}) {
  // Filter out completed and get nearest due dates
  const upcomingAssignments = assignments
    .filter(a => a.status !== 'done')
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
    .slice(0, 3);

  // Get latest 3 announcements across all courses
  const recentAnnouncements = resources
    .filter(r => r.type === 'announcement')
    .sort((a, b) => new Date(b.creationTime) - new Date(a.creationTime))
    .slice(0, 3);

  // Load cached exam results at the top level of Home.jsx
  const activeEmail = (profile.email || '').toLowerCase().trim();
  const cacheKey = activeEmail ? `classroom_hub_exam_results_${activeEmail}` : 'classroom_hub_exam_results_';
  let allExams = [];
  const cachedData = localStorage.getItem(cacheKey);
  const savedSearch = localStorage.getItem('lastExamSearch');
  const hasSavedSearch = savedSearch && savedSearch.trim() !== '';

  if (cachedData) {
    try {
      const parsed = JSON.parse(cachedData);
      const examsToLoad = hasSavedSearch ? (parsed.exams || []) : [];
      allExams = [...examsToLoad, ...(parsed.manualExams || [])];
    } catch (e) {
      console.error('Failed to parse cached exam results on Home page', e);
    }
  }

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-brand-900/40 via-brand-950/20 to-dark-card border border-brand-500/20 rounded-2xl p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-heading text-white mb-2">
            {t('welcomeBack', lang, { name: profile.name || 'Student' })}
          </h1>
          {(() => {
            const pendingCount = assignments.filter(a => a.status !== 'done').length;
            return (
              <p className="text-dark-muted text-sm max-w-xl">
                {pendingCount === 0 
                  ? t('welcomeDescZero', lang) 
                  : t('welcomeDesc', lang, { count: pendingCount })}
              </p>
            );
          })()}
        </div>
        <Link 
          to="/dashboard"
          className="flex items-center justify-center gap-2 bg-brand-500 hover:bg-brand-600 text-white font-medium text-sm px-5 py-2.5 rounded-xl transition-all duration-300 shadow-md shadow-brand-500/20 self-start md:self-auto hover:translate-x-1"
        >
          {t('goDashboard', lang)}
          <ArrowRight size={16} />
        </Link>
      </div>

      {/* Task Statistics */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold font-heading text-white">{t('progressOverview', lang)}</h2>
        <TaskStats assignments={assignments} lang={lang} exams={allExams} />
      </section>

      {/* Grid: Upcoming Tasks & Quick Quotes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Upcoming Deadlines & Recent Announcements */}
        <div className="lg:col-span-2 space-y-8">
          {/* Upcoming Deadlines */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold font-heading text-white flex items-center gap-2">
                <Calendar size={18} className="text-brand-400" />
                {t('upcomingDeadlines', lang)}
              </h2>
              {assignments.filter(a => a.status !== 'done').length > 3 && (
                <Link to="/dashboard" className="text-xs text-brand-400 hover:text-brand-300 font-semibold transition-colors flex items-center gap-1">
                  {t('viewAll', lang)}
                  <ArrowRight size={12} />
                </Link>
              )}
            </div>

            {upcomingAssignments.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {upcomingAssignments.map((assignment) => (
                  <AssignmentCard
                    key={assignment.id}
                    assignment={assignment}
                    onStatusChange={onStatusChange}
                    lang={lang}
                  />
                ))}
              </div>
            ) : (
              <div className="bg-dark-card border border-dark-border border-dashed rounded-xl p-8 text-center">
                <p className="text-dark-muted text-sm">{t('noUpcoming', lang)}</p>
              </div>
            )}
          </div>

          {/* Recent Announcements */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold font-heading text-white flex items-center gap-2">
                <Megaphone size={18} className="text-amber-400" />
                {t('recentAnnouncements', lang)}
              </h2>
            </div>
            
            {recentAnnouncements.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {recentAnnouncements.map((ann) => {
                  const formattedDate = new Date(ann.creationTime).toLocaleDateString(lang === 'en' ? 'en-US' : 'th-TH', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit'
                  });
                  const styles = getStyles(ann.courseColor);

                  return (
                    <Link
                      key={ann.id}
                      to={`/courses?selected=${encodeURIComponent(ann.course)}`}
                      className={`block p-4 rounded-xl bg-dark-card/20 border border-dark-border/40 hover:bg-dark-hover/30 hover:border-dark-border transition-all duration-300 hover:translate-x-1 group border-l-4 ${styles.border} flex flex-col justify-between h-full`}
                    >
                      <div className="space-y-3 flex-1 flex flex-col justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-col gap-1">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border truncate max-w-full self-start ${styles.badge}`} title={ann.course}>
                              {ann.courseCode && ann.courseCode !== 'CLASSROOM' ? ann.courseCode : ann.course}
                            </span>
                            <span className="text-[9px] text-dark-muted font-medium flex items-center gap-1 shrink-0">
                              <Clock size={10} />
                              {formattedDate}
                            </span>
                          </div>
                          
                          <p className="text-xs text-zinc-100 group-hover:text-brand-400 font-semibold line-clamp-3 leading-relaxed transition-colors">
                            {ann.title}
                          </p>
                        </div>

                        {ann.attachments && ann.attachments.length > 0 && (
                          <div className="flex items-center gap-1 text-[10px] text-dark-muted pt-2 border-t border-dark-border/20 mt-2 font-medium">
                            <Paperclip size={10} className="shrink-0" />
                            <span>{t(ann.attachments.length === 1 ? 'attachmentsCount' : 'attachmentsCountPlural', lang, { count: ann.attachments.length })}</span>
                          </div>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="bg-dark-card border border-dark-border border-dashed rounded-xl p-8 text-center">
                <p className="text-xs text-dark-muted">{t('noAnnouncements', lang)}</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Next Exam Widget & Quick Course List */}
        <div className="space-y-6">
          {/* Next Exam Widget */}
          {(() => {
            const activeEmail = (profile.email || '').toLowerCase().trim();
            const cacheKey = activeEmail ? `classroom_hub_exam_results_${activeEmail}` : 'classroom_hub_exam_results_';
            const cachedData = localStorage.getItem(cacheKey);
            const savedSearch = localStorage.getItem('lastExamSearch');
            const hasSavedSearch = savedSearch && savedSearch.trim() !== '';
            let nextExam = null;
            let unlisted = null;
            let hasChecked = false;

            if (cachedData) {
              try {
                const parsed = JSON.parse(cachedData);
                const hasManual = parsed.manualExams && parsed.manualExams.length > 0;
                
                if (hasSavedSearch || hasManual) {
                  hasChecked = true;
                  unlisted = parsed.unlisted || null;
                  const examsToLoad = hasSavedSearch ? (parsed.exams || []) : [];
                  const exams = [...examsToLoad, ...(parsed.manualExams || [])];
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);

                  const upcomingExams = exams.filter(exam => {
                    const parsedDate = parseExamDate(exam.rawIsoDate || exam.date);
                    return parsedDate ? parsedDate >= today : true;
                  });

                  upcomingExams.sort((a, b) => {
                    const dateA = parseExamDate(a.rawIsoDate || a.date) || new Date(8640000000000000);
                    const dateB = parseExamDate(b.rawIsoDate || b.date) || new Date(8640000000000000);
                    return dateA - dateB;
                  });

                  if (upcomingExams.length > 0) {
                    nextExam = upcomingExams[0];
                  }
                }
              } catch (e) {
                console.error('Failed to parse cached exam results on Home page', e);
              }
            }

            // Case 1: Has never checked exam seating
            if (!hasChecked) {
              return (
                <div className="bg-dark-card border border-dark-border rounded-xl p-5 space-y-3 relative overflow-hidden group">
                  <div className="absolute -top-10 -right-10 w-24 h-24 bg-brand-500/5 rounded-full blur-xl pointer-events-none group-hover:bg-brand-500/10 transition-all duration-300" />
                  <div className="flex items-center justify-between border-b border-dark-border/40 pb-2.5">
                    <h3 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                      <ClipboardCheck size={14} className="text-brand-400" />
                      <span>{t('upcomingExamHeader', lang)}</span>
                    </h3>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-zinc-100 leading-snug">
                      {lang === 'en' ? 'Check your Exam Seating & Rooms' : 'ตรวจสอบตารางและที่นั่งสอบ'}
                    </p>
                    <p className="text-[11px] text-dark-muted leading-relaxed">
                      {lang === 'en' 
                        ? 'Connect to KMUTNB database to check your exam schedule, locations, and seat numbers.' 
                        : 'เชื่อมต่อฐานข้อมูล มจพ. เพื่อตรวจสอบวิชาสอบ ห้องสอบ และเลขที่นั่งสอบของคุณ'}
                    </p>
                    <Link
                      to="/exam-room"
                      className="inline-flex items-center gap-1.5 text-xs text-brand-400 hover:text-brand-300 font-semibold pt-1 transition-colors hover:translate-x-0.5"
                    >
                      {lang === 'en' ? 'Check Seating now' : 'ตรวจสอบที่นี่'}
                      <ArrowRight size={12} />
                    </Link>
                  </div>
                </div>
              );
            }

            // Case 2: Has upcoming exam
            if (nextExam) {
              return (
                <div className="bg-dark-card border border-dark-border hover:border-brand-500/20 rounded-xl p-5 space-y-3 relative overflow-hidden group transition-all duration-300">
                  {/* Subtle top indicator strip */}
                  <div className="absolute top-0 left-0 right-0 h-1 bg-brand-500/40" />
                  
                  <div className="flex items-center justify-between border-b border-dark-border/40 pb-2.5">
                    <h3 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                      <ClipboardCheck size={14} className="text-brand-400" />
                      <span>{t('upcomingExamHeader', lang)}</span>
                    </h3>
                    <Link 
                      to="/exam-room" 
                      className="text-[10px] text-brand-400 hover:text-brand-300 font-medium transition-colors"
                    >
                      {lang === 'en' ? 'View All' : 'ดูทั้งหมด'}
                    </Link>
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-1">
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/20 uppercase tracking-wide">
                        {nextExam.courseCode}
                      </span>
                      <h4 className="font-bold text-white text-xs leading-snug truncate pt-0.5" title={nextExam.courseName}>
                        {nextExam.courseName}
                      </h4>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] border-t border-dark-border/30 pt-2.5">
                      <div className="space-y-0.5">
                        <span className="text-[8px] uppercase font-bold text-dark-muted tracking-wider block">{t('dateCol', lang)}</span>
                        <span className="font-medium text-zinc-300 truncate block">{nextExam.date}</span>
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-[8px] uppercase font-bold text-dark-muted tracking-wider block">{t('timeCol', lang)}</span>
                        <span className="font-medium text-zinc-300 truncate block">{nextExam.time}</span>
                      </div>
                    </div>

                    <div className="border-t border-dark-border/30 pt-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <MapPin size={12} className="text-brand-400 shrink-0" />
                        <span className="font-medium text-zinc-300 truncate max-w-[100px]">{nextExam.room}</span>
                      </div>
                      <div className="bg-brand-500/5 border border-brand-500/20 px-2 py-0.5 rounded-lg text-right shrink-0">
                        <span className="text-[7px] uppercase font-bold text-brand-400 block tracking-wider leading-none">{t('seatCol', lang)}</span>
                        <span className="text-[10px] font-black text-white">{nextExam.seat}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            // Case 3: Unlisted / Petition status
            if (unlisted) {
              return (
                <div className="bg-rose-500/5 border border-rose-500/10 rounded-xl p-5 space-y-3 relative overflow-hidden">
                  <div className="flex items-center justify-between border-b border-rose-500/10 pb-2.5">
                    <h3 className="text-xs font-semibold text-rose-400 uppercase tracking-wider flex items-center gap-2">
                      <AlertCircle size={14} className="text-rose-400" />
                      <span>{t('upcomingExamHeader', lang)}</span>
                    </h3>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-white leading-snug">
                      {t('noSeatingAlert', lang)}
                    </p>
                    <p className="text-[11px] text-rose-400/80 leading-relaxed">
                      {lang === 'en' 
                        ? 'No exam schedule found. You might need to submit an exam petition.' 
                        : 'ไม่พบรายชื่อในระบบ มจพ. โปรดตรวจเช็คเพื่อยื่นคำร้องขอเข้าสอบ'}
                    </p>
                    <Link
                      to="/exam-room"
                      className="inline-flex items-center gap-1.5 text-xs text-rose-300 hover:text-rose-200 font-semibold pt-1 transition-colors hover:translate-x-0.5"
                    >
                      {lang === 'en' ? 'View Petition Links' : 'ดูข้อมูลวิธียื่นคำร้อง'}
                      <ArrowRight size={12} />
                    </Link>
                  </div>
                </div>
              );
            }

            // Case 4: Has checked but no exams found at all
            return (
              <div className="bg-dark-card border border-dark-border rounded-xl p-5 space-y-3 relative overflow-hidden">
                <div className="flex items-center justify-between border-b border-dark-border/40 pb-2.5">
                  <h3 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                    <ClipboardCheck size={14} className="text-dark-muted" />
                    <span>{t('upcomingExamHeader', lang)}</span>
                  </h3>
                </div>
                <div className="py-2 text-center">
                  <p className="text-xs text-dark-muted font-medium">{t('noUpcomingExams', lang)}</p>
                </div>
              </div>
            );
          })()}

          {/* Quick Course List */}
          <div className="bg-dark-card border border-dark-border rounded-xl p-5">
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider mb-4 flex items-center justify-between">
              <span>{t('mySubjects', lang)}</span>
              <BookOpen size={14} className="text-dark-muted" />
            </h3>
            <div className="space-y-3">
              {courses.slice(0, 4).map((c) => {
                const count = assignments.filter(a => a.course === c.name && a.status !== 'done').length;
                return (
                  <div key={c.id} className="flex items-center justify-between text-xs">
                    <span className="text-zinc-300 font-medium">{c.name}</span>
                    <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${
                      count > 0 ? 'bg-brand-500/10 text-brand-400 border-brand-500/20' : 'bg-zinc-800 text-dark-muted border-zinc-700'
                    }`}>
                      {t('activeCount', lang, { count })}
                    </span>
                  </div>
                );
              })}
              <Link 
                to="/courses"
                className="text-xs text-brand-400 hover:text-brand-300 font-semibold transition-colors mt-2 block text-center border-t border-dark-border pt-3"
              >
                {t('manageCourses', lang)}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
