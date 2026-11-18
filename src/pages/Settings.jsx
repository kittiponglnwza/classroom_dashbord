import { useState, useEffect, useRef, useId } from 'react';
import {
  GraduationCap, Code, Mail, CheckCircle2, ChevronRight, Settings2,
  Layers, RefreshCw, MessageSquare, Copy, Check, ExternalLink, Terminal
} from 'lucide-react';
import { t } from '../utils/i18n';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { useClassroom } from '../contexts/ClassroomContext';
import { calendarSyncManager } from '../services/CalendarSyncManager';
import { syncManager } from '../services/SyncManager';
import { DiscordService } from '../services/DiscordService';
import { triggerTestDiscord, triggerManualDiscordDigest } from '../utils/notifications';
import { getAppsScriptTemplate } from '../utils/appsScriptTemplate';
import { getHiddenCourses, getAssignments } from '../utils/storage';

const GithubIcon = ({ size = 16, className = '' }) => (
  <svg height={size} width={size} viewBox="0 0 16 16" version="1.1" fill="currentColor" className={className} aria-hidden="true">
    <path fillRule="evenodd" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
  </svg>
);

const InstagramIcon = ({ size = 16, className = '' }) => (
  <svg height={size} width={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
  </svg>
);

const InputField = ({ label, value, onChange, type = 'text', required = true, readOnly = false, placeholder = '', inputMode = undefined }) => {
  const fieldId = useId();
  return (
    <div className="space-y-1.5">
      <label htmlFor={fieldId} className="block text-xs font-medium text-[#D4D4D4]">
        {label}
      </label>
      <input
        id={fieldId}
        type={type}
        required={required}
        readOnly={readOnly}
        disabled={readOnly}
        placeholder={placeholder}
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        className={`w-full bg-[#1E1E1E] border border-[#3C3C3C] rounded-xl px-3.5 py-2.5 text-sm placeholder-[#858585] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007ACC] transition-colors ${
          readOnly ? 'text-[#858585] cursor-not-allowed opacity-80' : 'text-[#D4D4D4]'
        }`}
      />
    </div>
  );
};

export default function Settings() {
  const { lang, alertSettings = {}, handleToggleSetting, handleUpdateSetting, refreshNotificationData } = useSettings();
  const { profile, isLoggedIn, handleProfileSave, login, logout, accessToken } = useAuth();
  const classroom = useClassroom();

  const [name, setName] = useState(profile.name || '');
  const [studentId, setStudentId] = useState(
    profile.studentId === 'Google Sync User' ? '' : (profile.studentId || '')
  );
  const [email, setEmail] = useState(profile.email || '');
  const [major, setMajor] = useState(profile.major || '');
  const [prevProfile, setPrevProfile] = useState(profile);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [avatarError, setAvatarError] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [isResettingCalendar, setIsResettingCalendar] = useState(false);
  const [calendarSyncState, setCalendarSyncState] = useState(calendarSyncManager.state);
  const [resetMessage, setResetMessage] = useState('');
  const [discordTestSending, setDiscordTestSending] = useState(false);
  const [discordDigestSending, setDiscordDigestSending] = useState(false);
  const [discordFeedback, setDiscordFeedback] = useState({ text: '', type: '' });
  const [scriptIncludeEmail, setScriptIncludeEmail] = useState(false);
  const [scriptNotifyNewPosts, setScriptNotifyNewPosts] = useState(true);
  const [showScriptPreview, setShowScriptPreview] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const webhookFieldId = useId();
  const timersRef = useRef([]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach(clearTimeout);
    };
  }, []);

  useEffect(() => {
    return calendarSyncManager.subscribe((st) => setCalendarSyncState(st));
  }, []);

  if (profile !== prevProfile) {
    setPrevProfile(profile);
    setName(profile.name || '');
    setStudentId(profile.studentId === 'Google Sync User' ? '' : (profile.studentId || ''));
    setEmail(profile.email || '');
    setMajor(profile.major || '');
    setAvatarError(false);
  }

  const devInfo = {
    name: 'KITTIPONG TEERASEE',
    nickname: 'Kittiponglnwza',
    email: 'kitipongzaza566@gmail.com',
    university: "King Mongkut's University of Technology North Bangkok",
    github: 'https://github.com/kittiponglnwza',
    instagram: 'https://www.instagram.com/kt_k1tt1111/',
    bio: 'Student Developer crafting minimalist, high-performance tools and web applications.'
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setProfileError('');
    const normalizedId = studentId.replace(/[\s-]/g, '').trim();
    if (normalizedId && !/^\d{13}$/.test(normalizedId)) {
      setProfileError(
        lang === 'en'
          ? 'Student ID must be 13 digits (or leave empty if not using KMUTNB exam lookup).'
          : 'รหัสนักศึกษาต้องเป็นตัวเลข 13 หลัก (หรือเว้นว่างไว้หากไม่ได้ใช้ค้นหาที่นั่งสอบ มจพ.)'
      );
      return;
    }

    handleProfileSave({
      name: name.trim(),
      studentId: normalizedId,
      email: isLoggedIn && profile.email ? profile.email : email,
      major: major.trim(),
      avatarUrl: profile.avatarUrl
    });
    setSaveSuccess(true);
    const id = setTimeout(() => setSaveSuccess(false), 3000);
    timersRef.current.push(id);
  };

  const handleResetCalendar = async () => {
    if (!profile.email || !accessToken) return;
    setIsResettingCalendar(true);
    setResetMessage('');
    try {
      await calendarSyncManager.resetAndSync(accessToken, profile.email);
      setResetMessage(lang === 'en' ? 'Calendar reset & sync initiated!' : 'ล้างข้อมูลและเริ่มซิงค์ปฏิทินใหม่แล้ว!');
    } catch (e) {
      console.error(e);
      setResetMessage(lang === 'en' ? 'Error resetting calendar.' : 'เกิดข้อผิดพลาดในการล้างข้อมูลปฏิทิน');
    } finally {
      setIsResettingCalendar(false);
      const id = setTimeout(() => setResetMessage(''), 4000);
      timersRef.current.push(id);
    }
  };

  const handleSyncCalendarNow = async () => {
    if (!profile.email || !accessToken) return;
    setResetMessage('');
    try {
      await calendarSyncManager.runSync(accessToken, profile.email);
      setResetMessage(lang === 'en' ? 'Calendar synced & duplicates cleaned!' : 'ซิงก์ปฏิทินและลบรายการซ้ำเรียบร้อยแล้ว!');
    } catch (e) {
      console.error(e);
      setResetMessage(lang === 'en' ? 'Error syncing calendar.' : 'เกิดข้อผิดพลาดในการซิงก์ปฏิทิน');
    } finally {
      const id = setTimeout(() => setResetMessage(''), 4000);
      timersRef.current.push(id);
    }
  };

  const activeUserEmail = profile.email || email || '';
  const hiddenCourseIds = getHiddenCourses(activeUserEmail);
  const currentAssignments = classroom?.assignments || getAssignments(activeUserEmail);
  const webhookValidation = DiscordService.validateWebhookUrl(alertSettings.discordWebhookUrl || '');
  const maskedWebhook = DiscordService.maskWebhookUrl(alertSettings.discordWebhookUrl || '');

  const generatedAppsScript = getAppsScriptTemplate(hiddenCourseIds, {
    discordWebhookUrl: alertSettings.discordWebhookUrl || '',
    enableDiscord: true,
    enableEmail: scriptIncludeEmail,
    notifyNewPosts: scriptNotifyNewPosts
  });

  const handleTestDiscordWebhook = async () => {
    setDiscordFeedback({ text: '', type: '' });
    if (!webhookValidation.valid) {
      setDiscordFeedback({
        text: lang === 'en'
          ? 'Please enter a valid Discord Webhook URL (https://discord.com/api/webhooks/...)'
          : 'กรุณาใส่ลิงก์ Discord Webhook ที่ถูกต้อง (https://discord.com/api/webhooks/...)',
        type: 'error'
      });
      return;
    }
    setDiscordTestSending(true);
    try {
      await triggerTestDiscord(activeUserEmail, webhookValidation.url);
      refreshNotificationData?.();
      if (accessToken && activeUserEmail) {
        syncManager.queueSync(accessToken, activeUserEmail);
      }
      setDiscordFeedback({
        text: lang === 'en'
          ? 'Test message delivered to Discord successfully!'
          : 'ส่งข้อความทดสอบเข้า Discord สำเร็จแล้ว! เช็กในห้องแชทได้เลย',
        type: 'success'
      });
    } catch (err) {
      setDiscordFeedback({
        text: (lang === 'en' ? 'Failed to send to Discord: ' : 'ส่งเข้า Discord ไม่สำเร็จ: ') + err.message,
        type: 'error'
      });
    } finally {
      setDiscordTestSending(false);
    }
  };

  const handleSendDiscordDigest = async () => {
    setDiscordFeedback({ text: '', type: '' });
    if (!webhookValidation.valid) {
      setDiscordFeedback({
        text: lang === 'en'
          ? 'Please enter a valid Discord Webhook URL first.'
          : 'กรุณาใส่ลิงก์ Discord Webhook ที่ถูกต้องก่อน',
        type: 'error'
      });
      return;
    }
    setDiscordDigestSending(true);
    try {
      await triggerManualDiscordDigest(activeUserEmail, currentAssignments, webhookValidation.url);
      refreshNotificationData?.();
      if (accessToken && activeUserEmail) {
        syncManager.queueSync(accessToken, activeUserEmail);
      }
      setDiscordFeedback({
        text: lang === 'en'
          ? 'Pending assignments & exam digest sent to Discord!'
          : 'ส่งสรุปงานค้างและตารางสอบเข้า Discord เรียบร้อยแล้ว!',
        type: 'success'
      });
    } catch (err) {
      setDiscordFeedback({
        text: (lang === 'en' ? 'Failed: ' : 'เกิดข้อผิดพลาด: ') + err.message,
        type: 'error'
      });
    } finally {
      setDiscordDigestSending(false);
    }
  };

  const handleCopyAppsScript = async () => {
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(generatedAppsScript);
      } else {
        const tempArea = document.createElement('textarea');
        tempArea.value = generatedAppsScript;
        document.body.appendChild(tempArea);
        tempArea.select();
        document.execCommand('copy');
        document.body.removeChild(tempArea);
      }
      setCopiedScript(true);
      const id = setTimeout(() => setCopiedScript(false), 3000);
      timersRef.current.push(id);
    } catch {
      setDiscordFeedback({
        text: lang === 'en' ? 'Could not copy automatically. Open preview below to copy manually.' : 'ไม่สามารถคัดลอกอัตโนมัติได้ กรุณากดดูโค้ดด้านล่างเพื่อคัดลอก',
        type: 'error'
      });
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="border-b border-[#3C3C3C] pb-5">
        <h1 className="text-2xl font-semibold text-[#FFFFFF] tracking-tight flex items-center gap-2.5">
          <Settings2 size={22} className="text-[#3794FF]" />
          <span>{t('settingsTitle', lang)}</span>
        </h1>
        <p className="text-xs text-[#9D9D9D] mt-1 leading-relaxed">{t('settingsDesc', lang)}</p>
      </div>

      {saveSuccess && (
        <div className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs px-4 py-3 rounded-xl flex items-center gap-2">
          <CheckCircle2 size={15} className="text-emerald-400" />
          <span>{t('profileSuccess', lang)}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (Profile & Integrations) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-[#252526] border border-[#3C3C3C] rounded-2xl p-6 md:p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 text-center sm:text-left">
                <div className="w-20 h-20 rounded-full overflow-hidden bg-[#1E1E1E] border border-[#3C3C3C] flex items-center justify-center shrink-0">
                  {profile.avatarUrl && !avatarError ? (
                    <img
                      src={profile.avatarUrl}
                      alt="Avatar"
                      onError={() => setAvatarError(true)}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-2xl font-semibold text-[#D4D4D4]">
                      {(name || profile.name || 'S').charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="pt-1 space-y-1">
                  <h3 className="text-lg font-semibold text-[#FFFFFF]">{name || 'Student'}</h3>
                  <div className="inline-flex items-center gap-1.5 bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 rounded-full text-[11px] font-medium text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span>{lang === 'en' ? 'Synced Profile' : 'ซิงค์ข้อมูลแล้ว'}</span>
                  </div>
                </div>
              </div>

              {profileError && (
                <div role="alert" className="bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs px-3.5 py-2.5 rounded-xl">
                  {profileError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InputField label={t('studentNameLabel', lang)} value={name} onChange={setName} />
                <InputField
                  label={t('studentIdLabel', lang)}
                  value={studentId}
                  onChange={setStudentId}
                  required={false}
                  inputMode="numeric"
                  placeholder="6401012345678"
                />
                <InputField
                  label={t('studentEmailLabel', lang)}
                  value={email}
                  onChange={setEmail}
                  type="email"
                  readOnly={isLoggedIn}
                />
                <InputField
                  label={t('studentMajorLabel', lang)}
                  value={major}
                  onChange={setMajor}
                  required={false}
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full sm:w-auto bg-[#007ACC] hover:bg-[#1177BB] text-white px-6 py-2.5 rounded-xl font-medium text-xs transition-colors cursor-pointer"
                >
                  {lang === 'en' ? 'Save Preferences' : 'บันทึกการตั้งค่า'}
                </button>
              </div>
            </form>
          </div>

          <div className="bg-[#252526] border border-[#3C3C3C] rounded-2xl p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-[#FFFFFF] mb-1 flex items-center gap-2">
                  <Layers className="text-[#3794FF] shrink-0" size={16} />
                  <span className="truncate">{lang === 'en' ? 'Classroom Integration' : 'บัญชี Google Classroom'}</span>
                </h3>
                <p className="text-xs text-[#9D9D9D] leading-relaxed break-all">
                  {isLoggedIn
                    ? (lang === 'en' ? `Connected securely as ${profile.email || email}` : `เชื่อมต่อแล้วด้วยอีเมล ${profile.email || email}`)
                    : (lang === 'en' ? 'Connect your account to sync assignments automatically.' : 'เชื่อมต่อบัญชีเพื่อซิงค์ข้อมูลการบ้านอัตโนมัติ')}
                </p>
              </div>
              {isLoggedIn ? (
                confirmLogout ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setConfirmLogout(false)}
                      className="px-3.5 py-2 rounded-xl text-xs font-medium bg-[#1E1E1E] hover:bg-[#2A2D2E] text-[#D4D4D4] border border-[#3C3C3C] transition-colors cursor-pointer"
                    >
                      {t('cancelBtn', lang)}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmLogout(false);
                        logout();
                      }}
                      className="px-4 py-2 rounded-xl text-xs font-medium bg-rose-600 hover:bg-rose-500 text-white transition-colors cursor-pointer"
                    >
                      {t('disconnectBtn', lang)}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmLogout(true)}
                    className="w-full sm:w-auto shrink-0 bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 px-5 py-2.5 rounded-xl text-xs font-medium transition-colors cursor-pointer"
                  >
                    {t('disconnectBtn', lang)}
                  </button>
                )
              ) : (
                <button
                  type="button"
                  onClick={() => login()}
                  className="w-full sm:w-auto shrink-0 bg-[#007ACC] hover:bg-[#1177BB] text-white px-5 py-2.5 rounded-xl text-xs font-medium transition-colors cursor-pointer"
                >
                  {t('connectBtn', lang)}
                </button>
              )}
            </div>
          </div>

          {isLoggedIn && (
            <div className="bg-[#252526] border border-[#3C3C3C] rounded-2xl p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-[#FFFFFF] mb-1 flex items-center gap-2">
                    <RefreshCw className="text-[#3794FF] shrink-0" size={16} />
                    <span className="truncate">{lang === 'en' ? 'Reset Calendar Sync' : 'รีเซ็ตข้อมูลปฏิทิน'}</span>
                  </h3>
                  <p className="text-xs text-[#9D9D9D] leading-relaxed">
                    {lang === 'en'
                      ? 'If your calendar events are duplicated or notifications are repeating, use this to clear and freshly re-sync all data.'
                      : 'หากการแจ้งเตือนซ้ำซ้อนหรือกิจกรรมในปฏิทินมีปัญหา คุณสามารถเลือกล้างและซิงค์ใหม่ทั้งหมดได้'}
                  </p>
                  {resetMessage && (
                    <p
                      className={`text-xs mt-2 font-medium ${
                        resetMessage.includes('Error') || resetMessage.includes('ข้อผิดพลาด')
                          ? 'text-rose-400'
                          : 'text-emerald-400'
                      }`}
                    >
                      {resetMessage}
                    </p>
                  )}
                </div>
                <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleSyncCalendarNow}
                    disabled={calendarSyncState === 'syncing' || isResettingCalendar}
                    className="w-full sm:w-auto justify-center shrink-0 bg-[#007ACC] hover:bg-[#1177BB] text-white px-4 py-2.5 rounded-xl text-xs font-medium transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-2"
                  >
                    {calendarSyncState === 'syncing' && !isResettingCalendar && <RefreshCw size={13} className="animate-spin" />}
                    <span>{calendarSyncState === 'syncing' && !isResettingCalendar ? t('syncingCalendarBtn', lang) : t('syncCalendarNowBtn', lang)}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleResetCalendar}
                    disabled={isResettingCalendar || calendarSyncState === 'syncing'}
                    className="w-full sm:w-auto justify-center shrink-0 bg-[#1E1E1E] hover:bg-[#2A2D2E] text-[#D4D4D4] border border-[#3C3C3C] px-4 py-2.5 rounded-xl text-xs font-medium transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-2"
                  >
                    {isResettingCalendar && <RefreshCw size={13} className="animate-spin text-[#3794FF]" />}
                    <span>{lang === 'en' ? 'Reset Calendar' : 'ล้างแล้วลงใหม่'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Discord Webhook & 24/7 Apps Script Cloud Auto-Alert Card */}
          <div className="bg-[#252526] border border-[#3C3C3C] rounded-2xl p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#3C3C3C] pb-4">
              <div>
                <h3 className="text-sm font-semibold text-[#FFFFFF] flex items-center gap-2">
                  <MessageSquare className="text-[#5865F2] shrink-0" size={16} />
                  <span>
                    {lang === 'en'
                      ? 'Discord Webhook & 24/7 Cloud Auto-Alert (Apps Script)'
                      : 'แจ้งเตือนผ่าน Discord Webhook + ระบบคลาวด์ 24 ชม. (Apps Script)'}
                  </span>
                </h3>
                <p className="text-xs text-[#9D9D9D] mt-1 leading-relaxed">
                  {lang === 'en'
                    ? 'Receive instant homework deadlines, new posts, and exam digests in your Discord channel — even when your browser or PC is off.'
                    : 'รับแจ้งเตือนการบ้านใกล้ส่ง ประกาศใหม่ และตารางสอบเข้าห้อง Discord ทันที พร้อมสร้างสคริปต์รันบนคลาวด์ฟรี 24 ชม. แม้ปิดคอม'}
                </p>
              </div>
              <span
                data-testid="discord-webhook-status"
                className={`self-start sm:self-center shrink-0 text-[11px] px-2.5 py-0.5 rounded-full font-medium ${
                  webhookValidation.valid
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : (alertSettings.discordWebhookUrl || '').trim()
                      ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                      : 'bg-[#1E1E1E] text-[#9D9D9D] border border-[#3C3C3C]'
                }`}
              >
                {webhookValidation.valid
                  ? (lang === 'en' ? 'Webhook Ready' : 'ลิงก์พร้อมใช้งาน')
                  : (alertSettings.discordWebhookUrl || '').trim()
                    ? (lang === 'en' ? 'Invalid Webhook URL' : 'ลิงก์ไม่ถูกต้อง')
                    : (lang === 'en' ? 'Not Configured' : 'ยังไม่ตั้งค่า')}
              </span>
            </div>

            {discordFeedback.text && (
              <div
                role={discordFeedback.type === 'error' ? 'alert' : 'status'}
                className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                  discordFeedback.type === 'error'
                    ? 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                    : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                }`}
              >
                <span>{discordFeedback.text}</span>
                <button
                  type="button"
                  onClick={() => setDiscordFeedback({ text: '', type: '' })}
                  className="text-sm font-semibold ml-2 hover:opacity-75 cursor-pointer"
                  aria-label={lang === 'en' ? 'Dismiss alert' : 'ปิดข้อความ'}
                >
                  ×
                </button>
              </div>
            )}

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label htmlFor={webhookFieldId} className="block text-xs font-medium text-[#D4D4D4]">
                  {lang === 'en' ? 'Discord Webhook URL' : 'ลิงก์ Discord Webhook (จาก Server Settings > Integrations > Webhooks)'}
                </label>
                <input
                  id={webhookFieldId}
                  type="url"
                  placeholder="https://discord.com/api/webhooks/123456789/abcdef..."
                  value={alertSettings.discordWebhookUrl || ''}
                  onChange={(e) => handleUpdateSetting?.('discordWebhookUrl', e.target.value)}
                  className="w-full bg-[#1E1E1E] border border-[#3C3C3C] rounded-xl px-3.5 py-2.5 text-xs text-[#D4D4D4] placeholder-[#858585] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5865F2]"
                />
                {maskedWebhook && (
                  <p className="text-[11px] text-[#858585] font-mono break-all">
                    {lang === 'en' ? 'Verified endpoint: ' : 'ปลายทางที่ตรวจสอบแล้ว: '}{maskedWebhook}
                  </p>
                )}
              </div>

              <label className="flex items-start gap-2.5 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={Boolean(alertSettings.discordEnabled)}
                  onChange={() => handleToggleSetting?.('discordEnabled')}
                  className="w-4 h-4 rounded accent-[#5865F2] cursor-pointer mt-0.5 shrink-0"
                />
                <div className="space-y-0.5">
                  <span className="text-xs font-medium text-[#FFFFFF]">
                    {lang === 'en'
                      ? 'Auto-send alerts to Discord when syncing on web'
                      : 'ส่งแจ้งเตือนเข้า Discord อัตโนมัติเมื่อเปิดหน้าเว็บซิงก์ข้อมูล'}
                  </span>
                  <p className="text-[11px] text-[#858585] leading-relaxed">
                    {lang === 'en'
                      ? 'Evaluates 3-day / 1-day / due-today reminders, new posts, and Sunday exam digests.'
                      : 'เช็กงานใกล้ส่ง 3 วัน / 1 วัน / วันครบกำหนด โพสต์ใหม่ และสรุปตารางสอบวันอาทิตย์'}
                  </p>
                </div>
              </label>

              <div className="flex flex-wrap gap-2.5 pt-1">
                <button
                  type="button"
                  disabled={discordTestSending || discordDigestSending || !webhookValidation.valid}
                  onClick={handleTestDiscordWebhook}
                  className="bg-[#5865F2] hover:bg-[#4752C4] text-white px-4 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-2"
                >
                  {discordTestSending ? <RefreshCw size={13} className="animate-spin" /> : <MessageSquare size={13} />}
                  <span>
                    {discordTestSending
                      ? (lang === 'en' ? 'Testing...' : 'กำลังทดสอบ...')
                      : (lang === 'en' ? 'Test Discord Webhook' : 'ยิงข้อความทดสอบเข้า Discord')}
                  </span>
                </button>

                <button
                  type="button"
                  disabled={discordDigestSending || discordTestSending || !webhookValidation.valid}
                  onClick={handleSendDiscordDigest}
                  className="bg-[#1E1E1E] hover:bg-[#2A2D2E] text-[#D4D4D4] border border-[#3C3C3C] px-4 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-2"
                >
                  {discordDigestSending && <RefreshCw size={13} className="animate-spin text-[#5865F2]" />}
                  <span>
                    {discordDigestSending
                      ? (lang === 'en' ? 'Sending Digest...' : 'กำลังส่งสรุป...')
                      : (lang === 'en' ? 'Send Task & Exam Digest Now' : 'ส่งสรุปงานค้าง + ตารางสอบเข้า Discord ทันที')}
                  </span>
                </button>
              </div>
            </div>

            {/* 24/7 Google Apps Script Generator & Debug Section */}
            <div className="bg-[#1E1E1E] border border-[#3C3C3C] rounded-xl p-4 space-y-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <h4 className="text-xs font-semibold text-[#FFFFFF] flex items-center gap-1.5">
                    <Terminal size={14} className="text-[#3794FF]" />
                    <span>
                      {lang === 'en'
                        ? '24/7 Google Apps Script Generator (No Server Needed)'
                        : 'ตัวสร้างโค้ด Google Apps Script แจ้งเตือน 24 ชม. (ไม่ต้องเปิดเว็บทิ้งไว้)'}
                    </span>
                  </h4>
                  <p className="text-[11px] text-[#9D9D9D]">
                    {lang === 'en'
                      ? `Pre-configured with your Webhook URL and ${hiddenCourseIds.length} hidden course(s) excluded.`
                      : `ฝังลิงก์ Webhook และรายชื่อวิชาที่ซ่อนไว้ (${hiddenCourseIds.length} วิชา) ให้พร้อมวางรันทันที`}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-4 text-xs text-[#D4D4D4]">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={scriptNotifyNewPosts}
                    onChange={(e) => setScriptNotifyNewPosts(e.target.checked)}
                    className="w-3.5 h-3.5 rounded accent-[#007ACC] cursor-pointer"
                  />
                  <span>{lang === 'en' ? 'Notify new announcements (24h)' : 'แจ้งเตือนประกาศใหม่ (ใน 24 ชม.)'}</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={scriptIncludeEmail}
                    onChange={(e) => setScriptIncludeEmail(e.target.checked)}
                    className="w-3.5 h-3.5 rounded accent-[#007ACC] cursor-pointer"
                  />
                  <span>{lang === 'en' ? 'Also send Gmail backup' : 'ส่งเข้า Gmail ควบคู่ด้วย'}</span>
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyAppsScript}
                  className="bg-[#007ACC] hover:bg-[#1177BB] text-white px-4 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  {copiedScript ? <Check size={13} /> : <Copy size={13} />}
                  <span>
                    {copiedScript
                      ? (lang === 'en' ? 'Copied Apps Script!' : 'คัดลอกโค้ดเรียบร้อย!')
                      : (lang === 'en' ? 'Copy Apps Script Code' : 'คัดลอกโค้ด Apps Script')}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowScriptPreview(prev => !prev)}
                  className="bg-[#252526] hover:bg-[#2A2D2E] text-[#D4D4D4] border border-[#3C3C3C] px-3.5 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer"
                >
                  {showScriptPreview
                    ? (lang === 'en' ? 'Hide Code & Debug Guide' : 'ซ่อนโค้ดและคู่มือ Debug')
                    : (lang === 'en' ? 'View Code & Debug Guide' : 'ดูโค้ดและวิธีตั้งค่า / Debug')}
                </button>

                <a
                  href="https://script.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[#3794FF] hover:underline px-2 py-1.5"
                >
                  <span>{lang === 'en' ? 'Open script.google.com' : 'เปิด script.google.com'}</span>
                  <ExternalLink size={12} />
                </a>
              </div>

              {showScriptPreview && (
                <div className="space-y-3 pt-2 border-t border-[#3C3C3C]">
                  <div className="bg-[#252526] border border-[#3C3C3C] rounded-xl p-3 text-[11px] text-[#D4D4D4] space-y-1.5 leading-relaxed">
                    <p className="font-semibold text-[#FFFFFF]">
                      {lang === 'en' ? 'Built-in Debug & Trigger Functions in Apps Script:' : 'ฟังก์ชัน Debug และตั้งเวลาที่มีให้ในโค้ด:'}
                    </p>
                    <ul className="list-disc pl-4 space-y-1 text-[#9D9D9D]">
                      <li>
                        <code className="text-[#4EC9B0]">testDiscordWebhook()</code> —{' '}
                        {lang === 'en'
                          ? 'Run first in Apps Script to test sending an Embed directly from Google Cloud to your Discord channel.'
                          : 'กด Run ตัวนี้ตัวแรกใน Apps Script เพื่อทดสอบยิงการ์ดแจ้งเตือนจาก Google Cloud เข้า Discord ทันที'}
                      </li>
                      <li>
                        <code className="text-[#CCA700]">debugDryRun()</code> —{' '}
                        {lang === 'en'
                          ? 'Inspects all active courses, hidden courses, and pending deadlines in Execution Log without sending messages.'
                          : 'เช็กรายวิชา วิชาที่ถูกซ่อน และรายการงานค้างใน Execution Log โดยไม่ยิงข้อความจริง'}
                      </li>
                      <li>
                        <code className="text-[#3794FF]">sendClassroomDigest()</code> —{' '}
                        {lang === 'en'
                          ? 'Main function to attach to a Time-driven Trigger (e.g. Every hour).'
                          : 'ฟังก์ชันหลักสำหรับตั้ง Triggers (รูปนาฬิกาปลุก) ให้รันอัตโนมัติทุกชั่วโมงหรือทุกวัน'}
                      </li>
                      <li>
                        <code className="text-[#C586C0]">resetSentHistory()</code> —{' '}
                        {lang === 'en'
                          ? 'Clears deduplication state in PropertiesService so you can re-test alerts cleanly.'
                          : 'ล้างประวัติป้องกันส่งซ้ำใน PropertiesService เผื่อต้องการทดสอบยิงซ้ำใหม่'}
                      </li>
                    </ul>
                  </div>

                  <textarea
                    readOnly
                    aria-label={lang === 'en' ? 'Generated Google Apps Script Code' : 'โค้ด Google Apps Script'}
                    value={generatedAppsScript}
                    rows={10}
                    className="w-full bg-[#181818] border border-[#3C3C3C] rounded-xl p-3 text-[11px] font-mono text-[#D4D4D4] focus:outline-none"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column (Developer & Info) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-[#252526] border border-[#3C3C3C] rounded-2xl p-6 md:p-8 space-y-5">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-[#007ACC]/20 border border-[#007ACC]/40 flex items-center justify-center shrink-0">
                <Code size={20} className="text-[#3794FF]" />
              </div>
              <div>
                <h4 className="font-semibold text-[#FFFFFF] text-base tracking-tight">{t('developerHeader', lang)}</h4>
                <p className="text-xs font-medium text-[#3794FF]">@{devInfo.nickname}</p>
              </div>
            </div>

            <p className="text-xs text-[#9D9D9D] leading-relaxed">
              {devInfo.bio}
            </p>

            <div className="space-y-3 text-xs">
              <div className="flex items-center gap-3 text-[#9D9D9D]">
                <div className="w-8 h-8 rounded-lg bg-[#1E1E1E] border border-[#3C3C3C] flex items-center justify-center shrink-0">
                  <GraduationCap size={14} className="text-[#3794FF]" />
                </div>
                <span className="leading-snug">{devInfo.university}</span>
              </div>
              <div className="flex items-center gap-3 text-[#9D9D9D]">
                <div className="w-8 h-8 rounded-lg bg-[#1E1E1E] border border-[#3C3C3C] flex items-center justify-center shrink-0">
                  <Mail size={14} className="text-[#3794FF]" />
                </div>
                <a href={`mailto:${devInfo.email}`} className="hover:text-[#3794FF] transition-colors">{devInfo.email}</a>
              </div>
            </div>

            <div className="space-y-2.5 pt-2">
              <a
                href={devInfo.github}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between w-full bg-[#1E1E1E] hover:bg-[#2A2D2E] border border-[#3C3C3C] p-3.5 rounded-xl transition-colors"
              >
                <div className="flex items-center gap-2.5 text-xs font-medium text-[#D4D4D4]">
                  <GithubIcon size={15} />
                  <span>GitHub Profile</span>
                </div>
                <ChevronRight size={14} className="text-[#858585]" />
              </a>

              <a
                href={devInfo.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between w-full bg-[#1E1E1E] hover:bg-[#2A2D2E] border border-[#3C3C3C] p-3.5 rounded-xl transition-colors"
              >
                <div className="flex items-center gap-2.5 text-xs font-medium text-[#D4D4D4]">
                  <InstagramIcon size={15} className="text-[#D4D4D4]" />
                  <span>Instagram Profile</span>
                </div>
                <ChevronRight size={14} className="text-[#858585]" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
