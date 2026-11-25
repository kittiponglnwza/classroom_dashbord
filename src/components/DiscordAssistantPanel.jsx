import { useState, useRef, useEffect, useId, useMemo } from 'react';
import {
  MessageSquare,
  RefreshCw,
  Terminal,
  Clock,
  Calendar,
  BookOpen,
  GraduationCap,
  Sliders,
  AlertCircle,
  History,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { DiscordService } from '../services/DiscordService';
import {
  triggerTestDiscord,
  triggerManualDiscordDigest,
  triggerMorningBriefingPreview,
  triggerAssignmentReminderPreview,
  triggerExamCountdownPreview,
  triggerWeeklyDigestPreview
} from '../utils/notifications';
import { getMergedExams } from '../utils/examMerger';
import { examRepository } from '../repositories/examRepository';
import { syncManager } from '../services/SyncManager';
import { NotificationLedger } from '../services/notifications/NotificationLedger';
import DiscordWebhookInput from './DiscordWebhookInput';
import DiscordLivePreview from './settings/DiscordLivePreview';
import CloudScriptPanel from './settings/CloudScriptPanel';

const SECTION_TABS = [
  { id: 'schedule', previewMode: 'morning', icon: Calendar, en: 'Schedule', th: 'ตารางเรียน' },
  { id: 'assignments', previewMode: 'assignment', icon: BookOpen, en: 'Assignments', th: 'การบ้าน' },
  { id: 'exams', previewMode: 'exam', icon: GraduationCap, en: 'Exams & Digests', th: 'สอบ & สรุปผล' },
  { id: 'advanced', previewMode: null, icon: Sliders, en: 'Advanced', th: 'ขั้นสูง' }
];

const TIMEZONE_OPTIONS = [
  'Asia/Bangkok',
  'Asia/Singapore',
  'Asia/Tokyo',
  'UTC',
  'Europe/London',
  'America/New_York'
];

const DAY_OPTIONS = [
  { value: 'sun', en: 'Sunday', th: 'วันอาทิตย์' },
  { value: 'mon', en: 'Monday', th: 'วันจันทร์' },
  { value: 'tue', en: 'Tuesday', th: 'วันอังคาร' },
  { value: 'wed', en: 'Wednesday', th: 'วันพุธ' },
  { value: 'thu', en: 'Thursday', th: 'วันพฤหัสบดี' },
  { value: 'fri', en: 'Friday', th: 'วันศุกร์' },
  { value: 'sat', en: 'Saturday', th: 'วันเสาร์' }
];

function SettingToggleRow({ label, description, checked, onChange, testId }) {
  return (
    <label className="flex items-start justify-between gap-4 py-3 cursor-pointer select-none">
      <div className="min-w-0 space-y-0.5">
        <span className="block text-xs sm:text-[13px] font-medium text-[var(--text-primary)]">
          {label}
        </span>
        {description && (
          <span className="block text-xs text-[var(--text-muted)] leading-relaxed">
            {description}
          </span>
        )}
      </div>
      <div className="relative inline-flex items-center shrink-0 mt-0.5">
        <input
          type="checkbox"
          data-testid={testId}
          checked={Boolean(checked)}
          onChange={onChange}
          className="sr-only peer"
        />
        <div className="w-9 h-5 bg-[var(--surface-elevated)] border border-[var(--border)] rounded-full peer peer-checked:after:translate-x-4 after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-[var(--text-heading)] after:rounded-full after:h-3.5 after:w-3.5 after:transition-transform peer-checked:bg-[var(--primary)] peer-checked:border-[var(--primary)]" />
      </div>
    </label>
  );
}

function formatTelemetryTime(isoStr, lang) {
  if (!isoStr) return lang === 'th' ? 'ยังไม่เคยส่ง' : 'None yet';
  const dt = new Date(isoStr);
  if (Number.isNaN(dt.getTime())) return '-';
  return dt.toLocaleString(lang === 'th' ? 'th-TH' : 'en-US', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export default function DiscordAssistantPanel({
  lang = 'en',
  activeUserEmail = '',
  accessToken = null,
  alertSettings = {},
  discordTelemetry = null,
  historyLogs = [],
  hiddenCourseIds = [],
  currentAssignments = [],
  currentSchedule = [],
  currentResources = [],
  generatedAppsScript = '',
  handleToggleSetting,
  handleUpdateSetting,
  handleTimeChange,
  refreshNotificationData
}) {
  const isTh = lang === 'th';
  const webhookFieldId = useId();
  const [activeSection, setActiveSection] = useState('schedule');
  const [previewMode, setPreviewMode] = useState('morning');
  const [busyAction, setBusyAction] = useState('');
  const [feedback, setFeedback] = useState({ text: '', type: '' });
  const [showRecentHistory, setShowRecentHistory] = useState(false);
  const [showCloudSetup, setShowCloudSetup] = useState(false);
  const [examCacheTick, setExamCacheTick] = useState(0);
  const timersRef = useRef([]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => timers.forEach(clearTimeout);
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

  const webhookValidation = DiscordService.validateWebhookUrl(alertSettings.discordWebhookUrl || '');
  const telemetry = discordTelemetry || NotificationLedger.getTelemetry(activeUserEmail);

  const mergedExams = useMemo(() => {
    void examCacheTick;
    if (!activeUserEmail) return [];
    const cached = examRepository.getCachedExams(activeUserEmail);
    if (!cached.success || !cached.data) return [];
    return getMergedExams(cached.data.exams || [], cached.data.manualExams || []);
  }, [activeUserEmail, examCacheTick]);

  const runPreviewOrTest = async (actionKey, fn, successEn, successTh) => {
    setFeedback({ text: '', type: '' });
    if (!webhookValidation.valid) {
      setFeedback({
        text: isTh ? 'กรุณาใส่ลิงก์ Discord Webhook ที่ถูกต้อง' : 'Enter a valid Discord Webhook URL first',
        type: 'error'
      });
      return;
    }
    setBusyAction(actionKey);
    try {
      await fn(webhookValidation.url);
      refreshNotificationData?.();
      if (accessToken && activeUserEmail) {
        syncManager.queueSync(accessToken, activeUserEmail);
      }
      setFeedback({ text: isTh ? successTh : successEn, type: 'success' });
    } catch (err) {
      refreshNotificationData?.();
      setFeedback({
        text: (isTh ? 'ส่งไม่สำเร็จ: ' : 'Failed: ') + (err?.message || 'Request failed'),
        type: 'error'
      });
    } finally {
      setBusyAction('');
    }
  };

  const handleSendSelectedPreview = (mode) => {
    if (mode === 'assignment') {
      return runPreviewOrTest(
        'assignment',
        (url) => triggerAssignmentReminderPreview(activeUserEmail, currentAssignments, url),
        'Assignment Reminder preview delivered to Discord',
        'ส่งตัวอย่างแจ้งเตือนการบ้านเข้า Discord แล้ว'
      );
    }
    if (mode === 'exam') {
      return runPreviewOrTest(
        'exam',
        (url) => triggerExamCountdownPreview(activeUserEmail, url),
        'Exam Countdown preview delivered to Discord',
        'ส่งตัวอย่างนับถอยหลังสอบเข้า Discord แล้ว'
      );
    }
    if (mode === 'weekly') {
      return runPreviewOrTest(
        'weekly',
        (url) =>
          triggerWeeklyDigestPreview(
            activeUserEmail,
            {
              schedule: currentSchedule,
              assignments: currentAssignments,
              resources: currentResources
            },
            url
          ),
        'Weekly Academic Report preview delivered to Discord',
        'ส่งตัวอย่างรายงานประจำสัปดาห์เข้า Discord แล้ว'
      );
    }
    return runPreviewOrTest(
      'morning',
      (url) =>
        triggerMorningBriefingPreview(
          activeUserEmail,
          {
            schedule: currentSchedule,
            assignments: currentAssignments,
            resources: currentResources
          },
          url
        ),
      'Morning Briefing preview delivered to Discord',
      'ส่งตัวอย่างสรุปตารางเช้าเข้า Discord แล้ว'
    );
  };

  const discordHistory = useMemo(
    () =>
      (Array.isArray(historyLogs) ? historyLogs : [])
        .filter((h) => h.channel === 'discord' || String(h.type || '').includes('discord'))
        .slice(0, 6),
    [historyLogs]
  );

  const deliveryStatusMeta = (() => {
    switch (telemetry?.lastStatus) {
      case 'delivered':
        return { dot: 'bg-[var(--success)]', text: isTh ? 'ส่งสำเร็จปกติ' : 'Healthy' };
      case 'retrying':
        return { dot: 'bg-[var(--warning)]', text: isTh ? 'กำลังลองส่งซ้ำ' : 'Retrying' };
      case 'ambiguous':
        return { dot: 'bg-[var(--warning)]', text: isTh ? 'หมดเวลา (หยุดส่งซ้ำป้องกันเบิ้ล)' : 'Timeout (retry paused)' };
      case 'failed':
        return { dot: 'bg-[var(--danger)]', text: isTh ? 'พบข้อผิดพลาดล่าสุด' : 'Delivery error' };
      default:
        return { dot: 'bg-[var(--text-muted)]', text: isTh ? 'พร้อมรอส่ง' : 'Standby' };
    }
  })();

  const isAnySending = Boolean(busyAction);

  return (
    <section
      id="discord-assistant-panel"
      aria-label={isTh ? 'ผู้ช่วยแจ้งเตือน Discord' : 'Discord Academic Assistant'}
      className="space-y-6"
    >
      {/* Top Header & Master Switch */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-[var(--border)]">
        <div className="space-y-1 max-w-2xl">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-base font-medium text-[var(--text-heading)]">
              {isTh ? 'ผู้ช่วยแจ้งเตือน Discord อัตโนมัติ' : 'Discord Academic Assistant'}
            </h2>
            <span
              data-testid="discord-webhook-status"
              className={`text-[11px] px-2 py-0.5 rounded-md font-medium whitespace-nowrap ${
                webhookValidation.valid
                  ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/25'
                  : (alertSettings.discordWebhookUrl || '').trim()
                    ? 'bg-rose-500/10 text-rose-300 border border-rose-500/25'
                    : 'bg-[var(--surface)] text-[var(--text-muted)] border border-[var(--border)]'
              }`}
            >
              {webhookValidation.valid
                ? (isTh ? 'พร้อมใช้งาน' : 'Webhook Ready')
                : (alertSettings.discordWebhookUrl || '').trim()
                  ? (isTh ? 'ลิงก์ไม่ถูกต้อง' : 'Invalid URL')
                  : (isTh ? 'ยังไม่ตั้งค่า' : 'Not Configured')}
            </span>
          </div>
          <p className="text-xs sm:text-[13px] text-[var(--text-secondary)] leading-relaxed">
            {isTh
              ? 'ส่งสรุปตารางเรียนตอนเช้า การบ้านใกล้ครบกำหนด และนับถอยหลังวันสอบเข้าช่อง Discord ส่วนตัวของคุณ'
              : 'Delivers daily morning briefings, coursework deadlines, and exam seating countdowns to your private Discord channel'}
          </p>
        </div>

        <label
          className="inline-flex items-center gap-2.5 cursor-pointer select-none self-start shrink-0 pt-0.5"
          title={isTh ? 'เปิดใช้งานระบบแจ้งเตือน Discord' : 'Enable Discord notifications'}
        >
          <span className="text-xs font-medium text-[var(--text-secondary)]">
            {alertSettings.discordEnabled
              ? (isTh ? 'เปิดใช้งานอยู่' : 'Enabled')
              : (isTh ? 'ปิดอยู่' : 'Paused')}
          </span>
          <div className="relative inline-flex items-center">
            <input
              type="checkbox"
              checked={Boolean(alertSettings.discordEnabled)}
              onChange={() => handleToggleSetting?.('discordEnabled')}
              aria-label={isTh ? 'ส่งแจ้งเตือนเข้า Discord อัตโนมัติ' : 'Auto-send alerts to Discord when syncing on web'}
              className="sr-only peer"
            />
            <div className="w-10 h-5 bg-[var(--surface-elevated)] border border-[var(--border)] rounded-full peer peer-checked:after:translate-x-5 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[var(--text-heading)] after:rounded-full after:h-4 after:w-4 after:transition-transform peer-checked:bg-[var(--primary)] peer-checked:border-[var(--primary)]" />
          </div>
        </label>
      </div>

      {/* Inline Connection & Telemetry Strip (Zero double-boxing) */}
      <div className="space-y-3 pb-6 border-b border-[var(--border)]">
        {feedback.text && (
          <div
            role={feedback.type === 'error' ? 'alert' : 'status'}
            className={`px-3.5 py-2 rounded-lg border text-xs flex items-center justify-between gap-2 ${
              feedback.type === 'error'
                ? 'bg-rose-500/10 border-rose-500/25 text-rose-300'
                : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'
            }`}
          >
            <span className="min-w-0 break-words">{feedback.text}</span>
            <button
              type="button"
              onClick={() => setFeedback({ text: '', type: '' })}
              className="text-sm font-medium shrink-0 hover:opacity-75 cursor-pointer"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        )}

        <div className="space-y-1.5">
          <label htmlFor={webhookFieldId} className="block text-xs font-medium text-[var(--text-secondary)]">
            {isTh ? 'ลิงก์เชื่อมต่อ Discord Webhook' : 'Webhook endpoint'}
          </label>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <div className="flex-1 min-w-0">
              <DiscordWebhookInput
                id={webhookFieldId}
                value={alertSettings.discordWebhookUrl || ''}
                onChange={(nextVal) => handleUpdateSetting?.('discordWebhookUrl', nextVal)}
                lang={lang}
              />
            </div>

            <button
              type="button"
              disabled={isAnySending || !webhookValidation.valid}
              onClick={() =>
                runPreviewOrTest(
                  'test',
                  (url) => triggerTestDiscord(activeUserEmail, url),
                  'Test message delivered to Discord successfully',
                  'ส่งข้อความทดสอบเข้า Discord สำเร็จแล้ว'
                )
              }
              className="h-9 bg-[var(--surface-elevated)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] border border-[var(--border)] px-3.5 rounded-lg text-xs font-medium transition-colors cursor-pointer disabled:opacity-40 inline-flex items-center justify-center gap-2 shrink-0 whitespace-nowrap"
            >
              {busyAction === 'test' ? (
                <RefreshCw size={14} strokeWidth={1.5} className="animate-spin shrink-0" />
              ) : (
                <MessageSquare size={14} strokeWidth={1.5} className="text-[var(--text-muted)] shrink-0" />
              )}
              <span>
                {busyAction === 'test'
                  ? (isTh ? 'กำลังทดสอบ...' : 'Testing...')
                  : (isTh ? 'ยิงข้อความทดสอบเข้า Discord' : 'Test Discord Webhook')}
              </span>
            </button>
          </div>
        </div>

        {/* Quiet Inline Telemetry Row */}
        <div
          data-testid="discord-delivery-telemetry"
          className="flex flex-col gap-2 pt-1"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="inline-flex items-center gap-2 text-[var(--text-primary)] font-medium">
                <span className={`w-1.5 h-1.5 rounded-full ${deliveryStatusMeta.dot}`} />
                <span>{deliveryStatusMeta.text}</span>
              </span>

              <span className="text-[var(--text-muted)] font-mono tabular-nums text-[11px]">
                {isTh ? 'ล่าสุด: ' : 'Last: '}
                <span className="text-[var(--text-secondary)]">
                  {formatTelemetryTime(telemetry?.lastSuccessAt, lang)}
                </span>
              </span>

              <span className="text-[var(--text-muted)] font-mono tabular-nums text-[11px]">
                {isTh ? 'ส่งแล้ว: ' : 'Sent: '}
                <span className="text-[var(--text-secondary)]">
                  {telemetry?.totalDelivered || 0}
                </span>
              </span>
            </div>

            <button
              type="button"
              onClick={() => setShowRecentHistory((v) => !v)}
              className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-heading)] transition-colors cursor-pointer"
            >
              <History size={13} strokeWidth={1.5} />
              <span>{showRecentHistory ? (isTh ? 'ซ่อนประวัติ' : 'Hide history') : (isTh ? 'ประวัติการส่ง' : 'Delivery history')}</span>
            </button>
          </div>

          {telemetry?.lastErrorMessage && telemetry.lastStatus !== 'delivered' && (
            <div className="flex items-start gap-2 rounded-lg bg-rose-500/10 border border-rose-500/25 px-3 py-2 text-xs text-rose-300">
              <AlertCircle size={14} strokeWidth={1.5} className="shrink-0 mt-0.5" />
              <div className="min-w-0">
                <span className="font-medium">
                  {isTh ? `ข้อผิดพลาด (${telemetry.consecutiveFailures || 1} ครั้ง): ` : `Last error (${telemetry.consecutiveFailures || 1}x): `}
                </span>
                <span className="break-words">{telemetry.lastErrorMessage}</span>
              </div>
            </div>
          )}

          {showRecentHistory && (
            <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] px-3.5 py-2.5 space-y-1.5 max-h-36 overflow-y-auto">
              {discordHistory.length > 0 ? (
                discordHistory.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 text-xs py-0.5">
                    <span className="text-[var(--text-secondary)] truncate">{item.title}</span>
                    <span className="text-[var(--text-muted)] font-mono tabular-nums text-[11px] shrink-0">
                      {formatTelemetryTime(item.sentAt, lang)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-[var(--text-muted)] py-1">
                  {isTh ? 'ยังไม่มีประวัติการแจ้งเตือน Discord' : 'No Discord deliveries recorded yet'}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Split: Spacious Rule Ledger (Left) + Live Discord Embed Preview (Right) */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_372px] gap-8 items-start">
        {/* Left: Non-Truncated Rule Tabs & Open Ledger */}
        <div className="min-w-0">
          <div className="flex items-center gap-1 border-b border-[var(--border)] overflow-x-auto">
            {SECTION_TABS.map((tab) => {
              const Icon = tab.icon;
              const active = activeSection === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveSection(tab.id);
                    if (tab.previewMode) setPreviewMode(tab.previewMode);
                  }}
                  className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors cursor-pointer whitespace-nowrap ${
                    active
                      ? 'border-[var(--text-heading)] text-[var(--text-heading)]'
                      : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                  }`}
                >
                  <Icon size={14} strokeWidth={1.5} className="shrink-0" />
                  <span>{isTh ? tab.th : tab.en}</span>
                </button>
              );
            })}
          </div>

          <div className="pt-2 divide-y divide-[var(--border)]">
            {activeSection === 'schedule' && (
              <>
                <div className="py-2 space-y-1">
                  <SettingToggleRow
                    label={isTh ? 'สรุปตารางเรียนตอนเช้า (Morning Briefing)' : 'Morning Briefing'}
                    description={
                      isTh
                        ? 'ส่งสรุปคาบเรียนวันนี้ งานที่ต้องส่ง และวิชาสอบที่กำลังจะมาถึงวันละ 1 ข้อความ'
                        : 'One daily consolidated embed with classes, due tasks, and upcoming exams'
                    }
                    checked={alertSettings.morningBriefingEnabled ?? true}
                    onChange={() => handleToggleSetting?.('morningBriefingEnabled')}
                    testId="toggle-morning-briefing"
                  />
                  {(alertSettings.morningBriefingEnabled ?? true) && (
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
                      <span className="text-xs text-[var(--text-secondary)] inline-flex items-center gap-1.5">
                        <Clock size={13} strokeWidth={1.5} className="text-[var(--text-muted)]" />
                        <span>{isTh ? 'เวลาส่งสรุปเช้า' : 'Delivery time'}</span>
                      </span>
                      <input
                        type="time"
                        aria-label={isTh ? 'เวลาส่งสรุปเช้า' : 'Morning Briefing delivery time'}
                        value={alertSettings.morningBriefingTime || '07:00'}
                        onChange={(e) => handleUpdateSetting?.('morningBriefingTime', e.target.value)}
                        className="h-8 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2.5 text-xs font-mono tabular-nums text-[var(--text-primary)]"
                      />
                    </div>
                  )}
                  <SettingToggleRow
                    label={isTh ? 'ส่งสรุปในวันที่ไม่มีคาบเรียน (เมื่อมีงานค้างหรือวันสอบ)' : 'Include no-class days when tasks or exams exist'}
                    checked={alertSettings.morningBriefingSendOnFreeDays ?? true}
                    onChange={() => handleToggleSetting?.('morningBriefingSendOnFreeDays')}
                  />
                </div>

                <div className="py-2 space-y-1">
                  <SettingToggleRow
                    label={isTh ? 'แจ้งเตือนก่อนเข้าเรียน' : 'Before-class reminder'}
                    description={
                      isTh
                        ? 'แจ้งชื่อวิชา เวลา และห้องเรียนก่อนเริ่มคาบ'
                        : 'Remind with course name, time, and room before class starts'
                    }
                    checked={alertSettings.classReminderEnabled ?? false}
                    onChange={() => handleToggleSetting?.('classReminderEnabled')}
                  />
                  {alertSettings.classReminderEnabled && (
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
                      <span className="text-xs text-[var(--text-secondary)]">
                        {isTh ? 'แจ้งล่วงหน้า' : 'Lead time'}
                      </span>
                      <select
                        value={alertSettings.classReminderLeadMinutes ?? 30}
                        onChange={(e) => handleUpdateSetting?.('classReminderLeadMinutes', Number(e.target.value))}
                        className="h-8 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2.5 text-xs text-[var(--text-primary)] tabular-nums"
                      >
                        <option value={15}>15 min</option>
                        <option value={30}>30 min</option>
                        <option value={45}>45 min</option>
                        <option value={60}>60 min</option>
                      </select>
                    </div>
                  )}
                  {alertSettings.classReminderEnabled && (
                    <SettingToggleRow
                      label={isTh ? 'เตือนซ้ำ 5 นาทีสุดท้ายก่อนเริ่มคาบ' : 'Final 5-minute reminder'}
                      checked={alertSettings.classReminderFinal5m ?? false}
                      onChange={() => handleToggleSetting?.('classReminderFinal5m')}
                    />
                  )}
                </div>
              </>
            )}

            {activeSection === 'assignments' && (
              <>
                <div className="py-2 grid grid-cols-1 sm:grid-cols-2 gap-x-8">
                  <SettingToggleRow
                    label={isTh ? 'ล่วงหน้า 7 วัน' : '7-day reminder'}
                    checked={alertSettings.due7Days ?? true}
                    onChange={() => handleToggleSetting?.('due7Days')}
                  />
                  <SettingToggleRow
                    label={isTh ? 'ล่วงหน้า 3 วัน' : '3-day reminder'}
                    checked={alertSettings.due3Days ?? true}
                    onChange={() => handleToggleSetting?.('due3Days')}
                  />
                  <SettingToggleRow
                    label={isTh ? 'ล่วงหน้า 1 วัน' : '1-day reminder'}
                    checked={alertSettings.due1Day ?? true}
                    onChange={() => handleToggleSetting?.('due1Day')}
                  />
                  <SettingToggleRow
                    label={isTh ? 'ครบกำหนดวันนี้' : 'Due today'}
                    checked={alertSettings.dueToday ?? true}
                    onChange={() => handleToggleSetting?.('dueToday')}
                  />
                  <SettingToggleRow
                    label={isTh ? 'งานเลยกำหนดส่ง' : 'Overdue catch-up'}
                    checked={alertSettings.overdue1Day ?? true}
                    onChange={() => handleToggleSetting?.('overdue1Day')}
                  />
                  <SettingToggleRow
                    label={isTh ? 'อาจารย์เลื่อนกำหนดส่ง' : 'Deadline changes'}
                    checked={alertSettings.notifyDeadlineChanges ?? true}
                    onChange={() => handleToggleSetting?.('notifyDeadlineChanges')}
                  />
                  <SettingToggleRow
                    label={isTh ? 'งานถูกลบออกจาก Classroom' : 'Removed assignments'}
                    checked={alertSettings.notifyDeletedAssignments ?? true}
                    onChange={() => handleToggleSetting?.('notifyDeletedAssignments')}
                  />
                  <SettingToggleRow
                    label={isTh ? 'ยืนยันเมื่อส่งงานแล้ว' : 'Submission confirmations'}
                    checked={alertSettings.notifySubmissionStatus ?? false}
                    onChange={() => handleToggleSetting?.('notifySubmissionStatus')}
                  />
                </div>

                <div className="py-2 grid grid-cols-1 sm:grid-cols-3 gap-x-6">
                  <SettingToggleRow
                    label={isTh ? 'งานใหม่' : 'New assignments'}
                    checked={alertSettings.newAssignments ?? true}
                    onChange={() => handleToggleSetting?.('newAssignments')}
                  />
                  <SettingToggleRow
                    label={isTh ? 'ประกาศใหม่' : 'New announcements'}
                    checked={alertSettings.newAnnouncements ?? true}
                    onChange={() => handleToggleSetting?.('newAnnouncements')}
                  />
                  <SettingToggleRow
                    label={isTh ? 'เอกสารเรียนใหม่' : 'New materials'}
                    checked={alertSettings.newMaterials ?? true}
                    onChange={() => handleToggleSetting?.('newMaterials')}
                  />
                </div>
              </>
            )}

            {activeSection === 'exams' && (
              <>
                <div className="py-2 space-y-1">
                  <SettingToggleRow
                    label={isTh ? 'นับถอยหลังวันสอบอัตโนมัติ (Exam Countdown)' : 'Examination Countdown'}
                    description={
                      isTh
                        ? 'ดึงข้อมูลรวมจาก SciBase, Reg มจพ. และรายการสอบที่เพิ่มเอง พร้อมห้องและเลขที่นั่ง'
                        : 'Uses merged official SciBase, Reg, and manual exam records with room and seat'
                    }
                    checked={alertSettings.examCountdownEnabled ?? true}
                    onChange={() => handleToggleSetting?.('examCountdownEnabled')}
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
                    <SettingToggleRow
                      label={isTh ? 'ก่อนสอบ 7 วัน' : '7 days before'}
                      checked={alertSettings.exam7Days ?? true}
                      onChange={() => handleToggleSetting?.('exam7Days')}
                    />
                    <SettingToggleRow
                      label={isTh ? 'ก่อนสอบ 3 วัน' : '3 days before'}
                      checked={alertSettings.exam3Days ?? true}
                      onChange={() => handleToggleSetting?.('exam3Days')}
                    />
                    <SettingToggleRow
                      label={isTh ? 'ก่อนสอบ 1 วัน' : '1 day before'}
                      checked={alertSettings.exam1Day ?? true}
                      onChange={() => handleToggleSetting?.('exam1Day')}
                    />
                    <SettingToggleRow
                      label={isTh ? 'เช้าวันสอบ' : 'Examination day'}
                      checked={alertSettings.examToday ?? true}
                      onChange={() => handleToggleSetting?.('examToday')}
                    />
                  </div>
                  <SettingToggleRow
                    label={isTh ? 'แจ้งเมื่อวันสอบหรือห้องสอบเปลี่ยนแปลง' : 'Exam reschedule & room updates'}
                    checked={alertSettings.notifyExamChanges ?? true}
                    onChange={() => handleToggleSetting?.('notifyExamChanges')}
                  />
                </div>

                <div className="py-2 space-y-1">
                  <SettingToggleRow
                    label={isTh ? 'สรุปภาพรวมรายวันช่วงค่ำ (Daily Digest)' : 'Daily evening digest'}
                    checked={alertSettings.dailyDigestEnabled ?? false}
                    onChange={() => handleToggleSetting?.('dailyDigestEnabled')}
                  />
                  {alertSettings.dailyDigestEnabled && (
                    <div className="flex items-center justify-between gap-2 pb-2">
                      <span className="text-xs text-[var(--text-secondary)]">
                        {isTh ? 'เวลาส่งสรุปรายวัน' : 'Daily digest time'}
                      </span>
                      <input
                        type="time"
                        value={alertSettings.dailyDigestTime || '20:00'}
                        onChange={(e) => handleUpdateSetting?.('dailyDigestTime', e.target.value)}
                        className="h-8 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2.5 text-xs font-mono tabular-nums text-[var(--text-primary)]"
                      />
                    </div>
                  )}

                  <SettingToggleRow
                    label={isTh ? 'รายงานสรุปประจำสัปดาห์ (Weekly Digest)' : 'Weekly academic digest'}
                    checked={alertSettings.sundayDigest ?? true}
                    onChange={() => handleToggleSetting?.('sundayDigest')}
                  />
                  {(alertSettings.sundayDigest ?? true) && (
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
                      <span className="text-xs text-[var(--text-secondary)]">
                        {isTh ? 'วันและเวลาส่งรายสัปดาห์' : 'Weekly delivery day & time'}
                      </span>
                      <div className="flex items-center gap-2">
                        <select
                          value={alertSettings.weeklyDigestDay || 'sun'}
                          onChange={(e) => handleUpdateSetting?.('weeklyDigestDay', e.target.value)}
                          className="h-8 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2.5 text-xs text-[var(--text-primary)]"
                        >
                          {DAY_OPTIONS.map((d) => (
                            <option key={d.value} value={d.value}>
                              {isTh ? d.th : d.en}
                            </option>
                          ))}
                        </select>
                        <input
                          type="time"
                          value={alertSettings.weeklyDigestTime || '18:00'}
                          onChange={(e) => {
                            handleUpdateSetting?.('weeklyDigestTime', e.target.value);
                            handleTimeChange?.(e.target.value);
                          }}
                          className="h-8 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2.5 text-xs font-mono tabular-nums text-[var(--text-primary)]"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {activeSection === 'advanced' && (
              <div className="divide-y divide-[var(--border)]">
                <div className="py-4 space-y-2">
                  <label className="block text-xs font-medium text-[var(--text-primary)]">
                    {isTh ? 'ตัวส่งแจ้งเตือนอัตโนมัติหลัก (ป้องกันส่งซ้ำ)' : 'Automated delivery authority'}
                  </label>
                  <select
                    data-testid="delivery-authority-select"
                    value={alertSettings.deliveryAuthority || 'browser'}
                    onChange={(e) => handleUpdateSetting?.('deliveryAuthority', e.target.value)}
                    className="h-9 w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 text-xs text-[var(--text-primary)]"
                  >
                    <option value="browser">
                      {isTh
                        ? 'เบราว์เซอร์เมื่อเปิดเว็บ (ค่าเริ่มต้น)'
                        : 'Browser workspace sync (default)'}
                    </option>
                    <option value="apps_script">
                      {isTh
                        ? 'Google Apps Script 24 ชม. เท่านั้น (ปิดการยิงอัตโนมัติซ้ำจากหน้าเว็บ)'
                        : '24/7 Google Apps Script only (pauses duplicate browser auto-sends)'}
                    </option>
                  </select>
                </div>

                <div className="py-1">
                  <SettingToggleRow
                    label={isTh ? 'ซิงก์ลิงก์ Webhook ข้ามอุปกรณ์ผ่าน Google Drive ส่วนตัว' : 'Sync Webhook URL across devices via private Google Drive'}
                    description={
                      isTh
                        ? 'ปิดตัวเลือกนี้หากต้องการเก็บความลับ Webhook ไว้เฉพาะบนเบราว์เซอร์เครื่องนี้เท่านั้น'
                        : 'Disable to keep your Discord Webhook secret strictly on this device only'
                    }
                    checked={alertSettings.syncWebhookToDrive ?? true}
                    onChange={() => handleToggleSetting?.('syncWebhookToDrive')}
                    testId="toggle-sync-webhook-drive"
                  />
                </div>

                <div className="py-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-[var(--text-secondary)]">
                      {isTh ? 'เขตเวลา (Timezone)' : 'Timezone'}
                    </label>
                    <select
                      value={alertSettings.timezone || 'Asia/Bangkok'}
                      onChange={(e) => handleUpdateSetting?.('timezone', e.target.value)}
                      className="h-9 w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2.5 text-xs text-[var(--text-primary)]"
                    >
                      {TIMEZONE_OPTIONS.map((tz) => (
                        <option key={tz} value={tz}>
                          {tz}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-[var(--text-secondary)]">
                      {isTh ? 'ความสำคัญขั้นต่ำ' : 'Minimum priority'}
                    </label>
                    <select
                      value={alertSettings.minPriority || 'P3'}
                      onChange={(e) => handleUpdateSetting?.('minPriority', e.target.value)}
                      className="h-9 w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2.5 text-xs text-[var(--text-primary)]"
                    >
                      <option value="P3">{isTh ? 'P3 — ทั้งหมดและสรุปผล' : 'P3 — All & digests'}</option>
                      <option value="P2">{isTh ? 'P2 — ทั่วไปขึ้นไป' : 'P2 — Normal & above'}</option>
                      <option value="P1">{isTh ? 'P1 — สำคัญมากเท่านั้น' : 'P1 — High & critical'}</option>
                      <option value="P0">{isTh ? 'P0 — วิกฤตเท่านั้น' : 'P0 — Critical only'}</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-[var(--text-secondary)]">
                      {isTh ? 'จำนวนส่งซ้ำสูงสุด' : 'Max retries'}
                    </label>
                    <select
                      value={alertSettings.maxRetries ?? 3}
                      onChange={(e) => handleUpdateSetting?.('maxRetries', Number(e.target.value))}
                      className="h-9 w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2.5 text-xs text-[var(--text-primary)] tabular-nums"
                    >
                      {[0, 1, 2, 3, 4, 5].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="py-1 space-y-1">
                  <SettingToggleRow
                    label={isTh ? 'โหมดห้ามรบกวน (Quiet Hours)' : 'Quiet hours'}
                    description={
                      isTh
                        ? 'เลื่อนการแจ้งเตือนทั่วไปออกไประหว่างช่วงเวลาพักผ่อน'
                        : 'Defer non-critical notifications during rest hours'
                    }
                    checked={alertSettings.quietHoursEnabled ?? false}
                    onChange={() => handleToggleSetting?.('quietHoursEnabled')}
                    testId="toggle-quiet-hours"
                  />
                  {alertSettings.quietHoursEnabled && (
                    <div className="pb-2 space-y-2">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="text-[var(--text-secondary)]">
                          {isTh ? 'ตั้งแต่' : 'From'}
                        </span>
                        <input
                          type="time"
                          value={alertSettings.quietHoursStart || '22:00'}
                          onChange={(e) => handleUpdateSetting?.('quietHoursStart', e.target.value)}
                          className="h-8 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2.5 text-xs font-mono tabular-nums text-[var(--text-primary)]"
                        />
                        <span className="text-[var(--text-secondary)]">
                          {isTh ? 'ถึง' : 'to'}
                        </span>
                        <input
                          type="time"
                          value={alertSettings.quietHoursEnd || '06:30'}
                          onChange={(e) => handleUpdateSetting?.('quietHoursEnd', e.target.value)}
                          className="h-8 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2.5 text-xs font-mono tabular-nums text-[var(--text-primary)]"
                        />
                      </div>
                      <SettingToggleRow
                        label={isTh ? 'อนุญาตแจ้งเตือนระดับวิกฤต (P0: วันสอบ/กำหนดส่งวันนี้)' : 'Allow P0 critical alerts during quiet hours'}
                        checked={alertSettings.quietHoursAllowCritical ?? true}
                        onChange={() => handleToggleSetting?.('quietHoursAllowCritical')}
                      />
                    </div>
                  )}
                </div>

                {/* Quiet Optional 24/7 Cloud Script Disclosure (Tucked inside Advanced only) */}
                <div className="py-3 space-y-3">
                  <button
                    type="button"
                    data-testid="toggle-optional-cloud-script"
                    onClick={() => setShowCloudSetup((prev) => !prev)}
                    className="w-full flex items-center justify-between gap-3 py-1 text-left cursor-pointer group"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Terminal size={14} strokeWidth={1.5} className="text-[var(--text-muted)] shrink-0" />
                      <span className="text-xs font-medium text-[var(--text-secondary)] group-hover:text-[var(--text-heading)] transition-colors truncate">
                        {isTh
                          ? 'ตัวเลือกเสริม: ตั้งค่าสคริปต์รันบนคลาวด์ตอนปิดคอม (24/7 Apps Script)'
                          : 'Optional: 24/7 Google Apps Script setup (when PC is off)'}
                      </span>
                    </div>
                    {showCloudSetup || alertSettings.deliveryAuthority === 'apps_script' ? (
                      <ChevronUp size={14} strokeWidth={1.5} className="text-[var(--text-muted)] shrink-0" />
                    ) : (
                      <ChevronDown size={14} strokeWidth={1.5} className="text-[var(--text-muted)] shrink-0" />
                    )}
                  </button>

                  {(showCloudSetup || alertSettings.deliveryAuthority === 'apps_script') && (
                    <div className="pt-1">
                      <CloudScriptPanel
                        lang={lang}
                        hiddenCourseCount={hiddenCourseIds.length}
                        embedWebhookInScript={Boolean(alertSettings.embedWebhookInScript)}
                        onToggleEmbedWebhook={() => handleToggleSetting?.('embedWebhookInScript')}
                        generatedAppsScript={generatedAppsScript}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Live Discord Embed Preview (Clean, zero Cloud Script clutter) */}
        <div>
          <DiscordLivePreview
            lang={lang}
            selectedMode={previewMode}
            onSelectMode={setPreviewMode}
            alertSettings={alertSettings}
            currentAssignments={currentAssignments}
            currentSchedule={currentSchedule}
            mergedExams={mergedExams}
            webhookValid={webhookValidation.valid}
            busyAction={busyAction}
            onSendSelectedPreview={handleSendSelectedPreview}
            onSendFullDigest={() =>
              runPreviewOrTest(
                'digest',
                (url) => triggerManualDiscordDigest(activeUserEmail, currentAssignments, url),
                'Pending assignments & exam digest sent to Discord',
                'ส่งสรุปงานค้างและตารางสอบเข้า Discord เรียบร้อยแล้ว'
              )
            }
          />
        </div>
      </div>
    </section>
  );
}
