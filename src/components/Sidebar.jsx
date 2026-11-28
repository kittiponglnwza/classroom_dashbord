import { useEffect, useState } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { Home, ClipboardList, BookOpen, Settings, ChevronLeft, ChevronRight, ClipboardCheck, CalendarDays, GraduationCap } from 'lucide-react';
import { t } from '../utils/i18n';
import { getCourseDotClass } from '../utils/colors';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { useClassroomUI } from '../contexts/ClassroomUIContext';

export default function Sidebar({ onLinkClick = null }) {
  const isMobileDrawer = Boolean(onLinkClick);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (isMobileDrawer) return false;
    if (typeof window !== 'undefined') {
      return window.matchMedia
        ? !window.matchMedia('(min-width: 1024px)').matches
        : window.innerWidth < 1024;
    }
    return false;
  });
  const [failedAvatarUrl, setFailedAvatarUrl] = useState(null);
  const { profile } = useAuth();
  const { lang } = useSettings();
  const { visibleCourses, visibleAssignments } = useClassroomUI();
  const location = useLocation();

  useEffect(() => {
    if (isMobileDrawer) return undefined;
    const updateCollapsedState = () => {
      const isDesktopWidth = window.matchMedia
        ? window.matchMedia('(min-width: 1024px)').matches
        : window.innerWidth >= 1024;
      setIsCollapsed(!isDesktopWidth);
    };

    window.addEventListener('resize', updateCollapsedState);
    return () => window.removeEventListener('resize', updateCollapsedState);
  }, [isMobileDrawer]);

  const selectedCourseParam = location.pathname === '/courses'
    ? new URLSearchParams(location.search).get('selected')
    : null;

  const getActiveCount = (course) => {
    return visibleAssignments.filter(a => {
      if (a.status === 'done' || a.status === 'read') return false;
      if (a.courseId && course.id) return a.courseId === course.id;
      return a.course === course.name;
    }).length;
  };

  const totalActive = visibleAssignments.filter(a => a.status !== 'done' && a.status !== 'read').length;

  const navItems = [
    { name: 'Home', key: 'home', path: '/', icon: Home, count: null, end: true },
    { name: 'Assignments', key: 'assignmentsNav', path: '/dashboard', icon: ClipboardList, count: totalActive },
    { name: 'Schedule', key: 'schedule', path: '/schedule', icon: CalendarDays, count: null },
    { name: 'Courses', key: 'courses', path: '/courses', icon: BookOpen, count: null, end: true },
    { name: 'Academic', key: 'academic', path: '/academic', icon: GraduationCap, count: null },
  ];

  const activeNavClass =
    'bg-[var(--surface-elevated)] text-[var(--text-heading)] border-[var(--border-strong)] shadow-[inset_0_1px_0_rgba(238,240,245,0.06)] font-medium';
  const inactiveNavClass =
    'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)] border-transparent';

  return (
    <aside
      className={`bg-[var(--sidebar-bg)] border-r border-[var(--border)] flex flex-col relative h-full min-h-0 select-none ${
        isCollapsed ? 'w-18' : 'w-60 lg:w-64'
      }`}
    >
      <div className={`h-16 flex items-center border-b border-[var(--border)] ${isCollapsed ? 'justify-center px-2' : 'justify-between gap-2 px-4'}`}>
        {!isCollapsed && (
          <Link to="/" onClick={onLinkClick} className="flex items-center gap-2.5 overflow-hidden min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] rounded-lg">
            <img
              src="/Logo.svg"
              alt="Classroom Hub Logo"
              width={32}
              height={32}
              className="w-8 h-8 rounded-lg shrink-0 select-none"
            />
            <div className="flex flex-col items-start min-w-0">
              <span className="font-medium text-sm text-[var(--text-heading)] tracking-[-0.01em] truncate max-w-full">
                Classroom Hub
              </span>
              <span className="text-[11px] text-[var(--text-muted)] truncate max-w-full">
                {lang === 'en' ? 'KMUTNB Workspace' : 'ระบบจัดการการเรียน มจพ.'}
              </span>
            </div>
          </Link>
        )}
        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!isCollapsed}
          className="hidden md:flex w-8 h-8 bg-[var(--surface)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-heading)] hover:bg-[var(--surface-hover)] rounded-lg transition-colors items-center justify-center cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
        >
          {isCollapsed ? <ChevronRight aria-hidden="true" size={14} strokeWidth={1.5} /> : <ChevronLeft aria-hidden="true" size={14} strokeWidth={1.5} />}
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-4">
        <nav aria-label="Main Navigation" className="space-y-1">
          {navItems.map((item) => {
            const collapsedLabel =
              item.count !== null && item.count > 0
                ? `${t(item.key, lang)} (${item.count})`
                : t(item.key, lang);
            return (
              <NavLink
                key={item.name}
                to={item.path}
                end={item.end}
                title={isCollapsed ? collapsedLabel : undefined}
                aria-label={isCollapsed ? collapsedLabel : undefined}
                onClick={onLinkClick}
                className={({ isActive }) => {
                  const active = item.path === '/courses' ? (isActive && !selectedCourseParam) : isActive;
                  return `flex items-center ${isMobileDrawer ? 'min-h-11' : 'h-9'} ${isCollapsed ? 'justify-center px-2' : 'justify-between px-3'} rounded-lg text-sm font-normal transition-colors border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] ${
                    active ? activeNavClass : inactiveNavClass
                  }`;
                }}
              >
                {({ isActive }) => {
                  const active = item.path === '/courses' ? (isActive && !selectedCourseParam) : isActive;
                  return (
                    <>
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-4 flex items-center justify-center shrink-0">
                          <item.icon
                            aria-hidden="true"
                            size={16}
                            strokeWidth={1.5}
                            className={active ? 'text-[var(--primary-bright)]' : 'text-[var(--text-muted)]'}
                          />
                        </span>
                        {!isCollapsed && <span className="truncate">{t(item.key, lang)}</span>}
                      </div>
                      {!isCollapsed && item.count !== null && item.count > 0 && (
                        <span className="text-xs font-mono text-[var(--text-muted)] tabular-nums shrink-0">
                          {item.count}
                        </span>
                      )}
                    </>
                  );
                }}
              </NavLink>
            );
          })}
        </nav>

        {!isCollapsed && visibleCourses.length > 0 && (
          <div className="mt-6">
            <h3 className="px-3 mb-2 text-xs font-medium text-[var(--text-muted)]">
              <span>{t('myCourses', lang)}</span>
            </h3>
            <nav aria-label="Courses Navigation" className="space-y-0.5">
              {visibleCourses.map((course) => {
                const count = getActiveCount(course);
                const isCourseActive = selectedCourseParam === course.name;
                return (
                  <Link
                    key={course.id}
                    to={`/courses?selected=${encodeURIComponent(course.name)}`}
                    onClick={onLinkClick}
                    className={`flex items-center justify-between ${isMobileDrawer ? 'min-h-11' : 'h-8'} px-3 rounded-lg text-[13px] transition-colors border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] ${
                      isCourseActive ? activeNavClass : inactiveNavClass
                    }`}
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <span aria-hidden="true" className="w-4 flex items-center justify-center shrink-0">
                        <span className={`w-2 h-2 rounded-full ${getCourseDotClass(course.color)}`} />
                      </span>
                      <span className="truncate">{course.name}</span>
                    </div>
                    {count > 0 && (
                      <span className="text-xs font-mono text-[var(--text-muted)] shrink-0 tabular-nums">
                        {count}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>
        )}
      </div>

      <div className="px-3 py-2 border-t border-[var(--border)] shrink-0">
        <NavLink
          to="/exam-room"
          title={isCollapsed ? t('examRoom', lang) : undefined}
          aria-label={isCollapsed ? t('examRoom', lang) : undefined}
          onClick={onLinkClick}
          className={({ isActive }) =>
            `flex items-center ${isMobileDrawer ? 'min-h-11' : 'h-9'} ${isCollapsed ? 'justify-center px-2' : 'gap-3 px-3'} rounded-lg text-sm font-normal transition-colors border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] ${
              isActive ? activeNavClass : inactiveNavClass
            }`
          }
        >
          {({ isActive }) => (
            <>
              <span className="w-4 flex items-center justify-center shrink-0">
                <ClipboardCheck
                  aria-hidden="true"
                  size={16}
                  strokeWidth={1.5}
                  className={isActive ? 'text-[var(--primary-bright)]' : 'text-[var(--text-muted)]'}
                />
              </span>
              {!isCollapsed && <span className="truncate">{t('examRoom', lang)}</span>}
            </>
          )}
        </NavLink>
      </div>

      <NavLink
        to="/settings"
        title={isCollapsed ? `${profile.name || 'Student'} — ${t('settings', lang)}` : undefined}
        aria-label={isCollapsed ? `${profile.name || 'Student'} — ${t('settings', lang)}` : undefined}
        onClick={onLinkClick}
        className={({ isActive }) =>
          `py-3 border-t border-[var(--border)] shrink-0 overflow-hidden flex items-center hover:bg-[var(--surface)] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] ${
            isCollapsed ? 'px-2 justify-center' : 'px-4 justify-between'
          } ${isActive ? 'bg-[var(--surface-elevated)]' : ''}`
        }
      >
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-8 h-8 rounded-full overflow-hidden border border-[var(--border)] bg-[var(--surface)] flex items-center justify-center shrink-0">
            {profile.avatarUrl && failedAvatarUrl !== profile.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt="Avatar"
                width={32}
                height={32}
                referrerPolicy="no-referrer"
                onError={() => setFailedAvatarUrl(profile.avatarUrl)}
                className="w-full h-full object-cover"
              />
            ) : (
              <span aria-hidden={isCollapsed ? 'true' : undefined} className="text-[var(--text-primary)] text-xs font-medium">
                {profile.name ? profile.name.charAt(0).toUpperCase() : 'S'}
              </span>
            )}
          </div>
          {!isCollapsed && (
            <div className="text-left overflow-hidden">
              <p className="text-[13px] font-medium text-[var(--text-primary)] truncate">
                {profile.name || 'Student'}
              </p>
              <p className="text-[11px] font-mono text-[var(--text-muted)] truncate">
                {profile.email || t('notConnected', lang)}
              </p>
            </div>
          )}
        </div>
        {!isCollapsed && (
          <Settings aria-hidden="true" size={16} strokeWidth={1.5} className="text-[var(--text-muted)] shrink-0 ml-2" />
        )}
      </NavLink>
    </aside>
  );
}
