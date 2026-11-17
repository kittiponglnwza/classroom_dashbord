import { useState } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { Home, LayoutDashboard, BookOpen, Settings, ChevronLeft, ChevronRight, ClipboardCheck, CalendarDays } from 'lucide-react';
import { t } from '../utils/i18n';
import { getCourseDotClass } from '../utils/colors';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { useClassroomUI } from '../contexts/ClassroomUIContext';

export default function Sidebar({ onLinkClick = null }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { profile } = useAuth();
  const { lang } = useSettings();
  const { visibleCourses, visibleAssignments } = useClassroomUI();
  const location = useLocation();

  const selectedCourseParam = location.pathname === '/courses'
    ? new URLSearchParams(location.search).get('selected')
    : null;

  const getActiveCount = (courseName) => {
    return visibleAssignments.filter(a => a.course === courseName && a.status !== 'done').length;
  };

  const totalActive = visibleAssignments.filter(a => a.status !== 'done').length;

  const navItems = [
    { name: 'Home', key: 'home', path: '/', icon: Home, count: null, end: true },
    { name: 'Dashboard', key: 'dashboard', path: '/dashboard', icon: LayoutDashboard, count: totalActive },
    { name: 'Schedule', key: 'schedule', path: '/schedule', icon: CalendarDays, count: null },
    { name: 'Courses', key: 'courses', path: '/courses', icon: BookOpen, count: null, end: true },
  ];

  return (
    <aside
      className={`bg-white border-r border-[#D2D2D7]/80 flex flex-col transition-all duration-200 relative h-screen select-none ${
        isCollapsed ? 'w-18' : 'w-64'
      }`}
    >
      <div className="h-16 px-4 flex items-center justify-between border-b border-[#D2D2D7]/70">
        <Link to="/" onClick={onLinkClick} className="flex items-center gap-2.5 overflow-hidden">
          <div className="w-8 h-8 rounded-lg bg-[#0071E3] text-white font-semibold text-xs flex items-center justify-center shrink-0">
            CH
          </div>
          {!isCollapsed && (
            <div className="flex flex-col items-start min-w-0">
              <span className="font-semibold text-sm text-[#1D1D1F] tracking-tight truncate">
                Classroom Hub
              </span>
              <span className="text-[11px] text-[#6E6E73] truncate">
                {lang === 'en' ? 'Student Workspace' : 'พื้นที่จัดการการเรียน'}
              </span>
            </div>
          )}
        </Link>
        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="hidden md:flex w-7 h-7 bg-white border border-[#D2D2D7] text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-[#F5F5F7] rounded-lg transition-colors items-center justify-center cursor-pointer shrink-0"
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
              onClick={onLinkClick}
              className={({ isActive }) => {
                const active = item.path === '/courses' ? (isActive && !selectedCourseParam) : isActive;
                return `flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  active
                    ? 'bg-[#0071E3]/10 text-[#0071E3] font-semibold'
                    : 'text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-[#F5F5F7]'
                }`;
              }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <item.icon size={18} className="shrink-0" />
                {!isCollapsed && <span className="truncate">{t(item.key, lang)}</span>}
              </div>
              {!isCollapsed && item.count !== null && item.count > 0 && (
                <span className="bg-[#F5F5F7] text-[#1D1D1F] text-xs px-2 py-0.5 rounded-full font-medium border border-[#D2D2D7]/80">
                  {item.count}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {!isCollapsed && visibleCourses.length > 0 && (
          <div className="space-y-1.5">
            <h3 className="px-3 text-xs font-medium text-[#6E6E73] flex items-center justify-between">
              <span>{t('myCourses', lang)}</span>
            </h3>
            <nav aria-label="Courses Navigation" className="space-y-0.5">
              {visibleCourses.map((course) => {
                const count = getActiveCount(course.name);
                const isCourseActive = selectedCourseParam === course.name;
                return (
                  <Link
                    key={course.id}
                    to={`/courses?selected=${encodeURIComponent(course.name)}`}
                    onClick={onLinkClick}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors ${
                      isCourseActive
                        ? 'bg-[#0071E3]/10 text-[#0071E3] font-semibold'
                        : 'text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-[#F5F5F7] font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${getCourseDotClass(course.color)}`} />
                      <span className="truncate">{course.name}</span>
                    </div>
                    {count > 0 && (
                      <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-[#F5F5F7] text-[#6E6E73] border border-[#D2D2D7]/70 font-medium shrink-0">
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

      <div className="px-3 py-2 border-t border-[#D2D2D7]/70 shrink-0">
        <NavLink
          to="/exam-room"
          onClick={onLinkClick}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              isActive
                ? 'bg-[#0071E3]/10 text-[#0071E3] font-semibold'
                : 'text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-[#F5F5F7]'
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
          `px-4 py-3.5 border-t border-[#D2D2D7]/70 overflow-hidden flex items-center justify-between hover:bg-[#F5F5F7] transition-colors cursor-pointer ${
            isActive ? 'bg-[#0071E3]/5' : ''
          }`
        }
      >
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-8 h-8 rounded-full overflow-hidden border border-[#D2D2D7] bg-[#F5F5F7] flex items-center justify-center shrink-0">
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="text-[#1D1D1F] text-xs font-semibold">
                {profile.name ? profile.name.charAt(0).toUpperCase() : 'S'}
              </span>
            )}
          </div>
          {!isCollapsed && (
            <div className="text-left overflow-hidden">
              <p className="text-xs font-semibold text-[#1D1D1F] truncate">
                {profile.name || 'Student'}
              </p>
              <p className="text-[11px] text-[#6E6E73] truncate">
                {profile.email || t('notConnected', lang)}
              </p>
            </div>
          )}
        </div>
        {!isCollapsed && (
          <Settings size={15} className="text-[#6E6E73] shrink-0 ml-1" />
        )}
      </NavLink>
    </aside>
  );
}
