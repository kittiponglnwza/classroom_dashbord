import { useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { Home, LayoutDashboard, BookOpen, Settings, ChevronLeft, ChevronRight, ClipboardCheck, CalendarDays } from 'lucide-react';
import { t } from '../utils/i18n';
import { getCourseBadgeColor } from '../utils/colors';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { useClassroom } from '../contexts/ClassroomContext';

export default function Sidebar({ onLinkClick = null }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { profile } = useAuth();
  const { lang } = useSettings();
  const { visibleCourses, visibleAssignments } = useClassroom();

  const getActiveCount = (courseName) => {
    return visibleAssignments.filter(a => a.course === courseName && a.status !== 'done').length;
  };

  const totalActive = visibleAssignments.filter(a => a.status !== 'done').length;

  const navItems = [
    { name: 'Home', key: 'home', path: '/', icon: Home, count: null },
    { name: 'Dashboard', key: 'dashboard', path: '/dashboard', icon: LayoutDashboard, count: totalActive },
    { name: 'Schedule', key: 'schedule', path: '/schedule', icon: CalendarDays, count: null },
    { name: 'Courses', key: 'courses', path: '/courses', icon: BookOpen, count: null },
  ];

  return (
    <aside 
      className={`bg-dark-sidebar border-r border-dark-border flex flex-col transition-all duration-300 relative h-screen ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      <div className="p-5 flex items-center justify-between border-b border-dark-border">
        <Link to="/" onClick={onLinkClick} className="flex items-center gap-3 overflow-hidden select-none group">
          <div className="font-heading font-extrabold text-base text-white flex-shrink-0 select-none">
            CH
          </div>
          {!isCollapsed && (
            <div className="flex flex-col items-start min-w-0">
              <span className="font-heading font-bold text-sm text-white tracking-wide leading-tight group-hover:text-brand-400 transition-colors">
                Classroom Hub
              </span>
              <span className="text-[6.5px] font-bold text-dark-muted tracking-[0.14em] uppercase whitespace-nowrap mt-0.5">
                Learning • Connection • Community
              </span>
            </div>
          )}
        </Link>
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-6 bg-dark-card border border-dark-border text-dark-muted hover:text-white p-1 rounded-full hover:bg-dark-hover transition-colors shadow-lg z-20"
        >
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-7">
        <div className="space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              onClick={onLinkClick}
              className={({ isActive }) => 
                `flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all group duration-200 ${
                  isActive 
                    ? 'bg-brand-500/10 text-brand-400 border border-brand-500/20' 
                    : 'text-dark-muted hover:text-white hover:bg-dark-hover border border-transparent'
                }`
              }
            >
              <div className="flex items-center gap-3">
                <item.icon size={18} className="flex-shrink-0" />
                {!isCollapsed && <span>{t(item.key, lang)}</span>}
              </div>
              {!isCollapsed && item.count !== null && item.count > 0 && (
                <span className="bg-brand-500/20 text-brand-400 text-xs px-2 py-0.5 rounded-full font-semibold border border-brand-500/25">
                  {item.count}
                </span>
              )}
              {isCollapsed && item.count !== null && item.count > 0 && (
                <div className="w-2 h-2 rounded-full bg-brand-500 absolute top-2 right-2" />
              )}
            </NavLink>
          ))}
        </div>

        {!isCollapsed && visibleCourses.length > 0 && (
          <div className="space-y-2">
            <h3 className="px-3 text-xs font-semibold text-dark-muted uppercase tracking-wider flex items-center justify-between">
              <span>{t('myCourses', lang)}</span>
              <BookOpen size={12} />
            </h3>
            <div className="space-y-0.5">
              {visibleCourses.map((course) => {
                const count = getActiveCount(course.name);
                return (
                  <Link
                    key={course.id}
                    to={`/courses?selected=${course.name}`}
                    onClick={onLinkClick}
                    className="flex items-center justify-between px-3 py-2 rounded-lg text-sm text-dark-muted hover:text-white hover:bg-dark-hover transition-colors group"
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <span className={`w-2 h-2 rounded-full bg-${course.color}-500`} />
                      <span className="truncate text-xs font-medium">{course.name}</span>
                    </div>
                    {count > 0 && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold ${getCourseBadgeColor(course.color)}`}>
                        {count}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="px-3 pb-2 border-t border-dark-border/20 pt-2 shrink-0">
        <NavLink
          to="/exam-room"
          onClick={onLinkClick}
          className={({ isActive }) => 
            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group duration-200 ${
              isActive 
                ? 'bg-brand-500/10 text-brand-400 border border-brand-500/20' 
                : 'text-dark-muted hover:text-white hover:bg-dark-hover border border-transparent'
            }`
          }
        >
          <ClipboardCheck size={18} className="flex-shrink-0" />
          {!isCollapsed && <span>{t('examRoom', lang)}</span>}
        </NavLink>
      </div>

      <NavLink
        to="/settings"
        onClick={onLinkClick}
        className={({ isActive }) => 
          `p-4 border-t border-dark-border overflow-hidden flex items-center justify-between hover:bg-dark-hover transition-colors duration-200 group cursor-pointer ${
            isActive ? 'bg-brand-500/5' : ''
          }`
        }
      >
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-8 h-8 rounded-full overflow-hidden border border-brand-500/20 bg-brand-500/10 flex items-center justify-center flex-shrink-0">
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="text-brand-400 text-xs font-bold font-heading">
                {profile.name ? profile.name.charAt(0).toUpperCase() : 'S'}
              </span>
            )}
          </div>
          {!isCollapsed && (
            <div className="text-left overflow-hidden col-span-2">
              <p className="text-xs font-medium text-white truncate group-hover:text-brand-400 transition-colors">
                {profile.name || 'Student'}
              </p>
              <p className="text-[10px] text-dark-muted truncate">
                {profile.email || t('notConnected', lang)}
              </p>
            </div>
          )}
        </div>
        {!isCollapsed && (
          <Settings size={14} className="text-dark-muted group-hover:text-white transition-colors flex-shrink-0 ml-1" />
        )}
      </NavLink>
    </aside>
  );
}
