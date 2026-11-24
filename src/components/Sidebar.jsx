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

  return (
    <aside
      className={`bg-[var(--sidebar-bg)] border-r border-[var(--border)] flex flex-col transition-all duration-200 relative h-full min-h-0 select-none ${
        isCollapsed ? 'w-18' : 'w-60 lg:w-64'
      }`}
    >
      <div className={`h-16 flex items-center border-b border-[var(--border)] ${isCollapsed ? 'justify-center px-2' : 'justify-between gap-2 px-4'}`}>
        {!isCollapsed && (
          <Link to="/" onClick={onLinkClick} className="flex items-center gap-2.5 overflow-hidden min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] rounded-lg">
            <img
              src="/Logo.svg"
              alt="Classroom Hub Logo"
              className="w-8 h-8 rounded-lg shrink-0 select-none"
            />
            <div className="flex flex-col items-start min-w-0">
              <span className="font-semibold text-sm text-[var(--text-heading)] tracking-tight truncate max-w-full">
                Classroom Hub
              </span>
              <span className="text-[11px] text-[var(--text-muted)] truncate max-w-full">
                {lang === 'en' ? 'Student Workspace' : 'พื้นที่จัดการการเรียน'}
              </span>
            </div>
          </Link>
        )}
        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="hidden md:flex w-7 h-7 bg-[var(--app-bg)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-heading)] hover:bg-[var(--surface-hover)] rounded-lg transition-colors items-center justify-center cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
        >
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-4 space-y-6">
        <nav aria-label="Main Navigation" className="space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              end={item.end}
              title={isCollapsed ? t(item.key, lang) : undefined}
              onClick={onLinkClick}
              className={({ isActive }) => {
                const active = item.path === '/courses' ? (isActive && !selectedCourseParam) : isActive;
                return `flex items-center ${isCollapsed ? 'justify-center px-2.5 py-2.5' : 'justify-between px-3 py-2.5'} rounded-xl text-sm font-medium transition-colors border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] ${
                  active
                    ? 'bg-[var(--primary-active)]/75 text-[var(--text-heading)] border-[var(--primary)]/50 font-semibold'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] border-transparent'
                }`;
              }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <item.icon size={18} className="shrink-0" />
                {!isCollapsed && <span className="truncate">{t(item.key, lang)}</span>}
              </div>
              {!isCollapsed && item.count !== null && item.count > 0 && (
                <span className="bg-[var(--app-bg)] text-[var(--text-primary)] text-xs px-2 py-0.5 rounded-full font-medium border border-[var(--border)] tabular-nums">
                  {item.count}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {!isCollapsed && visibleCourses.length > 0 && (
          <div className="space-y-1.5">
            <h3 className="px-3 text-xs font-medium text-[var(--text-muted)] flex items-center justify-between">
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
                    className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] ${
                      isCourseActive
                        ? 'bg-[var(--primary-active)]/75 text-[var(--text-heading)] border-[var(--primary)]/50 font-semibold'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] border-transparent font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${getCourseDotClass(course.color)}`} />
                      <span className="truncate">{course.name}</span>
                    </div>
                    {count > 0 && (
                      <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-[var(--app-bg)] text-[var(--text-secondary)] border border-[var(--border)] font-medium shrink-0 tabular-nums">
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
          onClick={onLinkClick}
          className={({ isActive }) =>
            `flex items-center ${isCollapsed ? 'justify-center px-2.5 py-2.5' : 'gap-3 px-3 py-2.5'} rounded-xl text-sm font-medium transition-colors border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] ${
              isActive
                ? 'bg-[var(--primary-active)]/75 text-[var(--text-heading)] border-[var(--primary)]/50 font-semibold'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] border-transparent'
            }`
          }
        >
          <ClipboardCheck size={18} className="shrink-0" />
          {!isCollapsed && <span>{t('examRoom', lang)}</span>}
        </NavLink>
      </div>

      <NavLink
        to="/settings"
        onClick={onLinkClick}
        className={({ isActive }) =>
          `py-3.5 border-t border-[var(--border)] shrink-0 overflow-hidden flex items-center hover:bg-[var(--surface-hover)] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] ${
            isCollapsed ? 'px-2 justify-center' : 'px-4 justify-between'
          } ${isActive ? 'bg-[var(--primary-active)]/50' : ''}`
        }
      >
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-8 h-8 rounded-full overflow-hidden border border-[var(--border)] bg-[var(--app-bg)] flex items-center justify-center shrink-0">
            {profile.avatarUrl && failedAvatarUrl !== profile.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt="Avatar"
                onError={() => setFailedAvatarUrl(profile.avatarUrl)}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-[var(--text-primary)] text-xs font-semibold">
                {profile.name ? profile.name.charAt(0).toUpperCase() : 'S'}
              </span>
            )}
          </div>
          {!isCollapsed && (
            <div className="text-left overflow-hidden">
              <p className="text-xs font-semibold text-[var(--text-primary)] truncate">
                {profile.name || 'Student'}
              </p>
              <p className="text-[11px] text-[var(--text-muted)] truncate">
                {profile.email || t('notConnected', lang)}
              </p>
            </div>
          )}
        </div>
        {!isCollapsed && (
          <Settings size={15} className="text-[var(--text-muted)] shrink-0 ml-1" />
        )}
      </NavLink>
    </aside>
  );
}
