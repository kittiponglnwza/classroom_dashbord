import { useState, useEffect, useRef } from 'react';
import Sidebar from './Sidebar';
import { 
  Menu, 
  X, 
  Bell, 
  RefreshCw, 
  LogIn, 
  LogOut, 
  Award, 
  AlertTriangle, 
  Globe,
  Mail,
  CheckCircle2,
  Sparkles,
  Clock
} from 'lucide-react';
import { t } from '../utils/i18n';
import { 
  getEnableEmailAlerts,
  setEnableEmailAlerts,
  getAlertSettings,
  saveAlertSettings,
  getSundayDigestTime,
  setSundayDigestTime,
  getNotificationHistory,
  getDailyEmailLimit,
  addNotificationHistoryLog
} from '../utils/storage';
import { triggerManualDigest } from '../utils/notifications';

export default function Layout({ 
  children, 
  courses = [], 
  assignments = [], 
  isLoggedIn = false, 
  isSyncing = false, 
  lastSyncTime = null, 
  onSync = null,
  onLogout = null,
  onLogin = null,
  profile = {},
  lang = 'en',
  toggleLang = null,
  accessToken = null
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Notification popover states
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('history'); // 'history' | 'settings'
  const popoverRef = useRef(null);
  const bellButtonRef = useRef(null);

  const userEmail = (profile.email || '').toLowerCase().trim();
  
  const [emailAlerts, setEmailAlerts] = useState(() => getEnableEmailAlerts(userEmail));
  const [alertSettings, setAlertSettingsState] = useState(() => getAlertSettings(userEmail));
  const [sundayTime, setSundayTimeState] = useState(() => getSundayDigestTime(userEmail));
  const [historyLogs, setHistoryLogs] = useState(() => getNotificationHistory(userEmail));
  const [dailyLimit, setDailyLimit] = useState(() => getDailyEmailLimit(userEmail));
  const [digestSending, setDigestSending] = useState(false);

  // Sync state when email or popover opens
  useEffect(() => {
    if (userEmail) {
      setEmailAlerts(getEnableEmailAlerts(userEmail));
      setAlertSettingsState(getAlertSettings(userEmail));
      setSundayTimeState(getSundayDigestTime(userEmail));
      setHistoryLogs(getNotificationHistory(userEmail));
      setDailyLimit(getDailyEmailLimit(userEmail));
    }
  }, [userEmail, isNotificationsOpen]);

  // Click outside listener for notifications popover
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
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleToggleAlerts = (val) => {
    setEmailAlerts(val);
    setEnableEmailAlerts(val, userEmail);
    addNotificationHistoryLog({
      title: val 
        ? (lang === 'en' ? 'Enabled Gmail Notification System' : 'เปิดใช้งานระบบแจ้งเตือนทาง Gmail')
        : (lang === 'en' ? 'Disabled Gmail Notification System' : 'ปิดใช้งานระบบแจ้งเตือนทาง Gmail'),
      type: 'settings_change'
    }, userEmail);
    setHistoryLogs(getNotificationHistory(userEmail));
  };

  const handleToggleSetting = (field) => {
    const updated = { ...alertSettings, [field]: !alertSettings[field] };
    setAlertSettingsState(updated);
    saveAlertSettings(updated, userEmail);
  };

  const handleTimeChange = (time) => {
    setSundayTimeState(time);
    setSundayDigestTime(time, userEmail);
  };

  const handleSendDigestNow = async () => {
    if (!accessToken) {
      alert(lang === 'en' ? 'Please connect to Google Classroom before performing this action.' : 'กรุณาเชื่อมต่อ Google Classroom ก่อนทำรายการนี้');
      return;
    }
    setDigestSending(true);
    try {
      await triggerManualDigest(accessToken, userEmail, assignments);
      setHistoryLogs(getNotificationHistory(userEmail));
      setDailyLimit(getDailyEmailLimit(userEmail));
    } catch (e) {
      console.error(e);
      alert((lang === 'en' ? 'Failed: ' : 'เกิดข้อผิดพลาด: ') + e.message);
    } finally {
      setDigestSending(false);
    }
  };

  // Format Sync Time to user-friendly string
  const formatSyncTime = (timestamp) => {
    if (!timestamp) return t('neverSynced', lang);
    const date = new Date(timestamp);
    return date.toLocaleTimeString(lang === 'en' ? 'en-US' : 'th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' ' + 
           date.toLocaleDateString(lang === 'en' ? 'en-US' : 'th-TH', { day: 'numeric', month: 'short' });
  };

  // Count active tasks
  const totalActive = assignments.filter(a => a.status !== 'done').length;
  // Count overdue tasks
  const overdueCount = assignments.filter(a => {
    if (a.status === 'done' || !a.dueDate) return false;
    return new Date(a.dueDate) - new Date() < 0;
  }).length;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-dark-bg text-dark-text">
      {/* Desktop Sidebar */}
      <div className="hidden md:block h-full">
        <Sidebar courses={courses} assignments={assignments} profile={profile} lang={lang} />
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden bg-black/60 backdrop-blur-sm">
          <div className="h-full w-64 animate-fade-in">
            <Sidebar courses={courses} assignments={assignments} profile={profile} onLinkClick={() => setMobileMenuOpen(false)} lang={lang} />
          </div>
          <button 
            onClick={() => setMobileMenuOpen(false)}
            className="p-3 text-white absolute top-4 right-4 bg-dark-card rounded-full border border-dark-border cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Header Bar */}
        <header className="h-16 border-b border-dark-border bg-dark-sidebar/50 backdrop-blur-md px-6 flex items-center justify-between flex-shrink-0 z-30">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 text-dark-muted hover:text-white hover:bg-dark-hover rounded-lg transition-colors border border-dark-border cursor-pointer"
            >
              <Menu size={20} />
            </button>
            <div className="hidden sm:flex items-center gap-3">
              {isLoggedIn ? (
                <span className="text-[10px] font-bold bg-brand-500/10 text-brand-400 border border-brand-500/20 px-2 py-0.5 rounded-full">
                  {t('googleConnected', lang)}
                </span>
              ) : (
                <span className="text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full">
                  {t('mockActive', lang)}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Sync classroom actions */}
            {isLoggedIn && onSync && (
              <div className="flex items-center gap-3 text-xs pr-4 border-r border-dark-border">
                <span className="text-dark-muted hidden lg:inline">
                  {t('lastSync', lang)} <span className="text-white font-medium">{formatSyncTime(lastSyncTime)}</span>
                </span>
                <button
                  onClick={onSync}
                  disabled={isSyncing}
                  className="flex items-center gap-1.5 bg-dark-card hover:bg-dark-hover text-brand-400 hover:text-brand-300 font-medium px-3.5 py-1.5 rounded-lg border border-dark-border transition-colors disabled:opacity-50 cursor-pointer"
                  title="Sync Google Classroom data"
                >
                  <RefreshCw size={13} className={isSyncing ? 'animate-spin' : ''} />
                  <span>{isSyncing ? t('syncing', lang) : t('sync', lang)}</span>
                </button>
              </div>
            )}

            {/* Quick Stats Summary */}
            <div className="hidden lg:flex items-center gap-4 text-xs pr-4 mr-2 border-r border-dark-border">
              <div className="text-right">
                <span className="text-dark-muted block">{t('tasksPending', lang)}</span>
                <span className="font-semibold text-brand-400">{totalActive} {totalActive === 1 ? t('taskPlural', lang) : t('tasksPlural', lang)}</span>
              </div>
              {overdueCount > 0 && (
                <div className="text-right">
                  <span className="text-rose-400 block font-semibold flex items-center gap-1">
                    <AlertTriangle size={11} /> {t('overdueHeader', lang)}
                  </span>
                  <span className="font-bold text-rose-400">{overdueCount} {overdueCount === 1 ? t('taskPlural', lang) : t('tasksPlural', lang)}</span>
                </div>
              )}
            </div>

            {/* Language Switcher */}
            {toggleLang && (
              <button
                onClick={toggleLang}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-dark-card hover:bg-dark-hover border border-dark-border text-xs font-semibold rounded-lg text-dark-muted hover:text-white transition-all shadow-sm cursor-pointer select-none active:scale-95 shrink-0"
                title={lang === 'en' ? 'Switch to Thai' : 'เปลี่ยนเป็นภาษาอังกฤษ'}
              >
                <Globe size={13} className="text-dark-muted group-hover:text-white" />
                <span>{lang === 'en' ? 'EN' : 'TH'}</span>
              </button>
            )}

            {/* Notification Bell */}
            <div className="relative">
              <button 
                ref={bellButtonRef}
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className={`p-2 rounded-lg transition-colors border relative cursor-pointer ${
                  isNotificationsOpen 
                    ? 'text-white bg-dark-hover border-dark-border' 
                    : 'text-dark-muted hover:text-white hover:bg-dark-hover border-transparent hover:border-dark-border'
                }`}
              >
                <Bell size={18} />
                {overdueCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full animate-bounce" />
                )}
              </button>

              {/* Notifications Popover */}
              {isNotificationsOpen && (
                <div 
                  ref={popoverRef}
                  className="absolute right-0 top-12 z-50 w-[320px] sm:w-[380px] bg-dark-card/95 backdrop-blur-md border border-dark-border/80 rounded-2xl shadow-2xl p-4.5 space-y-4 text-xs text-white animate-fade-in"
                >
                  <div className="flex items-center justify-between border-b border-dark-border/40 pb-3">
                    <h3 className="font-bold text-xs text-white flex items-center gap-2 uppercase tracking-wide">
                      <Bell size={14} className="text-brand-400" />
                      {lang === 'en' ? 'Gmail Alerts' : 'แจ้งเตือน Gmail'}
                    </h3>
                    
                    {/* Overall Switch */}
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
                      {/* Tabs Header */}
                      <div className="flex bg-dark-sidebar/40 p-0.5 rounded-lg border border-dark-border/20">
                        <button
                          onClick={() => setActiveTab('history')}
                          className={`flex-1 py-1 text-center font-bold text-[10px] uppercase tracking-wider rounded-md transition-colors cursor-pointer ${
                            activeTab === 'history' 
                              ? 'bg-brand-500 text-white shadow-sm' 
                              : 'text-dark-muted hover:text-white'
                          }`}
                        >
                          {lang === 'en' ? 'Logs' : 'ประวัติส่งเมล'}
                        </button>
                        <button
                          onClick={() => setActiveTab('settings')}
                          className={`flex-1 py-1 text-center font-bold text-[10px] uppercase tracking-wider rounded-md transition-colors cursor-pointer ${
                            activeTab === 'settings' 
                              ? 'bg-brand-500 text-white shadow-sm' 
                              : 'text-dark-muted hover:text-white'
                          }`}
                        >
                          {lang === 'en' ? 'Settings' : 'ตั้งค่าแจ้งเตือน'}
                        </button>
                      </div>

                      {/* Tab 1: History Logs */}
                      {activeTab === 'history' && (
                        <div className="space-y-3">
                          {emailAlerts ? (
                            <>
                              {/* Daily Limit Tracker */}
                              <div className="flex items-center justify-between p-2.5 rounded-xl bg-brand-500/5 border border-brand-500/10 text-[10px]">
                                <span className="text-dark-muted font-semibold">{t('quotaLabel', lang)}</span>
                                <span className="text-brand-400 font-bold">{t('quotaDesc', lang, { count: dailyLimit.count })}</span>
                              </div>

                              {/* Logs List */}
                              <div className="max-h-[180px] overflow-y-auto pr-1 space-y-2 text-xs custom-scrollbar">
                                {historyLogs.length > 0 ? (
                                  historyLogs.map(log => {
                                    const formattedLogDate = new Date(log.sentAt).toLocaleDateString(lang === 'en' ? 'en-US' : 'th-TH', {
                                      day: 'numeric',
                                      month: 'short',
                                      hour: '2-digit',
                                      minute: '2-digit'
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

                      {/* Tab 2: Email settings triggers */}
                      {activeTab === 'settings' && (
                        <div className="space-y-4 animate-fade-in">
                          {emailAlerts ? (
                            <div className="space-y-4">
                              <div className="space-y-3">
                                <span className="block text-[9px] font-bold text-dark-muted uppercase tracking-wider">{t('triggersHeader', lang)}</span>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
                                  <label className="flex items-start gap-2.5 cursor-pointer">
                                    <input 
                                      type="checkbox"
                                      checked={alertSettings.due3Days}
                                      onChange={() => handleToggleSetting('due3Days')}
                                      className="w-3.5 h-3.5 rounded text-brand-500 bg-dark-sidebar border-dark-border cursor-pointer focus:ring-0 mt-0.5 shrink-0"
                                    />
                                    <div className="space-y-0.5">
                                      <span className="font-semibold text-zinc-200">{t('due3DaysLabel', lang)}</span>
                                      <p className="text-[9px] text-dark-muted leading-tight">{t('due3DaysDesc', lang)}</p>
                                    </div>
                                  </label>

                                  <label className="flex items-start gap-2.5 cursor-pointer">
                                    <input 
                                      type="checkbox"
                                      checked={alertSettings.due1Day}
                                      onChange={() => handleToggleSetting('due1Day')}
                                      className="w-3.5 h-3.5 rounded text-brand-500 bg-dark-sidebar border-dark-border cursor-pointer focus:ring-0 mt-0.5 shrink-0"
                                    />
                                    <div className="space-y-0.5">
                                      <span className="font-semibold text-zinc-200">{t('due1DayLabel', lang)}</span>
                                      <p className="text-[9px] text-dark-muted leading-tight">{t('due1DayDesc', lang)}</p>
                                    </div>
                                  </label>

                                  <label className="flex items-start gap-2.5 cursor-pointer">
                                    <input 
                                      type="checkbox"
                                      checked={alertSettings.dueToday}
                                      onChange={() => handleToggleSetting('dueToday')}
                                      className="w-3.5 h-3.5 rounded text-brand-500 bg-dark-sidebar border-dark-border cursor-pointer focus:ring-0 mt-0.5 shrink-0"
                                    />
                                    <div className="space-y-0.5">
                                      <span className="font-semibold text-zinc-200">{t('dueTodayLabel', lang)}</span>
                                      <p className="text-[9px] text-dark-muted leading-tight">{t('dueTodayDesc', lang)}</p>
                                    </div>
                                  </label>

                                  <label className="flex items-start gap-2.5 cursor-pointer">
                                    <input 
                                      type="checkbox"
                                      checked={alertSettings.overdue1Day}
                                      onChange={() => handleToggleSetting('overdue1Day')}
                                      className="w-3.5 h-3.5 rounded text-brand-500 bg-dark-sidebar border-dark-border cursor-pointer focus:ring-0 mt-0.5 shrink-0"
                                    />
                                    <div className="space-y-0.5">
                                      <span className="font-semibold text-zinc-200">{t('overdue1DayLabel', lang)}</span>
                                      <p className="text-[9px] text-dark-muted leading-tight">{t('overdue1DayDesc', lang)}</p>
                                    </div>
                                  </label>

                                  <label className="flex items-start gap-2.5 cursor-pointer col-span-1 sm:col-span-2">
                                    <input 
                                      type="checkbox"
                                      checked={alertSettings.newPosts}
                                      onChange={() => handleToggleSetting('newPosts')}
                                      className="w-3.5 h-3.5 rounded text-brand-500 bg-dark-sidebar border-dark-border cursor-pointer focus:ring-0 mt-0.5 shrink-0"
                                    />
                                    <div className="space-y-0.5">
                                      <span className="font-semibold text-zinc-200">{t('newPostsLabel', lang)}</span>
                                      <p className="text-[9px] text-dark-muted leading-tight">{t('newPostsDesc', lang)}</p>
                                    </div>
                                  </label>
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
                                </div>
                              </div>

                              {/* Manual Send Button */}
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
              )}
            </div>

            {/* Theme toggle removed, locked to Dark Mode default */}

            {/* Profile Avatar & Login/Logout Trigger */}
            <div className="flex items-center gap-3 pl-2">
              <div className="w-8 h-8 rounded-full overflow-hidden bg-brand-500/10 border border-dark-border">
                <img 
                  src={profile.avatarUrl || "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&q=80&w=200"} 
                  alt="Student Avatar" 
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="hidden sm:flex flex-col text-left max-w-[120px]">
                <span className="text-xs font-semibold text-white truncate">
                  {profile.name || 'Student'}
                </span>
                <span className="text-[9px] text-dark-muted truncate mt-0.5">
                  {profile.email || t('connected', lang)}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Dynamic Page Container */}
        <main className="flex-1 overflow-y-auto bg-dark-bg p-6 md:p-8">
          <div className="max-w-7xl mx-auto w-full animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
