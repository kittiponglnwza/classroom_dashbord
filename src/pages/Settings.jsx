import { useState } from 'react';
import { User, Sparkles, Mail, CheckCircle2, GraduationCap, Layers, Code, LogIn, LogOut } from 'lucide-react';
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

const GithubIcon = ({ size = 16, className = '' }) => (
  <svg
    height={size}
    width={size}
    viewBox="0 0 16 16"
    version="1.1"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path fillRule="evenodd" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
  </svg>
);

export default function Settings({ 
  profile = {}, 
  onProfileSave, 
  isLoggedIn = false, 
  onLogout, 
  onLogin,
  accessToken = null,
  assignments = [],
  lang = 'en'
}) {
  const [name, setName] = useState(profile.name || '');
  const [studentId, setStudentId] = useState(profile.studentId || '');
  const [email, setEmail] = useState(profile.email || '');
  const [major, setMajor] = useState(profile.major || '');
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl || '');
  
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Scoped notifications states
  const userEmail = profile.email || email || '';
  
  const [emailAlerts, setEmailAlerts] = useState(() => getEnableEmailAlerts(userEmail));
  const [alertSettings, setAlertSettingsState] = useState(() => getAlertSettings(userEmail));
  const [sundayTime, setSundayTimeState] = useState(() => getSundayDigestTime(userEmail));
  const [historyLogs, setHistoryLogs] = useState(() => getNotificationHistory(userEmail));
  const [dailyLimit, setDailyLimit] = useState(() => getDailyEmailLimit(userEmail));
  
  const [digestSending, setDigestSending] = useState(false);

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
  const techStack = [
    { name: 'React 19', category: 'Frontend', color: 'emerald' },
    { name: 'Vite 8', category: 'Build Tool', color: 'purple' },
    { name: 'React Router 7', category: 'Routing', color: 'rose' },
    { name: 'Tailwind CSS v4', category: 'Styling', color: 'blue' },
    { name: 'Google Classroom API', category: 'Integrations', color: 'brand' },
    { name: 'Lucide React', category: 'Icons', color: 'amber' },
  ];

  const getPillColor = (color) => {
    switch (color) {
      case 'emerald': return 'bg-emerald-500/5 text-emerald-400 border-emerald-500/10';
      case 'purple': return 'bg-purple-500/5 text-purple-400 border-purple-500/10';
      case 'rose': return 'bg-rose-500/5 text-rose-400 border-rose-500/10';
      case 'blue': return 'bg-blue-500/5 text-blue-400 border-blue-500/10';
      case 'amber': return 'bg-amber-500/5 text-amber-400 border-amber-500/10';
      default: return 'bg-brand-500/5 text-brand-400 border-brand-500/10';
    }
  };

  const devInfo = {
    name: 'KITTIPONG TEERASEE',
    nickname: 'Kittiponglnwza',
    studentId: '6704082611115',
    email: 's6704082611115@email.kmutnb.ac.th',
    university: 'King Mongkut\'s University of Technology North Bangkok (KMUTNB)',
    github: 'https://github.com/kittiponglnwza',
    bio: 'KMUTNB Student Developer interested in building modern, high-performance web applications, productivity extensions, and APIs.'
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onProfileSave({
      name,
      studentId,
      email,
      major,
      avatarUrl
    });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in py-2">
      {/* Minimal Header */}
      <div className="border-b border-dark-border/40 pb-5">
        <h1 className="text-xl font-bold font-heading text-white">{t('settingsTitle', lang)}</h1>
        <p className="text-[11px] text-dark-muted mt-1 leading-relaxed">{t('settingsDesc', lang)}</p>
      </div>

      {/* Success Alert */}
      {saveSuccess && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs px-4 py-3 rounded-xl flex items-center gap-2 animate-fade-in max-w-xl">
          <CheckCircle2 size={15} />
          {t('profileSuccess', lang)}
        </div>
      )}

      {/* Responsive Grid layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Section: Student Profile Settings Form */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-dark-card/20 border border-dark-border/30 rounded-2xl p-6 md:p-8 space-y-6 shadow-sm">
            <div className="flex items-center gap-3 pb-3">
              <User size={16} className="text-brand-400" />
              <h3 className="font-semibold text-xs text-white uppercase tracking-wider">{t('profileSettingsHeader', lang)}</h3>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="flex flex-col sm:flex-row gap-5 items-start sm:items-center">
                <div className="w-14 h-14 rounded-full overflow-hidden bg-dark-sidebar border border-dark-border/50 flex-shrink-0 flex items-center justify-center">
                  <img 
                    src={avatarUrl || 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&q=80&w=200'} 
                    alt="Preview" 
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 w-full space-y-1">
                  <label className="block text-[10px] font-semibold text-dark-muted uppercase tracking-wider">{t('avatarUrlLabel', lang)}</label>
                  <input
                    type="url"
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    placeholder="https://example.com/avatar.jpg"
                    className="w-full bg-dark-sidebar/40 border border-dark-border/40 rounded-xl px-3.5 py-2 text-xs text-white placeholder-dark-muted focus:outline-none focus:border-brand-500/60 focus:ring-1 focus:ring-brand-500/20 transition-all duration-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-1">
                  <label className="block text-[10px] font-semibold text-dark-muted uppercase tracking-wider">{t('studentNameLabel', lang)}</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-dark-sidebar/40 border border-dark-border/40 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-brand-500/60 focus:ring-1 focus:ring-brand-500/20 transition-all duration-200"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-semibold text-dark-muted uppercase tracking-wider">{t('studentIdLabel', lang)}</label>
                  <input
                    type="text"
                    required
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    className="w-full bg-dark-sidebar/40 border border-dark-border/40 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-brand-500/60 focus:ring-1 focus:ring-brand-500/20 transition-all duration-200"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-semibold text-dark-muted uppercase tracking-wider">{t('studentEmailLabel', lang)}</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-dark-sidebar/40 border border-dark-border/40 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-brand-500/60 focus:ring-1 focus:ring-brand-500/20 transition-all duration-200"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-semibold text-dark-muted uppercase tracking-wider">{t('studentMajorLabel', lang)}</label>
                  <input
                    type="text"
                    required
                    value={major}
                    onChange={(e) => setMajor(e.target.value)}
                    className="w-full bg-dark-sidebar/40 border border-dark-border/40 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-brand-500/60 focus:ring-1 focus:ring-brand-500/20 transition-all duration-200"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="bg-brand-500 hover:bg-brand-600 text-white font-medium text-xs px-5 py-2.5 rounded-xl transition-all duration-200 shadow-md shadow-brand-500/10 hover:translate-x-0.5 cursor-pointer"
                >
                  {lang === 'en' ? 'Save Changes' : 'บันทึกการเปลี่ยนแปลง'}
                </button>
              </div>
            </form>

            {/* Google Classroom Integration Actions */}
            <div className="pt-5 border-t border-dark-border/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <h4 className="font-semibold text-xs text-white flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${isLoggedIn ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-500'}`} />
                  {lang === 'en' ? 'Google Classroom Account' : 'บัญชี Google Classroom'}
                </h4>
                <p className="text-[11px] text-dark-muted">
                  {isLoggedIn 
                    ? (lang === 'en' ? `Connected as ${profile.email || email}` : `เชื่อมต่อโดยอีเมล ${profile.email || email}`) 
                    : (lang === 'en' ? 'Link your school Google Account to import real coursework.' : 'เชื่อมต่อบัญชี Google ของสถานบันเพื่อนำเข้าการบ้านจริง')}
                </p>
              </div>
              
              {isLoggedIn ? (
                <button
                  type="button"
                  onClick={onLogout}
                  className="bg-rose-500/10 hover:bg-rose-500 hover:text-white text-rose-400 border border-rose-500/20 text-xs font-semibold px-4.5 py-2 rounded-xl transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <LogOut size={12} />
                  {t('disconnectBtn', lang)}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onLogin}
                  className="bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold px-4.5 py-2 rounded-xl transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-brand-500/15"
                >
                  <LogIn size={12} />
                  {t('connectBtn', lang)}
                </button>
              )}
            </div>
          </div>

          {/* Gmail Notifications Configuration Card */}
          {isLoggedIn && (
            <div className="bg-dark-card/20 border border-dark-border/30 rounded-2xl p-6 md:p-8 space-y-6 shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-dark-border/20">
                <div className="flex items-center gap-3">
                  <Mail size={16} className="text-brand-400" />
                  <h3 className="font-semibold text-xs text-white uppercase tracking-wider">{t('gmailSystemHeader', lang)}</h3>
                </div>
                
                {/* Overall Switch */}
                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    checked={emailAlerts}
                    onChange={(e) => handleToggleAlerts(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-500"></div>
                </label>
              </div>

              {emailAlerts ? (
                <div className="space-y-5 animate-fade-in text-xs">
                  {/* Daily Limit Tracker */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-brand-500/5 border border-brand-500/10">
                    <span className="text-dark-muted font-medium">{t('quotaLabel', lang)}</span>
                    <span className="text-brand-400 font-bold">{t('quotaDesc', lang, { count: dailyLimit.count })}</span>
                  </div>

                  {/* Settings Rules Checklist */}
                  <div className="space-y-3.5">
                    <span className="block text-[10px] font-semibold text-dark-muted uppercase tracking-wider">{t('triggersHeader', lang)}</span>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <label className="flex items-start gap-2.5 cursor-pointer">
                        <input 
                          type="checkbox"
                          checked={alertSettings.due3Days}
                          onChange={() => handleToggleSetting('due3Days')}
                          className="w-4 h-4 rounded text-brand-500 bg-dark-sidebar border-dark-border cursor-pointer focus:ring-0"
                        />
                        <div className="space-y-0.5">
                          <span className="font-semibold text-white">{t('due3DaysLabel', lang)}</span>
                          <p className="text-[10px] text-dark-muted">{t('due3DaysDesc', lang)}</p>
                        </div>
                      </label>

                      <label className="flex items-start gap-2.5 cursor-pointer">
                        <input 
                          type="checkbox"
                          checked={alertSettings.due1Day}
                          onChange={() => handleToggleSetting('due1Day')}
                          className="w-4 h-4 rounded text-brand-500 bg-dark-sidebar border-dark-border cursor-pointer focus:ring-0"
                        />
                        <div className="space-y-0.5">
                          <span className="font-semibold text-white">{t('due1DayLabel', lang)}</span>
                          <p className="text-[10px] text-dark-muted">{t('due1DayDesc', lang)}</p>
                        </div>
                      </label>

                      <label className="flex items-start gap-2.5 cursor-pointer">
                        <input 
                          type="checkbox"
                          checked={alertSettings.dueToday}
                          onChange={() => handleToggleSetting('dueToday')}
                          className="w-4 h-4 rounded text-brand-500 bg-dark-sidebar border-dark-border cursor-pointer focus:ring-0"
                        />
                        <div className="space-y-0.5">
                          <span className="font-semibold text-white">{t('dueTodayLabel', lang)}</span>
                          <p className="text-[10px] text-dark-muted">{t('dueTodayDesc', lang)}</p>
                        </div>
                      </label>

                      <label className="flex items-start gap-2.5 cursor-pointer">
                        <input 
                          type="checkbox"
                          checked={alertSettings.overdue1Day}
                          onChange={() => handleToggleSetting('overdue1Day')}
                          className="w-4 h-4 rounded text-brand-500 bg-dark-sidebar border-dark-border cursor-pointer focus:ring-0"
                        />
                        <div className="space-y-0.5">
                          <span className="font-semibold text-white">{t('overdue1DayLabel', lang)}</span>
                          <p className="text-[10px] text-dark-muted">{t('overdue1DayDesc', lang)}</p>
                        </div>
                      </label>

                      <label className="flex items-start gap-2.5 cursor-pointer col-span-1 sm:col-span-2">
                        <input 
                          type="checkbox"
                          checked={alertSettings.newPosts}
                          onChange={() => handleToggleSetting('newPosts')}
                          className="w-4 h-4 rounded text-brand-500 bg-dark-sidebar border-dark-border cursor-pointer focus:ring-0"
                        />
                        <div className="space-y-0.5">
                          <span className="font-semibold text-white">{t('newPostsLabel', lang)}</span>
                          <p className="text-[10px] text-dark-muted">{t('newPostsDesc', lang)}</p>
                        </div>
                      </label>
                    </div>

                    <div className="border-t border-dark-border/20 pt-4 space-y-3">
                      <label className="flex items-start gap-2.5 cursor-pointer">
                        <input 
                          type="checkbox"
                          checked={alertSettings.sundayDigest}
                          onChange={() => handleToggleSetting('sundayDigest')}
                          className="w-4 h-4 rounded text-brand-500 bg-dark-sidebar border-dark-border cursor-pointer focus:ring-0"
                        />
                        <div className="space-y-0.5">
                          <span className="font-semibold text-white">{t('sundayDigestLabel', lang)}</span>
                          <p className="text-[10px] text-dark-muted font-medium">{t('sundayDigestDesc', lang)}</p>
                        </div>
                      </label>

                      {alertSettings.sundayDigest && (
                        <div className="flex items-center gap-3 pl-6 animate-fade-in">
                          <span className="text-[10px] text-dark-muted uppercase font-semibold">{t('deliveryTimeLabel', lang)}</span>
                          <input 
                            type="time" 
                            value={sundayTime}
                            onChange={(e) => handleTimeChange(e.target.value)}
                            className="bg-dark-sidebar/40 border border-dark-border/40 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions buttons */}
                  <div className="flex flex-wrap gap-3 pt-3 border-t border-dark-border/20">

                    <button
                      type="button"
                      disabled={digestSending}
                      onClick={handleSendDigestNow}
                      className="bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold px-4.5 py-2.5 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {digestSending ? t('sendingDigestBtn', lang) : t('sendDigestBtn', lang)}
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

        {/* Right Section: Developer Bio & Project specs */}
        <div className="space-y-6">
          {/* Developer Mini Profile */}
          <div className="bg-dark-card/20 border border-dark-border/30 rounded-2xl p-6 space-y-5 shadow-sm">
            <div className="flex items-center gap-3 pb-2">
              <User size={16} className="text-brand-400" />
              <h3 className="font-semibold text-xs text-white uppercase tracking-wider">{t('developerHeader', lang)}</h3>
            </div>

            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-full overflow-hidden border border-brand-500/20 bg-brand-500/5 flex items-center justify-center shrink-0">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={devInfo.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-brand-400 text-xl font-bold font-heading">
                    {name ? name.charAt(0).toUpperCase() : 'K'}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <h4 className="font-semibold text-white text-xs leading-tight truncate">{devInfo.name}</h4>
                <p className="text-[10px] text-brand-400 mt-0.5">@{devInfo.nickname}</p>
              </div>
            </div>

            <p className="text-[11px] text-zinc-300 leading-relaxed leading-5">
              {devInfo.bio}
            </p>

            <div className="space-y-2.5 pt-3 border-t border-dark-border/30 text-[11px]">
              <div className="flex items-start gap-2.5">
                <GraduationCap size={13} className="text-dark-muted shrink-0 mt-0.5" />
                <span className="text-zinc-300 leading-normal">{devInfo.university}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Mail size={13} className="text-dark-muted shrink-0" />
                <a href={`mailto:${email || devInfo.email}`} className="text-zinc-300 hover:text-brand-400 transition-colors truncate">{email || devInfo.email}</a>
              </div>
            </div>

            <a 
              href={devInfo.github}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-1.5 bg-dark-sidebar/50 hover:bg-dark-hover text-white border border-dark-border/40 py-2 rounded-xl transition-colors font-medium text-xs cursor-pointer shadow-sm"
            >
              <GithubIcon size={13} />
              GitHub Profile
            </a>
          </div>

          {/* Project Details */}
          <div className="bg-dark-card/20 border border-dark-border/30 rounded-2xl p-6 space-y-4 shadow-sm">
            <div className="flex items-center gap-3 pb-1">
              <Code size={16} className="text-brand-400" />
              <h3 className="font-semibold text-xs text-white uppercase tracking-wider">{t('projectDetailsHeader', lang)}</h3>
            </div>

            <p className="text-[11px] text-zinc-300 leading-relaxed leading-5">
              {t('projectDesc', lang)}
            </p>

            <div className="grid grid-cols-2 gap-2 pt-1.5">
              {techStack.map((tech) => (
                <div 
                  key={tech.name} 
                  className={`p-2.5 rounded-xl border flex flex-col space-y-0.5 ${getPillColor(tech.color)}`}
                >
                  <span className="text-[8px] uppercase font-semibold opacity-70 tracking-wider">
                    {tech.category}
                  </span>
                  <span className="font-bold text-[10px]">
                    {tech.name}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Notification History Card */}
          {isLoggedIn && emailAlerts && (
            <div className="bg-dark-card/20 border border-dark-border/30 rounded-2xl p-6 space-y-4 shadow-sm animate-fade-in">
              <div className="flex items-center gap-3 pb-2 border-b border-dark-border/20">
                <Sparkles size={16} className="text-brand-400" />
                <h3 className="font-semibold text-xs text-white uppercase tracking-wider">{t('notificationHistoryHeader', lang)}</h3>
              </div>

              <div className="max-h-[220px] overflow-y-auto pr-1 space-y-2.5 text-xs custom-scrollbar">
                {historyLogs.length > 0 ? (
                  historyLogs.map(log => {
                    const formattedLogDate = new Date(log.sentAt).toLocaleDateString(lang === 'en' ? 'en-US' : 'th-TH', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit'
                    });
                    return (
                      <div key={log.id} className="p-2.5 rounded-xl bg-dark-sidebar/30 border border-dark-border/25 flex flex-col gap-0.5">
                        <span className="font-semibold text-white">{log.title}</span>
                        <span className="text-[10px] text-dark-muted">{formattedLogDate}</span>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-6 text-dark-muted text-[10px]">
                    {t('noHistoryLogs', lang)}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
