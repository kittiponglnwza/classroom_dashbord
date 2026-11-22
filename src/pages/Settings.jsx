import { useState, useEffect, useRef, useId } from 'react';
import {
  GraduationCap, Code, Mail, CheckCircle2, Settings2,
  RefreshCw, MessageSquare, Copy, Check, ExternalLink, Terminal, LogOut, LogIn, Send
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
import { examRepository } from '../repositories/examRepository';
import { decodeKmutnbStudentId } from '../utils/kmutnbStudentId';

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
      <label htmlFor={fieldId} className="block text-[11px] font-medium text-[#9D9D9D]">
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
        className={`w-full bg-[#1E1E1E] border border-[#3C3C3C] rounded-xl px-3 py-2 text-xs placeholder-[#858585] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007ACC] transition-colors ${
          readOnly ? 'text-[#858585] cursor-not-allowed opacity-80' : 'text-[#D4D4D4]'
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
  const { lang, alertSettings = {}, handleToggleSetting, handleUpdateSetting, refreshNotificationData } = useSettings();
  const { profile, isLoggedIn, handleProfileSave, login, logout, accessToken } = useAuth();
  const classroom = useClassroom();

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
  const [discordTestSending, setDiscordTestSending] = useState(false);
  const [discordDigestSending, setDiscordDigestSending] = useState(false);
  const [discordFeedback, setDiscordFeedback] = useState({ text: '', type: '' });
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
    const targetEmail = isLoggedIn && profile.email ? profile.email : email;
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
  const isTh = lang === 'th';
  const langKey = isTh ? 'th' : 'en';
  const decodedKmutnb = decodeKmutnbStudentId(studentId || resolveDisplayStudentId(profile));
  const hiddenCourseIds = getHiddenCourses(activeUserEmail);
  const currentAssignments = classroom?.assignments || getAssignments(activeUserEmail);
  const webhookValidation = DiscordService.validateWebhookUrl(alertSettings.discordWebhookUrl || '');

  const generatedAppsScript = getAppsScriptTemplate(hiddenCourseIds, {
    discordWebhookUrl: alertSettings.discordWebhookUrl || '',
    enableDiscord: true,
    enableEmail: false,
    notifyNewPosts: true
  });

  const handleTestDiscordWebhook = async () => {
    setDiscordFeedback({ text: '', type: '' });
    if (!webhookValidation.valid) {
      setDiscordFeedback({
        text: lang === 'en'
          ? 'Please enter a valid Discord Webhook URL.'
          : 'กรุณาใส่ลิงก์ Discord Webhook ที่ถูกต้อง',
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
          : 'ส่งข้อความทดสอบเข้า Discord สำเร็จแล้ว!',
        type: 'success'
      });
    } catch (err) {
      setDiscordFeedback({
        text: (lang === 'en' ? 'Failed: ' : 'ส่งไม่สำเร็จ: ') + err.message,
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
        text: lang === 'en' ? 'Could not copy automatically. Open preview below.' : 'ไม่สามารถคัดลอกอัตโนมัติได้ กรุณากดดูโค้ดด้านล่าง',
        type: 'error'
      });
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Compact Page Header */}
      <div className="flex items-center justify-between border-b border-[#3C3C3C] pb-4">
        <div>
          <h1 className="text-xl font-semibold text-[#FFFFFF] tracking-tight flex items-center gap-2">
            <Settings2 size={20} className="text-[#3794FF]" />
            <span>{t('settingsTitle', lang)}</span>
          </h1>
          <p className="text-xs text-[#9D9D9D] mt-0.5">{t('settingsDesc', lang)}</p>
        </div>
      </div>

      {saveSuccess && (
        <div className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs px-4 py-2.5 rounded-xl flex items-center gap-2">
          <CheckCircle2 size={14} className="text-emerald-400" />
          <span>{t('profileSuccess', lang)}</span>
        </div>
      )}

      {/* 1. Unified Profile & Google Account Card */}
      <div className="bg-[#252526] border border-[#3C3C3C] rounded-2xl p-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-[#3C3C3C]">
            <div className="flex items-start gap-3.5 min-w-0">
              <div
                className={`w-14 h-14 rounded-2xl overflow-hidden bg-[#1E1E1E] border flex items-center justify-center shrink-0 ${
                  decodedKmutnb ? 'border-[#007ACC]/60 ring-2 ring-[#007ACC]/30' : 'border-[#3C3C3C]'
                }`}
              >
                {profile.avatarUrl && !avatarError ? (
                  <img
                    src={profile.avatarUrl}
                    alt="Avatar"
                    onError={() => setAvatarError(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-lg font-semibold text-[#D4D4D4]">
                    {(name || profile.name || 'S').charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-sm font-semibold text-[#FFFFFF] truncate">{name || 'Student'}</h2>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      isLoggedIn
                        ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
                        : 'bg-[#1E1E1E] border border-[#3C3C3C] text-[#9D9D9D]'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${isLoggedIn ? 'bg-emerald-400' : 'bg-[#858585]'}`} />
                    {isLoggedIn
                      ? (lang === 'en' ? 'Google Connected' : 'เชื่อมต่อ Google แล้ว')
                      : (lang === 'en' ? 'Local Mode' : 'โหมดออฟไลน์')}
                  </span>
                  {decodedKmutnb && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#007ACC]/15 border border-[#007ACC]/35 text-[#3794FF]">
                      <GraduationCap size={11} className="shrink-0" />
                      <span>{decodedKmutnb.campusLabel[langKey]}</span>
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#9D9D9D] truncate mt-0.5">
                  {activeUserEmail || (lang === 'en' ? 'Connect Google Classroom to sync across devices' : 'เชื่อมต่อ Google Classroom เพื่อซิงก์ข้อมูล')}
                </p>

                {decodedKmutnb && (
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10.5px] font-medium bg-[#1E1E1E] border border-[#3C3C3C] text-[#D4D4D4]">
                      {decodedKmutnb.yearLevel
                        ? (isTh
                            ? `รหัส ${decodedKmutnb.yearShort} · ชั้นปีที่ ${decodedKmutnb.yearLevel}`
                            : `ID ${decodedKmutnb.yearShort} · Year ${decodedKmutnb.yearLevel}`)
                        : (isTh
                            ? `รหัส ${decodedKmutnb.yearShort} (${decodedKmutnb.entryYearBE})`
                            : `ID ${decodedKmutnb.yearShort} (${decodedKmutnb.entryYearBE})`)}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10.5px] font-medium bg-[#007ACC]/10 border border-[#007ACC]/30 text-[#3794FF]">
                      {decodedKmutnb.faculty[langKey]}
                    </span>
                    {(decodedKmutnb.program || decodedKmutnb.department) && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10.5px] font-medium bg-emerald-500/10 border border-emerald-500/25 text-emerald-300">
                        {decodedKmutnb.program?.[langKey] || decodedKmutnb.department?.[langKey]}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {isLoggedIn ? (
                confirmLogout ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setConfirmLogout(false)}
                      className="px-3 py-1.5 rounded-xl text-xs font-medium bg-[#1E1E1E] hover:bg-[#2A2D2E] text-[#D4D4D4] border border-[#3C3C3C] transition-colors cursor-pointer"
                    >
                      {t('cancelBtn', lang)}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmLogout(false);
                        logout();
                      }}
                      className="px-3.5 py-1.5 rounded-xl text-xs font-medium bg-rose-600 hover:bg-rose-500 text-white transition-colors cursor-pointer"
                    >
                      {t('disconnectBtn', lang)}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmLogout(true)}
                    className="inline-flex items-center gap-1.5 bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer"
                  >
                    <LogOut size={13} />
                    <span>{t('disconnectBtn', lang)}</span>
                  </button>
                )
              ) : (
                <button
                  type="button"
                  onClick={() => login()}
                  className="inline-flex items-center gap-1.5 bg-[#007ACC] hover:bg-[#1177BB] text-white px-4 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer"
                >
                  <LogIn size={13} />
                  <span>{t('connectBtn', lang)}</span>
                </button>
              )}
            </div>
          </div>

          {decodedKmutnb && (
            <div
              data-testid="kmutnb-profile-breakdown"
              className="bg-[#1E1E1E] border border-[#3C3C3C] rounded-xl p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3"
            >
              <div className="space-y-2 min-w-0">
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#9D9D9D]">
                  <GraduationCap size={13} className="text-[#3794FF] shrink-0" />
                  <span>
                    {isTh ? 'รหัสนักศึกษา มจพ. (13 หลัก)' : 'KMUTNB 13-Digit Student ID Breakdown'}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {decodedKmutnb.segments.map((seg) => {
                    const segmentMeta = {
                      year: {
                        label: isTh ? `ปี ${decodedKmutnb.entryYearBE}` : `Entry ${decodedKmutnb.entryYearBE}`,
                        classes: 'bg-[#252526] border-[#3C3C3C] text-[#D4D4D4]',
                      },
                      faculty: {
                        label: decodedKmutnb.faculty.short,
                        classes: 'bg-[#007ACC]/15 border-[#007ACC]/40 text-[#3794FF]',
                      },
                      department: {
                        label: decodedKmutnb.department?.short || (isTh ? 'ภาควิชา' : 'Dept'),
                        classes: 'bg-emerald-500/15 border-emerald-500/35 text-emerald-300',
                      },
                      program: {
                        label: decodedKmutnb.program?.short || (isTh ? 'หลักสูตร' : 'Prog'),
                        classes: 'bg-purple-500/15 border-purple-500/35 text-purple-300',
                      },
                      running: {
                        label: isTh ? 'ลำดับ' : 'No.',
                        classes: 'bg-[#252526] border-[#3C3C3C] text-[#D4D4D4]',
                      },
                    };
                    const meta = segmentMeta[seg.key] || segmentMeta.running;

                    return (
                      <div
                        key={seg.key}
                        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[11px] ${meta.classes}`}
                      >
                        <span className="font-mono font-semibold">{seg.value}</span>
                        <span className="text-[10px] opacity-85">{meta.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 lg:text-right border-t lg:border-t-0 border-[#3C3C3C] pt-2.5 lg:pt-0 min-w-0">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-[#FFFFFF] truncate">
                    {decodedKmutnb.faculty[langKey]}
                  </div>
                  <div className="text-[11px] text-[#9D9D9D] truncate mt-0.5">
                    {decodedKmutnb.department
                      ? (decodedKmutnb.program
                          ? `${decodedKmutnb.department[langKey]} · ${decodedKmutnb.program[langKey]}`
                          : decodedKmutnb.department[langKey])
                      : (isTh
                          ? `รหัสภาควิชา ${decodedKmutnb.departmentCode}`
                          : `Department ${decodedKmutnb.departmentCode}`)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {profileError && (
            <div role="alert" className="bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs px-3.5 py-2 rounded-xl">
              {profileError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              className="w-full sm:w-auto bg-[#007ACC] hover:bg-[#1177BB] text-white px-5 py-2 rounded-xl font-medium text-xs transition-colors cursor-pointer"
            >
              {lang === 'en' ? 'Save Preferences' : 'บันทึกการตั้งค่า'}
            </button>
          </div>
        </form>
      </div>

      {/* 2. Balanced Two-Column Grid: Discord Integration (Left) + Calendar & Developer (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Compact Discord Webhook & 24/7 Cloud Script */}
        <div className="lg:col-span-7 bg-[#252526] border border-[#3C3C3C] rounded-2xl p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-[#5865F2]/15 border border-[#5865F2]/30 flex items-center justify-center shrink-0">
                  <MessageSquare className="text-[#5865F2]" size={15} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-[#FFFFFF] truncate">
                    {lang === 'en' ? 'Discord Notifications' : 'แจ้งเตือน Discord'}
                  </h3>
                  <p className="text-[11px] text-[#9D9D9D] truncate">
                    {lang === 'en' ? 'Instant webhook & 24/7 cloud script' : 'ยิงแจ้งเตือนเข้าแชท & รันอัตโนมัติ 24 ชม.'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                <span
                  data-testid="discord-webhook-status"
                  className={`text-[10px] px-2.5 py-0.5 rounded-full font-medium ${
                    webhookValidation.valid
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : (alertSettings.discordWebhookUrl || '').trim()
                        ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                        : 'bg-[#1E1E1E] text-[#9D9D9D] border border-[#3C3C3C]'
                  }`}
                >
                  {webhookValidation.valid
                    ? (lang === 'en' ? 'Webhook Ready' : 'พร้อมใช้งาน')
                    : (alertSettings.discordWebhookUrl || '').trim()
                      ? (lang === 'en' ? 'Invalid URL' : 'ลิงก์ไม่ถูกต้อง')
                      : (lang === 'en' ? 'Not Configured' : 'ยังไม่ตั้งค่า')}
                </span>

                <label className="relative inline-flex items-center cursor-pointer select-none" title={lang === 'en' ? 'Auto-send on web sync' : 'ส่งอัตโนมัติเมื่อซิงก์เว็บ'}>
                  <input
                    type="checkbox"
                    checked={Boolean(alertSettings.discordEnabled)}
                    onChange={() => handleToggleSetting?.('discordEnabled')}
                    aria-label={lang === 'en' ? 'Auto-send alerts to Discord when syncing on web' : 'ส่งแจ้งเตือนเข้า Discord อัตโนมัติ'}
                    className="sr-only peer"
                  />
                  <div className="w-8 h-4.5 bg-[#3C3C3C] rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-[#5865F2]" />
                </label>
              </div>
            </div>

            {discordFeedback.text && (
              <div
                role={discordFeedback.type === 'error' ? 'alert' : 'status'}
                className={`px-3 py-2 rounded-xl border text-xs flex items-center justify-between ${
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
                  aria-label="Dismiss"
                >
                  ×
                </button>
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor={webhookFieldId} className="block text-[11px] font-medium text-[#9D9D9D]">
                {lang === 'en' ? 'Webhook URL' : 'ลิงก์ Discord Webhook'}
              </label>
              <input
                id={webhookFieldId}
                type="url"
                placeholder="https://discord.com/api/webhooks/123456789/abcdef..."
                value={alertSettings.discordWebhookUrl || ''}
                onChange={(e) => handleUpdateSetting?.('discordWebhookUrl', e.target.value)}
                className="w-full bg-[#1E1E1E] border border-[#3C3C3C] rounded-xl px-3 py-2 text-xs text-[#D4D4D4] placeholder-[#858585] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5865F2]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                disabled={discordTestSending || discordDigestSending || !webhookValidation.valid}
                onClick={handleTestDiscordWebhook}
                className="bg-[#5865F2] hover:bg-[#4752C4] text-white px-3.5 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
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
                className="bg-[#1E1E1E] hover:bg-[#2A2D2E] text-[#D4D4D4] border border-[#3C3C3C] px-3.5 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {discordDigestSending ? <RefreshCw size={13} className="animate-spin text-[#5865F2]" /> : <Send size={13} className="text-[#5865F2]" />}
                <span>
                  {discordDigestSending
                    ? (lang === 'en' ? 'Sending...' : 'กำลังส่ง...')
                    : (lang === 'en' ? 'Send Task & Exam Digest Now' : 'ส่งสรุปงาน + ตารางสอบ')}
                </span>
              </button>
            </div>
          </div>

          {/* Sleek 1-Line 24/7 Apps Script Bar */}
          <div className="pt-3 border-t border-[#3C3C3C] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs text-[#9D9D9D]">
                <Terminal size={13} className="text-[#3794FF] shrink-0" />
                <span>
                  {lang === 'en'
                    ? `24/7 Cloud Script (${hiddenCourseIds.length} hidden excluded)`
                    : `สคริปต์ 24 ชม. (ตัดวิชาที่ซ่อน ${hiddenCourseIds.length} วิชา)`}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleCopyAppsScript}
                  className="bg-[#1E1E1E] hover:bg-[#2A2D2E] text-[#D4D4D4] border border-[#3C3C3C] px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors cursor-pointer inline-flex items-center gap-1.5"
                >
                  {copiedScript ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} className="text-[#3794FF]" />}
                  <span>
                    {copiedScript
                      ? (lang === 'en' ? 'Copied!' : 'คัดลอกแล้ว!')
                      : (lang === 'en' ? 'Copy Script' : 'คัดลอกโค้ด')}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowScriptPreview(prev => !prev)}
                  className="bg-[#1E1E1E] hover:bg-[#2A2D2E] text-[#9D9D9D] hover:text-[#D4D4D4] border border-[#3C3C3C] px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors cursor-pointer"
                >
                  {showScriptPreview
                    ? (lang === 'en' ? 'Hide Code' : 'ซ่อนโค้ด')
                    : (lang === 'en' ? 'View Code & Debug Guide' : 'ดูโค้ดและวิธีตั้งค่า')}
                </button>

                <a
                  href="https://script.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open script.google.com"
                  className="p-1.5 rounded-lg bg-[#1E1E1E] hover:bg-[#2A2D2E] border border-[#3C3C3C] text-[#3794FF] transition-colors"
                >
                  <ExternalLink size={12} />
                </a>
              </div>
            </div>

            {showScriptPreview && (
              <div className="space-y-2 pt-1">
                <div className="bg-[#1E1E1E] border border-[#3C3C3C] rounded-xl p-2.5 text-[11px] text-[#9D9D9D] space-y-1">
                  <div><code className="text-[#4EC9B0]">testDiscordWebhook()</code> — {lang === 'en' ? 'Send test message from Google Cloud' : 'ทดสอบยิงเข้า Discord'}</div>
                  <div><code className="text-[#CCA700]">debugDryRun()</code> — {lang === 'en' ? 'Preview tasks in log without sending' : 'เช็กงานใน Log โดยไม่ส่งจริง'}</div>
                  <div><code className="text-[#3794FF]">sendClassroomDigest()</code> — {lang === 'en' ? 'Attach to hourly Time-driven Trigger' : 'ใช้ตั้งทริกเกอร์รายชั่วโมง'}</div>
                </div>
                <textarea
                  readOnly
                  aria-label={lang === 'en' ? 'Generated Google Apps Script Code' : 'โค้ด Google Apps Script'}
                  value={generatedAppsScript}
                  rows={6}
                  className="w-full bg-[#181818] border border-[#3C3C3C] rounded-xl p-2.5 text-[11px] font-mono text-[#D4D4D4] focus:outline-none"
                />
              </div>
            )}
          </div>
        </div>

        {/* Right: Calendar Sync & Compact Developer Card */}
        <div className="lg:col-span-5 flex flex-col justify-between gap-5">
          {/* Google Calendar Sync Maintenance Card */}
          <div className="bg-[#252526] border border-[#3C3C3C] rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#007ACC]/15 border border-[#007ACC]/30 flex items-center justify-center shrink-0">
                <RefreshCw className="text-[#3794FF]" size={15} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[#FFFFFF]">
                  {lang === 'en' ? 'Google Calendar Sync' : 'ซิงก์ปฏิทิน Google Calendar'}
                </h3>
                <p className="text-[11px] text-[#9D9D9D]">
                  {lang === 'en' ? 'Sync events or clean duplicates' : 'อัปเดตตารางหรือล้างรายการซ้ำ'}
                </p>
              </div>
            </div>

            {resetMessage && (
              <p
                className={`text-xs font-medium ${
                  resetMessage.includes('Error') || resetMessage.includes('ข้อผิดพลาด')
                    ? 'text-rose-400'
                    : 'text-emerald-400'
                }`}
              >
                {resetMessage}
              </p>
            )}

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={handleSyncCalendarNow}
                disabled={!isLoggedIn || calendarSyncState === 'syncing' || isResettingCalendar}
                className="bg-[#007ACC] hover:bg-[#1177BB] text-white px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {calendarSyncState === 'syncing' && !isResettingCalendar && <RefreshCw size={12} className="animate-spin" />}
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
                className="bg-[#1E1E1E] hover:bg-[#2A2D2E] text-[#D4D4D4] border border-[#3C3C3C] px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isResettingCalendar && <RefreshCw size={12} className="animate-spin text-[#3794FF]" />}
                <span className="truncate">{lang === 'en' ? 'Reset Calendar' : 'ล้างแล้วลงใหม่'}</span>
              </button>
            </div>
          </div>

          {/* Compact Developer Card */}
          <div className="bg-[#252526] border border-[#3C3C3C] rounded-2xl p-5 space-y-3.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-[#007ACC]/20 border border-[#007ACC]/40 flex items-center justify-center shrink-0">
                  <Code size={17} className="text-[#3794FF]" />
                </div>
                <div className="min-w-0">
                  <h4 className="font-semibold text-[#FFFFFF] text-xs truncate">{devInfo.name}</h4>
                  <p className="text-[11px] font-medium text-[#3794FF] truncate">@{devInfo.nickname} • {devInfo.university}</p>
                </div>
              </div>
              <GraduationCap size={16} className="text-[#858585] shrink-0" />
            </div>

            <div className="flex items-center gap-2 text-[11px] text-[#9D9D9D]">
              <Mail size={13} className="text-[#3794FF] shrink-0" />
              <a href={`mailto:${devInfo.email}`} className="hover:text-[#3794FF] transition-colors truncate">
                {devInfo.email}
              </a>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-0.5">
              <a
                href={devInfo.github}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 bg-[#1E1E1E] hover:bg-[#2A2D2E] border border-[#3C3C3C] py-2 px-3 rounded-xl transition-colors text-xs font-medium text-[#D4D4D4]"
              >
                <GithubIcon size={14} />
                <span>GitHub</span>
              </a>

              <a
                href={devInfo.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 bg-[#1E1E1E] hover:bg-[#2A2D2E] border border-[#3C3C3C] py-2 px-3 rounded-xl transition-colors text-xs font-medium text-[#D4D4D4]"
              >
                <InstagramIcon size={14} />
                <span>Instagram</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
