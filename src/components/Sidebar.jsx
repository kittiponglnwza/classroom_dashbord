import { useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { 
  Home, 
  LayoutDashboard, 
  BookOpen, 
  Settings, 
  ChevronLeft, 
  ChevronRight, 
  CheckSquare, 
  Clock
} from 'lucide-react';

export default function Sidebar({ courses = [], assignments = [] }) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Get active assignment count for each course code
  const getActiveCount = (courseName) => {
    return assignments.filter(a => a.course === courseName && a.status !== 'done').length;
  };

  const totalActive = assignments.filter(a => a.status !== 'done').length;

  const navItems = [
    { name: 'Home', path: '/', icon: Home, count: null },
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, count: totalActive },
    { name: 'Courses', path: '/courses', icon: BookOpen, count: null },
    { name: 'Settings', path: '/settings', icon: Settings, count: null },
  ];

  // Helper function to map course colors to tailwind classes
  const getBadgeColors = (color) => {
    switch(color) {
      case 'emerald': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'blue': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'amber': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'rose': return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      case 'purple': return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      default: return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20';
    }
  };

  return (
    <aside 
      className={`bg-dark-sidebar border-r border-dark-border flex flex-col transition-all duration-300 relative h-screen ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="p-5 flex items-center justify-between border-b border-dark-border">
        <Link to="/" className="flex items-center gap-3 overflow-hidden">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-brand-600 to-brand-400 flex items-center justify-center font-bold text-white shadow-md shadow-brand-500/20 flex-shrink-0">
            CH
          </div>
          {!isCollapsed && (
            <span className="font-heading font-semibold text-lg text-white whitespace-nowrap bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
              Classroom Hub
            </span>
          )}
        </Link>
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-6 bg-dark-card border border-dark-border text-dark-muted hover:text-white p-1 rounded-full hover:bg-dark-hover transition-colors shadow-lg z-20"
        >
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      {/* Main Navigation */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-7">
        <div className="space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
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
                {!isCollapsed && <span>{item.name}</span>}
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

        {/* Courses Section */}
        {!isCollapsed && courses.length > 0 && (
          <div className="space-y-2">
            <h3 className="px-3 text-xs font-semibold text-dark-muted uppercase tracking-wider flex items-center justify-between">
              <span>My Courses</span>
              <BookOpen size={12} />
            </h3>
            <div className="space-y-0.5">
              {courses.map((course) => {
                const count = getActiveCount(course.name);
                return (
                  <Link
                    key={course.id}
                    to={`/courses?selected=${course.name}`}
                    className="flex items-center justify-between px-3 py-2 rounded-lg text-sm text-dark-muted hover:text-white hover:bg-dark-hover transition-colors group"
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <span className={`w-2 h-2 rounded-full bg-${course.color}-500`} />
                      <span className="truncate text-xs font-medium">{course.name}</span>
                    </div>
                    {count > 0 && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold ${getBadgeColors(course.color)}`}>
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

      {/* Footer Info */}
      <div className="p-4 border-t border-dark-border overflow-hidden">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400 text-xs font-bold font-heading flex-shrink-0">
            AM
          </div>
          {!isCollapsed && (
            <div className="text-left overflow-hidden">
              <p className="text-xs font-medium text-white truncate">Alex Mercer</p>
              <p className="text-[10px] text-dark-muted truncate">alex.m@university.edu</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
