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
    <header className="h-16 border-b border-[var(--border)] bg-[var(--topbar-bg)] px-4 md:px-5 lg:px-6 xl:px-8 flex items-center justify-between gap-3 shrink-0 z-30">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          aria-label="Open Mobile Menu"
          className="md:hidden w-9 h-9 flex items-center justify-center text-[var(--text-primary)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] rounded-xl transition-colors border border-[var(--border)] cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
        >
          <Menu size={17} />
        </button>
        <div className="hidden sm:flex items-center gap-2 min-w-0">
          {isLoggedIn ? (
            <span className="inline-flex items-center gap-2 text-xs font-medium bg-[var(--surface)] text-[var(--text-secondary)] border border-[var(--border)] px-3 py-1 rounded-full whitespace-nowrap truncate max-w-[190px] md:max-w-none">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)] shrink-0" />
              <span>{t('googleConnected', lang)}</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 text-xs font-medium bg-amber-500/10 text-amber-300 border border-amber-500/25 px-3 py-1 rounded-full whitespace-nowrap truncate max-w-[190px] md:max-w-none">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
              <span>{t('mockActive', lang)}</span>
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
        {isLoggedIn && (
          <button
            type="button"
            onClick={() => syncClassroom()}
            disabled={isSyncing}
            aria-label="Sync Google Classroom data"
            className="flex items-center justify-center gap-1.5 bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] text-xs font-medium px-3 h-9 min-w-[96px] rounded-xl border border-[var(--border)] transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
            title={`${t('lastSync', lang)} ${formatRelativeTime(lastSyncTime, lang)}`}
          >
            <RefreshCw size={13} className={isSyncing ? 'animate-spin text-[var(--primary-bright)]' : 'text-[var(--text-muted)]'} />
            <span>{isSyncing ? t('syncing', lang) : t('sync', lang)}</span>
          </button>
        )}

        {canInstall && (
          <button
            type="button"
            onClick={promptInstall}
            aria-label={lang === 'en' ? 'Install App' : 'ติดตั้งแอป'}
            className="flex items-center justify-center gap-1.5 h-9 px-2.5 lg:px-3 bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-xs font-medium rounded-xl text-[var(--text-primary)] transition-colors cursor-pointer select-none shrink-0 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
            title={lang === 'en' ? 'Install App' : 'ติดตั้งแอป'}
          >
            <Download size={13} className="text-[var(--primary-bright)]" />
            <span className="hidden lg:inline">{lang === 'en' ? 'Install App' : 'ติดตั้งแอป'}</span>
          </button>
        )}

        <button
          type="button"
          onClick={toggleLang}
          aria-label={lang === 'en' ? 'Switch to Thai' : 'เปลี่ยนเป็นภาษาอังกฤษ'}
          className="flex items-center justify-center gap-1.5 h-9 px-2.5 lg:px-3 bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-xs font-medium rounded-xl text-[var(--text-primary)] transition-colors cursor-pointer select-none shrink-0 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
          title={lang === 'en' ? 'Switch to Thai' : 'เปลี่ยนเป็นภาษาอังกฤษ'}
        >
          <Globe size={13} className="text-[var(--text-muted)]" />
          <span>{lang === 'en' ? 'EN' : 'TH'}</span>
        </button>

        <div className="relative shrink-0">
          <button
            type="button"
            ref={bellButtonRef}
            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
            aria-label="Notifications"
            className={`w-9 h-9 flex items-center justify-center rounded-xl transition-colors border relative cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] ${
              isNotificationsOpen
                ? 'text-[var(--primary-bright)] bg-[var(--primary-active)]/60 border-[var(--primary)]/50'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-heading)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] border-[var(--border)]'
            }`}
          >
            <Bell size={15} />
            {unreadCount > 0 && (
              <span
                data-testid="notification-unread-badge"
                className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-rose-500 text-white text-[10px] font-semibold rounded-full flex items-center justify-center leading-none tabular-nums"
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

        <SafeLink to="/settings" className="flex items-center gap-2.5 pl-2 ml-0.5 border-l border-[var(--border)] hover:opacity-85 transition-opacity shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] rounded-xl">
          <div className="w-8 h-8 rounded-full overflow-hidden bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center shrink-0">
            {profile.avatarUrl && failedAvatarUrl !== profile.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt="Student Avatar"
                onError={() => setFailedAvatarUrl(profile.avatarUrl)}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-xs font-semibold text-[var(--text-primary)]">
                {(profile.name || 'S').charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="hidden lg:flex flex-col text-left max-w-[130px]">
            <span className="text-xs font-medium text-[var(--text-heading)] truncate">
              {profile.name || 'Student'}
            </span>
          </div>
        </SafeLink>
      </div>
    </header>
  );
}
