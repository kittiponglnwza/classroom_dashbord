import { useState, useRef, useEffect } from 'react';
import { Bell, RefreshCw } from 'lucide-react';
import { t } from '../utils/i18n';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { useClassroom } from '../contexts/ClassroomContext';
import { triggerManualDigest } from '../utils/notifications';

export default function NotificationPopover({ isNotificationsOpen, setIsNotificationsOpen, bellButtonRef }) {
  const { isLoggedIn, accessToken, profile } = useAuth();
  const { 
    lang, emailAlerts, handleToggleAlerts, alertSettings, handleToggleSetting, handleUpdateSetting,
    sundayTime, handleTimeChange, historyLogs, dailyLimit, refreshNotificationData 
  } = useSettings();
  const { assignments } = useClassroom();
  
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
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
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
      setUiFeedback({
        text: lang === 'en' ? 'Digest sent successfully!' : 'ส่งสรุปผลงานไปที่ Gmail เรียบร้อยแล้ว!',
        type: 'success'
      });
    } catch (e) {
      console.error(e);
      setUiFeedback({
        text: ((lang === 'en' ? 'Failed: ' : 'เกิดข้อผิดพลาด: ') + e.message),
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
      className="absolute right-0 top-12 z-50 w-[320px] sm:w-[380px] bg-dark-card/95 backdrop-blur-md border border-dark-border/80 rounded-2xl shadow-2xl p-4.5 space-y-4 text-xs text-white animate-fade-in"
    >
      <div className="flex items-center justify-between border-b border-dark-border/40 pb-3">
        <h3 className="font-bold text-xs text-white flex items-center gap-2 uppercase tracking-wide">
          <Bell size={14} className="text-brand-400" />
          {lang === 'en' ? 'Gmail Alerts' : 'แจ้งเตือน Gmail'}
        </h3>
        
        {isLoggedIn && (
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-dark-muted font-bold uppercase">
              {emailAlerts ? (lang === 'en' ? 'ON' : 'เปิด') : (lang === 'en' ? 'OFF' : 'ปิด')}
            </span>
            <label className="relative inline-flex items-center cursor-pointer select-none">
              <input 
                type="checkbox" 
                checked={emailAlerts}
                onChange={(e) => handleToggleAlerts(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-8 h-4.5 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-brand-500"></div>
            </label>
          </div>
        )}
      </div>

      {isLoggedIn ? (
        <div className="space-y-4">
          {uiFeedback.text && (
            <div className={`p-2.5 rounded-xl border text-[10px] flex items-center justify-between transition-all ${
              uiFeedback.type === 'error' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            }`}>
              <span>{uiFeedback.text}</span>
              <button onClick={() => setUiFeedback({ text: '', type: '' })} className="text-[12px] hover:text-white font-extrabold ml-2 cursor-pointer">×</button>
            </div>
          )}
          <div className="flex bg-dark-sidebar/40 p-0.5 rounded-lg border border-dark-border/20">
            <button
              onClick={() => setActiveTab('history')}
              className={`flex-1 py-1 text-center font-bold text-[10px] uppercase tracking-wider rounded-md transition-colors cursor-pointer ${
                activeTab === 'history' ? 'bg-brand-500 text-white shadow-sm' : 'text-dark-muted hover:text-white'
              }`}
            >
              {lang === 'en' ? 'Logs' : 'ประวัติส่งเมล'}
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex-1 py-1 text-center font-bold text-[10px] uppercase tracking-wider rounded-md transition-colors cursor-pointer ${
                activeTab === 'settings' ? 'bg-brand-500 text-white shadow-sm' : 'text-dark-muted hover:text-white'
              }`}
            >
              {lang === 'en' ? 'Settings' : 'ตั้งค่าแจ้งเตือน'}
            </button>
          </div>

          {activeTab === 'history' && (
            <div className="space-y-3">
              {emailAlerts ? (
                <>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-brand-500/5 border border-brand-500/10 text-[10px]">
                    <span className="text-dark-muted font-semibold">{t('quotaLabel', lang)}</span>
                    <span className="text-brand-400 font-bold">{t('quotaDesc', lang, { count: dailyLimit.count })}</span>
                  </div>
                  <div className="max-h-[180px] overflow-y-auto pr-1 space-y-2 text-xs custom-scrollbar">
                    {historyLogs.length > 0 ? (
                      historyLogs.map(log => {
                        const formattedLogDate = new Date(log.sentAt).toLocaleDateString(lang === 'en' ? 'en-US' : 'th-TH', {
                          day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                        });
                        return (
                          <div key={log.id} className="p-2.5 rounded-xl bg-dark-sidebar/30 border border-dark-border/25 flex flex-col gap-0.5 text-left">
                            <span className="font-semibold text-zinc-100">{log.title}</span>
                            <span className="text-[9px] text-dark-muted">{formattedLogDate}</span>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-center py-8 text-dark-muted text-[10px]">
                        {t('noHistoryLogs', lang)}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-center p-8 bg-dark-sidebar/20 rounded-xl border border-dashed border-dark-border/40 text-dark-muted text-xs">
                  {t('gmailDisabledMsg', lang)}
                </div>
              )}
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-4 animate-fade-in">
              {emailAlerts ? (
                <div className="space-y-4">
                  <div className="space-y-3">
                    <span className="block text-[9px] font-bold text-dark-muted uppercase tracking-wider">{t('triggersHeader', lang)}</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
                      {['due3Days', 'due1Day', 'dueToday', 'overdue1Day', 'newPosts'].map((field) => (
                        <label key={field} className={`flex items-start gap-2.5 cursor-pointer ${field === 'newPosts' ? 'col-span-1 sm:col-span-2' : ''}`}>
                          <input 
                            type="checkbox"
                            checked={alertSettings[field]}
                            onChange={() => handleToggleSetting(field)}
                            className="w-3.5 h-3.5 rounded text-brand-500 bg-dark-sidebar border-dark-border cursor-pointer focus:ring-0 mt-0.5 shrink-0"
                          />
                          <div className="space-y-0.5">
                            <span className="font-semibold text-zinc-200">{t(`${field}Label`, lang)}</span>
                            <p className="text-[9px] text-dark-muted leading-tight">{t(`${field}Desc`, lang)}</p>
                          </div>
                        </label>
                      ))}
                    </div>

                    <div className="border-t border-dark-border/20 pt-3 space-y-3 text-left">
                      <label className="flex items-start gap-2.5 cursor-pointer">
                        <input 
                          type="checkbox"
                          checked={alertSettings.sundayDigest}
                          onChange={() => handleToggleSetting('sundayDigest')}
                          className="w-3.5 h-3.5 rounded text-brand-500 bg-dark-sidebar border-dark-border cursor-pointer focus:ring-0 mt-0.5 shrink-0"
                        />
                        <div className="space-y-0.5">
                          <span className="font-semibold text-zinc-200">{t('sundayDigestLabel', lang)}</span>
                          <p className="text-[9px] text-dark-muted leading-tight">{t('sundayDigestDesc', lang)}</p>
                        </div>
                      </label>

                      {alertSettings.sundayDigest && (
                        <div className="flex items-center gap-2.5 pl-6 animate-fade-in">
                          <span className="text-[9px] text-dark-muted uppercase font-semibold">{t('deliveryTimeLabel', lang)}</span>
                          <input 
                            type="time" 
                            value={sundayTime}
                            onChange={(e) => handleTimeChange(e.target.value)}
                            className="bg-dark-sidebar/40 border border-dark-border/40 rounded-lg px-2 py-0.5 text-xs text-white focus:outline-none"
                          />
                        </div>
                      )}

                      <label className="flex items-start gap-2.5 cursor-pointer border-t border-dark-border/10 pt-2.5">
                        <input 
                          type="checkbox"
                          checked={alertSettings.includeExams}
                          onChange={() => handleToggleSetting('includeExams')}
                          className="w-3.5 h-3.5 rounded text-brand-500 bg-dark-sidebar border-dark-border cursor-pointer focus:ring-0 mt-0.5 shrink-0"
                        />
                        <div className="space-y-0.5">
                          <span className="font-semibold text-zinc-200">{t('includeExamsLabel', lang)}</span>
                          <p className="text-[9px] text-dark-muted leading-tight">{t('includeExamsDesc', lang)}</p>
                        </div>
                      </label>

                      <label className="flex items-start gap-2.5 cursor-pointer border-t border-dark-border/10 pt-2.5">
                        <input 
                          type="checkbox"
                          checked={alertSettings.calendarReminderEnabled}
                          onChange={() => handleToggleSetting('calendarReminderEnabled')}
                          className="w-3.5 h-3.5 rounded text-brand-500 bg-dark-sidebar border-dark-border cursor-pointer focus:ring-0 mt-0.5 shrink-0"
                        />
                        <div className="space-y-0.5">
                          <span className="font-semibold text-zinc-200">{t('calendarReminderLabel', lang)}</span>
                          <p className="text-[9px] text-dark-muted leading-tight">{t('calendarReminderDesc', lang)}</p>
                        </div>
                      </label>

                      {alertSettings.calendarReminderEnabled && (
                        <div className="flex items-center gap-2.5 pl-6 animate-fade-in">
                          <span className="text-[9px] text-dark-muted uppercase font-semibold">{t('notifyBeforeLabel', lang)}</span>
                          <input 
                            type="number"
                            min="0"
                            max="999"
                            value={alertSettings.calendarReminderValue}
                            onChange={(e) => handleUpdateSetting('calendarReminderValue', parseInt(e.target.value, 10) || 0)}
                            className="bg-dark-sidebar/40 border border-dark-border/40 rounded-lg px-2 py-0.5 w-16 text-xs text-white focus:outline-none"
                          />
                          <select
                            value={alertSettings.calendarReminderUnit}
                            onChange={(e) => handleUpdateSetting('calendarReminderUnit', e.target.value)}
                            className="bg-dark-sidebar/40 border border-dark-border/40 rounded-lg px-2 py-0.5 text-xs text-white focus:outline-none cursor-pointer"
                          >
                            <option value="minutes">{t('minutesUnit', lang)}</option>
                            <option value="hours">{t('hoursUnit', lang)}</option>
                            <option value="days">{t('daysUnit', lang)}</option>
                          </select>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-dark-border/20 flex justify-end">
                    <button
                      type="button"
                      disabled={digestSending}
                      onClick={handleSendDigestNow}
                      className="w-full bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {digestSending ? (
                        <>
                          <RefreshCw size={12} className="animate-spin" />
                          {t('sendingDigestBtn', lang)}
                        </>
                      ) : t('sendDigestBtn', lang)}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center p-8 bg-dark-sidebar/20 rounded-xl border border-dashed border-dark-border/40 text-dark-muted text-xs">
                  {t('gmailDisabledMsg', lang)}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="text-center p-6 text-dark-muted text-xs">
          {lang === 'en' ? 'Connect Google Classroom to enable alerts.' : 'เชื่อมต่อบัญชี Google เพื่อใช้งานการแจ้งเตือน'}
        </div>
      )}
    </div>
  );
}
