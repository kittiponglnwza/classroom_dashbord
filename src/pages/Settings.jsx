import { useState } from 'react';
import { GraduationCap, Code, Mail, CheckCircle2, ChevronRight, Settings2, Layers, RefreshCw } from 'lucide-react';
import { t } from '../utils/i18n';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { calendarSyncManager } from '../services/CalendarSyncManager';

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

const InputField = ({ label, value, onChange, type = 'text' }) => (
  <div className="space-y-1.5">
    <label className="block text-xs font-medium text-[#D4D4D4]">
      {label}
    </label>
    <input
      type={type}
      required
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-[#1E1E1E] border border-[#3C3C3C] rounded-xl px-3.5 py-2.5 text-sm text-[#D4D4D4] placeholder-[#858585] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007ACC] transition-colors"
    />
  </div>
);

export default function Settings() {
  const { lang } = useSettings();
  const { profile, isLoggedIn, handleProfileSave, login, logout, accessToken } = useAuth();

  const [name, setName] = useState(profile.name || '');
  const [studentId, setStudentId] = useState(profile.studentId || '');
  const [email, setEmail] = useState(profile.email || '');
  const [major, setMajor] = useState(profile.major || '');
  const [prevProfile, setPrevProfile] = useState(profile);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isResettingCalendar, setIsResettingCalendar] = useState(false);
  const [resetMessage, setResetMessage] = useState('');

  if (profile !== prevProfile) {
    setPrevProfile(profile);
    setName(profile.name || '');
    setStudentId(profile.studentId || '');
    setEmail(profile.email || '');
    setMajor(profile.major || '');
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
    handleProfileSave({
      name,
      studentId,
      email,
      major,
      avatarUrl: profile.avatarUrl
    });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
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
      setTimeout(() => setResetMessage(''), 4000);
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
                <div className="w-20 h-20 rounded-full overflow-hidden bg-[#1E1E1E] border border-[#3C3C3C] shrink-0">
                  <img
                    src={profile.avatarUrl || 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&q=80&w=200'}
                    alt="Avatar"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="pt-1 space-y-1">
                  <h3 className="text-lg font-semibold text-[#FFFFFF]">{name || 'Student'}</h3>
                  <div className="inline-flex items-center gap-1.5 bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 rounded-full text-[11px] font-medium text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span>{lang === 'en' ? 'Synced Profile' : 'ซิงค์ข้อมูลแล้ว'}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InputField label={t('studentNameLabel', lang)} value={name} onChange={setName} />
                <InputField label={t('studentIdLabel', lang)} value={studentId} onChange={setStudentId} />
                <InputField label={t('studentEmailLabel', lang)} value={email} onChange={setEmail} type="email" />
                <InputField label={t('studentMajorLabel', lang)} value={major} onChange={setMajor} />
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
                <button
                  type="button"
                  onClick={logout}
                  className="w-full sm:w-auto shrink-0 bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 px-5 py-2.5 rounded-xl text-xs font-medium transition-colors cursor-pointer"
                >
                  {t('disconnectBtn', lang)}
                </button>
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
                <button
                  type="button"
                  onClick={handleResetCalendar}
                  disabled={isResettingCalendar}
                  className="w-full sm:w-auto justify-center shrink-0 bg-[#1E1E1E] hover:bg-[#2A2D2E] text-[#D4D4D4] border border-[#3C3C3C] px-5 py-2.5 rounded-xl text-xs font-medium transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-2"
                >
                  {isResettingCalendar && <RefreshCw size={13} className="animate-spin text-[#3794FF]" />}
                  <span>{lang === 'en' ? 'Reset Calendar' : 'ล้างแล้วลงใหม่'}</span>
                </button>
              </div>
            </div>
          )}
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
