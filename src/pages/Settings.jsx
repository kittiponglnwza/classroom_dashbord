import { useState, useEffect, useRef, useId, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  User,
  CheckCircle2,
  Settings2,
  RefreshCw,
  LogOut,
  LogIn,
  Calendar,
  MessageSquare,
  Clock,
  GraduationCap,
  ClipboardList
} from 'lucide-react';
import { t } from '../utils/i18n';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { useClassroom } from '../contexts/ClassroomContext';
import { calendarSyncManager } from '../services/CalendarSyncManager';
import { DiscordService } from '../services/DiscordService';
import { getHiddenCourses, getAssignments, getSchedule, getResources } from '../utils/storage';
import { examRepository } from '../repositories/examRepository';
import { getMergedExams } from '../utils/examMerger';
import { getAppsScriptTemplate } from '../utils/appsScriptTemplate';
import { decodeKmutnbStudentId } from '../utils/kmutnbStudentId';
import { APP_VERSION, APP_COMMIT, formatAppBuildTime, forceCheckPwaUpdate } from '../config/version';
import PageHeader from '../components/PageHeader';
import DiscordAssistantPanel from '../components/DiscordAssistantPanel';
import KmutnbStudentCard from '../components/settings/KmutnbStudentCard';
import DeveloperShowcase, { GithubMark } from '../components/settings/DeveloperShowcase';

const VALID_TABS = new Set(['account', 'calendar', 'discord', 'about']);

const InputField = ({
  label,
  hint = '',
  value,
  onChange,
  type = 'text',
  required = true,
  readOnly = false,
  placeholder = '',
  inputMode = undefined
}) => {
  const fieldId = useId();
  return (
    <div className="space-y-1.5">
      <label htmlFor={fieldId} className="block text-xs font-medium text-[var(--text-secondary)]">
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
        className={`w-full h-9 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 text-xs font-normal placeholder-[var(--text-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] transition-colors ${
          readOnly ? 'text-[var(--text-muted)] cursor-not-allowed opacity-80' : 'text-[var(--text-primary)]'
        }`}
      />
      {hint && <p className="text-[11px] text-[var(--text-muted)] leading-snug">{hint}</p>}
    </div>
  );
};

const resolveDisplayStudentId = (p) => {
  const saved = p?.studentId === 'Google Sync User' ? '' : String(p?.studentId || '').trim();
  if (saved) return saved;
  return String(p?.email || '').match(/\d{13}/)?.[0] || '';
};

