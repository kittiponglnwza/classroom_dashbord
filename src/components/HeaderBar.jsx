import { useState, useRef } from 'react';
import { Link, useInRouterContext } from 'react-router-dom';
import { Menu, Bell, RefreshCw, AlertTriangle, Globe, Download } from 'lucide-react';
import { t } from '../utils/i18n';
import NotificationPopover from './NotificationPopover';
import { formatRelativeTime, isOverdue } from '../utils/dateUtils';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { useClassroom } from '../contexts/ClassroomContext';
import { useClassroomUI } from '../contexts/ClassroomUIContext';
import { usePwaInstall } from '../hooks/usePwaInstall';

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
  const { canInstall, promptInstall } = usePwaInstall();

  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [failedAvatarUrl, setFailedAvatarUrl] = useState(null);
  const bellButtonRef = useRef(null);

  const totalActive = visibleAssignments.filter(a => a.status !== 'done').length;
  const overdueCount = visibleAssignments.filter(a => a.status !== 'done' && isOverdue(a.dueDate)).length;

  return (
    <header className="h-16 border-b border-[#3C3C3C] bg-[#252526] px-4 md:px-8 flex items-center justify-between shrink-0 z-30">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          aria-label="Open Mobile Menu"
          className="md:hidden w-10 h-10 flex items-center justify-center text-[#D4D4D4] hover:bg-[#2A2D2E] rounded-xl transition-colors border border-[#3C3C3C] cursor-pointer"
        >
          <Menu size={18} />
        </button>
        <div className="hidden sm:flex items-center gap-2.5">
          {isLoggedIn ? (
            <span className="text-xs font-medium bg-[#1E1E1E] text-[#D4D4D4] border border-[#3C3C3C] px-2.5 py-1 rounded-full">
              {t('googleConnected', lang)}
            </span>
          ) : (
            <span className="text-xs font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30 px-2.5 py-1 rounded-full">
              {t('mockActive', lang)}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {isLoggedIn && (
          <div className="flex items-center gap-3 text-xs pr-3 border-r border-[#3C3C3C]">
            <span className="text-[#858585] hidden lg:inline">
              {t('lastSync', lang)}{' '}
              <span className="text-[#D4D4D4] font-medium">{formatRelativeTime(lastSyncTime, lang)}</span>
            </span>
            <button
              type="button"
              onClick={() => syncClassroom()}
              disabled={isSyncing}
              aria-label="Sync Google Classroom data"
              className="flex items-center justify-center gap-1.5 bg-[#2D2D2D] hover:bg-[#37373D] text-[#D4D4D4] font-medium px-3 h-9 rounded-xl border border-[#3C3C3C] transition-colors disabled:opacity-50 cursor-pointer"
              title="Sync Google Classroom data"
            >
              <RefreshCw size={13} className={isSyncing ? 'animate-spin text-[#3794FF]' : 'text-[#9D9D9D]'} />
              <span>{isSyncing ? t('syncing', lang) : t('sync', lang)}</span>
            </button>
          </div>
        )}

        <div className="hidden lg:flex items-center gap-4 text-xs pr-3 border-r border-[#3C3C3C]">
          <SafeLink to="/dashboard" className="text-right hover:opacity-80 transition-opacity">
            <span className="text-[#858585] block">{t('tasksPending', lang)}</span>
            <span className="font-semibold text-[#D4D4D4]">
              {totalActive} {totalActive === 1 ? t('taskPlural', lang) : t('tasksPlural', lang)}
            </span>
          </SafeLink>
          {overdueCount > 0 && (
            <SafeLink to="/dashboard" className="text-right hover:opacity-80 transition-opacity">
              <span className="text-rose-400 font-medium flex items-center gap-1">
                <AlertTriangle size={11} /> {t('overdueHeader', lang)}
              </span>
              <span className="font-semibold text-rose-400">
                {overdueCount} {overdueCount === 1 ? t('taskPlural', lang) : t('tasksPlural', lang)}
              </span>
            </SafeLink>
          )}
        </div>

        {canInstall && (
          <button
            type="button"
            onClick={promptInstall}
            aria-label={lang === 'en' ? 'Install App' : 'ติดตั้งแอป'}
            className="flex items-center justify-center gap-1.5 h-9 px-3 bg-[#007ACC]/20 hover:bg-[#007ACC]/30 border border-[#007ACC]/40 text-xs font-medium rounded-xl text-[#3794FF] transition-colors cursor-pointer select-none shrink-0 whitespace-nowrap"
            title={lang === 'en' ? 'Install App' : 'ติดตั้งแอป'}
          >
            <Download size={13} />
            <span>{lang === 'en' ? 'Install App' : 'ติดตั้งแอป'}</span>
          </button>
        )}

        <button
          type="button"
          onClick={toggleLang}
          aria-label={lang === 'en' ? 'Switch to Thai' : 'เปลี่ยนเป็นภาษาอังกฤษ'}
          className="flex items-center justify-center gap-1.5 h-9 px-3 bg-[#2D2D2D] hover:bg-[#37373D] border border-[#3C3C3C] text-xs font-medium rounded-xl text-[#D4D4D4] transition-colors cursor-pointer select-none shrink-0"
          title={lang === 'en' ? 'Switch to Thai' : 'เปลี่ยนเป็นภาษาอังกฤษ'}
        >
          <Globe size={13} className="text-[#9D9D9D]" />
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
                ? 'text-[#3794FF] bg-[#007ACC]/20 border-[#007ACC]/40'
                : 'text-[#9D9D9D] hover:text-[#D4D4D4] bg-[#2D2D2D] hover:bg-[#37373D] border-[#3C3C3C]'
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
          <div className="w-8 h-8 rounded-full overflow-hidden bg-[#1E1E1E] border border-[#3C3C3C] flex items-center justify-center shrink-0">
            {profile.avatarUrl && failedAvatarUrl !== profile.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt="Student Avatar"
                onError={() => setFailedAvatarUrl(profile.avatarUrl)}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-xs font-semibold text-[#D4D4D4]">
                {(profile.name || 'S').charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="hidden sm:flex flex-col text-left max-w-[130px]">
            <span className="text-xs font-semibold text-[#D4D4D4] truncate">
              {profile.name || 'Student'}
            </span>
            <span className="text-[11px] text-[#858585] truncate">
              {profile.email || t('connected', lang)}
            </span>
          </div>
        </SafeLink>
      </div>
    </header>
  );
}
