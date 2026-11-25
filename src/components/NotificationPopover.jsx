import { useState, useRef, useEffect, useId } from 'react';
import { useInRouterContext, useNavigate, useLocation } from 'react-router-dom';
import { Bell, RefreshCw, ArrowUpRight, Calendar, Mail, MessageSquare } from 'lucide-react';
import { t } from '../utils/i18n';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { useClassroom } from '../contexts/ClassroomContext';
import { triggerManualDigest, triggerTestEmail, triggerManualDiscordDigest, triggerTestDiscord } from '../utils/notifications';
import { DiscordService } from '../services/DiscordService';
import { syncManager } from '../services/SyncManager';
import { calendarSyncManager } from '../services/CalendarSyncManager';
import DiscordWebhookInput from './DiscordWebhookInput';

function resolveNotificationTarget(log, assignments = []) {
  if (log.targetPath) return log.targetPath;
  if (log.assignmentId && log.assignmentId !== 'sunday_digest_overall') {
    return `/assignments/${log.assignmentId}`;
  }
  const titleMatch = typeof log.title === 'string' && log.title.match(/'([^']+)'/);
  if (titleMatch && Array.isArray(assignments)) {
    const matched = assignments.find(a => a.title === titleMatch[1]);
    if (matched) return `/assignments/${matched.id}`;
  }
  if (log.type === 'settings_change' || log.type === 'test_email' || log.type === 'test_discord') {
    return '/settings';
  }
  if (log.type && (log.type.includes('due') || log.type.includes('overdue') || log.type.includes('digest') || log.type.includes('posts'))) {
    return '/dashboard';
  }
  return null;
}

function RouterOpenAction({ targetPath, onBeforeNavigate, lang }) {
  const navigate = useNavigate();
  const location = useLocation();
  const fromPath = `${location.pathname}${location.search}`;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (onBeforeNavigate) onBeforeNavigate();
        navigate(targetPath, { state: { from: fromPath } });
      }}
      className="inline-flex items-center gap-0.5 text-[11px] font-medium text-[var(--primary-bright)] hover:underline shrink-0 cursor-pointer"
    >
      <span>{t('openRelated', lang)}</span>
      <ArrowUpRight size={11} strokeWidth={1.5} />
    </button>
  );
}

