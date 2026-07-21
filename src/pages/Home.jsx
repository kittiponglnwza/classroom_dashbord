import { useMemo, useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import TaskStats from '../components/TaskStats';
import AssignmentCard from '../components/AssignmentCard';
import { Calendar, ArrowRight, BookOpen, Megaphone, Clock, Paperclip, ClipboardCheck, MapPin, AlertCircle, CalendarDays } from 'lucide-react';
import { t } from '../utils/i18n';
import { parseExamDate } from '../utils/examDate';
import { getCourseBadgeColor } from '../utils/colors';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';

import { syncManager } from '../services/SyncManager';
import { calendarSyncManager } from '../services/CalendarSyncManager';
import { getToken } from '../utils/storage';
import { useClassroom } from '../contexts/ClassroomContext';
import { examRepository } from '../repositories/examRepository';

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
    .sort((a, b) => {
      const dateA = a.creationTime ? new Date(a.creationTime).getTime() : 0;
      const dateB = b.creationTime ? new Date(b.creationTime).getTime() : 0;
      return dateB - dateA;
    })
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

  const activeEmail = (profile.email || '').toLowerCase().trim();
  const implicitStudentId = activeEmail.match(/\d{13}/) ? activeEmail.match(/\d{13}/)[0] : null;


  const [examState, setExamState] = useState(() => {
    let initialExams = [];
    let initialChecked = false;
    let initialUnlisted = null;

    const savedSearch = sessionStorage.getItem('lastExamSearch') || implicitStudentId;
    const cachedResult = examRepository.getCachedExams(activeEmail);
    const data = (cachedResult.success && cachedResult.data) ? cachedResult.data : null;

    if (data) {
      const hasCachedExams = data.exams && data.exams.length > 0;
      const hasManual = data.manualExams && data.manualExams.length > 0;
      
      if (savedSearch || hasCachedExams || hasManual) {
        initialChecked = true;
        initialUnlisted = data.unlisted || null;
        const examsToLoad = (savedSearch || hasCachedExams) ? (data.exams || []) : [];
        initialExams = [...examsToLoad, ...(data.manualExams || [])];
      }
    }
    
    return { allExams: initialExams, hasCheckedExams: initialChecked, unlistedInfo: initialUnlisted };
  });

  // Enforce exam cache sync on mount, activeEmail changes, and when ClassroomContext finishes a Drive sync (indicated by schedule/assignments updating)
  useEffect(() => {
    if (activeEmail) {
      const savedSearch = sessionStorage.getItem('lastExamSearch') || implicitStudentId;
      const cachedResult = examRepository.getCachedExams(activeEmail);
      const data = (cachedResult.success && cachedResult.data) ? cachedResult.data : null;
      
      if (data) {
        const hasCachedExams = data.exams && data.exams.length > 0;
        const hasManual = data.manualExams && data.manualExams.length > 0;
        
        if (savedSearch || hasCachedExams || hasManual) {
          const examsToLoad = (savedSearch || hasCachedExams) ? (data.exams || []) : [];
          const newExams = [...examsToLoad, ...(data.manualExams || [])];
          
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setExamState(prev => {
            // Only update if changed to avoid infinite loop
            if (JSON.stringify(prev.allExams) !== JSON.stringify(newExams)) {
              return { allExams: newExams, hasCheckedExams: true, unlistedInfo: data.unlisted || null };
            }
            return prev;
          });
        }
      }
    }
  }, [activeEmail, implicitStudentId, schedule]);

  const fetchAttempted = useRef(false);
  const [isFetchingExams, setIsFetchingExams] = useState(() => {
    // If it hasn't checked exams but we have an implicit student ID, we will be fetching immediately.
    return !examState.hasCheckedExams && !!implicitStudentId;
  });

  useEffect(() => {
    if (!examState.hasCheckedExams && implicitStudentId && !fetchAttempted.current) {
      fetchAttempted.current = true;
      setIsFetchingExams(true);
      examRepository.fetchExams(implicitStudentId, lang).then(result => {
        if (result.success && result.data.exams && result.data.exams.length > 0) {
          const currentCache = examRepository.getCachedExams(activeEmail);
          const currentManual = (currentCache.success && currentCache.data) ? (currentCache.data.manualExams || []) : [];
          examRepository.saveToCache(activeEmail, result.data.exams, currentManual, result.data.unlisted);
          
          const token = getToken();
          if (token && activeEmail) {
            syncManager.queueSync(token, activeEmail);
            calendarSyncManager.queueSync(token, activeEmail);
          }

          setExamState({
            allExams: [...result.data.exams, ...currentManual],
            hasCheckedExams: true,
            unlistedInfo: result.data.unlisted || null
          });
          sessionStorage.setItem('lastExamSearch', implicitStudentId);
        }
      }).catch(err => {
        console.error("Auto-fetch exams failed on Home page", err);
      }).finally(() => {
        setIsFetchingExams(false);
      });
    }
  }, [examState.hasCheckedExams, implicitStudentId, activeEmail, lang]);

  const { allExams, hasCheckedExams, unlistedInfo } = examState;

  return (
    <div className="space-y-8 relative max-w-7xl mx-auto py-4">
      {/* Abstract Background Elements */}
      <div className="fixed top-0 left-1/4 w-[600px] h-[600px] ambient-glow-brand rounded-full pointer-events-none -z-10"></div>
      <div className="fixed bottom-0 right-1/4 w-[600px] h-[600px] ambient-glow-indigo rounded-full pointer-events-none -z-10"></div>

      {/* Welcome Banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-brand-900/40 via-dark-card/60 to-dark-card/40 backdrop-blur-xl border border-white/5 rounded-3xl p-8 md:p-10 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-2xl opacity-0 animate-fade-in group hover:border-brand-500/20 transition-all duration-500" style={{ animationDelay: '50ms' }}>
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-brand-500/20 rounded-full blur-[80px] pointer-events-none group-hover:bg-brand-500/30 transition-all duration-700" />
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
      <section className="space-y-4 opacity-0 animate-fade-in" style={{ animationDelay: '100ms' }}>
        <h2 className="text-xl font-bold font-heading text-white">{t('progressOverview', lang)}</h2>
        <TaskStats assignments={visibleAssignments} lang={lang} exams={allExams} />
      </section>

      {/* Grid: Upcoming Tasks & Quick Quotes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 opacity-0 animate-fade-in" style={{ animationDelay: '200ms' }}>
        {/* Left Column: Upcoming Deadlines & Recent Announcements */}
        <div className="lg:col-span-2 space-y-8">
          {/* Upcoming Deadlines */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold font-heading text-white flex items-center gap-2">
                <Calendar size={18} className="text-brand-400" />
                {t('latestAssignments', lang)}
              </h2>
              {visibleAssignments.filter(a => a.status !== 'done').length > 3 && (
                <Link to="/dashboard" className="text-xs text-brand-400 hover:text-brand-300 font-semibold transition-colors flex items-center gap-1">
                  {t('viewAll', lang)}
                  <ArrowRight size={12} />
                </Link>
              )}
            </div>

            {upcomingAssignments.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
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
              <div className="bg-dark-card/30 backdrop-blur-md border border-white/5 border-dashed rounded-3xl p-10 text-center shadow-inner">
                <p className="text-zinc-400 text-sm font-medium">{t('noUpcoming', lang)}</p>
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
                      className={`block p-5 rounded-2xl bg-dark-card/30 backdrop-blur-md border border-white/5 hover:bg-white/5 hover:border-white/10 transition-all duration-300 hover:translate-x-1 group border-l-[3px] ${borderLeft} flex flex-col justify-between h-full shadow-lg hover:shadow-xl`}
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
              <div className="bg-dark-card/30 backdrop-blur-md border border-white/5 border-dashed rounded-3xl p-10 text-center shadow-inner">
                <p className="text-sm font-medium text-zinc-400">{t('noAnnouncements', lang)}</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Next Exam Widget & Quick Course List */}
        <div className="space-y-8">
          {/* Today's Classes Widget */}
          <div className="bg-dark-card/40 backdrop-blur-xl border border-white/5 rounded-3xl p-6 lg:p-8 space-y-6 shadow-2xl group hover:border-white/10 transition-all duration-500">
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <h3 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                <CalendarDays size={14} className="text-brand-400" />
                <span>{lang === 'en' ? "Today's Classes" : 'ตารางเรียนวันนี้'}</span>
              </h3>
              <Link to="/schedule" className="text-[10px] text-brand-400 hover:text-brand-300 font-medium transition-colors">
                {lang === 'en' ? 'View Schedule' : 'ดูตารางเรียน'}
              </Link>
            </div>
            
            {todayClasses.length > 0 ? (
              <div className="space-y-4">
                {todayClasses.map((cls, idx) => {
                  const borderLeft = getBorderLeftColor(cls.color || 'blue');
                  return (
                  <div key={idx} className={`flex items-start gap-4 p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all duration-300 hover:-translate-y-1 group border-l-[3px] ${borderLeft} shadow-md`}>
                    <div className="flex flex-col items-center justify-center shrink-0 w-14 h-14 rounded-xl bg-black/20 border border-white/5 text-brand-400 group-hover:scale-105 transition-transform">
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
              <div className="py-8 text-center border border-dashed border-white/10 rounded-2xl bg-white/5">
                <p className="text-sm text-zinc-400 font-medium flex items-center justify-center gap-2">
                  <span>🎉</span> {lang === 'en' ? 'No classes today! Enjoy your day.' : 'วันนี้ไม่มีเรียน! พักผ่อนให้เต็มที่'}
                </p>
              </div>
            )}
          </div>

          {/* Next Exam Widget */}
          {(() => {
            let nextExam = null;
            let unlisted = unlistedInfo;
            let hasChecked = hasCheckedExams;

            if (hasChecked) {
              const today = new Date();
              today.setHours(0, 0, 0, 0);

              const upcomingExams = allExams.filter(exam => {
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

            if (!hasChecked) {
              if (isFetchingExams) {
                return (
                  <div className="bg-dark-card/40 backdrop-blur-xl border border-white/5 rounded-3xl p-6 lg:p-8 space-y-4 relative overflow-hidden shadow-2xl animate-pulse">
                    <div className="flex items-center justify-between border-b border-white/5 pb-4">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-white/10 rounded-full" />
                        <div className="h-3 w-24 bg-white/10 rounded-full" />
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="h-4 w-40 bg-white/10 rounded-full" />
                      <div className="h-2 w-32 bg-white/10 rounded-full" />
                    </div>
                    <div className="pt-2">
                      <div className="h-2 w-20 bg-brand-500/20 rounded-full" />
                    </div>
                  </div>
                );
              }

              return (
                <div className="bg-dark-card/40 backdrop-blur-xl border border-white/5 rounded-3xl p-6 lg:p-8 space-y-4 relative overflow-hidden group hover:border-white/10 transition-all duration-500 shadow-2xl">
                  <div className="absolute -top-10 -right-10 w-32 h-32 bg-brand-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-brand-500/20 transition-all duration-500" />
                  <div className="flex items-center justify-between border-b border-white/5 pb-4">
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
                <div className="bg-dark-card/40 backdrop-blur-xl border border-white/5 hover:border-brand-500/30 rounded-3xl p-6 lg:p-8 space-y-5 relative overflow-hidden group transition-all duration-500 shadow-2xl">
                  <div className="absolute top-0 left-0 right-0 h-1.5 bg-brand-500/40" />
                  <div className="flex items-center justify-between border-b border-white/5 pb-4">
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
                <div className="bg-rose-500/10 backdrop-blur-xl border border-rose-500/20 rounded-3xl p-6 lg:p-8 space-y-4 relative overflow-hidden shadow-2xl">
                  <div className="flex items-center justify-between border-b border-rose-500/10 pb-4">
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
              <div className="bg-dark-card/40 backdrop-blur-xl border border-white/5 rounded-3xl p-6 lg:p-8 space-y-4 relative overflow-hidden shadow-2xl hover:border-white/10 transition-all duration-500">
                <div className="flex items-center justify-between border-b border-white/5 pb-4">
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
          <div className="bg-dark-card/40 backdrop-blur-xl border border-white/5 rounded-3xl p-6 lg:p-8 shadow-2xl group hover:border-white/10 transition-all duration-500">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-5 flex items-center justify-between">
              <span>{t('mySubjects', lang)}</span>
              <BookOpen size={14} className="text-dark-muted group-hover:text-brand-400 transition-colors" />
            </h3>
            <div className="space-y-2">
              {visibleCourses.slice(0, 4).map((c) => {
                const count = visibleAssignments.filter(a => a.course === c.name && a.status !== 'done').length;
                return (
                  <div key={c.id} className="flex items-center justify-between text-sm p-3 rounded-2xl hover:bg-white/5 transition-colors group/row">
                    <span className="text-zinc-300 font-bold truncate pr-3 group-hover/row:text-white transition-colors flex-1" title={c.name}>{c.name}</span>
                    <span className={`px-3 py-1 rounded-full border text-[10px] font-bold shrink-0 shadow-sm ${
                      count > 0 ? 'bg-brand-500/15 text-brand-400 border-brand-500/30' : 'bg-black/20 text-zinc-400 border-white/5'
                    }`}>
                      {t('activeCount', lang, { count })}
                    </span>
                  </div>
                );
              })}
              <div className="pt-4 mt-2 border-t border-white/5">
                <Link 
                  to="/courses"
                  className="flex items-center justify-center gap-2 text-sm text-zinc-400 hover:text-white bg-black/20 hover:bg-brand-500/10 border border-transparent hover:border-brand-500/20 font-bold transition-all py-3 rounded-2xl shadow-sm"
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
