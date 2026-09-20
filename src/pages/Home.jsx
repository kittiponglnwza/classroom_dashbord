import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import TaskStats from '../components/TaskStats';
import AssignmentCard from '../components/AssignmentCard';
import { Calendar, ArrowRight, Megaphone, Clock, Paperclip, MapPin, CalendarDays, X, CheckCircle } from 'lucide-react';
import { t } from '../utils/i18n';

import { getCourseBadgeColor } from '../utils/colors';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { useClassroom } from '../contexts/ClassroomContext';
import { useClassroomUI } from '../contexts/ClassroomUIContext';
import { useExams } from '../hooks/useExams';
import { useTodayClasses } from '../hooks/useTodayClasses';
import NextExamWidget from '../components/NextExamWidget';

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
  const { handleStatusChange, schedule } = useClassroom();
  const {
    visibleAssignments,
    visibleResources
  } = useClassroomUI();

  const [showWelcome, setShowWelcome] = useState(() => {
    return localStorage.getItem('hide_welcome_banner') !== 'true';
  });

  const handleDismissWelcome = () => {
    setShowWelcome(false);
    localStorage.setItem('hide_welcome_banner', 'true');
  };

  // Filter out completed and get nearest due dates
  const upcomingAssignments = useMemo(() => {
    return visibleAssignments
      .filter(a => a.status !== 'done')
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
      .slice(0, 4);
  }, [visibleAssignments]);

  // Get recent announcements/materials
  const recentAnnouncements = useMemo(() => {
    return [...visibleResources]
      .sort((a, b) => new Date(b.creationTime) - new Date(a.creationTime))
      .slice(0, 3);
  }, [visibleResources]);



  const activeEmail = (profile?.email || '').toLowerCase().trim();
  const { allExams, hasCheckedExams, unlistedInfo, isFetching: isFetchingExams } = useExams(activeEmail, lang, schedule);

  const todayClasses = useTodayClasses(schedule, profile);

  return (
    <div className="space-y-8 relative max-w-7xl mx-auto py-4">
      {/* Abstract Background Elements */}
      <div className="fixed top-0 left-1/4 w-[600px] h-[600px] ambient-glow-brand rounded-full pointer-events-none -z-10"></div>
      <div className="fixed bottom-0 right-1/4 w-[600px] h-[600px] ambient-glow-indigo rounded-full pointer-events-none -z-10"></div>

      {/* Welcome Banner */}
      {showWelcome && (
        <div className="relative overflow-hidden bg-gradient-to-br from-brand-900/40 via-dark-card/60 to-dark-card/40 backdrop-blur-xl border border-white/5 rounded-3xl p-8 md:p-10 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-2xl opacity-0 animate-fade-in group hover:border-brand-500/20 transition-all duration-500" style={{ animationDelay: '50ms' }}>
          
          {/* Dismiss Button */}
          <button 
            onClick={handleDismissWelcome}
            className="absolute top-4 right-4 p-1.5 text-zinc-500 hover:text-white hover:bg-white/10 rounded-full transition-colors z-20"
            title="Dismiss"
          >
            <X size={16} />
          </button>

          <div className="absolute -top-24 -right-24 w-64 h-64 bg-brand-500/20 rounded-full blur-[80px] pointer-events-none group-hover:bg-brand-500/30 transition-all duration-700" />
          <div className="relative z-10 pr-6">
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
      )}

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
              <div className="bg-dark-card/30 backdrop-blur-md border border-white/5 border-dashed rounded-3xl p-10 flex flex-col items-center justify-center text-center shadow-inner">
                <CheckCircle size={32} className="text-zinc-600 mb-3 opacity-50" />
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
              <div className="bg-dark-card/30 backdrop-blur-md border border-white/5 border-dashed rounded-3xl p-10 flex flex-col items-center justify-center text-center shadow-inner">
                <Megaphone size={32} className="text-zinc-600 mb-3 opacity-50" />
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
              <div className="py-10 text-center border border-dashed border-white/10 rounded-2xl bg-white/[0.02] flex flex-col items-center justify-center">
                <span className="text-4xl mb-3">🎉</span>
                <p className="text-sm text-zinc-400 font-medium">
                  {lang === 'en' ? 'No classes today! Enjoy your day.' : 'วันนี้ไม่มีเรียน! พักผ่อนให้เต็มที่'}
                </p>
              </div>
            )}
          </div>

          {/* Next Exam Widget */}
          <NextExamWidget 
            allExams={allExams} 
            unlistedInfo={unlistedInfo} 
            hasCheckedExams={hasCheckedExams} 
            isFetchingExams={isFetchingExams} 
            lang={lang} 
          />


        </div>
      </div>
    </div>
  );
}
