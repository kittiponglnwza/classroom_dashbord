import { useState, useRef, useEffect } from 'react';
import { useInRouterContext, useNavigate, useLocation } from 'react-router-dom';
import { Bell, RefreshCw, ArrowUpRight } from 'lucide-react';
import { t } from '../utils/i18n';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { useClassroom } from '../contexts/ClassroomContext';
import { triggerManualDigest } from '../utils/notifications';
import { syncManager } from '../services/SyncManager';

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
  if (log.type === 'settings_change' || log.type === 'test_email') {
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
      className="inline-flex items-center gap-0.5 text-[11px] font-medium text-[#0071E3] hover:underline shrink-0 cursor-pointer"
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
  const popoverRef = useRef(null);

  useEffect(() => {
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
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [setIsNotificationsOpen, bellButtonRef]);

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

  if (!isNotificationsOpen) return null;

  return (
    <div
      ref={popoverRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="notification-popover-title"
      className="fixed left-4 right-4 top-20 sm:absolute sm:left-auto sm:right-0 sm:top-12 z-50 sm:w-[380px] bg-white border border-[#D2D2D7] rounded-2xl shadow-lg p-4 space-y-4 text-xs text-[#1D1D1F] animate-fade-in"
    >
      <div className="flex items-center justify-between border-b border-[#D2D2D7]/70 pb-3">
        <h3 id="notification-popover-title" className="font-semibold text-xs text-[#1D1D1F] flex items-center gap-2">
          <Bell size={14} className="text-[#0071E3]" />
          {lang === 'en' ? 'Gmail Alerts' : 'แจ้งเตือน Gmail'}
        </h3>

        {isLoggedIn && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[#6E6E73] font-medium">
              {emailAlerts ? (lang === 'en' ? 'On' : 'เปิด') : (lang === 'en' ? 'Off' : 'ปิด')}
            </span>
            <label className="relative inline-flex items-center cursor-pointer select-none">
              <input
                type="checkbox"
                checked={emailAlerts}
                onChange={(e) => handleToggleAlerts(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-8 h-4.5 bg-[#D2D2D7] peer-focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3] rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-[#0071E3]"></div>
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
                  ? 'bg-rose-50 border-rose-200 text-rose-700'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-700'
              }`}
            >
              <span>{uiFeedback.text}</span>
              <button
                type="button"
                onClick={() => setUiFeedback({ text: '', type: '' })}
                className="text-sm hover:opacity-70 font-semibold ml-2 cursor-pointer"
              >
                ×
              </button>
            </div>
          )}

          <div className="flex bg-[#F5F5F7] p-1 rounded-xl border border-[#D2D2D7]/70">
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`flex-1 py-1.5 text-center font-medium text-xs rounded-lg transition-colors cursor-pointer ${
                activeTab === 'history' ? 'bg-white text-[#1D1D1F] shadow-2xs font-semibold' : 'text-[#6E6E73] hover:text-[#1D1D1F]'
              }`}
            >
              {lang === 'en' ? 'Logs' : 'ประวัติส่งเมล'}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className={`flex-1 py-1.5 text-center font-medium text-xs rounded-lg transition-colors cursor-pointer ${
                activeTab === 'settings' ? 'bg-white text-[#1D1D1F] shadow-2xs font-semibold' : 'text-[#6E6E73] hover:text-[#1D1D1F]'
              }`}
            >
              {lang === 'en' ? 'Settings' : 'ตั้งค่าแจ้งเตือน'}
            </button>
          </div>

          {activeTab === 'history' && (
            <div className="space-y-3">
              {emailAlerts ? (
                <>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#F5F5F7] border border-[#D2D2D7]/70 text-xs">
                    <span className="text-[#6E6E73] font-medium">{t('quotaLabel', lang)}</span>
                    <span className="text-[#1D1D1F] font-semibold">{t('quotaDesc', lang, { count: dailyLimit.count })}</span>
                  </div>
                  {historyLogs.length > 0 && (
                    <div className="flex items-center justify-between text-xs px-1">
                      <span className="text-[#6E6E73] font-medium" data-testid="notification-unread-counter">
                        {unreadCount} {t('unreadLabel', lang)}
                      </span>
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={handleMarkAllNotificationsRead}
                          className="text-[#0071E3] hover:underline font-medium cursor-pointer"
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
                            onClick={() => handleMarkNotificationRead && handleMarkNotificationRead(log.id, !log.read)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                if (handleMarkNotificationRead) handleMarkNotificationRead(log.id, !log.read);
                              }
                            }}
                            className={`w-full p-3 rounded-xl border flex items-start justify-between gap-2 text-left transition-colors cursor-pointer ${
                              isUnread
                                ? 'bg-[#0071E3]/5 border-[#0071E3]/30 hover:bg-[#0071E3]/10'
                                : 'bg-[#F5F5F7]/70 border-[#D2D2D7]/70 hover:bg-[#F5F5F7]'
                            }`}
                          >
                            <div className="flex flex-col gap-1 min-w-0 flex-1">
                              <span className={`font-medium leading-snug ${isUnread ? 'text-[#1D1D1F] font-semibold' : 'text-[#6E6E73]'}`}>
                                {log.title}
                              </span>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[11px] text-[#6E6E73]">{formattedLogDate}</span>
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
                                className="w-2 h-2 rounded-full bg-[#0071E3] shrink-0 mt-1"
                              />
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-center py-8 text-[#6E6E73] text-xs">
                        {t('noHistoryLogs', lang)}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-center p-6 bg-[#F5F5F7] rounded-xl border border-[#D2D2D7] text-[#6E6E73] text-xs">
                  {t('gmailDisabledMsg', lang)}
                </div>
              )}
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-4">
              {emailAlerts ? (
                <div className="space-y-4">
                  <div className="space-y-3">
                    <span className="block text-xs font-semibold text-[#1D1D1F]">{t('triggersHeader', lang)}</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-left">
                      {['due3Days', 'due1Day', 'dueToday', 'overdue1Day', 'newPosts'].map((field) => (
                        <label
                          key={field}
                          className={`flex items-start gap-2 cursor-pointer ${field === 'newPosts' ? 'col-span-1 sm:col-span-2' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={alertSettings[field]}
                            onChange={() => handleToggleSetting(field)}
                            className="w-3.5 h-3.5 rounded accent-[#0071E3] cursor-pointer mt-0.5 shrink-0"
                          />
                          <div className="space-y-0.5">
                            <span className="font-medium text-[#1D1D1F]">{t(`${field}Label`, lang)}</span>
                            <p className="text-[11px] text-[#6E6E73] leading-tight">{t(`${field}Desc`, lang)}</p>
                          </div>
                        </label>
                      ))}
                    </div>

                    <div className="border-t border-[#D2D2D7]/70 pt-3 space-y-2.5 text-left">
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={alertSettings.sundayDigest}
                          onChange={() => handleToggleSetting('sundayDigest')}
                          className="w-3.5 h-3.5 rounded accent-[#0071E3] cursor-pointer mt-0.5 shrink-0"
                        />
                        <div className="space-y-0.5">
                          <span className="font-medium text-[#1D1D1F]">{t('sundayDigestLabel', lang)}</span>
                          <p className="text-[11px] text-[#6E6E73] leading-tight">{t('sundayDigestDesc', lang)}</p>
                        </div>
                      </label>

                      {alertSettings.sundayDigest && (
                        <div className="flex items-center gap-2 pl-5">
                          <span className="text-[11px] text-[#6E6E73] font-medium">{t('deliveryTimeLabel', lang)}</span>
                          <input
                            type="time"
                            value={sundayTime}
                            onChange={(e) => handleTimeChange(e.target.value)}
                            className="bg-[#F5F5F7] border border-[#D2D2D7] rounded-lg px-2 py-1 text-xs text-[#1D1D1F] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3]"
                          />
                        </div>
                      )}

                      <label className="flex items-start gap-2 cursor-pointer border-t border-[#D2D2D7]/50 pt-2.5">
                        <input
                          type="checkbox"
                          checked={alertSettings.includeExams}
                          onChange={() => handleToggleSetting('includeExams')}
                          className="w-3.5 h-3.5 rounded accent-[#0071E3] cursor-pointer mt-0.5 shrink-0"
                        />
                        <div className="space-y-0.5">
                          <span className="font-medium text-[#1D1D1F]">{t('includeExamsLabel', lang)}</span>
                          <p className="text-[11px] text-[#6E6E73] leading-tight">{t('includeExamsDesc', lang)}</p>
                        </div>
                      </label>

                      <label className="flex items-start gap-2 cursor-pointer border-t border-[#D2D2D7]/50 pt-2.5">
                        <input
                          type="checkbox"
                          checked={alertSettings.calendarReminderEnabled}
                          onChange={() => handleToggleSetting('calendarReminderEnabled')}
                          className="w-3.5 h-3.5 rounded accent-[#0071E3] cursor-pointer mt-0.5 shrink-0"
                        />
                        <div className="space-y-0.5">
                          <span className="font-medium text-[#1D1D1F]">{t('calendarReminderLabel', lang)}</span>
                          <p className="text-[11px] text-[#6E6E73] leading-tight">{t('calendarReminderDesc', lang)}</p>
                        </div>
                      </label>

                      {alertSettings.calendarReminderEnabled && (
                        <div className="flex items-center gap-2 pl-5">
                          <span className="text-[11px] text-[#6E6E73] font-medium">{t('notifyBeforeLabel', lang)}</span>
                          <input
                            type="number"
                            min="0"
                            max="999"
                            value={alertSettings.calendarReminderValue}
                            onChange={(e) => handleUpdateSetting('calendarReminderValue', parseInt(e.target.value, 10) || 0)}
                            className="bg-[#F5F5F7] border border-[#D2D2D7] rounded-lg px-2 py-1 w-16 text-xs text-[#1D1D1F] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3]"
                          />
                          <select
                            value={alertSettings.calendarReminderUnit}
                            onChange={(e) => handleUpdateSetting('calendarReminderUnit', e.target.value)}
                            className="bg-[#F5F5F7] border border-[#D2D2D7] rounded-lg px-2 py-1 text-xs text-[#1D1D1F] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3] cursor-pointer"
                          >
                            <option value="minutes">{t('minutesUnit', lang)}</option>
                            <option value="hours">{t('hoursUnit', lang)}</option>
                            <option value="days">{t('daysUnit', lang)}</option>
                          </select>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#D2D2D7]/70 flex justify-end">
                    <button
                      type="button"
                      disabled={digestSending}
                      onClick={handleSendDigestNow}
                      className="w-full bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-medium px-4 py-2.5 rounded-xl transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {digestSending ? (
                        <>
                          <RefreshCw size={12} className="animate-spin" />
                          {t('sendingDigestBtn', lang)}
                        </>
                      ) : (
                        t('sendDigestBtn', lang)
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center p-6 bg-[#F5F5F7] rounded-xl border border-[#D2D2D7] text-[#6E6E73] text-xs">
                  {t('gmailDisabledMsg', lang)}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="text-center p-6 text-[#6E6E73] text-xs">
          {lang === 'en' ? 'Connect Google Classroom to enable alerts.' : 'เชื่อมต่อบัญชี Google เพื่อใช้งานการแจ้งเตือน'}
        </div>
      )}
    </div>
  );
}
