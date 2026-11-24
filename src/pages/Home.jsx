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
import { parseLocalDateInput } from '../utils/dateUtils';
import { getCookieConsent } from '../utils/cookieConsent';
import NextExamWidget from '../components/NextExamWidget';

const getBorderLeftColor = (color) => {
  switch (color) {
    case 'emerald': return 'border-l-emerald-500';
    case 'blue': return 'border-l-[#007ACC]';
    case 'amber': return 'border-l-amber-500';
    case 'rose': return 'border-l-rose-500';
    case 'purple': return 'border-l-purple-500';
    default: return 'border-l-[#858585]';
  }
};

export default function Home() {
  const { profile } = useAuth();
  const { lang } = useSettings();
  const { handleStatusChange, schedule } = useClassroom();
  const { visibleAssignments, visibleResources } = useClassroomUI();

  const [showWelcome, setShowWelcome] = useState(() => {
    return localStorage.getItem('hide_welcome_banner') !== 'true';
  });

  const handleDismissWelcome = () => {
    setShowWelcome(false);
    const consent = getCookieConsent();
    if (!consent || consent.preferences !== false) {
      localStorage.setItem('hide_welcome_banner', 'true');
    }
  };

  // Filter out completed/read and get nearest due dates (items with valid dueDate first)
  const upcomingAssignments = useMemo(() => {
    return visibleAssignments
      .filter(a => a.status !== 'done' && a.status !== 'read')
      .sort((a, b) => {
        const parsedA = parseLocalDateInput(a.dueDate, { endOfDayForDateOnly: true });
        const parsedB = parseLocalDateInput(b.dueDate, { endOfDayForDateOnly: true });
        const timeA = parsedA ? parsedA.getTime() : NaN;
        const timeB = parsedB ? parsedB.getTime() : NaN;
        const validA = Number.isFinite(timeA);
        const validB = Number.isFinite(timeB);
        if (validA && validB) return timeA - timeB;
        if (validA) return -1;
        if (validB) return 1;
        return 0;
      })
      .slice(0, 4);
  }, [visibleAssignments]);

  // Get recent announcements/materials
  const recentAnnouncements = useMemo(() => {
    return [...visibleResources]
      .sort((a, b) => new Date(b.creationTime) - new Date(a.creationTime))
      .slice(0, 3);
  }, [visibleResources]);

  const activeEmail = (profile?.email || '').toLowerCase().trim();
  const { allExams, hasCheckedExams, unlistedInfo, isFetching: isFetchingExams } = useExams(
    activeEmail,
    lang,
    schedule,
    profile?.studentId
  );
  const todayClasses = useTodayClasses(schedule, profile);

  const pendingCount = visibleAssignments.filter(a => a.status !== 'done' && a.status !== 'read').length;

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      {showWelcome && (
        <div className="relative bg-[#252526] border border-[#3C3C3C] rounded-2xl p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <button
            type="button"
            onClick={handleDismissWelcome}
            className="absolute top-3.5 right-3.5 p-1.5 text-[#9D9D9D] hover:text-[#FFFFFF] hover:bg-[#2A2D2E] rounded-lg transition-colors cursor-pointer"
            title={lang === 'en' ? 'Dismiss' : 'ปิด'}
          >
            <X size={16} />
          </button>

          <div className="pr-6 space-y-1.5">
            <h1 className="text-2xl font-semibold text-[#FFFFFF] tracking-tight">
              {t('welcomeBack', lang, { name: profile.name || 'Student' })}
            </h1>
            <p className="text-[#9D9D9D] text-sm max-w-xl">
              {pendingCount === 0
                ? t('welcomeDescZero', lang)
                : t('welcomeDesc', lang, { count: pendingCount })}
            </p>
          </div>
          <Link
            to="/dashboard"
            className="inline-flex items-center justify-center gap-2 bg-[#007ACC] hover:bg-[#1177BB] text-white font-medium text-xs px-5 py-2.5 rounded-xl transition-colors self-start md:self-auto shrink-0"
          >
            <span>{t('goDashboard', lang)}</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      )}

      {/* Task Statistics */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-[#FFFFFF] tracking-tight">{t('progressOverview', lang)}</h2>
        <TaskStats assignments={visibleAssignments} lang={lang} exams={allExams} />
      </section>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Upcoming Deadlines & Recent Announcements */}
        <div className="lg:col-span-2 space-y-8">
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-[#FFFFFF] flex items-center gap-2">
                <Calendar size={16} className="text-[#3794FF]" />
                <span>{t('latestAssignments', lang)}</span>
              </h2>
              {pendingCount > 0 && (
                <Link
                  to="/dashboard"
                  className="text-xs text-[#3794FF] hover:underline font-medium inline-flex items-center gap-1"
                >
                  <span>{t('viewAll', lang)}</span>
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
              <div className="bg-[#252526] border border-[#3C3C3C] border-dashed rounded-2xl p-10 flex flex-col items-center justify-center text-center">
                <CheckCircle size={28} className="text-[#858585] mb-2.5 opacity-60" />
                <p className="text-[#9D9D9D] text-xs font-medium">{t('noUpcoming', lang)}</p>
              </div>
            )}
          </div>

          {/* Recent Announcements */}
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-[#FFFFFF] flex items-center gap-2">
                <Megaphone size={16} className="text-[#3794FF]" />
                <span>{t('recentAnnouncements', lang)}</span>
              </h2>
              {recentAnnouncements.length > 0 && (
                <Link
                  to="/courses"
                  className="text-xs text-[#3794FF] hover:underline font-medium inline-flex items-center gap-1"
                >
                  <span>{t('viewAll', lang)}</span>
                  <ArrowRight size={12} />
                </Link>
              )}
            </div>

            {recentAnnouncements.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                      to={`/courses?selected=${encodeURIComponent(ann.course)}&tab=resources&highlight=${encodeURIComponent(ann.id)}`}
                      state={{ from: '/' }}
                      className={`p-4 rounded-2xl bg-[#252526] border border-[#3C3C3C] hover:border-[#007ACC]/70 transition-colors group border-l-3 ${borderLeft} flex flex-col justify-between h-full`}
                    >
                      <div className="space-y-2.5 flex-1 flex flex-col justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-col gap-1">
                            <span
                              className={`text-[11px] font-medium px-2 py-0.5 rounded-md truncate max-w-full self-start ${badgeClasses}`}
                              title={ann.course}
                            >
                              {ann.courseCode && ann.courseCode !== 'CLASSROOM' ? ann.courseCode : ann.course}
                            </span>
                            <span className="text-[11px] text-[#858585] flex items-center gap-1 shrink-0">
                              <Clock size={11} />
                              {formattedDate}
                            </span>
                          </div>

                          <p className="text-xs text-[#D4D4D4] group-hover:text-[#3794FF] font-semibold line-clamp-3 leading-relaxed transition-colors">
                            {ann.title}
                          </p>
                        </div>

                        {ann.attachments && ann.attachments.length > 0 && (
                          <div className="flex items-center gap-1 text-[11px] text-[#858585] pt-2 border-t border-[#3C3C3C] mt-2">
                            <Paperclip size={11} className="shrink-0" />
                            <span>
                              {t(ann.attachments.length === 1 ? 'attachmentsCount' : 'attachmentsCountPlural', lang, {
                                count: ann.attachments.length
                              })}
                            </span>
                          </div>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="bg-[#252526] border border-[#3C3C3C] border-dashed rounded-2xl p-10 flex flex-col items-center justify-center text-center">
                <Megaphone size={28} className="text-[#858585] mb-2.5 opacity-60" />
                <p className="text-xs font-medium text-[#9D9D9D]">{t('noAnnouncements', lang)}</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Today's Classes & Next Exam Widget */}
        <div className="space-y-6">
          <div className="bg-[#252526] border border-[#3C3C3C] rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#3C3C3C] pb-3">
              <h3 className="text-xs font-semibold text-[#FFFFFF] flex items-center gap-2">
                <CalendarDays size={15} className="text-[#3794FF]" />
                <span>{lang === 'en' ? "Today's Classes" : 'ตารางเรียนวันนี้'}</span>
              </h3>
              <Link to="/schedule" className="text-xs text-[#3794FF] hover:underline font-medium">
                {lang === 'en' ? 'View Schedule' : 'ดูตารางเรียน'}
              </Link>
            </div>

            {todayClasses.length > 0 ? (
              <div className="space-y-3">
                {todayClasses.map((cls, idx) => {
                  const borderLeft = getBorderLeftColor(cls.color || 'blue');
                  return (
                    <Link
                      key={cls.id || idx}
                      to="/schedule"
                      className={`flex items-start gap-3.5 p-3.5 rounded-xl bg-[#1E1E1E] hover:bg-[#2A2D2E] border border-[#3C3C3C] transition-colors border-l-3 ${borderLeft}`}
                    >
                      <div className="flex flex-col items-center justify-center shrink-0 w-13 h-12 rounded-lg bg-[#252526] border border-[#3C3C3C] text-[#3794FF]">
                        <span className="text-[11px] font-semibold leading-none">{cls.startTime}</span>
                        <span className="text-[10px] text-[#858585] mt-1 leading-none">{cls.endTime}</span>
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <div className="flex items-center gap-1.5">
                          {cls.courseCode && (
                            <span
                              className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#252526] text-[#9D9D9D] border border-[#3C3C3C] truncate max-w-[80px]"
                              title={cls.courseCode}
                            >
                              {cls.courseCode}
                            </span>
                          )}
                          <h4 className="text-xs font-semibold text-[#FFFFFF] truncate flex-1" title={cls.title || cls.courseName}>
                            {cls.title || cls.courseName}
                          </h4>
                        </div>
                        <p className="text-[11px] text-[#9D9D9D] truncate mt-1 flex items-center gap-1">
                          <MapPin size={11} className="shrink-0" />
                          {cls.room || (lang === 'en' ? 'TBA' : 'ไม่ระบุห้อง')}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center border border-dashed border-[#3C3C3C] rounded-xl bg-[#1E1E1E]/60 flex flex-col items-center justify-center">
                <CalendarDays size={24} className="text-[#858585] mb-2 opacity-60" />
                <p className="text-xs text-[#9D9D9D] font-medium">
                  {lang === 'en' ? 'No classes scheduled today.' : 'วันนี้ไม่มีตารางเรียน'}
                </p>
              </div>
            )}
          </div>

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
