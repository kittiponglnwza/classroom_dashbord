import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import TaskStats from '../components/TaskStats';
import AssignmentCard from '../components/AssignmentCard';
import PageHeader from '../components/PageHeader';
import SectionHeader from '../components/SectionHeader';
import { Home as HomeIcon, Calendar, ArrowRight, Megaphone, Clock, Paperclip, MapPin, CalendarDays, X, CheckCircle } from 'lucide-react';
import { t } from '../utils/i18n';
import { getCourseDotClass } from '../utils/colors';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { useClassroom } from '../contexts/ClassroomContext';
import { useClassroomUI } from '../contexts/ClassroomUIContext';
import { useExams } from '../hooks/useExams';
import { useTodayClasses } from '../hooks/useTodayClasses';
import { parseLocalDateInput } from '../utils/dateUtils';
import { getCookieConsent } from '../utils/cookieConsent';
import NextExamWidget from '../components/NextExamWidget';

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
  const { allExams, hasCheckedExams, unlistedInfo, isFetching: isFetchingExams, seatingLookupEnabled } = useExams(
    activeEmail,
    lang,
    schedule,
    profile?.studentId
  );
  const todayClasses = useTodayClasses(schedule, profile);

  const pendingCount = visibleAssignments.filter(a => a.status !== 'done' && a.status !== 'read').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('home', lang)}
        description={t('homeDesc', lang)}
        icon={HomeIcon}
        actions={
          <Link
            to="/dashboard"
            className="inline-flex items-center justify-center gap-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-medium text-xs px-4 h-9 rounded-lg shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] transition-colors"
          >
            <span>{t('goDashboard', lang)}</span>
            <ArrowRight size={15} strokeWidth={1.5} />
          </Link>
        }
      />

      {/* Term Status Notice */}
      {showWelcome && (
        <div className="relative bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3.5 flex items-center justify-between gap-4">
          <div className="pr-8 space-y-0.5">
            <h2 className="text-sm font-medium text-[var(--text-heading)]">
              {t('welcomeBack', lang, { name: profile.name || 'Student' })}
            </h2>
            <p className="text-xs text-[var(--text-secondary)]">
              {pendingCount === 0
                ? t('welcomeDescZero', lang)
                : t('welcomeDesc', lang, { count: pendingCount })}
            </p>
          </div>

          <button
            type="button"
            onClick={handleDismissWelcome}
            className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-heading)] hover:bg-[var(--surface-hover)] rounded-lg transition-colors cursor-pointer shrink-0"
            title={lang === 'en' ? 'Dismiss' : 'ปิด'}
            aria-label={lang === 'en' ? 'Dismiss welcome banner' : 'ปิดข้อความต้อนรับ'}
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>
      )}

      {/* Task Statistics */}
      <section className="space-y-3">
        <SectionHeader title={t('progressOverview', lang)} />
        <TaskStats assignments={visibleAssignments} lang={lang} exams={allExams} />
      </section>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Upcoming Deadlines & Recent Announcements */}
        <div className="lg:col-span-2 space-y-6">
          <div className="space-y-3">
            <SectionHeader
              title={t('latestAssignments', lang)}
              icon={Calendar}
              action={
                pendingCount > 0 ? (
                  <Link
                    to="/dashboard"
                    className="text-xs text-[var(--primary-bright)] hover:underline font-medium inline-flex items-center gap-1"
                  >
                    <span>{t('viewAll', lang)}</span>
                    <ArrowRight size={14} strokeWidth={1.5} />
                  </Link>
                ) : null
              }
            />

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
              <div className="bg-[var(--surface)] border border-[var(--border)] border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center">
                <CheckCircle size={20} strokeWidth={1.5} className="text-[var(--text-muted)] mb-2" />
                <p className="text-[var(--text-secondary)] text-xs font-medium">{t('noUpcoming', lang)}</p>
              </div>
            )}
          </div>

          {/* Recent Announcements */}
          <div className="space-y-3">
            <SectionHeader
              title={t('recentAnnouncements', lang)}
              icon={Megaphone}
              action={
                recentAnnouncements.length > 0 ? (
                  <Link
                    to="/courses"
                    className="text-xs text-[var(--primary-bright)] hover:underline font-medium inline-flex items-center gap-1"
                  >
                    <span>{t('viewAll', lang)}</span>
                    <ArrowRight size={14} strokeWidth={1.5} />
                  </Link>
                ) : null
              }
            />

            {recentAnnouncements.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {recentAnnouncements.map((ann) => {
                  const formattedDate = new Date(ann.creationTime).toLocaleDateString(lang === 'en' ? 'en-US' : 'th-TH', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit'
                  });
                  const dotClass = getCourseDotClass(ann.courseColor);

                  return (
                    <Link
                      key={ann.id}
                      to={`/courses?selected=${encodeURIComponent(ann.course)}&tab=resources&highlight=${encodeURIComponent(ann.id)}`}
                      state={{ from: '/' }}
                      className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-elevated)] transition-colors group flex flex-col justify-between h-full"
                    >
                      <div className="space-y-2.5 flex-1 flex flex-col justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className="inline-flex items-center gap-1.5 text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-[var(--app-bg)] border border-[var(--border)] text-[var(--text-secondary)] truncate max-w-full"
                              title={ann.course}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotClass}`} />
                              <span className="truncate">
                                {ann.courseCode && ann.courseCode !== 'CLASSROOM' ? ann.courseCode : ann.course}
                              </span>
                            </span>
                          </div>

                          <p className="text-[13px] text-[var(--text-primary)] group-hover:text-[var(--primary-bright)] font-medium line-clamp-3 leading-relaxed transition-colors">
                            {ann.title}
                          </p>

                          <span className="text-[11px] font-mono text-[var(--text-muted)] flex items-center gap-1.5 shrink-0 tabular-nums">
                            <Clock size={12} strokeWidth={1.5} />
                            {formattedDate}
                          </span>
                        </div>

                        {ann.attachments && ann.attachments.length > 0 && (
                          <div className="flex items-center gap-1.5 text-[11px] font-mono text-[var(--text-muted)] pt-2 border-t border-[var(--border)] mt-2 tabular-nums">
                            <Paperclip size={12} strokeWidth={1.5} className="shrink-0" />
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
              <div className="bg-[var(--surface)] border border-[var(--border)] border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center">
                <Megaphone size={20} strokeWidth={1.5} className="text-[var(--text-muted)] mb-2" />
                <p className="text-xs font-medium text-[var(--text-secondary)]">{t('noAnnouncements', lang)}</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Today's Classes & Next Exam Widget */}
        <div className="space-y-6">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <h3 className="text-xs font-medium text-[var(--text-heading)] flex items-center gap-2">
                <CalendarDays size={16} strokeWidth={1.5} className="text-[var(--primary-bright)]" />
                <span>{lang === 'en' ? "Today's Classes" : 'ตารางเรียนวันนี้'}</span>
              </h3>
              <Link to="/schedule" className="text-xs text-[var(--primary-bright)] hover:underline font-medium">
                {lang === 'en' ? 'View Schedule' : 'ดูตารางเรียน'}
              </Link>
            </div>

            {todayClasses.length > 0 ? (
              <div className="space-y-2">
                {todayClasses.map((cls, idx) => {
                  const dotClass = getCourseDotClass(cls.color || 'blue');
                  return (
                    <Link
                      key={cls.id || idx}
                      to="/schedule"
                      className="flex items-center gap-3 p-3 rounded-lg bg-[var(--app-bg)] hover:bg-[var(--surface-elevated)] border border-[var(--border)] transition-colors"
                    >
                      <div className="flex flex-col items-end justify-center shrink-0 w-14 pr-3 border-r border-[var(--border)] font-mono tabular-nums">
                        <span className="text-xs font-medium text-[var(--text-heading)] leading-tight">{cls.startTime}</span>
                        <span className="text-[11px] text-[var(--text-muted)] leading-tight mt-0.5">{cls.endTime}</span>
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <div className="flex items-center gap-2">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotClass}`} />
                          {cls.courseCode && (
                            <span
                              className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-[var(--surface)] text-[var(--text-secondary)] border border-[var(--border)] truncate max-w-[84px]"
                              title={cls.courseCode}
                            >
                              {cls.courseCode}
                            </span>
                          )}
                          <h4 className="text-xs font-medium text-[var(--text-heading)] truncate flex-1" title={cls.title || cls.courseName}>
                            {cls.title || cls.courseName}
                          </h4>
                        </div>
                        <p className="text-[11px] text-[var(--text-secondary)] truncate mt-1 flex items-center gap-1.5 font-mono">
                          <MapPin size={12} strokeWidth={1.5} className="text-[var(--text-muted)] shrink-0" />
                          <span>{cls.room || (lang === 'en' ? 'TBA' : 'ไม่ระบุห้อง')}</span>
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="py-6 px-4 text-center border border-dashed border-[var(--border)] rounded-lg bg-[var(--app-bg)] flex flex-col items-center justify-center space-y-2.5">
                <CalendarDays size={20} strokeWidth={1.5} className="text-[var(--text-muted)]" />
                {Array.isArray(schedule) && schedule.length > 0 ? (
                  <p className="text-xs text-[var(--text-secondary)] font-medium">
                    {lang === 'en' ? 'No classes scheduled today' : 'วันนี้ไม่มีตารางเรียน'}
                  </p>
                ) : (
                  <>
                    <div className="space-y-1">
                      <p className="text-xs text-[var(--text-primary)] font-medium">
                        {lang === 'en' ? 'No timetable imported yet' : 'ยังไม่มีตารางเรียนในระบบ'}
                      </p>
                      <p className="text-[11px] text-[var(--text-muted)]">
                        {lang === 'en'
                          ? 'Copy-paste from KMUTNB Reg in 10 seconds or add classes'
                          : 'คัดลอกวางจากเว็บ Reg มจพ. ใน 10 วินาที หรือเพิ่มคาบเรียนเอง'}
                      </p>
                    </div>
                    <Link
                      to="/schedule"
                      className="inline-flex items-center gap-1.5 text-xs font-medium px-3 h-8 rounded-lg bg-[var(--surface-elevated)] hover:bg-[var(--surface-hover)] text-[var(--primary-bright)] border border-[var(--border)] transition-colors"
                    >
                      <span>{lang === 'en' ? 'Go to Schedule & Import Reg' : 'ไปตารางเรียน / นำเข้า Reg'}</span>
                      <ArrowRight size={13} strokeWidth={1.5} />
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>

          <NextExamWidget
            allExams={allExams}
            unlistedInfo={unlistedInfo}
            hasCheckedExams={hasCheckedExams}
            isFetchingExams={isFetchingExams}
            seatingLookupEnabled={seatingLookupEnabled}
            lang={lang}
          />
        </div>
      </div>
    </div>
  );
}
