import { useContext } from 'react';
import { NavLink, useLocation, useInRouterContext } from 'react-router-dom';
import { Home, ClipboardList, CalendarDays, BookOpen, Menu } from 'lucide-react';
import { t } from '../utils/i18n';
import { SettingsContext } from '../contexts/SettingsContext';
import { ClassroomUIContext } from '../contexts/ClassroomUIContext';

export default function MobileBottomNav({ onOpenMenu }) {
  const inRouter = useInRouterContext();
  const settingsCtx = useContext(SettingsContext);
  const uiCtx = useContext(ClassroomUIContext);
  const lang = settingsCtx?.lang || 'en';
  const visibleAssignments = uiCtx?.visibleAssignments || [];
  const totalActive = visibleAssignments.filter((a) => a.status !== 'done' && a.status !== 'read').length;

  if (!inRouter) {
    return null;
  }

  return <MobileBottomNavInner lang={lang} totalActive={totalActive} onOpenMenu={onOpenMenu} />;
}

function MobileBottomNavInner({ lang, totalActive, onOpenMenu }) {
  const location = useLocation();
  const selectedCourseParam = location.pathname === '/courses'
    ? new URLSearchParams(location.search).get('selected')
    : null;

  const tabs = [
    { to: '/', label: t('home', lang), icon: Home, end: true },
    {
      to: '/dashboard',
      label: lang === 'th' ? 'งาน' : 'Tasks',
      icon: ClipboardList,
      badge: totalActive,
    },
    { to: '/schedule', label: lang === 'th' ? 'ตาราง' : 'Schedule', icon: CalendarDays },
    { to: '/courses', label: lang === 'th' ? 'วิชา' : 'Courses', icon: BookOpen, end: true },
  ];

  return (
    <nav
      aria-label="Mobile Bottom Navigation"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[var(--topbar-bg)] border-t border-[var(--border)] px-2 pt-1 pb-[calc(0.25rem+env(safe-area-inset-bottom))]"
    >
      <div className="grid grid-cols-5 gap-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) => {
                const active = tab.to === '/courses' ? (isActive && !selectedCourseParam) : isActive;
                return `relative flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 rounded-lg text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] ${
                  active
                    ? 'text-[var(--text-heading)] bg-[var(--surface-elevated)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`;
              }}
            >
              {({ isActive }) => {
                const active = tab.to === '/courses' ? (isActive && !selectedCourseParam) : isActive;
                return (
                  <>
                    <div className="relative">
                      <Icon size={18} strokeWidth={1.5} className={active ? 'text-[var(--primary-bright)]' : undefined} />
                      {tab.badge > 0 && (
                        <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-[var(--primary)] text-white text-[11px] font-mono font-medium flex items-center justify-center leading-none tabular-nums">
                          {tab.badge > 99 ? '99+' : tab.badge}
                        </span>
                      )}
                    </div>
                    <span className="truncate max-w-full leading-tight">{tab.label}</span>
                  </>
                );
              }}
            </NavLink>
          );
        })}

        <button
          type="button"
          onClick={onOpenMenu}
          aria-label={lang === 'th' ? 'เมนูทั้งหมด' : 'More navigation'}
          className="flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 rounded-lg text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
        >
          <Menu size={18} strokeWidth={1.5} />
          <span className="truncate max-w-full leading-tight">{lang === 'th' ? 'เมนู' : 'More'}</span>
        </button>
      </div>
    </nav>
  );
}
