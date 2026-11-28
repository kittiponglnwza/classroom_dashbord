import { useState, useRef } from 'react';
import { Link, useInRouterContext } from 'react-router-dom';
import { Bell, RefreshCw, Globe, Download, HelpCircle, MessageSquareText } from 'lucide-react';
import { t } from '../utils/i18n';
import NotificationPopover from './NotificationPopover';
import QuickGuideModal from './QuickGuideModal';
import { formatRelativeTime } from '../utils/dateUtils';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { useClassroom } from '../contexts/ClassroomContext';
import { usePwaInstall } from '../hooks/usePwaInstall';

function SafeLink({ to, className, ariaLabel, children }) {
  const inRouter = useInRouterContext();
  if (inRouter) {
    return (
      <Link to={to} aria-label={ariaLabel} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <a href={to} aria-label={ariaLabel} className={className}>
      {children}
    </a>
  );
}

export default function HeaderBar({ onOpenAssistant }) {
  const { isLoggedIn, isCachedSession = false, rememberedAccount = null, profile = {}, login } = useAuth() || {};
  const { lang, toggleLang, unreadCount = 0 } = useSettings();
  const { isSyncing, lastSyncTime, syncClassroom } = useClassroom();
  const { canInstall, promptInstall } = usePwaInstall();

  const cachedMode = Boolean(!isLoggedIn && (isCachedSession || rememberedAccount?.email));

  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [failedAvatarUrl, setFailedAvatarUrl] = useState(null);
  const bellButtonRef = useRef(null);

  const notificationsLabel =
    unreadCount > 0
      ? lang === 'en'
        ? `Notifications (${unreadCount > 99 ? '99+' : unreadCount} unread)`
        : `การแจ้งเตือน (ยังไม่อ่าน ${unreadCount > 99 ? '99+' : unreadCount} รายการ)`
      : lang === 'en'
        ? 'Notifications'
        : 'การแจ้งเตือน';

  return (
    <header className="h-14 sm:h-16 border-b border-[var(--border)] bg-[var(--topbar-bg)] px-3 sm:px-6 lg:px-8 flex items-center justify-between gap-2 sm:gap-3 shrink-0 z-30">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <SafeLink
          to="/"
          ariaLabel="Classroom Hub Home"
          className="md:hidden min-h-11 px-1 flex items-center gap-2 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] rounded-lg"
        >
          <img
            src="/Logo.svg"
            alt=""
            aria-hidden="true"
            width={28}
            height={28}
            className="w-7 h-7 rounded-lg select-none"
          />
          <span className="hidden min-[400px]:inline text-xs font-medium text-[var(--text-heading)] truncate">
            Classroom Hub
          </span>
        </SafeLink>
        <div className="hidden sm:flex items-center gap-2 min-w-0">
          {isLoggedIn ? (
            <span className="inline-flex items-center gap-2 text-xs text-[var(--text-secondary)] bg-[var(--surface)] border border-[var(--border)] px-2.5 py-1 rounded-lg whitespace-nowrap truncate max-w-[200px] md:max-w-none">
              <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-[var(--success)] shrink-0" />
              <span>{t('googleConnected', lang)}</span>
            </span>
          ) : cachedMode ? (
            <span className="inline-flex items-center gap-2 text-xs text-[var(--text-secondary)] bg-[var(--surface)] border border-[var(--border)] px-2.5 py-1 rounded-lg whitespace-nowrap truncate max-w-[200px] md:max-w-none">
              <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
              <span>{t('cachedMode', lang)}</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 text-xs bg-amber-500/10 text-amber-300 border border-amber-500/25 px-2.5 py-1 rounded-lg whitespace-nowrap truncate max-w-[200px] md:max-w-none">
              <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
              <span>{t('mockActive', lang)}</span>
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {isLoggedIn ? (
          <button
            type="button"
            onClick={() => syncClassroom()}
            disabled={isSyncing}
            aria-label="Sync Google Classroom data"
            className="flex items-center justify-center gap-1.5 sm:gap-2 bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] text-xs font-medium px-2.5 sm:px-3 min-h-11 sm:min-h-0 sm:h-9 sm:min-w-[96px] rounded-lg border border-[var(--border)] transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
            title={`${t('lastSync', lang)} ${formatRelativeTime(lastSyncTime, lang)}`}
          >
            <RefreshCw aria-hidden="true" size={15} strokeWidth={1.5} className={isSyncing ? 'animate-spin text-[var(--primary-bright)]' : 'text-[var(--text-muted)]'} />
            <span>{isSyncing ? t('syncing', lang) : t('sync', lang)}</span>
          </button>
        ) : cachedMode && (
          <button
            type="button"
            onClick={() => login?.()}
            aria-label="Reconnect Google Classroom to sync"
            className="flex items-center justify-center gap-1.5 sm:gap-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-medium px-2.5 sm:px-3 min-h-11 sm:min-h-0 sm:h-9 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-bright)]"
            title={`${t('lastSync', lang)} ${formatRelativeTime(lastSyncTime, lang)}`}
          >
            <RefreshCw aria-hidden="true" size={14} strokeWidth={1.5} />
            <span>{t('connectSyncBtn', lang)}</span>
          </button>
        )}

        {canInstall && (
          <button
            type="button"
            onClick={promptInstall}
            aria-label={lang === 'en' ? 'Install App' : 'ติดตั้งแอป'}
            className="flex items-center justify-center gap-2 min-h-11 min-w-11 sm:min-h-0 sm:min-w-0 sm:h-9 sm:w-9 lg:w-auto lg:px-3 bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-xs font-medium rounded-lg text-[var(--text-primary)] transition-colors cursor-pointer select-none shrink-0 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
            title={lang === 'en' ? 'Install App' : 'ติดตั้งแอป'}
          >
            <Download aria-hidden="true" size={15} strokeWidth={1.5} className="text-[var(--primary-bright)]" />
            <span className="hidden lg:inline">{lang === 'en' ? 'Install App' : 'ติดตั้งแอป'}</span>
          </button>
        )}

        <button
          type="button"
          onClick={toggleLang}
          aria-label={lang === 'en' ? 'Switch to Thai' : 'เปลี่ยนเป็นภาษาอังกฤษ'}
          className="flex items-center justify-center gap-1.5 min-h-11 min-w-11 sm:min-h-0 sm:min-w-0 sm:h-9 px-2.5 lg:px-3 bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-xs font-medium rounded-lg text-[var(--text-primary)] transition-colors cursor-pointer select-none shrink-0 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
          title={lang === 'en' ? 'Switch to Thai' : 'เปลี่ยนเป็นภาษาอังกฤษ'}
        >
          <Globe aria-hidden="true" size={15} strokeWidth={1.5} className="text-[var(--text-muted)]" />
          <span>{lang === 'en' ? 'EN' : 'TH'}</span>
        </button>

        {onOpenAssistant && (
          <button
            type="button"
            onClick={onOpenAssistant}
            aria-label={lang === 'en' ? 'Open Study Assistant' : 'เปิดผู้ช่วยวางแผนการเรียน'}
            title={lang === 'en' ? 'Study Assistant' : 'ผู้ช่วยวางแผนการเรียน'}
            className="hidden md:flex h-9 px-2.5 items-center justify-center gap-1.5 rounded-lg transition-colors border bg-[var(--surface)] hover:bg-[var(--surface-hover)] border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-heading)] cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
          >
            <MessageSquareText aria-hidden="true" size={15} strokeWidth={1.5} className="text-[var(--primary-bright)]" />
            <span className="hidden lg:inline text-xs font-medium text-[var(--text-primary)]">
              {lang === 'en' ? 'Assistant' : 'ผู้ช่วยเรียน'}
            </span>
          </button>
        )}

        <button
          type="button"
          onClick={() => setIsGuideOpen(true)}
          aria-label={lang === 'en' ? 'Student Quick Guide' : 'คู่มือใช้งาน'}
          title={lang === 'en' ? 'Quick Guide' : 'คู่มือใช้งาน'}
          className="w-11 h-11 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg transition-colors border bg-[var(--surface)] hover:bg-[var(--surface-hover)] border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-heading)] cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
        >
          <HelpCircle aria-hidden="true" size={16} strokeWidth={1.5} />
        </button>

        <div className="relative shrink-0">
          <button
            type="button"
            ref={bellButtonRef}
            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
            aria-label={notificationsLabel}
            aria-expanded={isNotificationsOpen}
            aria-haspopup="dialog"
            className={`w-11 h-11 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg transition-colors border relative cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] ${
              isNotificationsOpen
                ? 'text-[var(--primary-bright)] bg-[var(--surface-elevated)] border-[var(--border-strong)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-heading)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] border-[var(--border)]'
            }`}
          >
            <Bell aria-hidden="true" size={16} strokeWidth={1.5} />
            {unreadCount > 0 && (
              <span
                data-testid="notification-unread-badge"
                aria-hidden="true"
                className="absolute top-0.5 right-0.5 sm:-top-1 sm:-right-1 min-w-[16px] h-4 px-1 bg-[var(--danger)] text-white text-[11px] font-mono font-medium rounded-full flex items-center justify-center leading-none tabular-nums"
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

        <SafeLink
          to="/settings"
          ariaLabel={lang === 'en' ? `Profile & Settings (${profile.name || 'Student'})` : `โปรไฟล์และการตั้งค่า (${profile.name || 'Student'})`}
          className="min-h-11 sm:min-h-0 flex items-center gap-2.5 pl-1.5 sm:pl-2 ml-0.5 border-l border-[var(--border)] hover:opacity-85 transition-opacity shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] rounded-lg"
        >
          <div className="w-8 h-8 rounded-full overflow-hidden bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center shrink-0">
            {profile.avatarUrl && failedAvatarUrl !== profile.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt="Student Avatar"
                width={32}
                height={32}
                referrerPolicy="no-referrer"
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
