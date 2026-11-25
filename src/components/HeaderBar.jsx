import { useState, useRef } from 'react';
import { Link, useInRouterContext } from 'react-router-dom';
import { Menu, Bell, RefreshCw, Globe, Download, HelpCircle } from 'lucide-react';
import { t } from '../utils/i18n';
import NotificationPopover from './NotificationPopover';
import QuickGuideModal from './QuickGuideModal';
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
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [failedAvatarUrl, setFailedAvatarUrl] = useState(null);
  const bellButtonRef = useRef(null);

  return (
    <header className="h-14 sm:h-16 border-b border-[var(--border)] bg-[var(--topbar-bg)] px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-2 sm:gap-3 shrink-0 z-30">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          aria-label="Open Mobile Menu"
          className="md:hidden w-9 h-9 flex items-center justify-center text-[var(--text-primary)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] rounded-lg transition-colors border border-[var(--border)] cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
        >
          <Menu size={16} strokeWidth={1.5} />
        </button>
        <SafeLink to="/" className="md:hidden flex items-center shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] rounded-lg">
          <img
            src="/Logo.svg"
            alt="Classroom Hub"
            className="w-7 h-7 rounded-lg select-none"
          />
        </SafeLink>
        <div className="hidden sm:flex items-center gap-2 min-w-0">
          {isLoggedIn ? (
            <span className="inline-flex items-center gap-2 text-xs text-[var(--text-secondary)] bg-[var(--surface)] border border-[var(--border)] px-2.5 py-1 rounded-lg whitespace-nowrap truncate max-w-[200px] md:max-w-none">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)] shrink-0" />
              <span>{t('googleConnected', lang)}</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 text-xs bg-amber-500/10 text-amber-300 border border-amber-500/25 px-2.5 py-1 rounded-lg whitespace-nowrap truncate max-w-[200px] md:max-w-none">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
              <span>{t('mockActive', lang)}</span>
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {isLoggedIn && (
          <button
            type="button"
            onClick={() => syncClassroom()}
            disabled={isSyncing}
            aria-label="Sync Google Classroom data"
            className="flex items-center justify-center gap-2 bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] text-xs font-medium px-3 h-9 sm:min-w-[96px] rounded-lg border border-[var(--border)] transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
            title={`${t('lastSync', lang)} ${formatRelativeTime(lastSyncTime, lang)}`}
          >
            <RefreshCw size={15} strokeWidth={1.5} className={isSyncing ? 'animate-spin text-[var(--primary-bright)]' : 'text-[var(--text-muted)]'} />
            <span>{isSyncing ? t('syncing', lang) : t('sync', lang)}</span>
          </button>
        )}

        {canInstall && (
          <button
            type="button"
            onClick={promptInstall}
            aria-label={lang === 'en' ? 'Install App' : 'ติดตั้งแอป'}
            className="flex items-center justify-center gap-2 h-9 w-9 sm:w-auto sm:px-3 bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-xs font-medium rounded-lg text-[var(--text-primary)] transition-colors cursor-pointer select-none shrink-0 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
            title={lang === 'en' ? 'Install App' : 'ติดตั้งแอป'}
          >
            <Download size={15} strokeWidth={1.5} className="text-[var(--primary-bright)]" />
            <span className="hidden lg:inline">{lang === 'en' ? 'Install App' : 'ติดตั้งแอป'}</span>
          </button>
        )}

        <button
          type="button"
          onClick={toggleLang}
          aria-label={lang === 'en' ? 'Switch to Thai' : 'เปลี่ยนเป็นภาษาอังกฤษ'}
          className="flex items-center justify-center gap-1.5 h-9 px-2.5 lg:px-3 bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-xs font-medium rounded-lg text-[var(--text-primary)] transition-colors cursor-pointer select-none shrink-0 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
          title={lang === 'en' ? 'Switch to Thai' : 'เปลี่ยนเป็นภาษาอังกฤษ'}
        >
          <Globe size={15} strokeWidth={1.5} className="text-[var(--text-muted)]" />
          <span>{lang === 'en' ? 'EN' : 'TH'}</span>
        </button>

        <button
          type="button"
          onClick={() => setIsGuideOpen(true)}
          aria-label={lang === 'en' ? 'Student Quick Guide' : 'คู่มือใช้งาน'}
          title={lang === 'en' ? 'Quick Guide' : 'คู่มือใช้งาน'}
          className="w-9 h-9 flex items-center justify-center rounded-lg transition-colors border bg-[var(--surface)] hover:bg-[var(--surface-hover)] border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-heading)] cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
        >
          <HelpCircle size={16} strokeWidth={1.5} />
        </button>

        <div className="relative shrink-0">
          <button
            type="button"
            ref={bellButtonRef}
            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
            aria-label="Notifications"
            className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors border relative cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] ${
              isNotificationsOpen
                ? 'text-[var(--primary-bright)] bg-[var(--surface-elevated)] border-[var(--border-strong)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-heading)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] border-[var(--border)]'
            }`}
          >
            <Bell size={16} strokeWidth={1.5} />
            {unreadCount > 0 && (
              <span
                data-testid="notification-unread-badge"
                className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-[var(--danger)] text-white text-[11px] font-mono font-medium rounded-full flex items-center justify-center leading-none tabular-nums"
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

        <SafeLink to="/settings" className="flex items-center gap-2.5 pl-2 ml-0.5 border-l border-[var(--border)] hover:opacity-85 transition-opacity shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] rounded-lg">
          <div className="w-8 h-8 rounded-full overflow-hidden bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center shrink-0">
            {profile.avatarUrl && failedAvatarUrl !== profile.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt="Student Avatar"
                onError={() => setFailedAvatarUrl(profile.avatarUrl)}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-xs font-medium text-[var(--text-primary)]">
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

      <QuickGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        lang={lang}
      />
    </header>
  );
}