export default function NotificationPopover({ isNotificationsOpen, setIsNotificationsOpen, bellButtonRef }) {
  const { isLoggedIn, isCachedSession = false, rememberedAccount = null, accessToken, profile, login } = useAuth() || {};
  const cachedMode = Boolean(!isLoggedIn && (isCachedSession || rememberedAccount?.email));
  const hasWorkspaceSession = Boolean(isLoggedIn || cachedMode);
  const {
    lang, emailAlerts, handleToggleAlerts, alertSettings, handleToggleSetting, handleUpdateSetting,
    sundayTime, handleTimeChange, historyLogs, unreadCount = 0, dailyLimit, discordTelemetry = null, refreshNotificationData,
    handleMarkNotificationRead, handleMarkAllNotificationsRead
  } = useSettings();
  const classroom = useClassroom();
  const assignments = classroom?.assignments || [];
  const inRouter = useInRouterContext();

  const [activeTab, setActiveTab] = useState('history');
  const [digestSending, setDigestSending] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [discordDigestSending, setDiscordDigestSending] = useState(false);
  const [discordTestSending, setDiscordTestSending] = useState(false);
  const deliveryTimeId = useId();
  const reminderValueId = useId();
  const discordWebhookInputId = useId();
  const [calendarSyncState, setCalendarSyncState] = useState(calendarSyncManager.state);
  const [reminderDraft, setReminderDraft] = useState(null);
  const popoverRef = useRef(null);

  const displayedReminderValue = reminderDraft !== null
    ? reminderDraft
    : String(alertSettings.calendarReminderValue ?? 10);

  useEffect(() => {
    return calendarSyncManager.subscribe((state) => {
      setCalendarSyncState(state);
    });
  }, []);

  useEffect(() => {
    if (!isNotificationsOpen) return;
    function handleClickOutside(event) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target) &&
        bellButtonRef.current &&
        !bellButtonRef.current.contains(event.target)
      ) {
        setIsNotificationsOpen(false);
      }
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setIsNotificationsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isNotificationsOpen, setIsNotificationsOpen, bellButtonRef]);

  const calendarStatusLabel = {
    queued: lang === 'en' ? 'Queued' : 'รอซิงก์',
    syncing: lang === 'en' ? 'Syncing' : 'กำลังซิงก์',
    success: lang === 'en' ? 'Synced' : 'ซิงก์แล้ว',
    failed: lang === 'en' ? 'Failed' : 'ซิงก์ไม่สำเร็จ'
  }[calendarSyncState] || calendarSyncState;

  const [uiFeedback, setUiFeedback] = useState({ text: '', type: '' });

  const handleSendDigestNow = async () => {
    setUiFeedback({ text: '', type: '' });
    if (!accessToken) {
      setUiFeedback({
        text: lang === 'en' ? 'Please connect to Google Classroom before performing this action.' : 'กรุณาเชื่อมต่อ Google Classroom ก่อนทำรายการนี้',
        type: 'error'
      });
      return;
    }
    setDigestSending(true);
    try {
      await triggerManualDigest(accessToken, profile.email, assignments);
      refreshNotificationData();
      syncManager.queueSync(accessToken, profile.email);
      setUiFeedback({
        text: lang === 'en' ? 'Digest sent successfully!' : 'ส่งสรุปผลงานไปที่ Gmail เรียบร้อยแล้ว!',
        type: 'success'
      });
    } catch (e) {
      console.error(e);
      setUiFeedback({
        text: (lang === 'en' ? 'Failed: ' : 'เกิดข้อผิดพลาด: ') + e.message,
        type: 'error'
      });
    } finally {
      setDigestSending(false);
    }
  };

  const handleSendTestEmail = async () => {
    setUiFeedback({ text: '', type: '' });
    if (!accessToken) {
      setUiFeedback({
        text: lang === 'en' ? 'Please connect to Google Classroom before performing this action.' : 'กรุณาเชื่อมต่อ Google Classroom ก่อนทำรายการนี้',
        type: 'error'
      });
      return;
    }
    setTestSending(true);
    try {
      await triggerTestEmail(accessToken, profile.email);
      refreshNotificationData();
      syncManager.queueSync(accessToken, profile.email);
      setUiFeedback({
        text: lang === 'en' ? 'Test email sent to your Gmail!' : 'ส่งอีเมลทดสอบไปที่ Gmail เรียบร้อยแล้ว!',
        type: 'success'
      });
    } catch (e) {
      console.error(e);
      setUiFeedback({
        text: (lang === 'en' ? 'Failed: ' : 'เกิดข้อผิดพลาด: ') + e.message,
        type: 'error'
      });
    } finally {
      setTestSending(false);
    }
  };

  const handleSyncCalendarNow = async () => {
    setUiFeedback({ text: '', type: '' });
    if (!accessToken || !profile?.email) {
      setUiFeedback({
        text: lang === 'en' ? 'Please connect to Google Classroom before performing this action.' : 'กรุณาเชื่อมต่อ Google Classroom ก่อนทำรายการนี้',
        type: 'error'
      });
      return;
    }
    try {
      await calendarSyncManager.runSync(accessToken, profile.email);
      setUiFeedback({
        text: lang === 'en' ? 'Google Calendar synced and deduplicated.' : 'ซิงก์และทำความสะอาดกิจกรรมบน Google Calendar เรียบร้อยแล้ว',
        type: 'success'
      });
    } catch (e) {
      console.error(e);
      setUiFeedback({
        text: (lang === 'en' ? 'Calendar sync failed: ' : 'ซิงก์ปฏิทินไม่สำเร็จ: ') + e.message,
        type: 'error'
      });
    }
  };

  const handleSendDiscordDigestNow = async () => {
    setUiFeedback({ text: '', type: '' });
    const check = DiscordService.validateWebhookUrl(alertSettings.discordWebhookUrl || '');
    if (!check.valid) {
      setUiFeedback({
        text: lang === 'en' ? 'Please enter a valid Discord Webhook URL first.' : 'กรุณาใส่ลิงก์ Discord Webhook ที่ถูกต้องก่อน',
        type: 'error'
      });
      return;
    }
    setDiscordDigestSending(true);
    try {
      await triggerManualDiscordDigest(profile.email, assignments, check.url);
      refreshNotificationData();
      if (accessToken && profile.email) {
        syncManager.queueSync(accessToken, profile.email);
      }
      setUiFeedback({
        text: lang === 'en' ? 'Digest sent to Discord!' : 'ส่งสรุปงานไปที่ Discord เรียบร้อยแล้ว!',
        type: 'success'
      });
    } catch (e) {
      console.error(e);
      setUiFeedback({
        text: (lang === 'en' ? 'Discord failed: ' : 'ส่งเข้า Discord ไม่สำเร็จ: ') + e.message,
        type: 'error'
      });
    } finally {
      setDiscordDigestSending(false);
    }
  };

  const handleSendTestDiscord = async () => {
    setUiFeedback({ text: '', type: '' });
    const check = DiscordService.validateWebhookUrl(alertSettings.discordWebhookUrl || '');
    if (!check.valid) {
      setUiFeedback({
        text: lang === 'en' ? 'Please enter a valid Discord Webhook URL first.' : 'กรุณาใส่ลิงก์ Discord Webhook ที่ถูกต้องก่อน',
        type: 'error'
      });
      return;
    }
    setDiscordTestSending(true);
    try {
      await triggerTestDiscord(profile.email, check.url);
      refreshNotificationData();
      if (accessToken && profile.email) {
        syncManager.queueSync(accessToken, profile.email);
      }
      setUiFeedback({
        text: lang === 'en' ? 'Test message sent to Discord!' : 'ส่งข้อความทดสอบไปที่ Discord เรียบร้อยแล้ว!',
        type: 'success'
      });
    } catch (e) {
      console.error(e);
      setUiFeedback({
        text: (lang === 'en' ? 'Discord failed: ' : 'ส่งเข้า Discord ไม่สำเร็จ: ') + e.message,
        type: 'error'
      });
    } finally {
      setDiscordTestSending(false);
    }
  };

  const discordCheck = DiscordService.validateWebhookUrl(alertSettings.discordWebhookUrl || '');

  const calendarMaxVal = alertSettings.calendarReminderUnit === 'days'
    ? 28
    : alertSettings.calendarReminderUnit === 'hours'
      ? 672
      : 40320;

  if (!isNotificationsOpen) return null;

  return (
    <div
      ref={popoverRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="notification-popover-title"
      className="fixed left-3 right-3 top-16 sm:top-12 sm:absolute sm:left-auto sm:right-0 z-50 sm:w-[400px] max-h-[calc(100dvh-5rem)] overflow-y-auto bg-[var(--surface-elevated)] border border-[var(--border-strong)] rounded-xl p-3.5 sm:p-4 space-y-3.5 sm:space-y-4 text-xs text-[var(--text-primary)] animate-fade-in"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] pb-3">
        <h3 id="notification-popover-title" className="font-medium text-xs text-[var(--text-heading)] flex items-center gap-2">
          <Bell size={14} strokeWidth={1.5} className="text-[var(--primary-bright)]" />
          {lang === 'en' ? 'Gmail & Calendar Alerts' : 'การแจ้งเตือน Gmail และ Calendar'}
        </h3>

        {hasWorkspaceSession && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[var(--text-secondary)] font-medium">
              {lang === 'en' ? 'Gmail:' : 'เมล:'}{' '}
              {emailAlerts ? (lang === 'en' ? 'On' : 'เปิด') : (lang === 'en' ? 'Off' : 'ปิด')}
            </span>
            <label className="relative inline-flex items-center cursor-pointer select-none">
              <input
                type="checkbox"
                checked={emailAlerts}
                onChange={(e) => handleToggleAlerts(e.target.checked)}
                aria-label={lang === 'en' ? 'Toggle Gmail Alerts' : 'เปิดปิดแจ้งเตือน Gmail'}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-[var(--border-strong)] peer-focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[var(--text-heading)] after:rounded-full after:h-4 after:w-4 after:transition-transform peer-checked:bg-[var(--primary)]"></div>
            </label>
          </div>
        )}
      </div>

      {hasWorkspaceSession ? (
        <div className="space-y-3.5">
          {cachedMode && (
            <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-200 text-[11px] flex items-center justify-between gap-2">
              <span>
                {lang === 'en'
                  ? 'Offline cache active — reconnect Google for Gmail & Calendar actions.'
                  : 'โหมดแคชออฟไลน์ — เชื่อมต่อ Google เพื่อส่งเมลหรือซิงก์ปฏิทิน'}
              </span>
              <button
                type="button"
                onClick={() => login?.()}
                className="shrink-0 px-2.5 py-1 rounded bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-medium transition-colors cursor-pointer"
              >
                {t('connectSyncBtn', lang)}
              </button>
            </div>
          )}
          {uiFeedback.text && (
            <div
              className={`p-2.5 rounded-lg border text-xs flex items-center justify-between ${
                uiFeedback.type === 'error'
                  ? 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                  : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
              }`}
            >
              <span>{uiFeedback.text}</span>
              <button
                type="button"
                aria-label={lang === 'en' ? 'Dismiss message' : 'ปิดข้อความ'}
                onClick={() => setUiFeedback({ text: '', type: '' })}
                className="text-sm hover:opacity-70 font-medium ml-2 cursor-pointer"
              >
                ×
              </button>
            </div>
          )}

          <div className="flex bg-[var(--app-bg)] p-1 rounded-lg border border-[var(--border)]">
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`flex-1 py-1.5 text-center font-medium text-xs rounded-md transition-colors cursor-pointer ${
                activeTab === 'history' ? 'bg-[var(--surface-elevated)] text-[var(--text-heading)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {lang === 'en' ? 'Logs' : 'ประวัติส่งเมล'}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className={`flex-1 py-1.5 text-center font-medium text-xs rounded-md transition-colors cursor-pointer ${
                activeTab === 'settings' ? 'bg-[var(--surface-elevated)] text-[var(--text-heading)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {lang === 'en' ? 'Settings' : 'ตั้งค่าแจ้งเตือน'}
            </button>
          </div>

          {activeTab === 'history' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--app-bg)] border border-[var(--border)] text-xs">
                <span className="text-[var(--text-secondary)] font-medium">{t('quotaLabel', lang)}</span>
                <span className="text-[var(--text-primary)] font-medium font-mono tabular-nums">{t('quotaDesc', lang, { count: dailyLimit.count })}</span>
              </div>
              {!emailAlerts && (
                <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-300 text-[11px]">
                  {t('gmailDisabledMsg', lang)}
                </div>
              )}
              {historyLogs.length > 0 && (
                <div className="flex items-center justify-between text-xs px-1">
                  <span className="text-[var(--text-secondary)] font-medium tabular-nums" data-testid="notification-unread-counter">
                    {unreadCount} {t('unreadLabel', lang)}
                  </span>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkAllNotificationsRead}
                      className="text-[var(--primary-bright)] hover:underline font-medium cursor-pointer"
                    >
                      {t('markAllRead', lang)}
                    </button>
                  )}
                </div>
              )}
              <div className="max-h-[210px] overflow-y-auto pr-1 space-y-2 text-xs">
                {historyLogs.length > 0 ? (
                  historyLogs.map(log => {
                    const formattedLogDate = new Date(log.sentAt).toLocaleDateString(lang === 'en' ? 'en-US' : 'th-TH', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit'
                    });
                    const isUnread = !log.read;
                    const targetPath = resolveNotificationTarget(log, assignments);

                    return (
                      <div
                        key={log.id}
                        className={`w-full p-3 rounded-lg border flex items-start justify-between gap-2 text-left transition-colors ${
                          isUnread
                            ? 'bg-[var(--primary)]/12 border-[var(--primary)]/35'
                            : 'bg-[var(--app-bg)] border-[var(--border)]'
                        }`}
                      >
                        <div className="flex flex-col gap-1 min-w-0 flex-1">
                          <button
                            type="button"
                            onClick={() => handleMarkNotificationRead && handleMarkNotificationRead(log.id, !log.read)}
                            className={`text-left font-medium leading-snug cursor-pointer hover:opacity-85 ${isUnread ? 'text-[var(--text-heading)]' : 'text-[var(--text-secondary)]'}`}
                          >
                            {log.title}
                          </button>
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-[11px] text-[var(--text-muted)] font-mono tabular-nums">{formattedLogDate}</span>
                              {(log.channel === 'discord' || String(log.type || '').includes('discord')) && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                                  log.status === 'failed' || log.status === 'ambiguous'
                                    ? 'border-rose-500/30 text-rose-300 bg-rose-500/10'
                                    : 'border-[var(--border)] text-[var(--text-muted)] bg-[var(--surface)]'
                                }`}>
                                  {log.status === 'failed' ? 'Discord error' : log.status === 'ambiguous' ? 'Discord timeout' : 'Discord'}
                                </span>
                              )}
                            </div>
                            {inRouter && targetPath && (
                              <RouterOpenAction
                                targetPath={targetPath}
                                lang={lang}
                                onBeforeNavigate={() => {
                                  if (isUnread && handleMarkNotificationRead) {
                                    handleMarkNotificationRead(log.id, true);
                                  }
                                  setIsNotificationsOpen(false);
                                }}
                              />
                            )}
                          </div>
                        </div>
                        {isUnread && (
                          <span
                            aria-label="unread"
                            className="w-2 h-2 rounded-full bg-[var(--primary-bright)] shrink-0 mt-1"
                          />
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-8 text-[var(--text-muted)] text-xs">
                    {t('noHistoryLogs', lang)}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
              {/* Gmail Triggers Section */}
              {emailAlerts ? (
                <div className="space-y-3.5 bg-[var(--app-bg)]/70 border border-[var(--border)] rounded-lg p-3">
                  <span className="block text-xs font-medium text-[var(--text-heading)]">{t('triggersHeader', lang)}</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-left">
                    {['due3Days', 'due1Day', 'dueToday', 'overdue1Day', 'newPosts'].map((field) => (
                      <label
                        key={field}
                        className={`flex items-start gap-2 cursor-pointer ${field === 'newPosts' ? 'col-span-1 sm:col-span-2' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(alertSettings[field])}
                          onChange={() => handleToggleSetting(field)}
                          className="w-3.5 h-3.5 rounded accent-[var(--primary)] cursor-pointer mt-0.5 shrink-0"
                        />
                        <div className="space-y-0.5">
                          <span className="font-medium text-[var(--text-primary)]">{t(`${field}Label`, lang)}</span>
                          <p className="text-[11px] text-[var(--text-muted)] leading-tight">{t(`${field}Desc`, lang)}</p>
                        </div>
                      </label>
                    ))}
                  </div>

                  <div className="border-t border-[var(--border)] pt-3 space-y-2.5 text-left">
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(alertSettings.sundayDigest)}
                        onChange={() => handleToggleSetting('sundayDigest')}
                        className="w-3.5 h-3.5 rounded accent-[var(--primary)] cursor-pointer mt-0.5 shrink-0"
                      />
                      <div className="space-y-0.5">
                        <span className="font-medium text-[var(--text-primary)]">{t('sundayDigestLabel', lang)}</span>
                        <p className="text-[11px] text-[var(--text-muted)] leading-tight">{t('sundayDigestDesc', lang)}</p>
                      </div>
                    </label>

                    {alertSettings.sundayDigest && (
                      <div className="flex items-center gap-2 pl-5">
                        <label htmlFor={deliveryTimeId} className="text-[11px] text-[var(--text-secondary)] font-medium">{t('deliveryTimeLabel', lang)}</label>
                        <input
                          id={deliveryTimeId}
                          type="time"
                          value={sundayTime}
                          onChange={(e) => handleTimeChange(e.target.value)}
                          className="bg-[var(--app-bg)] border border-[var(--border)] rounded-lg px-2 py-1 text-xs font-mono text-[var(--text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                        />
                      </div>
                    )}

                    <label className="flex items-start gap-2 cursor-pointer border-t border-[var(--border)] pt-2.5">
                      <input
                        type="checkbox"
                        checked={Boolean(alertSettings.includeExams)}
                        onChange={() => handleToggleSetting('includeExams')}
                        className="w-3.5 h-3.5 rounded accent-[var(--primary)] cursor-pointer mt-0.5 shrink-0"
                      />
                      <div className="space-y-0.5">
                        <span className="font-medium text-[var(--text-primary)]">{t('includeExamsLabel', lang)}</span>
                        <p className="text-[11px] text-[var(--text-muted)] leading-tight">{t('includeExamsDesc', lang)}</p>
                      </div>
                    </label>
                  </div>

                  <div className="pt-2 border-t border-[var(--border)] flex flex-col sm:flex-row gap-2">
                    <button
                      type="button"
                      disabled={digestSending || testSending}
                      onClick={handleSendDigestNow}
                      className="flex-1 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      {digestSending ? (
                        <>
                          <RefreshCw size={12} strokeWidth={1.5} className="animate-spin" />
                          <span>{t('sendingDigestBtn', lang)}</span>
                        </>
                      ) : (
                        <span>{t('sendDigestBtn', lang)}</span>
                      )}
                    </button>
                    <button
                      type="button"
                      disabled={testSending || digestSending}
                      onClick={handleSendTestEmail}
                      className="bg-[var(--surface-elevated)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-primary)] text-xs font-medium px-3 py-2 rounded-lg transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 shrink-0"
                    >
                      {testSending ? <RefreshCw size={12} strokeWidth={1.5} className="animate-spin text-[var(--primary-bright)]" /> : <Mail size={12} strokeWidth={1.5} className="text-[var(--primary-bright)]" />}
                      <span>{testSending ? t('sendingTestEmailBtn', lang) : t('sendTestEmailBtn', lang)}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center p-4 bg-[var(--app-bg)] rounded-lg border border-[var(--border)] text-[var(--text-secondary)] text-xs">
                  {t('gmailDisabledMsg', lang)}
                </div>
              )}

              {/* Independent Google Calendar Event Alerts Section */}
              <div className="space-y-3 bg-[var(--app-bg)]/70 border border-[var(--border)] rounded-lg p-3 text-left">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[var(--text-heading)] flex items-center gap-1.5">
                    <Calendar size={13} strokeWidth={1.5} className="text-[var(--primary-bright)]" />
                    <span>{t('calendarReminderLabel', lang)}</span>
                  </span>
                  {calendarSyncState !== 'idle' && (
                    <span className={`text-[11px] px-2 py-0.5 rounded-lg font-medium ${
                      calendarSyncState === 'failed'
                        ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                        : calendarSyncState === 'success'
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : 'bg-[var(--primary)]/15 text-[var(--primary-bright)] border border-[var(--primary)]/35'
                    }`}>
                      {calendarStatusLabel}
                    </span>
                  )}
                </div>

                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(alertSettings.calendarReminderEnabled)}
                    onChange={() => handleToggleSetting('calendarReminderEnabled')}
                    className="w-3.5 h-3.5 rounded accent-[var(--primary)] cursor-pointer mt-0.5 shrink-0"
                  />
                  <div className="space-y-0.5">
                    <span className="font-medium text-[var(--text-primary)]">{t('calendarReminderLabel', lang)}</span>
                    <p className="text-[11px] text-[var(--text-muted)] leading-tight">{t('calendarReminderDesc', lang)}</p>
                  </div>
                </label>

                {alertSettings.calendarReminderEnabled && (
                  <div className="flex flex-wrap items-center gap-2 pl-5">
                    <label htmlFor={reminderValueId} className="text-[11px] text-[var(--text-secondary)] font-medium">{t('notifyBeforeLabel', lang)}</label>
                    <input
                      id={reminderValueId}
                      type="number"
                      min="0"
                      max={calendarMaxVal}
                      value={displayedReminderValue}
                      onChange={(e) => {
                        const rawStr = e.target.value;
                        setReminderDraft(rawStr);
                        if (rawStr !== '') {
                          const parsed = parseInt(rawStr, 10);
                          if (!Number.isNaN(parsed)) {
                            handleUpdateSetting('calendarReminderValue', parsed);
                          }
                        }
                      }}
                      onBlur={() => {
                        if (reminderDraft !== null) {
                          const parsed = parseInt(reminderDraft, 10);
                          const finalVal = Number.isNaN(parsed) ? 0 : Math.min(Math.max(parsed, 0), calendarMaxVal);
                          setReminderDraft(null);
                          handleUpdateSetting('calendarReminderValue', finalVal);
                        }
                      }}
                      className="bg-[var(--app-bg)] border border-[var(--border)] rounded-lg px-2 py-1 w-16 text-xs font-mono tabular-nums text-[var(--text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                    />
                    <select
                      aria-label={lang === 'en' ? 'Reminder unit' : 'หน่วยเวลาแจ้งเตือน'}
                      value={alertSettings.calendarReminderUnit || 'minutes'}
                      onChange={(e) => handleUpdateSetting('calendarReminderUnit', e.target.value)}
                      className="bg-[var(--app-bg)] border border-[var(--border)] rounded-lg px-2 py-1 text-xs text-[var(--text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] cursor-pointer"
                    >
                      <option value="minutes">{t('minutesUnit', lang)}</option>
                      <option value="hours">{t('hoursUnit', lang)}</option>
                      <option value="days">{t('daysUnit', lang)}</option>
                    </select>
                  </div>
                )}

                <div className="pt-2 border-t border-[var(--border)]">
                  <button
                    type="button"
                    disabled={calendarSyncState === 'syncing'}
                    onClick={handleSyncCalendarNow}
                    className="w-full bg-[var(--surface-elevated)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-primary)] text-xs font-medium px-3 py-2 rounded-lg transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    <RefreshCw size={12} strokeWidth={1.5} className={calendarSyncState === 'syncing' ? 'animate-spin text-[var(--primary-bright)]' : 'text-[var(--primary-bright)]'} />
                    <span>{calendarSyncState === 'syncing' ? t('syncingCalendarBtn', lang) : t('syncCalendarNowBtn', lang)}</span>
                  </button>
                </div>
              </div>

              {/* Independent Discord Webhook Alerts Section */}
              <div className="space-y-3 bg-[var(--app-bg)]/70 border border-[var(--border)] rounded-lg p-3 text-left">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[var(--text-heading)] flex items-center gap-1.5">
                    <MessageSquare size={13} strokeWidth={1.5} className="text-[var(--text-secondary)]" />
                    <span>{lang === 'en' ? 'Discord Webhook Alerts' : 'แจ้งเตือนผ่าน Discord Webhook'}</span>
                  </span>
                  <span className={`text-[11px] px-2 py-0.5 rounded-lg font-medium ${
                    discordCheck.valid
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : (alertSettings.discordWebhookUrl || '').trim()
                        ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                        : 'bg-[var(--surface-elevated)] text-[var(--text-secondary)] border border-[var(--border)]'
                  }`}>
                    {discordCheck.valid
                      ? (lang === 'en' ? 'Webhook Ready' : 'พร้อมใช้งาน')
                      : (alertSettings.discordWebhookUrl || '').trim()
                        ? (lang === 'en' ? 'Invalid URL' : 'ลิงก์ไม่ถูกต้อง')
                        : (lang === 'en' ? 'Not Configured' : 'ยังไม่ตั้งค่า')}
                  </span>
                </div>

                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(alertSettings.discordEnabled)}
                    onChange={() => handleToggleSetting('discordEnabled')}
                    className="w-3.5 h-3.5 rounded accent-[var(--primary)] cursor-pointer mt-0.5 shrink-0"
                  />
                  <div className="space-y-0.5">
                    <span className="font-medium text-[var(--text-primary)]">
                      {lang === 'en' ? 'Enable Discord Webhook Notifications' : 'เปิดส่งแจ้งเตือนเข้า Discord อัตโนมัติ'}
                    </span>
                    <p className="text-[11px] text-[var(--text-muted)] leading-tight">
                      {lang === 'en'
                        ? 'Morning briefing, coursework reminders, exam countdowns, and digests'
                        : 'สรุปตารางเช้า การบ้านใกล้ส่ง นับถอยหลังวันสอบ และประกาศใหม่'}
                    </p>
                  </div>
                </label>

                <div className="space-y-1.5">
                  <label htmlFor={discordWebhookInputId} className="block text-[11px] text-[var(--text-secondary)] font-medium">
                    {lang === 'en' ? 'Discord Webhook URL' : 'ลิงก์ Discord Webhook'}
                  </label>
                  <DiscordWebhookInput
                    id={discordWebhookInputId}
                    value={alertSettings.discordWebhookUrl || ''}
                    onChange={(nextVal) => handleUpdateSetting('discordWebhookUrl', nextVal)}
                    lang={lang}
                    compact
                  />
                </div>

                {discordTelemetry?.lastErrorMessage && discordTelemetry.lastStatus !== 'delivered' && (
                  <p className="text-[11px] text-rose-300 break-words">
                    {discordTelemetry.lastErrorMessage}
                  </p>
                )}

                <div className="pt-2 border-t border-[var(--border)] flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    disabled={discordDigestSending || discordTestSending || !discordCheck.valid}
                    onClick={handleSendDiscordDigestNow}
                    className="flex-1 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {discordDigestSending ? (
                      <>
                        <RefreshCw size={12} strokeWidth={1.5} className="animate-spin" />
                        <span>{lang === 'en' ? 'Sending...' : 'กำลังส่ง...'}</span>
                      </>
                    ) : (
                      <span>{lang === 'en' ? 'Send Discord Digest' : 'ส่งสรุปเข้า Discord'}</span>
                    )}
                  </button>
                  <button
                    type="button"
                    disabled={discordTestSending || discordDigestSending || !discordCheck.valid}
                    onClick={handleSendTestDiscord}
                    className="bg-[var(--surface-elevated)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-primary)] text-xs font-medium px-3 py-2 rounded-lg transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 shrink-0"
                  >
                    {discordTestSending ? <RefreshCw size={12} strokeWidth={1.5} className="animate-spin text-[var(--text-secondary)]" /> : <MessageSquare size={12} strokeWidth={1.5} className="text-[var(--text-secondary)]" />}
                    <span>{lang === 'en' ? 'Test Discord' : 'ทดสอบ Discord'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center p-6 text-[var(--text-muted)] text-xs">
          {lang === 'en' ? 'Connect Google Classroom to enable alerts.' : 'เชื่อมต่อบัญชี Google เพื่อใช้งานการแจ้งเตือน'}
        </div>
      )}
    </div>
  );
}
