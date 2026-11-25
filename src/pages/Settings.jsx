import { useState, useEffect, useRef, useId } from 'react';
import {
  GraduationCap, CheckCircle2, Settings2,
  RefreshCw, LogOut, LogIn, ExternalLink, Calendar
} from 'lucide-react';
import { t } from '../utils/i18n';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { useClassroom } from '../contexts/ClassroomContext';
import { calendarSyncManager } from '../services/CalendarSyncManager';
import { getHiddenCourses, getAssignments, getSchedule, getResources } from '../utils/storage';
import { examRepository } from '../repositories/examRepository';
import { decodeKmutnbStudentId } from '../utils/kmutnbStudentId';
import { APP_VERSION, APP_COMMIT, formatAppBuildTime, forceCheckPwaUpdate } from '../config/version';
import PageHeader from '../components/PageHeader';
import DiscordAssistantPanel from '../components/DiscordAssistantPanel';

const GithubIcon = ({ size = 15, className = '' }) => (
  <svg height={size} width={size} viewBox="0 0 16 16" version="1.1" fill="currentColor" className={className} aria-hidden="true">
    <path fillRule="evenodd" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
  </svg>
);

const InstagramIcon = ({ size = 15, className = '' }) => (
  <svg height={size} width={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
  </svg>
);

const InputField = ({ label, value, onChange, type = 'text', required = true, readOnly = false, placeholder = '', inputMode = undefined }) => {
  const fieldId = useId();
  return (
    <div className="space-y-1">
      <label htmlFor={fieldId} className="block text-[11px] font-medium text-[var(--text-secondary)]">
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
        className={`w-full h-9 bg-[var(--app-bg)] border border-[var(--border)] rounded-lg px-3 text-xs placeholder-[var(--text-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] transition-colors ${
          readOnly ? 'text-[var(--text-muted)] cursor-not-allowed opacity-80' : 'text-[var(--text-primary)]'
        }`}
      />
    </div>
  );
};

const resolveDisplayStudentId = (p) => {
  const saved = p?.studentId === 'Google Sync User' ? '' : String(p?.studentId || '').trim();
  if (saved) return saved;
  return String(p?.email || '').match(/\d{13}/)?.[0] || '';
};

export default function Settings() {
  const {
    lang,
    alertSettings = {},
    discordTelemetry = null,
    historyLogs = [],
    handleToggleSetting,
    handleUpdateSetting,
    handleTimeChange,
    refreshNotificationData
  } = useSettings();
  const { profile, isLoggedIn, isCachedSession = false, rememberedAccount = null, handleProfileSave, login, logout, accessToken } = useAuth();
  const classroom = useClassroom();
  const cachedMode = Boolean(!isLoggedIn && (isCachedSession || rememberedAccount?.email));
  const hasAccountSession = isLoggedIn || cachedMode;

  const [name, setName] = useState(profile.name || '');
  const [studentId, setStudentId] = useState(() => resolveDisplayStudentId(profile));
  const [email, setEmail] = useState(profile.email || '');
  const [prevProfile, setPrevProfile] = useState(profile);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [avatarError, setAvatarError] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [isResettingCalendar, setIsResettingCalendar] = useState(false);
  const [calendarSyncState, setCalendarSyncState] = useState(calendarSyncManager.state);
  const [resetMessage, setResetMessage] = useState('');
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
    setStudentId(resolveDisplayStudentId(profile));
    setEmail(profile.email || '');
    setAvatarError(false);
  }

  const devInfo = {
    name: 'KITTIPONG TEERASEE',
    nickname: 'Kittiponglnwza',
    email: 'kitipongzaza566@gmail.com',
    university: 'KMUTNB',
    github: 'https://github.com/kittiponglnwza',
    instagram: 'https://www.instagram.com/kt_k1tt1111/'
  };

  const activeUserEmail = profile.email || email || '';
  const isTh = lang === 'th';
  const langKey = isTh ? 'th' : 'en';
  const decodedKmutnb = decodeKmutnbStudentId(studentId || resolveDisplayStudentId(profile));
  const hiddenCourseIds = getHiddenCourses(activeUserEmail);
  const currentAssignments = classroom?.assignments || getAssignments(activeUserEmail);
  const currentSchedule = classroom?.schedule || getSchedule(activeUserEmail);
  const currentResources = classroom?.resources || getResources(activeUserEmail);

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

    const prevNormalizedId = resolveDisplayStudentId(profile).replace(/[\s-]/g, '').trim();
    const targetEmail = hasAccountSession && profile.email ? profile.email : email;
    const submittedDecoded = decodeKmutnbStudentId(normalizedId);

    handleProfileSave({
      name: name.trim(),
      studentId: normalizedId,
      email: targetEmail,
      major: submittedDecoded?.suggestedMajor?.[langKey] || profile.major || '',
      avatarUrl: profile.avatarUrl
    });

    // When Student ID changes, invalidate stale SciBase seating cache so ExamRoom & Schedule re-fetch for the new ID
    if (normalizedId !== prevNormalizedId) {
      if (targetEmail) {
        examRepository.clearExamsCache(targetEmail);
      }
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem('lastExamSearch');
      }
      if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
        window.dispatchEvent(new CustomEvent('classroom_hub_exams_updated', { detail: { email: targetEmail } }));
      }
    }

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
      setResetMessage(lang === 'en' ? 'Calendar reset & sync initiated' : 'ล้างข้อมูลและเริ่มซิงค์ปฏิทินใหม่แล้ว');
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
      setResetMessage(lang === 'en' ? 'Calendar synced & duplicates cleaned' : 'ซิงก์ปฏิทินและลบรายการซ้ำเรียบร้อยแล้ว');
    } catch (e) {
      console.error(e);
      setResetMessage(lang === 'en' ? 'Error syncing calendar.' : 'เกิดข้อผิดพลาดในการซิงก์ปฏิทิน');
    } finally {
      const id = setTimeout(() => setResetMessage(''), 4000);
      timersRef.current.push(id);
    }
  };

  return (
    <div className="space-y-5 pb-6">
      <PageHeader
        title={t('settingsTitle', lang)}
        description={t('settingsDesc', lang)}
        icon={Settings2}
      />

      {saveSuccess && (
        <div className="bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs px-4 py-2.5 rounded-xl flex items-center gap-2">
          <CheckCircle2 size={14} strokeWidth={1.5} className="text-[var(--success)] shrink-0" />
          <span>{t('profileSuccess', lang)}</span>
        </div>
      )}

      {/* Row 1: Profile & Account (Left 7) + Google Calendar Sync (Right 5) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <div className="lg:col-span-7 bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 flex flex-col justify-between">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border)]">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-11 h-11 rounded-full overflow-hidden bg-[var(--app-bg)] border border-[var(--border)] flex items-center justify-center shrink-0">
                  {profile.avatarUrl && !avatarError ? (
                    <img
                      src={profile.avatarUrl}
                      alt="Avatar"
                      referrerPolicy="no-referrer"
                      onError={() => setAvatarError(true)}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-sm font-medium text-[var(--text-primary)]">
                      {(name || profile.name || 'S').charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>

                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-sm font-medium text-[var(--text-heading)] truncate">{name || 'Student'}</h2>
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[11px] font-medium bg-[var(--app-bg)] border border-[var(--border)] text-[var(--text-secondary)]">
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        isLoggedIn
                          ? 'bg-[var(--success)]'
                          : cachedMode
                            ? 'bg-amber-400'
                            : 'bg-[var(--text-muted)]'
                      }`} />
                      {isLoggedIn
                        ? (lang === 'en' ? 'Connected' : 'เชื่อมต่อแล้ว')
                        : cachedMode
                          ? t('cachedMode', lang)
                          : (lang === 'en' ? 'Local Mode' : 'โหมดออฟไลน์')}
                    </span>
                  </div>

                  <p className="text-xs text-[var(--text-secondary)] truncate">
                    {activeUserEmail || (lang === 'en' ? 'Connect Google Classroom to sync across devices' : 'เชื่อมต่อ Google Classroom เพื่อซิงก์ข้อมูล')}
                  </p>

                  {decodedKmutnb && (
                    <div
                      data-testid="kmutnb-profile-breakdown"
                      className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-1 text-[11px] text-[var(--text-secondary)]"
                    >
                      <span className="inline-flex items-center gap-1 text-[var(--text-primary)] font-medium">
                        <GraduationCap size={12} strokeWidth={1.5} className="text-[var(--primary-bright)] shrink-0" />
                        <span>{decodedKmutnb.campusLabel[langKey]}</span>
                      </span>
                      <span className="text-[var(--text-muted)]">•</span>
                      <span className="tabular-nums">
                        {decodedKmutnb.yearLevel
                          ? (isTh ? `ชั้นปีที่ ${decodedKmutnb.yearLevel}` : `Year ${decodedKmutnb.yearLevel}`)
                          : (isTh ? `รหัส ${decodedKmutnb.yearShort}` : `ID ${decodedKmutnb.yearShort}`)}
                      </span>
                      <span className="text-[var(--text-muted)]">•</span>
                      <span>{decodedKmutnb.faculty[langKey]}</span>
                      {(decodedKmutnb.department || decodedKmutnb.program) && (
                        <>
                          <span className="text-[var(--text-muted)]">•</span>
                          <span className="text-[var(--text-primary)]">
                            {decodedKmutnb.department
                              ? (decodedKmutnb.program
                                  ? `${decodedKmutnb.department[langKey]} · ${decodedKmutnb.program[langKey]}`
                                  : decodedKmutnb.department[langKey])
                              : decodedKmutnb.program?.[langKey]}
                          </span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap shrink-0">
                {hasAccountSession ? (
                  confirmLogout ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setConfirmLogout(false)}
                        className="h-8 px-3 rounded-lg text-xs font-medium bg-[var(--app-bg)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] border border-[var(--border)] transition-colors cursor-pointer"
                      >
                        {t('cancelBtn', lang)}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmLogout(false);
                          logout();
                        }}
                        className="h-8 px-3.5 rounded-lg text-xs font-medium bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 transition-colors cursor-pointer"
                      >
                        {t('disconnectBtn', lang)}
                      </button>
                    </>
                  ) : (
                    <>
                      {cachedMode && (
                        <button
                          type="button"
                          onClick={() => login()}
                          className="h-8 inline-flex items-center gap-1.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white px-3 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                        >
                          <LogIn size={13} strokeWidth={1.5} />
                          <span>{t('connectSyncBtn', lang)}</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setConfirmLogout(true)}
                        className="h-8 inline-flex items-center gap-1.5 bg-[var(--app-bg)] hover:bg-rose-500/15 text-[var(--text-secondary)] hover:text-rose-300 border border-[var(--border)] hover:border-rose-500/30 px-3 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                      >
                        <LogOut size={13} strokeWidth={1.5} />
                        <span>{t('disconnectBtn', lang)}</span>
                      </button>
                    </>
                  )
                ) : (
                  <button
                    type="button"
                    onClick={() => login()}
                    className="h-8 inline-flex items-center gap-1.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white px-3.5 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                  >
                    <LogIn size={13} strokeWidth={1.5} />
                    <span>{t('connectBtn', lang)}</span>
                  </button>
                )}
              </div>
            </div>

            {profileError && (
              <div role="alert" className="bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs px-3.5 py-2 rounded-lg">
                {profileError}
              </div>
            )}

            <div className={`grid grid-cols-1 ${hasAccountSession ? 'sm:grid-cols-[1fr_1fr_auto]' : 'sm:grid-cols-[1fr_1fr_1fr_auto]'} gap-3 items-end`}>
              <InputField label={t('studentNameLabel', lang)} value={name} onChange={setName} />
              <InputField
                label={t('studentIdLabel', lang)}
                value={studentId}
                onChange={setStudentId}
                required={false}
                inputMode="numeric"
                placeholder="6401012345678"
              />
              {!hasAccountSession && (
                <InputField
                  label={t('studentEmailLabel', lang)}
                  value={email}
                  onChange={setEmail}
                  type="email"
                />
              )}
              <button
                type="submit"
                className="h-9 w-full sm:w-auto bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white px-4 rounded-lg font-medium text-xs transition-colors cursor-pointer whitespace-nowrap"
              >
                {lang === 'en' ? 'Save Preferences' : 'บันทึกการตั้งค่า'}
              </button>
            </div>
          </form>
        </div>

        {/* Google Calendar Sync Card (aligned equal height next to Profile) */}
        <div className="lg:col-span-5 bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 flex flex-col justify-between gap-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-[var(--border)]">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-[var(--app-bg)] border border-[var(--border)] flex items-center justify-center shrink-0">
                  <Calendar className="text-[var(--primary-bright)]" size={15} strokeWidth={1.5} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-medium text-[var(--text-heading)]">
                    {lang === 'en' ? 'Google Calendar Sync' : 'ซิงก์ปฏิทิน Google Calendar'}
                  </h3>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    {lang === 'en' ? 'Timetable, exams & task deadlines' : 'ตารางเรียน วันสอบ และกำหนดส่งงาน'}
                  </p>
                </div>
              </div>
              {calendarSyncState === 'syncing' && (
                <span className="text-[11px] px-2 py-0.5 rounded-lg bg-[var(--app-bg)] border border-[var(--border)] text-[var(--primary-bright)]">
                  {t('syncing', lang)}
                </span>
              )}
            </div>

            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              {lang === 'en'
                ? 'Keeps your primary Google Calendar updated with classes, midterm pauses, exam rooms, and pending due dates—also powers 24/7 Apps Script schedule sync.'
                : 'อัปเดตตารางเรียน ช่วงหยุดสอบกลางภาค ห้องสอบ และวันส่งงานลงในปฏิทิน Google โดยอัตโนมัติ (ใช้เป็นแหล่งข้อมูลสำหรับสคริปต์ 24 ชม. ด้วย)'}
            </p>

            {cachedMode && !resetMessage && (
              <p className="text-[11px] text-amber-300/90">
                {lang === 'en'
                  ? 'Connect Google on the left to sync or reset Google Calendar.'
                  : 'กดเชื่อมต่อ Google ด้านซ้ายก่อนซิงก์หรือล้างปฏิทิน'}
              </p>
            )}

            {resetMessage && (
              <p
                className={`text-xs font-medium ${
                  resetMessage.includes('Error') || resetMessage.includes('ข้อผิดพลาด')
                    ? 'text-rose-300'
                    : 'text-emerald-300'
                }`}
              >
                {resetMessage}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <button
              type="button"
              onClick={handleSyncCalendarNow}
              disabled={!isLoggedIn || calendarSyncState === 'syncing' || isResettingCalendar}
              className="h-9 bg-[var(--surface-elevated)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] border border-[var(--border)] px-3 rounded-lg text-xs font-medium transition-colors cursor-pointer disabled:opacity-45 flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              <RefreshCw
                size={13}
                strokeWidth={1.5}
                className={calendarSyncState === 'syncing' && !isResettingCalendar ? 'animate-spin shrink-0' : 'shrink-0'}
              />
              <span className="truncate">
                {calendarSyncState === 'syncing' && !isResettingCalendar
                  ? t('syncingCalendarBtn', lang)
                  : (lang === 'en' ? 'Sync Now' : 'ซิงก์ตอนนี้')}
              </span>
            </button>
            <button
              type="button"
              onClick={handleResetCalendar}
              disabled={!isLoggedIn || isResettingCalendar || calendarSyncState === 'syncing'}
              className="h-9 bg-[var(--app-bg)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] border border-[var(--border)] px-3 rounded-lg text-xs font-medium transition-colors cursor-pointer disabled:opacity-45 flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              {isResettingCalendar && <RefreshCw size={13} strokeWidth={1.5} className="animate-spin shrink-0" />}
              <span className="truncate">{lang === 'en' ? 'Reset Calendar' : 'ล้างแล้วลงใหม่'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Row 2: Full-Width Two-Pane Discord Academic Assistant */}
      <DiscordAssistantPanel
        lang={lang}
        activeUserEmail={activeUserEmail}
        accessToken={accessToken}
        alertSettings={alertSettings}
        discordTelemetry={discordTelemetry}
        historyLogs={historyLogs}
        hiddenCourseIds={hiddenCourseIds}
        currentAssignments={currentAssignments}
        currentSchedule={currentSchedule}
        currentResources={currentResources}
        handleToggleSetting={handleToggleSetting}
        handleUpdateSetting={handleUpdateSetting}
        handleTimeChange={handleTimeChange}
        refreshNotificationData={refreshNotificationData}
      />

      {/* Row 3: Full-Width Developer Attribution Card (Zero truncation) */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl px-5 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-[var(--app-bg)] border border-[var(--border)] flex items-center justify-center shrink-0 text-[var(--text-primary)]">
              <GithubIcon size={18} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="font-medium text-[var(--text-heading)] text-sm">{devInfo.name}</h4>
                <span className="text-[11px] text-[var(--text-muted)]">·</span>
                <span className="text-[11px] text-[var(--text-secondary)]">
                  {isTh ? `ผู้พัฒนา · ${devInfo.university}` : `Developer · ${devInfo.university}`}
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)] truncate mt-0.5">
                @{devInfo.nickname} · <a href={`mailto:${devInfo.email}`} className="hover:text-[var(--text-primary)] transition-colors">{devInfo.email}</a>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <a
              href={devInfo.github}
              target="_blank"
              rel="noopener noreferrer"
              className="h-9 inline-flex items-center justify-center gap-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white px-4 rounded-lg transition-colors text-xs font-medium whitespace-nowrap"
            >
              <GithubIcon size={14} />
              <span>{isTh ? 'ดูโปรไฟล์ GitHub' : 'GitHub Profile'}</span>
              <ExternalLink size={12} strokeWidth={1.5} />
            </a>

            <a
              href={devInfo.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="h-9 inline-flex items-center justify-center gap-2 bg-[var(--app-bg)] hover:bg-[var(--surface-hover)] border border-[var(--border)] px-4 rounded-lg transition-colors text-xs font-medium text-[var(--text-primary)] whitespace-nowrap"
            >
              <InstagramIcon size={14} />
              <span>Instagram</span>
            </a>
          </div>
        </div>
      </div>

      {/* Bottom Version & Update Line */}
      <div
        data-testid="settings-version-badge"
        className="pt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--text-muted)] border-t border-[var(--border)]"
      >
        <div className="flex items-center gap-2 font-mono tabular-nums">
          <span className="text-[var(--text-secondary)]">
            Classroom Hub v{APP_VERSION}{APP_COMMIT ? ` (${APP_COMMIT})` : ''}
          </span>
          <span>•</span>
          <span>
            {lang === 'th' ? 'อัปเดต ' : 'Updated '}
            {formatAppBuildTime(lang)}
          </span>
        </div>

        <button
          type="button"
          onClick={forceCheckPwaUpdate}
          title={lang === 'th' ? 'เช็กและดึงอัปเดตเวอร์ชันล่าสุด' : 'Check and reload latest update'}
          className="h-8 inline-flex items-center gap-1.5 px-3 rounded-lg bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-heading)] transition-colors cursor-pointer"
        >
          <RefreshCw size={12} strokeWidth={1.5} />
          <span>{lang === 'th' ? 'เช็กอัปเดต' : 'Check for updates'}</span>
        </button>
      </div>
    </div>
  );
}