export default function Settings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab');
  const activeTab = VALID_TABS.has(rawTab) ? rawTab : 'account';

  const selectCategory = (nextTab) => {
    if (!VALID_TABS.has(nextTab)) return;
    const nextParams = new URLSearchParams(searchParams);
    if (nextTab === 'account') {
      nextParams.delete('tab');
    } else {
      nextParams.set('tab', nextTab);
    }
    setSearchParams(nextParams, { replace: true });
  };

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
  const {
    profile,
    isLoggedIn,
    isCachedSession = false,
    rememberedAccount = null,
    handleProfileSave,
    login,
    logout,
    accessToken
  } = useAuth();
  const classroom = useClassroom();
  const cachedMode = Boolean(!isLoggedIn && (isCachedSession || rememberedAccount?.email));
  const hasAccountSession = isLoggedIn || cachedMode;

  const [name, setName] = useState(profile.name || '');
  const [studentId, setStudentId] = useState(() => resolveDisplayStudentId(profile));
  const [email, setEmail] = useState(profile.email || '');
  const [prevProfile, setPrevProfile] = useState(profile);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [isResettingCalendar, setIsResettingCalendar] = useState(false);
  const [calendarSyncState, setCalendarSyncState] = useState(calendarSyncManager.state);
  const [resetMessage, setResetMessage] = useState('');
  const [examCacheTick, setExamCacheTick] = useState(0);
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

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const bumpExamCache = () => setExamCacheTick((v) => v + 1);
    window.addEventListener('classroom_hub_exams_updated', bumpExamCache);
    window.addEventListener('classroom_hub_remote_applied', bumpExamCache);
    return () => {
      window.removeEventListener('classroom_hub_exams_updated', bumpExamCache);
      window.removeEventListener('classroom_hub_remote_applied', bumpExamCache);
    };
  }, []);

  if (profile !== prevProfile) {
    setPrevProfile(profile);
    setName(profile.name || '');
    setStudentId(resolveDisplayStudentId(profile));
    setEmail(profile.email || '');
  }

  const devInfo = {
    name: 'Kittipong Teerasee',
    nickname: 'kittiponglnwza',
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

  const webhookValidation = DiscordService.validateWebhookUrl(alertSettings.discordWebhookUrl || '');

  const mergedExams = useMemo(() => {
    void examCacheTick;
    if (!activeUserEmail) return [];
    const cached = examRepository.getCachedExams(activeUserEmail);
    if (!cached.success || !cached.data) return [];
    return getMergedExams(cached.data.exams || [], cached.data.manualExams || []);
  }, [activeUserEmail, examCacheTick]);

  const generatedAppsScript = useMemo(
    () =>
      getAppsScriptTemplate(hiddenCourseIds, {
        discordWebhookUrl: alertSettings.discordWebhookUrl || '',
        embedWebhook: Boolean(alertSettings.embedWebhookInScript),
        enableDiscord: true,
        enableEmail: false,
        notifyNewPosts: Boolean(alertSettings.newPosts ?? true),
        notifyNewAssignments: Boolean(alertSettings.newAssignments ?? true),
        notifyNewAnnouncements: Boolean(alertSettings.newAnnouncements ?? true),
        notifyNewMaterials: Boolean(alertSettings.newMaterials ?? true),
        due7Days: Boolean(alertSettings.due7Days ?? true),
        due3Days: Boolean(alertSettings.due3Days ?? true),
        due1Day: Boolean(alertSettings.due1Day ?? true),
        dueToday: Boolean(alertSettings.dueToday ?? true),
        overdue1Day: Boolean(alertSettings.overdue1Day ?? true),
        morningBriefingEnabled: Boolean(alertSettings.morningBriefingEnabled ?? true),
        morningBriefingTime: alertSettings.morningBriefingTime || '07:00',
        morningBriefingSendOnFreeDays: Boolean(alertSettings.morningBriefingSendOnFreeDays ?? true),
        classReminderEnabled: Boolean(alertSettings.classReminderEnabled ?? false),
        classReminderLeadMinutes: Number(alertSettings.classReminderLeadMinutes ?? 30),
        classReminderFinal5m: Boolean(alertSettings.classReminderFinal5m ?? false),
        examCountdownEnabled: Boolean(alertSettings.examCountdownEnabled ?? true),
        exam7Days: Boolean(alertSettings.exam7Days ?? true),
        exam3Days: Boolean(alertSettings.exam3Days ?? true),
        exam1Day: Boolean(alertSettings.exam1Day ?? true),
        examToday: Boolean(alertSettings.examToday ?? true),
        dailyDigestEnabled: Boolean(alertSettings.dailyDigestEnabled ?? false),
        dailyDigestTime: alertSettings.dailyDigestTime || '20:00',
        sundayDigest: Boolean(alertSettings.sundayDigest ?? true),
        weeklyDigestDay: alertSettings.weeklyDigestDay || 'sun',
        weeklyDigestTime: alertSettings.weeklyDigestTime || '18:00',
        quietHoursEnabled: Boolean(alertSettings.quietHoursEnabled ?? false),
        quietHoursStart: alertSettings.quietHoursStart || '22:00',
        quietHoursEnd: alertSettings.quietHoursEnd || '06:30',
        quietHoursAllowCritical: Boolean(alertSettings.quietHoursAllowCritical ?? true),
        minPriority: alertSettings.minPriority || 'P3',
        timezone: alertSettings.timezone || 'Asia/Bangkok',
        maxRetries: alertSettings.maxRetries ?? 2,
        schedule: currentSchedule,
        mergedExams
      }),
    [hiddenCourseIds, alertSettings, currentSchedule, mergedExams]
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    setProfileError('');
    const normalizedId = studentId.replace(/[\s-]/g, '').trim();
    if (normalizedId && !/^\d{13}$/.test(normalizedId)) {
      setProfileError(
        lang === 'en'
          ? 'Student ID must be 13 digits (or leave empty if not using KMUTNB exam lookup)'
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
      setResetMessage(lang === 'en' ? 'Calendar reset & sync initiated' : 'ล้างข้อมูลและเริ่มซิงก์ปฏิทินใหม่แล้ว');
    } catch (e) {
      console.error(e);
      setResetMessage(lang === 'en' ? 'Error resetting calendar' : 'เกิดข้อผิดพลาดในการล้างข้อมูลปฏิทิน');
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
      setResetMessage(lang === 'en' ? 'Error syncing calendar' : 'เกิดข้อผิดพลาดในการซิงก์ปฏิทิน');
    } finally {
      const id = setTimeout(() => setResetMessage(''), 4000);
      timersRef.current.push(id);
    }
  };

  const categories = [
    {
      id: 'account',
      icon: User,
      en: 'Account & ID',
      th: 'โปรไฟล์ & บัตรนักศึกษา',
      dotClass: isLoggedIn
        ? 'bg-[var(--success)]'
        : cachedMode
          ? 'bg-[var(--warning)]'
          : 'bg-[var(--text-muted)]'
    },
    {
      id: 'calendar',
      icon: Calendar,
      en: 'Google Calendar',
      th: 'ซิงก์ปฏิทิน',
      meta: calendarSyncState === 'syncing' ? (isTh ? 'ซิงก์...' : 'Syncing') : null
    },
    {
      id: 'discord',
      icon: MessageSquare,
      en: 'Discord Assistant',
      th: 'แจ้งเตือน Discord',
      meta: webhookValidation.valid && alertSettings.discordEnabled ? 'On' : null,
      dotClass: webhookValidation.valid
        ? (alertSettings.discordEnabled ? 'bg-[var(--success)]' : 'bg-[var(--text-muted)]')
        : null
    },
    {
      id: 'about',
      icon: GithubMark,
      en: 'Developer & App',
      th: 'ผู้พัฒนา & ตัวแอป',
      meta: `v${APP_VERSION}`
    }
  ];

  const calendarPipelines = [
    {
      icon: Clock,
      title: isTh ? 'ตารางเรียนรายสัปดาห์' : 'Weekly class timetable',
      desc: isTh
        ? 'สร้างอีเวนต์คาบเรียนพร้อมห้องเรียน และหยุดพักคาบเรียนช่วงสัปดาห์สอบกลางภาคให้อัตโนมัติ'
        : 'Syncs recurring class blocks with rooms and automatically pauses sessions during Midterm week'
    },
    {
      icon: GraduationCap,
      title: isTh ? 'ตารางสอบและที่นั่งสอบ' : 'Exam rooms & seat assignments',
      desc: isTh
        ? 'รวมข้อมูลสอบจาก SciBase, Reg มจพ. และรายการที่เพิ่มเอง ลงในปฏิทินพร้อมเลขที่นั่ง'
        : 'Pushes merged SciBase, KMUTNB Reg, and custom exam schedules with room and seat details'
    },
    {
      icon: ClipboardList,
      title: isTh ? 'กำหนดส่งการบ้าน' : 'Pending coursework deadlines',
      desc: isTh
        ? 'ปักหมุดงานที่ยังไม่ส่งจาก Google Classroom และอัปเดตเมื่ออาจารย์เลื่อนกำหนดส่ง'
        : 'Tracks unsubmitted Google Classroom assignments and updates events when deadlines shift'
    }
  ];

  return (
    <div className="space-y-6 pb-8">
      <div className="space-y-3">
        <PageHeader
          title={t('settingsTitle', lang)}
          description={t('settingsDesc', lang)}
          icon={Settings2}
          className="border-b-0 pb-1 sm:pb-1"
        />

        {/* Top Horizontal Category Bar (Zero Double Sidebar, Zero Truncation) */}
        <nav
          aria-label={isTh ? 'หมวดหมู่การตั้งค่า' : 'Settings categories'}
          className="flex items-center gap-1 sm:gap-2 overflow-x-auto border-b border-[var(--border)] select-none"
        >
          {categories.map((cat) => {
            const Icon = cat.icon;
            const active = activeTab === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                data-testid={`settings-nav-${cat.id}`}
                aria-current={active ? 'page' : undefined}
                onClick={() => selectCategory(cat.id)}
                className={`px-3.5 py-2.5 -mb-px border-b-2 flex items-center gap-2 text-[13px] font-medium transition-colors cursor-pointer shrink-0 whitespace-nowrap ${
                  active
                    ? 'border-[var(--text-heading)] text-[var(--text-heading)]'
                    : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Icon
                  size={15}
                  strokeWidth={1.5}
                  className={active ? 'text-[var(--text-heading)] shrink-0' : 'text-[var(--text-muted)] shrink-0'}
                />
                <span>{isTh ? cat.th : cat.en}</span>

                {(cat.dotClass || cat.meta) && (
                  <span className="inline-flex items-center gap-1.5 pl-0.5 text-[11px] font-mono tabular-nums text-[var(--text-muted)] shrink-0">
                    {cat.dotClass && <span className={`w-1.5 h-1.5 rounded-full ${cat.dotClass}`} />}
                    {cat.meta && <span>{cat.meta}</span>}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Focused Full-Width Category Content (Locked min-height prevents footer jump across tabs) */}
      <div className="min-w-0 lg:min-h-[540px]">
          {/* 1. Account & KMUTNB Student Pass */}
          {activeTab === 'account' && (
            <div className="grid grid-cols-1 xl:grid-cols-[430px_minmax(0,1fr)] gap-8 items-start">
              <KmutnbStudentCard
                name={name || profile.name}
                email={activeUserEmail}
                studentId={studentId}
                avatarUrl={profile.avatarUrl}
                decodedKmutnb={decodedKmutnb}
                isLoggedIn={isLoggedIn}
                cachedMode={cachedMode}
                lang={lang}
              />

              <div className="divide-y divide-[var(--border)] min-w-0">
                {/* Google Classroom Connection Row */}
                <div className="pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    <h3 className="text-sm font-medium text-[var(--text-heading)]">
                      {isTh ? 'บัญชีเชื่อมต่อ Google Classroom' : 'Google Classroom session'}
                    </h3>
                    <p className="text-xs text-[var(--text-secondary)] truncate">
                      {hasAccountSession
                        ? activeUserEmail
                        : (isTh
                            ? 'เชื่อมต่อบัญชีมหาวิทยาลัยเพื่อซิงก์การบ้านและรายวิชาอัตโนมัติ'
                            : 'Connect your university Google account to sync courses and assignments')}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
                    {hasAccountSession ? (
                      confirmLogout ? (
                        <>
                          <button
                            type="button"
                            onClick={() => setConfirmLogout(false)}
                            className="h-8 px-3 rounded-lg text-xs font-medium bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] border border-[var(--border)] transition-colors cursor-pointer"
                          >
                            {t('cancelBtn', lang)}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmLogout(false);
                              logout();
                            }}
                            className="h-8 px-3.5 rounded-lg text-xs font-medium bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 transition-colors cursor-pointer"
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
                              <LogIn size={14} strokeWidth={1.5} />
                              <span>{t('connectSyncBtn', lang)}</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setConfirmLogout(true)}
                            className="h-8 inline-flex items-center gap-1.5 bg-[var(--surface)] hover:bg-rose-500/10 text-[var(--text-secondary)] hover:text-rose-300 border border-[var(--border)] hover:border-rose-500/30 px-3 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                          >
                            <LogOut size={14} strokeWidth={1.5} />
                            <span>{t('disconnectBtn', lang)}</span>
                          </button>
                        </>
                      )
                    ) : (
                      <button
                        type="button"
                        onClick={() => login()}
                        className="h-9 inline-flex items-center gap-1.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white px-4 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                      >
                        <LogIn size={14} strokeWidth={1.5} />
                        <span>{t('connectBtn', lang)}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Profile Form Ledger */}
                <form onSubmit={handleSubmit} className="pt-6 space-y-5">
                  <div className="space-y-1">
                    <h3 className="text-sm font-medium text-[var(--text-heading)]">
                      {isTh ? 'ข้อมูลประจำตัวนักศึกษา' : 'Student profile details'}
                    </h3>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {isTh
                        ? 'รหัสนักศึกษา 13 หลักจะใช้ถอดรหัสคณะ/ภาควิชาบนบัตร และใช้ค้นหาผังที่นั่งสอบอัตโนมัติ'
                        : 'Your 13-digit KMUTNB ID populates your credential pass and powers automated exam seat lookup'}
                    </p>
                  </div>

                  {saveSuccess && (
                    <div className="bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs px-3.5 py-2.5 rounded-lg flex items-center gap-2">
                      <CheckCircle2 size={15} strokeWidth={1.5} className="text-[var(--success)] shrink-0" />
                      <span>{t('profileSuccess', lang)}</span>
                    </div>
                  )}

                  {profileError && (
                    <div
                      role="alert"
                      className="bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs px-3.5 py-2.5 rounded-lg"
                    >
                      {profileError}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <InputField
                      label={t('studentNameLabel', lang)}
                      value={name}
                      onChange={setName}
                    />
                    <InputField
                      label={t('studentIdLabel', lang)}
                      value={studentId}
                      onChange={setStudentId}
                      required={false}
                      inputMode="numeric"
                      placeholder="6704062611115"
                    />
                    {!hasAccountSession && (
                      <div className="sm:col-span-2">
                        <InputField
                          label={t('studentEmailLabel', lang)}
                          value={email}
                          onChange={setEmail}
                          type="email"
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      className="h-9 bg-[#EEF0F5] hover:bg-white text-[#0C0F16] px-4 rounded-lg font-medium text-xs transition-colors cursor-pointer whitespace-nowrap"
                    >
                      {lang === 'en' ? 'Save Preferences' : 'บันทึกการตั้งค่า'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* 2. Google Calendar Sync */}
          {activeTab === 'calendar' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-[var(--border)]">
                <div className="space-y-1 max-w-2xl">
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-base font-medium text-[var(--text-heading)]">
                      {isTh ? 'ซิงก์ปฏิทิน Google Calendar' : 'Google Calendar Sync'}
                    </h2>
                    {calendarSyncState === 'syncing' && (
                      <span className="text-[11px] px-2 py-0.5 rounded-md bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--primary-bright)]">
                        {t('syncing', lang)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs sm:text-[13px] text-[var(--text-secondary)] leading-relaxed">
                    {isTh
                      ? 'อัปเดตตารางเรียน ช่วงหยุดสอบกลางภาค ห้องสอบ และวันส่งงานลงในปฏิทินหลักของ Google โดยอัตโนมัติ'
                      : 'Keeps your primary Google Calendar updated with classes, midterm pauses, exam rooms, and pending due dates'}
                  </p>
                </div>
              </div>

              {/* 3-Column Sync Pipeline Strip */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-0 md:divide-x divide-[var(--border)] pb-6 border-b border-[var(--border)]">
                {calendarPipelines.map((item, idx) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.title}
                      className={`space-y-1.5 ${idx > 0 ? 'md:pl-5' : ''} ${idx < 2 ? 'md:pr-5' : ''}`}
                    >
                      <div className="flex items-center gap-2 text-xs font-medium text-[var(--text-heading)]">
                        <Icon size={15} strokeWidth={1.5} className="text-[var(--text-muted)] shrink-0" />
                        <span>{item.title}</span>
                      </div>
                      <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                        {item.desc}
                      </p>
                    </div>
                  );
                })}
              </div>

              {cachedMode && !resetMessage && (
                <div className="rounded-lg bg-amber-500/10 border border-amber-500/25 px-3.5 py-2.5 text-xs text-amber-200">
                  {isTh
                    ? 'กรุณาเชื่อมต่อบัญชี Google ในหมวดโปรไฟล์ก่อนสั่งซิงก์หรือล้างข้อมูลปฏิทิน'
                    : 'Connect your Google session in Account & ID before syncing or resetting Google Calendar'}
                </div>
              )}

              {resetMessage && (
                <div
                  className={`rounded-lg border px-3.5 py-2.5 text-xs font-medium ${
                    resetMessage.includes('Error') || resetMessage.includes('ข้อผิดพลาด')
                      ? 'bg-rose-500/10 border-rose-500/25 text-rose-300'
                      : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'
                  }`}
                >
                  {resetMessage}
                </div>
              )}

              {/* Action Ledger Rows */}
              <div className="divide-y divide-[var(--border)]">
                <div className="py-4 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-0.5 max-w-xl">
                    <h3 className="text-xs sm:text-[13px] font-medium text-[var(--text-primary)]">
                      {isTh ? 'ซิงก์ข้อมูลล่าสุดและเก็บกวาดรายการซ้ำ' : 'Sync now & clean duplicate events'}
                    </h3>
                    <p className="text-xs text-[var(--text-muted)]">
                      {isTh
                        ? 'อัปเดตคาบเรียน วันสอบ และงานล่าสุดลงใน Google Calendar ทันที'
                        : 'Pushes any recent schedule, exam, or assignment changes to Google Calendar'}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleSyncCalendarNow}
                    disabled={!isLoggedIn || calendarSyncState === 'syncing' || isResettingCalendar}
                    className="h-9 self-start sm:self-auto bg-[#EEF0F5] hover:bg-white text-[#0C0F16] px-4 rounded-lg text-xs font-medium transition-colors cursor-pointer disabled:opacity-40 inline-flex items-center gap-2 shrink-0 whitespace-nowrap"
                  >
                    <RefreshCw
                      size={14}
                      strokeWidth={1.6}
                      className={calendarSyncState === 'syncing' && !isResettingCalendar ? 'animate-spin shrink-0' : 'shrink-0'}
                    />
                    <span>
                      {calendarSyncState === 'syncing' && !isResettingCalendar
                        ? t('syncingCalendarBtn', lang)
                        : (isTh ? 'ซิงก์ตอนนี้' : 'Sync Now')}
                    </span>
                  </button>
                </div>

                <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-0.5 max-w-xl">
                    <h3 className="text-xs sm:text-[13px] font-medium text-[var(--text-primary)]">
                      {isTh ? 'ล้างอีเวนต์ของแอปแล้วสร้างใหม่ทั้งหมด' : 'Rebuild Classroom Hub calendar events'}
                    </h3>
                    <p className="text-xs text-[var(--text-muted)]">
                      {isTh
                        ? 'ใช้เมื่อมีการเปลี่ยนเทอมเรียนหรือย้ายเซกชัน เพื่อลบรายการเก่าของแอปออกแล้วลงใหม่แบบสะอาด'
                        : 'Removes stale Classroom Hub events after semester or section changes and performs a clean import'}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleResetCalendar}
                    disabled={!isLoggedIn || isResettingCalendar || calendarSyncState === 'syncing'}
                    className="h-9 self-start sm:self-auto bg-[var(--surface-elevated)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] border border-[var(--border)] px-4 rounded-lg text-xs font-medium transition-colors cursor-pointer disabled:opacity-40 inline-flex items-center gap-2 shrink-0 whitespace-nowrap"
                  >
                    {isResettingCalendar && <RefreshCw size={14} strokeWidth={1.5} className="animate-spin shrink-0" />}
                    <span>{isTh ? 'ล้างแล้วลงใหม่' : 'Reset Calendar'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 3. Discord Academic Assistant */}
          {activeTab === 'discord' && (
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
              generatedAppsScript={generatedAppsScript}
              handleToggleSetting={handleToggleSetting}
              handleUpdateSetting={handleUpdateSetting}
              handleTimeChange={handleTimeChange}
              refreshNotificationData={refreshNotificationData}
            />
          )}

          {/* 4. Developer & App Showcase */}
          {activeTab === 'about' && (
            <DeveloperShowcase
              devInfo={devInfo}
              lang={lang}
              appVersion={APP_VERSION}
              appCommit={APP_COMMIT}
            />
          )}
      </div>

      {/* Unified Rock-Steady Bottom Version Bar across all 4 tabs */}
      <div
        data-testid="settings-version-badge"
        className="pt-4 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--text-muted)] border-t border-[var(--border)]"
      >
        <div className="flex items-center gap-2 font-mono tabular-nums">
          <span className="text-[var(--text-secondary)]">
            Classroom Hub v{APP_VERSION}{APP_COMMIT ? ` (${APP_COMMIT})` : ''}
          </span>
          <span>·</span>
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
