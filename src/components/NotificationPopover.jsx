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
      className="inline-flex items-center gap-0.5 text-[11px] font-medium text-[#3794FF] hover:underline shrink-0 cursor-pointer"
    >
      <span>{t('openRelated', lang)}</span>
      <ArrowUpRight size={11} />
    </button>
  );
}

export default function NotificationPopover({ isNotificationsOpen, setIsNotificationsOpen, bellButtonRef }) {
  const { isLoggedIn, accessToken, profile } = useAuth();
  const {
    lang, emailAlerts, handleToggleAlerts, alertSettings, handleToggleSetting, handleUpdateSetting,
    sundayTime, handleTimeChange, historyLogs, unreadCount = 0, dailyLimit, refreshNotificationData,
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
      className="fixed left-3 right-3 top-16 sm:top-12 sm:absolute sm:left-auto sm:right-0 z-50 sm:w-[400px] max-h-[calc(100dvh-5rem)] overflow-y-auto bg-[#252526] border border-[#3C3C3C] rounded-2xl shadow-xl p-3.5 sm:p-4 space-y-3.5 sm:space-y-4 text-xs text-[#D4D4D4] animate-fade-in"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#3C3C3C] pb-3">
        <h3 id="notification-popover-title" className="font-semibold text-xs text-[#FFFFFF] flex items-center gap-2">
          <Bell size={14} className="text-[#3794FF]" />
          {lang === 'en' ? 'Gmail & Calendar Alerts' : 'การแจ้งเตือน Gmail และ Calendar'}
        </h3>

        {isLoggedIn && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[#9D9D9D] font-medium">
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
              <div className="w-8 h-4.5 bg-[#3C3C3C] peer-focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007ACC] rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-[#007ACC]"></div>
            </label>
          </div>
        )}
      </div>

      {isLoggedIn ? (
        <div className="space-y-3.5">
          {uiFeedback.text && (
            <div
              className={`p-2.5 rounded-xl border text-xs flex items-center justify-between ${
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
                className="text-sm hover:opacity-70 font-semibold ml-2 cursor-pointer"
              >
                ×
              </button>
            </div>
          )}

          <div className="flex bg-[#1E1E1E] p-1 rounded-xl border border-[#3C3C3C]">
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`flex-1 py-1.5 text-center font-medium text-xs rounded-lg transition-colors cursor-pointer ${
                activeTab === 'history' ? 'bg-[#2D2D2D] text-[#FFFFFF] font-semibold' : 'text-[#9D9D9D] hover:text-[#D4D4D4]'
              }`}
            >
              {lang === 'en' ? 'Logs' : 'ประวัติส่งเมล'}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className={`flex-1 py-1.5 text-center font-medium text-xs rounded-lg transition-colors cursor-pointer ${
                activeTab === 'settings' ? 'bg-[#2D2D2D] text-[#FFFFFF] font-semibold' : 'text-[#9D9D9D] hover:text-[#D4D4D4]'
              }`}
            >
              {lang === 'en' ? 'Settings' : 'ตั้งค่าแจ้งเตือน'}
            </button>
          </div>

          {activeTab === 'history' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#1E1E1E] border border-[#3C3C3C] text-xs">
                <span className="text-[#9D9D9D] font-medium">{t('quotaLabel', lang)}</span>
                <span className="text-[#D4D4D4] font-semibold">{t('quotaDesc', lang, { count: dailyLimit.count })}</span>
              </div>
              {!emailAlerts && (
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-300 text-[11px]">
                  {t('gmailDisabledMsg', lang)}
                </div>
              )}
              {historyLogs.length > 0 && (
                <div className="flex items-center justify-between text-xs px-1">
                  <span className="text-[#9D9D9D] font-medium" data-testid="notification-unread-counter">
                    {unreadCount} {t('unreadLabel', lang)}
                  </span>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkAllNotificationsRead}
                      className="text-[#3794FF] hover:underline font-medium cursor-pointer"
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
                        className={`w-full p-3 rounded-xl border flex items-start justify-between gap-2 text-left transition-colors ${
                          isUnread
                            ? 'bg-[#094771]/35 border-[#007ACC]/50'
                            : 'bg-[#1E1E1E] border-[#3C3C3C]'
                        }`}
                      >
                        <div className="flex flex-col gap-1 min-w-0 flex-1">
                          <button
                            type="button"
                            onClick={() => handleMarkNotificationRead && handleMarkNotificationRead(log.id, !log.read)}
                            className={`text-left font-medium leading-snug cursor-pointer hover:opacity-85 ${isUnread ? 'text-[#FFFFFF] font-semibold' : 'text-[#9D9D9D]'}`}
                          >
                            {log.title}
                          </button>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] text-[#858585]">{formattedLogDate}</span>
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
                            className="w-2 h-2 rounded-full bg-[#3794FF] shrink-0 mt-1"
                          />
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-8 text-[#858585] text-xs">
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
                <div className="space-y-3.5 bg-[#1E1E1E]/60 border border-[#3C3C3C] rounded-xl p-3">
                  <span className="block text-xs font-semibold text-[#FFFFFF]">{t('triggersHeader', lang)}</span>
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
                          className="w-3.5 h-3.5 rounded accent-[#007ACC] cursor-pointer mt-0.5 shrink-0"
                        />
                        <div className="space-y-0.5">
                          <span className="font-medium text-[#D4D4D4]">{t(`${field}Label`, lang)}</span>
                          <p className="text-[11px] text-[#858585] leading-tight">{t(`${field}Desc`, lang)}</p>
                        </div>
                      </label>
                    ))}
                  </div>

                  <div className="border-t border-[#3C3C3C] pt-3 space-y-2.5 text-left">
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(alertSettings.sundayDigest)}
                        onChange={() => handleToggleSetting('sundayDigest')}
                        className="w-3.5 h-3.5 rounded accent-[#007ACC] cursor-pointer mt-0.5 shrink-0"
                      />
                      <div className="space-y-0.5">
                        <span className="font-medium text-[#D4D4D4]">{t('sundayDigestLabel', lang)}</span>
                        <p className="text-[11px] text-[#858585] leading-tight">{t('sundayDigestDesc', lang)}</p>
                      </div>
                    </label>

                    {alertSettings.sundayDigest && (
                      <div className="flex items-center gap-2 pl-5">
                        <label htmlFor={deliveryTimeId} className="text-[11px] text-[#9D9D9D] font-medium">{t('deliveryTimeLabel', lang)}</label>
                        <input
                          id={deliveryTimeId}
                          type="time"
                          value={sundayTime}
                          onChange={(e) => handleTimeChange(e.target.value)}
                          className="bg-[#1E1E1E] border border-[#3C3C3C] rounded-lg px-2 py-1 text-xs text-[#D4D4D4] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007ACC]"
                        />
                      </div>
                    )}

                    <label className="flex items-start gap-2 cursor-pointer border-t border-[#3C3C3C] pt-2.5">
                      <input
                        type="checkbox"
                        checked={Boolean(alertSettings.includeExams)}
                        onChange={() => handleToggleSetting('includeExams')}
                        className="w-3.5 h-3.5 rounded accent-[#007ACC] cursor-pointer mt-0.5 shrink-0"
                      />
                      <div className="space-y-0.5">
                        <span className="font-medium text-[#D4D4D4]">{t('includeExamsLabel', lang)}</span>
                        <p className="text-[11px] text-[#858585] leading-tight">{t('includeExamsDesc', lang)}</p>
                      </div>
                    </label>
                  </div>

                  <div className="pt-2 border-t border-[#3C3C3C] flex flex-col sm:flex-row gap-2">
                    <button
                      type="button"
                      disabled={digestSending || testSending}
                      onClick={handleSendDigestNow}
                      className="flex-1 bg-[#007ACC] hover:bg-[#1177BB] text-white text-xs font-medium px-3 py-2 rounded-xl transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      {digestSending ? (
                        <>
                          <RefreshCw size={12} className="animate-spin" />
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
                      className="bg-[#2D2D2D] hover:bg-[#37373D] border border-[#3C3C3C] text-[#D4D4D4] text-xs font-medium px-3 py-2 rounded-xl transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 shrink-0"
                    >
                      {testSending ? <RefreshCw size={12} className="animate-spin text-[#3794FF]" /> : <Mail size={12} className="text-[#3794FF]" />}
                      <span>{testSending ? t('sendingTestEmailBtn', lang) : t('sendTestEmailBtn', lang)}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center p-4 bg-[#1E1E1E] rounded-xl border border-[#3C3C3C] text-[#9D9D9D] text-xs">
                  {t('gmailDisabledMsg', lang)}
                </div>
              )}

              {/* Independent Google Calendar Event Alerts Section */}
              <div className="space-y-3 bg-[#1E1E1E]/60 border border-[#3C3C3C] rounded-xl p-3 text-left">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#FFFFFF] flex items-center gap-1.5">
                    <Calendar size={13} className="text-[#3794FF]" />
                    <span>{t('calendarReminderLabel', lang)}</span>
                  </span>
                  {calendarSyncState !== 'idle' && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      calendarSyncState === 'failed'
                        ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                        : calendarSyncState === 'success'
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : 'bg-[#007ACC]/20 text-[#3794FF] border border-[#007ACC]/40'
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
                    className="w-3.5 h-3.5 rounded accent-[#007ACC] cursor-pointer mt-0.5 shrink-0"
                  />
                  <div className="space-y-0.5">
                    <span className="font-medium text-[#D4D4D4]">{t('calendarReminderLabel', lang)}</span>
                    <p className="text-[11px] text-[#858585] leading-tight">{t('calendarReminderDesc', lang)}</p>
                  </div>
                </label>

                {alertSettings.calendarReminderEnabled && (
                  <div className="flex flex-wrap items-center gap-2 pl-5">
                    <label htmlFor={reminderValueId} className="text-[11px] text-[#9D9D9D] font-medium">{t('notifyBeforeLabel', lang)}</label>
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
                      className="bg-[#1E1E1E] border border-[#3C3C3C] rounded-lg px-2 py-1 w-16 text-xs text-[#D4D4D4] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007ACC]"
                    />
                    <select
                      aria-label={lang === 'en' ? 'Reminder unit' : 'หน่วยเวลาแจ้งเตือน'}
                      value={alertSettings.calendarReminderUnit || 'minutes'}
                      onChange={(e) => handleUpdateSetting('calendarReminderUnit', e.target.value)}
                      className="bg-[#1E1E1E] border border-[#3C3C3C] rounded-lg px-2 py-1 text-xs text-[#D4D4D4] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007ACC] cursor-pointer"
                    >
                      <option value="minutes">{t('minutesUnit', lang)}</option>
                      <option value="hours">{t('hoursUnit', lang)}</option>
                      <option value="days">{t('daysUnit', lang)}</option>
                    </select>
                  </div>
                )}

                <div className="pt-2 border-t border-[#3C3C3C]">
                  <button
                    type="button"
                    disabled={calendarSyncState === 'syncing'}
                    onClick={handleSyncCalendarNow}
                    className="w-full bg-[#2D2D2D] hover:bg-[#37373D] border border-[#3C3C3C] text-[#D4D4D4] text-xs font-medium px-3 py-2 rounded-xl transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    <RefreshCw size={12} className={calendarSyncState === 'syncing' ? 'animate-spin text-[#3794FF]' : 'text-[#3794FF]'} />
                    <span>{calendarSyncState === 'syncing' ? t('syncingCalendarBtn', lang) : t('syncCalendarNowBtn', lang)}</span>
                  </button>
                </div>
              </div>

              {/* Independent Discord Webhook Alerts Section */}
              <div className="space-y-3 bg-[#1E1E1E]/60 border border-[#3C3C3C] rounded-xl p-3 text-left">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#FFFFFF] flex items-center gap-1.5">
                    <MessageSquare size={13} className="text-[#5865F2]" />
                    <span>{lang === 'en' ? 'Discord Webhook Alerts' : 'แจ้งเตือนผ่าน Discord Webhook'}</span>
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    discordCheck.valid
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : (alertSettings.discordWebhookUrl || '').trim()
                        ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                        : 'bg-[#2D2D2D] text-[#9D9D9D] border border-[#3C3C3C]'
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
                    className="w-3.5 h-3.5 rounded accent-[#5865F2] cursor-pointer mt-0.5 shrink-0"
                  />
                  <div className="space-y-0.5">
                    <span className="font-medium text-[#D4D4D4]">
                      {lang === 'en' ? 'Enable Discord Webhook Notifications' : 'เปิดส่งแจ้งเตือนเข้า Discord อัตโนมัติ'}
                    </span>
                    <p className="text-[11px] text-[#858585] leading-tight">
                      {lang === 'en'
                        ? 'Send deadline reminders, new posts, and digests directly to your Discord channel.'
                        : 'ส่งการบ้านใกล้ครบกำหนด ประกาศใหม่ และสรุปงานเข้าห้องแชท Discord ของคุณ'}
                    </p>
                  </div>
                </label>

                <div className="space-y-1.5">
                  <label htmlFor={discordWebhookInputId} className="block text-[11px] text-[#9D9D9D] font-medium">
                    {lang === 'en' ? 'Discord Webhook URL:' : 'ลิงก์ Discord Webhook:'}
                  </label>
                  <DiscordWebhookInput
                    id={discordWebhookInputId}
                    value={alertSettings.discordWebhookUrl || ''}
                    onChange={(nextVal) => handleUpdateSetting('discordWebhookUrl', nextVal)}
                    lang={lang}
                    compact
                  />
                </div>

                <div className="pt-2 border-t border-[#3C3C3C] flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    disabled={discordDigestSending || discordTestSending || !discordCheck.valid}
                    onClick={handleSendDiscordDigestNow}
                    className="flex-1 bg-[#5865F2] hover:bg-[#4752C4] text-white text-xs font-medium px-3 py-2 rounded-xl transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {discordDigestSending ? (
                      <>
                        <RefreshCw size={12} className="animate-spin" />
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
                    className="bg-[#2D2D2D] hover:bg-[#37373D] border border-[#3C3C3C] text-[#D4D4D4] text-xs font-medium px-3 py-2 rounded-xl transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 shrink-0"
                  >
                    {discordTestSending ? <RefreshCw size={12} className="animate-spin text-[#5865F2]" /> : <MessageSquare size={12} className="text-[#5865F2]" />}
                    <span>{lang === 'en' ? 'Test Discord' : 'ทดสอบ Discord'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center p-6 text-[#858585] text-xs">
          {lang === 'en' ? 'Connect Google Classroom to enable alerts.' : 'เชื่อมต่อบัญชี Google เพื่อใช้งานการแจ้งเตือน'}
        </div>
      )}
    </div>
  );
}
