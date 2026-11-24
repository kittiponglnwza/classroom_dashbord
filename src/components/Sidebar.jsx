import { useState } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { Home, LayoutDashboard, BookOpen, Settings, ChevronLeft, ChevronRight, ClipboardCheck, CalendarDays, GraduationCap } from 'lucide-react';
import { t } from '../utils/i18n';
import { getCourseDotClass } from '../utils/colors';
import { APP_VERSION } from '../config/version';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { useClassroomUI } from '../contexts/ClassroomUIContext';

export default function Sidebar({ onLinkClick = null }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [failedAvatarUrl, setFailedAvatarUrl] = useState(null);
  const { profile } = useAuth();
  const { lang } = useSettings();
  const { visibleCourses, visibleAssignments } = useClassroomUI();
  const location = useLocation();

  const selectedCourseParam = location.pathname === '/courses'
    ? new URLSearchParams(location.search).get('selected')
    : null;

  const getActiveCount = (course) => {
    return visibleAssignments.filter(a => {
      if (a.status === 'done') return false;
      if (a.courseId && course.id) return a.courseId === course.id;
      return a.course === course.name;
    }).length;
  };

  const totalActive = visibleAssignments.filter(a => a.status !== 'done').length;

  const navItems = [
    { name: 'Home', key: 'home', path: '/', icon: Home, count: null, end: true },
    { name: 'Dashboard', key: 'dashboard', path: '/dashboard', icon: LayoutDashboard, count: totalActive },
    { name: 'Schedule', key: 'schedule', path: '/schedule', icon: CalendarDays, count: null },
    { name: 'Courses', key: 'courses', path: '/courses', icon: BookOpen, count: null, end: true },
    { name: 'Academic', key: 'academic', path: '/academic', icon: GraduationCap, count: null },
  ];

  return (
    <aside
      className={`bg-[#252526] border-r border-[#3C3C3C] flex flex-col transition-all duration-200 relative h-screen select-none ${
        isCollapsed ? 'w-18' : 'w-64'
      }`}
    >
      <div className={`h-16 flex items-center border-b border-[#3C3C3C] ${isCollapsed ? 'justify-center px-2' : 'justify-between px-4'}`}>
        {!isCollapsed && (
          <Link to="/" onClick={onLinkClick} className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-[#007ACC] text-white font-semibold text-xs flex items-center justify-center shrink-0">
              CH
            </div>
            <div className="flex flex-col items-start min-w-0">
              <div className="flex items-center gap-1.5 max-w-full">
                <span className="font-semibold text-sm text-[#FFFFFF] tracking-tight truncate">
                  Classroom Hub
                </span>
                <span className="text-[9.5px] font-mono px-1.5 py-0.25 rounded bg-[#1E1E1E] border border-[#3C3C3C] text-[#3794FF] shrink-0">
                  v{APP_VERSION}
                </span>
              </div>
              <span className="text-[11px] text-[#858585] truncate">
                {lang === 'en' ? 'Student Workspace' : 'พื้นที่จัดการการเรียน'}
              </span>
            </div>
          </Link>
        )}
        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="hidden md:flex w-7 h-7 bg-[#1E1E1E] border border-[#3C3C3C] text-[#9D9D9D] hover:text-[#FFFFFF] hover:bg-[#2A2D2E] rounded-lg transition-colors items-center justify-center cursor-pointer shrink-0"
        >
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
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
                return `flex items-center ${isCollapsed ? 'justify-center px-2.5 py-2.5' : 'justify-between px-3 py-2.5'} rounded-xl text-sm font-medium transition-colors ${
                  active
                    ? 'bg-[#094771]/70 text-[#FFFFFF] border border-[#007ACC]/50 font-semibold'
                    : 'text-[#9D9D9D] hover:text-[#D4D4D4] hover:bg-[#2A2D2E]'
                }`;
              }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <item.icon size={18} className="shrink-0" />
                {!isCollapsed && <span className="truncate">{t(item.key, lang)}</span>}
              </div>
              {!isCollapsed && item.count !== null && item.count > 0 && (
                <span className="bg-[#1E1E1E] text-[#D4D4D4] text-xs px-2 py-0.5 rounded-full font-medium border border-[#3C3C3C]">
                  {item.count}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {!isCollapsed && visibleCourses.length > 0 && (
          <div className="space-y-1.5">
            <h3 className="px-3 text-xs font-medium text-[#858585] flex items-center justify-between">
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
                    className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors ${
                      isCourseActive
                        ? 'bg-[#094771]/70 text-[#FFFFFF] border border-[#007ACC]/50 font-semibold'
                        : 'text-[#9D9D9D] hover:text-[#D4D4D4] hover:bg-[#2A2D2E] font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${getCourseDotClass(course.color)}`} />
                      <span className="truncate">{course.name}</span>
                    </div>
                    {count > 0 && (
                      <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-[#1E1E1E] text-[#9D9D9D] border border-[#3C3C3C] font-medium shrink-0">
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

      <div className="px-3 py-2 border-t border-[#3C3C3C] shrink-0">
        <NavLink
          to="/exam-room"
          title={isCollapsed ? t('examRoom', lang) : undefined}
          onClick={onLinkClick}
          className={({ isActive }) =>
            `flex items-center ${isCollapsed ? 'justify-center px-2.5 py-2.5' : 'gap-3 px-3 py-2.5'} rounded-xl text-sm font-medium transition-colors ${
              isActive
                ? 'bg-[#094771]/70 text-[#FFFFFF] border border-[#007ACC]/50 font-semibold'
                : 'text-[#9D9D9D] hover:text-[#D4D4D4] hover:bg-[#2A2D2E]'
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
          `py-3.5 border-t border-[#3C3C3C] overflow-hidden flex items-center hover:bg-[#2A2D2E] transition-colors cursor-pointer ${
            isCollapsed ? 'px-2 justify-center' : 'px-4 justify-between'
          } ${isActive ? 'bg-[#094771]/40' : ''}`
        }
      >
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-8 h-8 rounded-full overflow-hidden border border-[#3C3C3C] bg-[#1E1E1E] flex items-center justify-center shrink-0">
            {profile.avatarUrl && failedAvatarUrl !== profile.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt="Avatar"
                onError={() => setFailedAvatarUrl(profile.avatarUrl)}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-[#D4D4D4] text-xs font-semibold">
                {profile.name ? profile.name.charAt(0).toUpperCase() : 'S'}
              </span>
            )}
          </div>
          {!isCollapsed && (
            <div className="text-left overflow-hidden">
              <p className="text-xs font-semibold text-[#D4D4D4] truncate">
                {profile.name || 'Student'}
              </p>
              <p className="text-[11px] text-[#858585] truncate">
                {profile.email || t('notConnected', lang)}
              </p>
            </div>
          )}
        </div>
        {!isCollapsed && (
          <Settings size={15} className="text-[#858585] shrink-0 ml-1" />
        )}
      </NavLink>
    </aside>
  );
}
