import { useState, useRef } from 'react';
import { Link, useInRouterContext } from 'react-router-dom';
import { Menu, Bell, RefreshCw, Globe, Download } from 'lucide-react';
import { t } from '../utils/i18n';
import NotificationPopover from './NotificationPopover';
import { formatRelativeTime } from '../utils/dateUtils';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { useClassroom } from '../contexts/ClassroomContext';
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
  const { canInstall, promptInstall } = usePwaInstall();

  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [failedAvatarUrl, setFailedAvatarUrl] = useState(null);
  const bellButtonRef = useRef(null);

  return (
    <header className="h-16 border-b border-[#333337] bg-[#222225] px-4 lg:px-6 xl:px-8 flex items-center justify-between gap-3 shrink-0 z-30">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          aria-label="Open Mobile Menu"
          className="md:hidden w-9 h-9 flex items-center justify-center text-[#D4D4D4] hover:bg-[#2A2D2E] rounded-xl transition-colors border border-[#343438] cursor-pointer shrink-0"
        >
          <Menu size={17} />
        </button>
        <div className="hidden sm:flex items-center gap-2 min-w-0">
          {isLoggedIn ? (
            <span className="inline-flex items-center gap-2 text-xs font-medium bg-[#1A1A1D] text-[#A0A0A8] border border-[#323236] px-3 py-1 rounded-full whitespace-nowrap truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/90 shrink-0" />
              <span>{t('googleConnected', lang)}</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 text-xs font-medium bg-amber-500/10 text-amber-300/90 border border-amber-500/25 px-3 py-1 rounded-full whitespace-nowrap truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
              <span>{t('mockActive', lang)}</span>
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2.5 shrink-0">
        {isLoggedIn && (
          <button
            type="button"
            onClick={() => syncClassroom()}
            disabled={isSyncing}
            aria-label="Sync Google Classroom data"
            className="flex items-center justify-center gap-1.5 bg-[#2A2A2E] hover:bg-[#323237] text-[#D4D4D4] text-xs font-medium px-3 h-9 rounded-xl border border-[#38383E] transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap shrink-0"
            title={`${t('lastSync', lang)} ${formatRelativeTime(lastSyncTime, lang)}`}
          >
            <RefreshCw size={13} className={isSyncing ? 'animate-spin text-[#3794FF]' : 'text-[#8E8E93]'} />
            <span>{isSyncing ? t('syncing', lang) : t('sync', lang)}</span>
          </button>
        )}

        {canInstall && (
          <button
            type="button"
            onClick={promptInstall}
            aria-label={lang === 'en' ? 'Install App' : 'ติดตั้งแอป'}
            className="flex items-center justify-center gap-1.5 h-9 px-2.5 lg:px-3 bg-[#2A2A2E] hover:bg-[#323237] border border-[#38383E] text-xs font-medium rounded-xl text-[#D4D4D4] transition-colors cursor-pointer select-none shrink-0 whitespace-nowrap"
            title={lang === 'en' ? 'Install App' : 'ติดตั้งแอป'}
          >
            <Download size={13} className="text-[#3794FF]" />
            <span className="hidden lg:inline">{lang === 'en' ? 'Install App' : 'ติดตั้งแอป'}</span>
          </button>
        )}

        <button
          type="button"
          onClick={toggleLang}
          aria-label={lang === 'en' ? 'Switch to Thai' : 'เปลี่ยนเป็นภาษาอังกฤษ'}
          className="flex items-center justify-center gap-1.5 h-9 px-2.5 lg:px-3 bg-[#2A2A2E] hover:bg-[#323237] border border-[#38383E] text-xs font-medium rounded-xl text-[#D4D4D4] transition-colors cursor-pointer select-none shrink-0 whitespace-nowrap"
          title={lang === 'en' ? 'Switch to Thai' : 'เปลี่ยนเป็นภาษาอังกฤษ'}
        >
          <Globe size={13} className="text-[#8E8E93]" />
          <span>{lang === 'en' ? 'EN' : 'TH'}</span>
        </button>

        <div className="relative shrink-0">
          <button
            type="button"
            ref={bellButtonRef}
            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
            aria-label="Notifications"
            className={`w-9 h-9 flex items-center justify-center rounded-xl transition-colors border relative cursor-pointer ${
              isNotificationsOpen
                ? 'text-[#3794FF] bg-[#007ACC]/15 border-[#007ACC]/35'
                : 'text-[#9D9D9D] hover:text-[#D4D4D4] bg-[#2A2A2E] hover:bg-[#323237] border-[#38383E]'
            }`}
          >
            <Bell size={15} />
            {unreadCount > 0 && (
              <span
                data-testid="notification-unread-badge"
                className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-rose-500 text-white text-[10px] font-semibold rounded-full flex items-center justify-center leading-none"
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

        <SafeLink to="/settings" className="flex items-center gap-2.5 pl-1.5 ml-0.5 border-l border-[#333337] hover:opacity-85 transition-opacity shrink-0">
          <div className="w-8 h-8 rounded-full overflow-hidden bg-[#1A1A1D] border border-[#38383E] flex items-center justify-center shrink-0">
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
          <div className="hidden lg:flex flex-col text-left max-w-[130px]">
            <span className="text-xs font-medium text-[#E5E5E7] truncate">
              {profile.name || 'Student'}
            </span>
          </div>
        </SafeLink>
      </div>
    </header>
  );
}
