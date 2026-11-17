import { useState, useRef } from 'react';
import { Link, useInRouterContext } from 'react-router-dom';
import { Menu, Bell, RefreshCw, AlertTriangle, Globe } from 'lucide-react';
import { t } from '../utils/i18n';
import NotificationPopover from './NotificationPopover';
import { formatRelativeTime } from '../utils/dateUtils';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { useClassroom } from '../contexts/ClassroomContext';
import { useClassroomUI } from '../contexts/ClassroomUIContext';

function SafeLink({ to, className, children }) {
  const inRouter = useInRouterContext();
  if (inRouter) {
    return (
      <Link to={to} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <a href={to} className={className}>
      {children}
    </a>
  );
}

export default function HeaderBar({ setMobileMenuOpen }) {
  const { isLoggedIn, profile } = useAuth();
  const { lang, toggleLang, unreadCount = 0 } = useSettings();
  const { isSyncing, lastSyncTime, syncClassroom } = useClassroom();
  const { visibleAssignments } = useClassroomUI();

  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const bellButtonRef = useRef(null);

  const totalActive = visibleAssignments.filter(a => a.status !== 'done').length;
  const overdueCount = visibleAssignments.filter(a => {
    if (a.status === 'done' || !a.dueDate) return false;
    return new Date(a.dueDate) < new Date();
  }).length;

  return (
    <header className="h-16 border-b border-[#D2D2D7]/80 bg-white px-4 md:px-8 flex items-center justify-between shrink-0 z-30">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          aria-label="Open Mobile Menu"
          className="md:hidden w-10 h-10 flex items-center justify-center text-[#1D1D1F] hover:bg-[#F5F5F7] rounded-xl transition-colors border border-[#D2D2D7] cursor-pointer"
        >
          <Menu size={18} />
        </button>
        <div className="hidden sm:flex items-center gap-2.5">
          {isLoggedIn ? (
            <span className="text-xs font-medium bg-[#F5F5F7] text-[#1D1D1F] border border-[#D2D2D7] px-2.5 py-1 rounded-full">
              {t('googleConnected', lang)}
            </span>
          ) : (
            <span className="text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-1 rounded-full">
              {t('mockActive', lang)}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {isLoggedIn && (
          <div className="flex items-center gap-3 text-xs pr-3 border-r border-[#D2D2D7]/80">
            <span className="text-[#6E6E73] hidden lg:inline">
              {t('lastSync', lang)}{' '}
              <span className="text-[#1D1D1F] font-medium">{formatRelativeTime(lastSyncTime, lang)}</span>
            </span>
            <button
              type="button"
              onClick={() => syncClassroom()}
              disabled={isSyncing}
              aria-label="Sync Google Classroom data"
              className="flex items-center justify-center gap-1.5 bg-[#F5F5F7] hover:bg-[#E8E8ED] text-[#1D1D1F] font-medium px-3 h-9 rounded-xl border border-[#D2D2D7] transition-colors disabled:opacity-50 cursor-pointer"
              title="Sync Google Classroom data"
            >
              <RefreshCw size={13} className={isSyncing ? 'animate-spin text-[#0071E3]' : 'text-[#6E6E73]'} />
              <span>{isSyncing ? t('syncing', lang) : t('sync', lang)}</span>
            </button>
          </div>
        )}

        <div className="hidden lg:flex items-center gap-4 text-xs pr-3 border-r border-[#D2D2D7]/80">
          <SafeLink to="/dashboard?status=todo" className="text-right hover:opacity-80 transition-opacity">
            <span className="text-[#6E6E73] block">{t('tasksPending', lang)}</span>
            <span className="font-semibold text-[#1D1D1F]">
              {totalActive} {totalActive === 1 ? t('taskPlural', lang) : t('tasksPlural', lang)}
            </span>
          </SafeLink>
          {overdueCount > 0 && (
            <SafeLink to="/dashboard?status=todo" className="text-right hover:opacity-80 transition-opacity">
              <span className="text-rose-600 font-medium flex items-center gap-1">
                <AlertTriangle size={11} /> {t('overdueHeader', lang)}
              </span>
              <span className="font-semibold text-rose-600">
                {overdueCount} {overdueCount === 1 ? t('taskPlural', lang) : t('tasksPlural', lang)}
              </span>
            </SafeLink>
          )}
        </div>

        <button
          type="button"
          onClick={toggleLang}
          aria-label={lang === 'en' ? 'Switch to Thai' : 'เปลี่ยนเป็นภาษาอังกฤษ'}
          className="flex items-center justify-center gap-1.5 h-9 px-3 bg-[#F5F5F7] hover:bg-[#E8E8ED] border border-[#D2D2D7] text-xs font-medium rounded-xl text-[#1D1D1F] transition-colors cursor-pointer select-none shrink-0"
          title={lang === 'en' ? 'Switch to Thai' : 'เปลี่ยนเป็นภาษาอังกฤษ'}
        >
          <Globe size={13} className="text-[#6E6E73]" />
          <span>{lang === 'en' ? 'EN' : 'TH'}</span>
        </button>

        <div className="relative">
          <button
            type="button"
            ref={bellButtonRef}
            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
            aria-label="Notifications"
            className={`w-9 h-9 flex items-center justify-center rounded-xl transition-colors border relative cursor-pointer ${
              isNotificationsOpen
                ? 'text-[#0071E3] bg-[#0071E3]/10 border-[#0071E3]/30'
                : 'text-[#6E6E73] hover:text-[#1D1D1F] bg-[#F5F5F7] hover:bg-[#E8E8ED] border-[#D2D2D7]'
            }`}
          >
            <Bell size={16} />
            {unreadCount > 0 && (
              <span
                data-testid="notification-unread-badge"
                className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-rose-600 text-white text-[10px] font-semibold rounded-full flex items-center justify-center leading-none"
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          <NotificationPopover
            isNotificationsOpen={isNotificationsOpen}
            setIsNotificationsOpen={setIsNotificationsOpen}
            bellButtonRef={bellButtonRef}
          />
        </div>

        <SafeLink to="/settings" className="flex items-center gap-2.5 pl-1 hover:opacity-85 transition-opacity">
          <div className="w-8 h-8 rounded-full overflow-hidden bg-[#F5F5F7] border border-[#D2D2D7]">
            <img
              src={profile.avatarUrl || 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&q=80&w=200'}
              alt="Student Avatar"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="hidden sm:flex flex-col text-left max-w-[130px]">
            <span className="text-xs font-semibold text-[#1D1D1F] truncate">
              {profile.name || 'Student'}
            </span>
            <span className="text-[11px] text-[#6E6E73] truncate">
              {profile.email || t('connected', lang)}
            </span>
          </div>
        </SafeLink>
      </div>
    </header>
  );
}
