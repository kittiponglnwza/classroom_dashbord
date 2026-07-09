import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import TaskStats from '../components/TaskStats';
import AssignmentCard from '../components/AssignmentCard';
import { Calendar, ArrowRight, BookOpen, Megaphone, Clock, Paperclip, ClipboardCheck, MapPin, AlertCircle, CalendarDays } from 'lucide-react';
import { t } from '../utils/i18n';
import { parseExamDate } from '../utils/examDate';
import { getCourseBadgeColor } from '../utils/colors';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { useClassroom } from '../contexts/ClassroomContext';

const getBorderLeftColor = (color) => {
  switch(color) {
    case 'emerald': return 'border-l-emerald-500';
    case 'blue': return 'border-l-blue-500';
    case 'amber': return 'border-l-amber-500';
    case 'rose': return 'border-l-rose-500';
    case 'purple': return 'border-l-purple-500';
    default: return 'border-l-zinc-500';
  }
};

export default function Home() {
  const { profile } = useAuth();
  const { lang } = useSettings();
  const { visibleAssignments, visibleCourses, visibleResources, handleStatusChange, schedule } = useClassroom();

  // Filter out completed and get nearest due dates
  const upcomingAssignments = visibleAssignments
    .filter(a => a.status !== 'done')
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
    .slice(0, 3);

  // Get latest 3 announcements across all courses
  const recentAnnouncements = visibleResources
    .filter(r => r.type === 'announcement')
    .sort((a, b) => new Date(b.creationTime) - new Date(a.creationTime))
    .slice(0, 3);

  // Compute Today's Classes
  const todayClasses = useMemo(() => {
    if (!schedule) return [];
    const JS_DAY_MAP = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const today = new Date();
    const todayKey = JS_DAY_MAP[today.getDay()];
    // Local date string YYYY-MM-DD
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    const todayDateStr = `${y}-${m}-${d}`;

    return schedule.filter(entry => {
      if (entry.date) return entry.date === todayDateStr;
      return entry.day === todayKey;
    }).sort((a, b) => {
      const [hA, mA] = a.startTime.split(':').map(Number);
      const [hB, mB] = b.startTime.split(':').map(Number);
      return (hA * 60 + mA) - (hB * 60 + mB);
    });
  }, [schedule]);

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
      <div className="relative overflow-hidden bg-gradient-to-br from-brand-900/40 via-dark-card to-dark-card border border-brand-500/20 rounded-2xl p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-lg shadow-black/20 group">
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-brand-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-brand-500/20 transition-all duration-700" />
        <div className="relative z-10">
          <h1 className="text-2xl md:text-3xl font-bold font-heading text-white mb-2">
            {t('welcomeBack', lang, { name: profile.name || 'Student' })}
          </h1>
          {(() => {
            const pendingCount = visibleAssignments.filter(a => a.status !== 'done').length;
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
          className="relative z-10 flex items-center justify-center gap-2 bg-brand-500 hover:bg-brand-400 text-white font-semibold text-sm px-6 py-3 rounded-xl transition-all duration-300 shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:shadow-[0_0_30px_rgba(59,130,246,0.5)] self-start md:self-auto hover:-translate-y-0.5"
        >
          {t('goDashboard', lang)}
          <ArrowRight size={16} />
        </Link>
      </div>

      {/* Task Statistics */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold font-heading text-white">{t('progressOverview', lang)}</h2>
        <TaskStats assignments={visibleAssignments} lang={lang} exams={allExams} />
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
              {visibleAssignments.filter(a => a.status !== 'done').length > 3 && (
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
                    onStatusChange={handleStatusChange}
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
                  const borderLeft = getBorderLeftColor(ann.courseColor);
                  const badgeClasses = getCourseBadgeColor(ann.courseColor);

                  return (
                    <Link
                      key={ann.id}
                      to={`/courses?selected=${encodeURIComponent(ann.course)}`}
                      className={`block p-4 rounded-xl bg-dark-card/20 border border-dark-border/40 hover:bg-dark-hover/30 hover:border-dark-border transition-all duration-300 hover:translate-x-1 group border-l-4 ${borderLeft} flex flex-col justify-between h-full`}
                    >
                      <div className="space-y-3 flex-1 flex flex-col justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-col gap-1">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border truncate max-w-full self-start ${badgeClasses}`} title={ann.course}>
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
          {/* Today's Classes Widget */}
          <div className="bg-dark-card border border-dark-border rounded-xl p-5 space-y-4 shadow-sm shadow-black/20">
            <div className="flex items-center justify-between border-b border-dark-border/40 pb-2.5">
              <h3 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                <CalendarDays size={14} className="text-brand-400" />
                <span>{lang === 'en' ? "Today's Classes" : 'ตารางเรียนวันนี้'}</span>
              </h3>
              <Link to="/schedule" className="text-[10px] text-brand-400 hover:text-brand-300 font-medium transition-colors">
                {lang === 'en' ? 'View Schedule' : 'ดูตารางเรียน'}
              </Link>
            </div>
            
            {todayClasses.length > 0 ? (
              <div className="space-y-3">
                {todayClasses.map((cls, idx) => {
                  const borderLeft = getBorderLeftColor(cls.color || 'blue');
                  return (
                  <div key={idx} className={`flex items-start gap-3 p-3.5 rounded-xl bg-dark-card/40 border border-dark-border/40 hover:bg-dark-hover/30 hover:border-dark-border transition-all duration-300 hover:-translate-y-0.5 group border-l-4 ${borderLeft} shadow-sm`}>
                    <div className="flex flex-col items-center justify-center shrink-0 w-12 h-12 rounded-lg bg-dark-bg/50 border border-dark-border/50 text-brand-400 group-hover:scale-105 transition-transform">
                      <span className="text-[11px] font-bold leading-none">{cls.startTime}</span>
                      <span className="text-[9px] font-medium text-dark-muted mt-1.5 leading-none">{cls.endTime}</span>
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-center h-12">
                      <div className="flex items-center gap-2">
                        {cls.courseCode && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-dark-bg/80 text-zinc-300 border border-dark-border truncate max-w-[80px]" title={cls.courseCode}>
                            {cls.courseCode}
                          </span>
                        )}
                        <h4 className="text-xs font-bold text-white truncate flex-1 group-hover:text-brand-300 transition-colors" title={cls.title || cls.courseName}>{cls.title || cls.courseName}</h4>
                      </div>
                      <p className="text-[10px] text-dark-muted truncate mt-1.5 flex items-center gap-1 group-hover:text-zinc-300 transition-colors">
                        <MapPin size={10} className="shrink-0" />
                        {cls.room || (lang === 'en' ? 'TBA' : 'ไม่ระบุห้อง')}
                      </p>
                    </div>
                  </div>
                )})}
              </div>
            ) : (
              <div className="py-6 text-center border border-dashed border-dark-border/60 rounded-xl bg-dark-bg/30">
                <p className="text-xs text-dark-muted font-medium flex items-center justify-center gap-2">
                  <span>🎉</span> {lang === 'en' ? 'No classes today! Enjoy your day.' : 'วันนี้ไม่มีเรียน! พักผ่อนให้เต็มที่'}
                </p>
              </div>
            )}
          </div>

          {/* Next Exam Widget */}
          {(() => {
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

            if (nextExam) {
              return (
                <div className="bg-dark-card border border-dark-border hover:border-brand-500/20 rounded-xl p-5 space-y-3 relative overflow-hidden group transition-all duration-300">
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
          <div className="bg-dark-card border border-dark-border rounded-xl p-5 shadow-sm shadow-black/20 group">
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider mb-4 flex items-center justify-between">
              <span>{t('mySubjects', lang)}</span>
              <BookOpen size={14} className="text-dark-muted group-hover:text-brand-400 transition-colors" />
            </h3>
            <div className="space-y-2">
              {visibleCourses.slice(0, 4).map((c) => {
                const count = visibleAssignments.filter(a => a.course === c.name && a.status !== 'done').length;
                return (
                  <div key={c.id} className="flex items-center justify-between text-xs p-2.5 rounded-lg hover:bg-dark-hover/30 transition-colors group/row">
                    <span className="text-zinc-300 font-medium truncate pr-3 group-hover/row:text-white transition-colors flex-1" title={c.name}>{c.name}</span>
                    <span className={`px-2.5 py-1 rounded-full border text-[10px] font-bold shrink-0 shadow-sm ${
                      count > 0 ? 'bg-brand-500/15 text-brand-400 border-brand-500/30' : 'bg-dark-bg text-zinc-400 border-dark-border/60'
                    }`}>
                      {t('activeCount', lang, { count })}
                    </span>
                  </div>
                );
              })}
              <div className="pt-3 mt-1 border-t border-dark-border/50">
                <Link 
                  to="/courses"
                  className="flex items-center justify-center gap-1.5 text-xs text-zinc-400 hover:text-white bg-dark-bg/50 hover:bg-brand-500/10 border border-transparent hover:border-brand-500/20 font-semibold transition-all py-2 rounded-lg"
                >
                  {t('manageCourses', lang)}
                  <ArrowRight size={12} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
