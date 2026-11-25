import { useState, useRef, useEffect, useId, useMemo } from 'react';
import {
  MessageSquare,
  RefreshCw,
  Send,
  Terminal,
  Copy,
  Check,
  ExternalLink,
  Clock,
  Calendar,
  BookOpen,
  GraduationCap,
  Sliders,
  AlertCircle,
  History
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
import { getAppsScriptTemplate } from '../utils/appsScriptTemplate';
import { getMergedExams } from '../utils/examMerger';
import { examRepository } from '../repositories/examRepository';
import { syncManager } from '../services/SyncManager';
import { NotificationLedger } from '../services/notifications/NotificationLedger';
import DiscordWebhookInput from './DiscordWebhookInput';

const SECTION_TABS = [
  { id: 'schedule', icon: Calendar, en: 'Schedule & Briefing', th: 'ตารางเรียน & สรุปเช้า' },
  { id: 'assignments', icon: BookOpen, en: 'Assignments & Activity', th: 'การบ้าน & ความเคลื่อนไหว' },
  { id: 'exams', icon: GraduationCap, en: 'Exams & Digests', th: 'การสอบ & รายงานสรุป' },
  { id: 'advanced', icon: Sliders, en: 'Advanced', th: 'ขั้นสูง' }
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
    <label className="flex items-start justify-between gap-3 py-2.5 cursor-pointer select-none">
      <div className="min-w-0 space-y-0.5">
        <span className="block text-xs font-medium text-[var(--text-primary)]">{label}</span>
        {description && (
          <span className="block text-[11px] text-[var(--text-muted)] leading-snug">{description}</span>
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
        <div className="w-8 h-4 bg-[var(--border)] rounded-full peer peer-checked:after:translate-x-4 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[var(--text-heading)] after:rounded-full after:h-3 after:w-3 after:transition-transform peer-checked:bg-[var(--primary)]" />
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
  handleToggleSetting,
  handleUpdateSetting,
  handleTimeChange,
  refreshNotificationData
}) {
  const isTh = lang === 'th';
  const webhookFieldId = useId();
  const [activeSection, setActiveSection] = useState('schedule');
  const [busyAction, setBusyAction] = useState('');
  const [feedback, setFeedback] = useState({ text: '', type: '' });
  const [showScriptPreview, setShowScriptPreview] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [showRecentHistory, setShowRecentHistory] = useState(false);
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
        examCountdownEnabled: Boolean(alertSettings.examCountdownEnabled ?? true),
        exam7Days: Boolean(alertSettings.exam7Days ?? true),
        exam3Days: Boolean(alertSettings.exam3Days ?? true),
        exam1Day: Boolean(alertSettings.exam1Day ?? true),
        examToday: Boolean(alertSettings.examToday ?? true),
        sundayDigest: Boolean(alertSettings.sundayDigest ?? true),
        weeklyDigestTime: alertSettings.weeklyDigestTime || '18:00',
        quietHoursEnabled: Boolean(alertSettings.quietHoursEnabled ?? false),
        quietHoursStart: alertSettings.quietHoursStart || '22:00',
        quietHoursEnd: alertSettings.quietHoursEnd || '06:30',
        quietHoursAllowCritical: Boolean(alertSettings.quietHoursAllowCritical ?? true),
        timezone: alertSettings.timezone || 'Asia/Bangkok',
        maxRetries: alertSettings.maxRetries ?? 2,
        schedule: currentSchedule,
        mergedExams
      }),
    [hiddenCourseIds, alertSettings, currentSchedule, mergedExams]
  );

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
      setFeedback({
        text: isTh ? 'ไม่สามารถคัดลอกอัตโนมัติได้ กรุณากดดูโค้ดด้านล่าง' : 'Could not copy automatically. Open preview below',
        type: 'error'
      });
    }
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
        return { dot: 'bg-emerald-400', text: isTh ? 'ส่งสำเร็จปกติ' : 'Healthy' };
      case 'retrying':
        return { dot: 'bg-amber-400', text: isTh ? 'กำลังลองส่งซ้ำ' : 'Retrying' };
      case 'ambiguous':
        return { dot: 'bg-amber-400', text: isTh ? 'หมดเวลา (หยุดส่งซ้ำป้องกันข้อความเบิ้ล)' : 'Timeout (auto-retry paused)' };
      case 'failed':
        return { dot: 'bg-rose-400', text: isTh ? 'พบข้อผิดพลาดล่าสุด' : 'Delivery error' };
      default:
        return { dot: 'bg-[var(--text-muted)]', text: isTh ? 'พร้อมรอส่ง' : 'Standby' };
    }
  })();

  const isAnySending = Boolean(busyAction);

  return (
    <section
      id="discord-assistant-panel"
      aria-label={isTh ? 'ผู้ช่วยแจ้งเตือน Discord' : 'Discord Academic Assistant'}
      className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden"
    >
      {/* Top Card Header */}
      <div className="px-5 py-4 border-b border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[var(--app-bg)] border border-[var(--border)] flex items-center justify-center shrink-0">
            <MessageSquare className="text-[var(--text-secondary)]" size={16} strokeWidth={1.5} />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-medium text-[var(--text-heading)]">
              {isTh ? 'ผู้ช่วยแจ้งเตือน Discord' : 'Discord Academic Assistant'}
            </h3>
            <p className="text-xs text-[var(--text-muted)]">
              {isTh
                ? 'สรุปตารางเช้า การบ้านใกล้ส่ง นับถอยหลังวันสอบ และสคริปต์รัน 24 ชม.'
                : 'Morning briefing, coursework deadlines, exam countdown, and 24/7 cloud sync'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0 self-start sm:self-auto">
          <span
            data-testid="discord-webhook-status"
            className={`text-[11px] px-2.5 py-1 rounded-lg font-medium whitespace-nowrap ${
              webhookValidation.valid
                ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/25'
                : (alertSettings.discordWebhookUrl || '').trim()
                  ? 'bg-rose-500/10 text-rose-300 border border-rose-500/25'
                  : 'bg-[var(--app-bg)] text-[var(--text-muted)] border border-[var(--border)]'
            }`}
          >
            {webhookValidation.valid
              ? (isTh ? 'พร้อมใช้งาน' : 'Webhook Ready')
              : (alertSettings.discordWebhookUrl || '').trim()
                ? (isTh ? 'ลิงก์ไม่ถูกต้อง' : 'Invalid URL')
                : (isTh ? 'ยังไม่ตั้งค่า' : 'Not Configured')}
          </span>

          <label
            className="relative inline-flex items-center cursor-pointer select-none"
            title={isTh ? 'เปิดใช้งานระบบแจ้งเตือน Discord' : 'Enable Discord notifications'}
          >
            <input
              type="checkbox"
              checked={Boolean(alertSettings.discordEnabled)}
              onChange={() => handleToggleSetting?.('discordEnabled')}
              aria-label={isTh ? 'ส่งแจ้งเตือนเข้า Discord อัตโนมัติ' : 'Auto-send alerts to Discord when syncing on web'}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-[var(--border)] rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[var(--text-heading)] after:rounded-full after:h-4 after:w-4 after:transition-transform peer-checked:bg-[var(--primary)]" />
          </label>
        </div>
      </div>

      {/* Balanced Two-Pane Desktop Body */}
      <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-[var(--border)]">
        {/* Left Pane: Connection, Telemetry, Previews & Cloud Script Trigger */}
        <div className="lg:col-span-5 p-5 flex flex-col justify-between gap-4 min-w-0">
          <div className="space-y-4">
            {feedback.text && (
              <div
                role={feedback.type === 'error' ? 'alert' : 'status'}
                className={`px-3 py-2 rounded-lg border text-xs flex items-center justify-between gap-2 ${
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

            {/* Webhook Input */}
            <div className="space-y-1.5">
              <label htmlFor={webhookFieldId} className="block text-[11px] font-medium text-[var(--text-secondary)]">
                {isTh ? 'ลิงก์ Discord Webhook' : 'Webhook URL'}
              </label>
              <DiscordWebhookInput
                id={webhookFieldId}
                value={alertSettings.discordWebhookUrl || ''}
                onChange={(nextVal) => handleUpdateSetting?.('discordWebhookUrl', nextVal)}
                lang={lang}
              />
            </div>

            {/* Delivery Telemetry Strip */}
            <div
              data-testid="discord-delivery-telemetry"
              className="bg-[var(--app-bg)] border border-[var(--border)] rounded-lg px-3 py-2.5 space-y-2"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <div className="inline-flex items-center gap-2 text-[var(--text-primary)] font-medium">
                  <span className={`w-1.5 h-1.5 rounded-full ${deliveryStatusMeta.dot}`} />
                  <span>{deliveryStatusMeta.text}</span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-[var(--text-muted)] tabular-nums">
                  <span>
                    {isTh ? 'ล่าสุด: ' : 'Last: '}
                    <strong className="font-medium text-[var(--text-secondary)]">
                      {formatTelemetryTime(telemetry?.lastSuccessAt, lang)}
                    </strong>
                  </span>
                  <span>
                    {isTh ? 'รวม: ' : 'Sent: '}
                    <strong className="font-medium text-[var(--text-secondary)]">
                      {telemetry?.totalDelivered || 0}
                    </strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowRecentHistory((v) => !v)}
                    className="inline-flex items-center gap-1 text-[var(--text-secondary)] hover:text-[var(--text-heading)] transition-colors cursor-pointer"
                  >
                    <History size={12} strokeWidth={1.5} />
                    <span>{isTh ? 'ประวัติ' : 'History'}</span>
                  </button>
                </div>
              </div>

              {telemetry?.lastErrorMessage && telemetry.lastStatus !== 'delivered' && (
                <div className="flex items-start gap-2 pt-1.5 border-t border-[var(--border)] text-[11px] text-rose-300">
                  <AlertCircle size={13} strokeWidth={1.5} className="shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <span className="font-medium">
                      {isTh ? `ข้อผิดพลาด (${telemetry.consecutiveFailures || 1} ครั้ง): ` : `Last error (${telemetry.consecutiveFailures || 1}x): `}
                    </span>
                    <span className="break-words">{telemetry.lastErrorMessage}</span>
                  </div>
                </div>
              )}

              {showRecentHistory && (
                <div className="pt-2 border-t border-[var(--border)] space-y-1.5 max-h-32 overflow-y-auto">
                  {discordHistory.length > 0 ? (
                    discordHistory.map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="text-[var(--text-secondary)] truncate">{item.title}</span>
                        <span className="text-[var(--text-muted)] font-mono tabular-nums shrink-0">
                          {formatTelemetryTime(item.sentAt, lang)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-[11px] text-[var(--text-muted)]">
                      {isTh ? 'ยังไม่มีประวัติการแจ้งเตือน Discord' : 'No Discord deliveries recorded yet'}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Primary Actions & Live Previews */}
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                  className="h-9 bg-[var(--surface-elevated)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] border border-[var(--border)] px-3 rounded-lg text-xs font-medium transition-colors cursor-pointer disabled:opacity-45 flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  {busyAction === 'test' ? (
                    <RefreshCw size={14} strokeWidth={1.5} className="animate-spin shrink-0" />
                  ) : (
                    <MessageSquare size={14} strokeWidth={1.5} className="text-[var(--text-secondary)] shrink-0" />
                  )}
                  <span className="truncate">
                    {busyAction === 'test'
                      ? (isTh ? 'กำลังทดสอบ...' : 'Testing...')
                      : (isTh ? 'ยิงข้อความทดสอบเข้า Discord' : 'Test Discord Webhook')}
                  </span>
                </button>

                <button
                  type="button"
                  disabled={isAnySending || !webhookValidation.valid}
                  onClick={() =>
                    runPreviewOrTest(
                      'digest',
                      (url) => triggerManualDiscordDigest(activeUserEmail, currentAssignments, url),
                      'Pending assignments & exam digest sent to Discord',
                      'ส่งสรุปงานค้างและตารางสอบเข้า Discord เรียบร้อยแล้ว'
                    )
                  }
                  className="h-9 bg-[var(--app-bg)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] border border-[var(--border)] px-3 rounded-lg text-xs font-medium transition-colors cursor-pointer disabled:opacity-45 flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  {busyAction === 'digest' ? (
                    <RefreshCw size={14} strokeWidth={1.5} className="animate-spin shrink-0" />
                  ) : (
                    <Send size={14} strokeWidth={1.5} className="text-[var(--text-secondary)] shrink-0" />
                  )}
                  <span className="truncate">
                    {busyAction === 'digest'
                      ? (isTh ? 'กำลังส่ง...' : 'Sending...')
                      : (isTh ? 'ส่งสรุปงาน + ตารางสอบ' : 'Send Task & Exam Digest')}
                  </span>
                </button>
              </div>

              <div className="space-y-1.5">
                <span className="block text-[11px] font-medium text-[var(--text-muted)]">
                  {isTh ? 'ส่งตัวอย่างทดสอบรายหมวด' : 'Live message previews'}
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    data-testid="preview-morning-briefing-btn"
                    disabled={isAnySending || !webhookValidation.valid}
                    onClick={() =>
                      runPreviewOrTest(
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
                      )
                    }
                    className="h-8 bg-[var(--app-bg)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)] px-2.5 rounded-lg text-[11px] font-medium transition-colors cursor-pointer disabled:opacity-45 truncate"
                  >
                    {busyAction === 'morning'
                      ? (isTh ? 'กำลังส่ง...' : 'Sending...')
                      : (isTh ? 'ตัวอย่างสรุปเช้า' : 'Briefing Preview')}
                  </button>

                  <button
                    type="button"
                    data-testid="preview-assignment-btn"
                    disabled={isAnySending || !webhookValidation.valid}
                    onClick={() =>
                      runPreviewOrTest(
                        'assignment',
                        (url) => triggerAssignmentReminderPreview(activeUserEmail, currentAssignments, url),
                        'Assignment Reminder preview delivered to Discord',
                        'ส่งตัวอย่างแจ้งเตือนการบ้านเข้า Discord แล้ว'
                      )
                    }
                    className="h-8 bg-[var(--app-bg)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)] px-2.5 rounded-lg text-[11px] font-medium transition-colors cursor-pointer disabled:opacity-45 truncate"
                  >
                    {busyAction === 'assignment'
                      ? (isTh ? 'กำลังส่ง...' : 'Sending...')
                      : (isTh ? 'ตัวอย่างการบ้าน' : 'Assignment Preview')}
                  </button>

                  <button
                    type="button"
                    data-testid="preview-exam-btn"
                    disabled={isAnySending || !webhookValidation.valid}
                    onClick={() =>
                      runPreviewOrTest(
                        'exam',
                        (url) => triggerExamCountdownPreview(activeUserEmail, url),
                        'Exam Countdown preview delivered to Discord',
                        'ส่งตัวอย่างนับถอยหลังสอบเข้า Discord แล้ว'
                      )
                    }
                    className="h-8 bg-[var(--app-bg)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)] px-2.5 rounded-lg text-[11px] font-medium transition-colors cursor-pointer disabled:opacity-45 truncate"
                  >
                    {busyAction === 'exam'
                      ? (isTh ? 'กำลังส่ง...' : 'Sending...')
                      : (isTh ? 'ตัวอย่างวันสอบ' : 'Exam Preview')}
                  </button>

                  <button
                    type="button"
                    data-testid="preview-weekly-btn"
                    disabled={isAnySending || !webhookValidation.valid}
                    onClick={() =>
                      runPreviewOrTest(
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
                      )
                    }
                    className="h-8 bg-[var(--app-bg)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)] px-2.5 rounded-lg text-[11px] font-medium transition-colors cursor-pointer disabled:opacity-45 truncate"
                  >
                    {busyAction === 'weekly'
                      ? (isTh ? 'กำลังส่ง...' : 'Sending...')
                      : (isTh ? 'ตัวอย่างรายสัปดาห์' : 'Weekly Preview')}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 24/7 Google Apps Script Footer inside Left Pane */}
          <div className="pt-3.5 border-t border-[var(--border)] flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
              <Terminal size={13} strokeWidth={1.5} className="text-[var(--text-muted)] shrink-0" />
              <span className="tabular-nums">
                {isTh
                  ? `สคริปต์ 24 ชม. (ซ่อน ${hiddenCourseIds.length} วิชา)`
                  : `24/7 Cloud Script (${hiddenCourseIds.length} hidden)`}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleCopyAppsScript}
                className="h-8 bg-[var(--app-bg)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] border border-[var(--border)] px-2.5 rounded-lg text-[11px] font-medium transition-colors cursor-pointer inline-flex items-center gap-1.5"
              >
                {copiedScript ? (
                  <Check size={12} strokeWidth={1.5} className="text-emerald-400" />
                ) : (
                  <Copy size={12} strokeWidth={1.5} className="text-[var(--text-muted)]" />
                )}
                <span>
                  {copiedScript
                    ? (isTh ? 'คัดลอกแล้ว' : 'Copied')
                    : (isTh ? 'คัดลอกโค้ด' : 'Copy Script')}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setShowScriptPreview((prev) => !prev)}
                className="h-8 bg-[var(--app-bg)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-heading)] border border-[var(--border)] px-2.5 rounded-lg text-[11px] font-medium transition-colors cursor-pointer"
              >
                {showScriptPreview
                  ? (isTh ? 'ซ่อนโค้ด' : 'Hide Code')
                  : (isTh ? 'ดูโค้ดและวิธีตั้งค่า' : 'View Code & Debug Guide')}
              </button>

              <a
                href="https://script.google.com"
                target="_blank"
                rel="noopener noreferrer"
                title="Open script.google.com"
                className="h-8 w-8 inline-flex items-center justify-center rounded-lg bg-[var(--app-bg)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-heading)] transition-colors"
              >
                <ExternalLink size={12} strokeWidth={1.5} />
              </a>
            </div>
          </div>
        </div>

        {/* Right Pane: Rule Configuration Tabs */}
        <div className="lg:col-span-7 p-5 flex flex-col gap-3 min-w-0">
          <div className="border border-[var(--border)] rounded-xl bg-[var(--app-bg)] overflow-hidden flex-1 flex flex-col">
            <div className="grid grid-cols-2 sm:grid-cols-4 border-b border-[var(--border)] bg-[var(--surface)]">
              {SECTION_TABS.map((tab) => {
                const Icon = tab.icon;
                const active = activeSection === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveSection(tab.id)}
                    className={`flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                      active
                        ? 'bg-[var(--app-bg)] text-[var(--text-heading)] border-b-2 border-[var(--primary)]'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                    }`}
                  >
                    <Icon size={14} strokeWidth={1.5} className="shrink-0" />
                    <span className="truncate">{isTh ? tab.th : tab.en}</span>
                  </button>
                );
              })}
            </div>

            <div className="p-4 divide-y divide-[var(--border)] flex-1">
              {activeSection === 'schedule' && (
                <>
                  <div className="pb-3 space-y-2">
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
                      <div className="flex flex-wrap items-center justify-between gap-2 pl-3 pt-1">
                        <span className="text-[11px] text-[var(--text-secondary)] inline-flex items-center gap-1.5">
                          <Clock size={12} strokeWidth={1.5} />
                          <span>{isTh ? 'เวลาส่งสรุปเช้า' : 'Delivery time'}</span>
                        </span>
                        <input
                          type="time"
                          aria-label={isTh ? 'เวลาส่งสรุปเช้า' : 'Morning Briefing delivery time'}
                          value={alertSettings.morningBriefingTime || '07:00'}
                          onChange={(e) => handleUpdateSetting?.('morningBriefingTime', e.target.value)}
                          className="bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2.5 py-1 text-xs font-mono tabular-nums text-[var(--text-primary)]"
                        />
                      </div>
                    )}
                    <SettingToggleRow
                      label={isTh ? 'ส่งสรุปในวันที่ไม่มีคาบเรียน (เมื่อมีงานค้าง/สอบ)' : 'Include no-class days when tasks or exams exist'}
                      checked={alertSettings.morningBriefingSendOnFreeDays ?? true}
                      onChange={() => handleToggleSetting?.('morningBriefingSendOnFreeDays')}
                    />
                  </div>

                  <div className="pt-3 space-y-2">
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
                      <div className="flex flex-wrap items-center justify-between gap-2 pl-3 pt-1">
                        <span className="text-[11px] text-[var(--text-secondary)]">
                          {isTh ? 'แจ้งล่วงหน้า' : 'Lead time'}
                        </span>
                        <select
                          value={alertSettings.classReminderLeadMinutes ?? 30}
                          onChange={(e) => handleUpdateSetting?.('classReminderLeadMinutes', Number(e.target.value))}
                          className="bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2.5 py-1 text-xs text-[var(--text-primary)] tabular-nums"
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
                  <div className="pb-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6">
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

                  <div className="pt-3 grid grid-cols-1 sm:grid-cols-3 gap-x-6">
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
                  <div className="pb-3 space-y-1">
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
                    <div className="grid grid-cols-2 gap-x-6 pl-2">
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

                  <div className="pt-3 space-y-2">
                    <SettingToggleRow
                      label={isTh ? 'สรุปภาพรวมรายวันช่วงค่ำ (Daily Digest)' : 'Daily evening digest'}
                      checked={alertSettings.dailyDigestEnabled ?? false}
                      onChange={() => handleToggleSetting?.('dailyDigestEnabled')}
                    />
                    {alertSettings.dailyDigestEnabled && (
                      <div className="flex items-center justify-between gap-2 pl-3">
                        <span className="text-[11px] text-[var(--text-secondary)]">
                          {isTh ? 'เวลาส่งสรุปรายวัน' : 'Daily digest time'}
                        </span>
                        <input
                          type="time"
                          value={alertSettings.dailyDigestTime || '20:00'}
                          onChange={(e) => handleUpdateSetting?.('dailyDigestTime', e.target.value)}
                          className="bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2.5 py-1 text-xs font-mono tabular-nums text-[var(--text-primary)]"
                        />
                      </div>
                    )}

                    <SettingToggleRow
                      label={isTh ? 'รายงานสรุปประจำสัปดาห์ (Weekly Digest)' : 'Weekly academic digest'}
                      checked={alertSettings.sundayDigest ?? true}
                      onChange={() => handleToggleSetting?.('sundayDigest')}
                    />
                    {(alertSettings.sundayDigest ?? true) && (
                      <div className="flex flex-wrap items-center justify-between gap-2 pl-3">
                        <span className="text-[11px] text-[var(--text-secondary)]">
                          {isTh ? 'วันและเวลาส่งรายสัปดาห์' : 'Weekly delivery day & time'}
                        </span>
                        <div className="flex items-center gap-2">
                          <select
                            value={alertSettings.weeklyDigestDay || 'sun'}
                            onChange={(e) => handleUpdateSetting?.('weeklyDigestDay', e.target.value)}
                            className="bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2 py-1 text-xs text-[var(--text-primary)]"
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
                            className="bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2.5 py-1 text-xs font-mono tabular-nums text-[var(--text-primary)]"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {activeSection === 'advanced' && (
                <div className="space-y-3">
                  {/* Automated Delivery Authority */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-[var(--text-primary)]">
                      {isTh ? 'ตัวส่งแจ้งเตือนอัตโนมัติหลัก (ป้องกันส่งซ้ำ)' : 'Automated delivery authority'}
                    </label>
                    <select
                      data-testid="delivery-authority-select"
                      value={alertSettings.deliveryAuthority || 'browser'}
                      onChange={(e) => handleUpdateSetting?.('deliveryAuthority', e.target.value)}
                      className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-primary)]"
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

                  {/* Timezone & Priority & Retry */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-[var(--border)]">
                    <div className="space-y-1">
                      <label className="block text-[11px] font-medium text-[var(--text-secondary)]">
                        {isTh ? 'เขตเวลา (Timezone)' : 'Timezone'}
                      </label>
                      <select
                        value={alertSettings.timezone || 'Asia/Bangkok'}
                        onChange={(e) => handleUpdateSetting?.('timezone', e.target.value)}
                        className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-primary)]"
                      >
                        {TIMEZONE_OPTIONS.map((tz) => (
                          <option key={tz} value={tz}>
                            {tz}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[11px] font-medium text-[var(--text-secondary)]">
                        {isTh ? 'ระดับความสำคัญขั้นต่ำ' : 'Minimum priority'}
                      </label>
                      <select
                        value={alertSettings.minPriority || 'P3'}
                        onChange={(e) => handleUpdateSetting?.('minPriority', e.target.value)}
                        className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-primary)]"
                      >
                        <option value="P3">{isTh ? 'P3 — ทั้งหมดและสรุปรายวัน' : 'P3 — All & digests'}</option>
                        <option value="P2">{isTh ? 'P2 — ทั่วไปขึ้นไป' : 'P2 — Normal & above'}</option>
                        <option value="P1">{isTh ? 'P1 — สำคัญมากเท่านั้น' : 'P1 — High & critical'}</option>
                        <option value="P0">{isTh ? 'P0 — วิกฤตเท่านั้น' : 'P0 — Critical only'}</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[11px] font-medium text-[var(--text-secondary)]">
                        {isTh ? 'จำนวนส่งซ้ำเมื่อขัดข้อง' : 'Max retries'}
                      </label>
                      <select
                        value={alertSettings.maxRetries ?? 3}
                        onChange={(e) => handleUpdateSetting?.('maxRetries', Number(e.target.value))}
                        className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-primary)] tabular-nums"
                      >
                        {[0, 1, 2, 3, 4, 5].map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Quiet Hours */}
                  <div className="pt-2 border-t border-[var(--border)] space-y-2">
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
                      <div className="space-y-2 pl-2">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="text-[11px] text-[var(--text-secondary)]">
                            {isTh ? 'ตั้งแต่' : 'From'}
                          </span>
                          <input
                            type="time"
                            value={alertSettings.quietHoursStart || '22:00'}
                            onChange={(e) => handleUpdateSetting?.('quietHoursStart', e.target.value)}
                            className="bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2 py-1 text-xs font-mono tabular-nums text-[var(--text-primary)]"
                          />
                          <span className="text-[11px] text-[var(--text-secondary)]">
                            {isTh ? 'ถึง' : 'to'}
                          </span>
                          <input
                            type="time"
                            value={alertSettings.quietHoursEnd || '06:30'}
                            onChange={(e) => handleUpdateSetting?.('quietHoursEnd', e.target.value)}
                            className="bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2 py-1 text-xs font-mono tabular-nums text-[var(--text-primary)]"
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
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Full-Width Collapsible 24/7 Google Apps Script Code Drawer */}
      {showScriptPreview && (
        <div className="px-5 pb-5 pt-4 border-t border-[var(--border)] bg-[var(--app-bg)]/50 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-[11px] text-[var(--text-muted)]">
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-3">
              <code className="block text-[var(--text-primary)] font-medium mb-1">1. Script Properties</code>
              <span>
                {isTh
                  ? 'เก็บ DISCORD_WEBHOOK_URL ใน Project Settings เพื่อไม่ให้รหัส Webhook อยู่ในโค้ด'
                  : 'Save DISCORD_WEBHOOK_URL in Project Settings so your webhook secret stays out of source code'}
              </span>
            </div>
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-3">
              <code className="block text-[var(--text-primary)] font-medium mb-1">2. Services (+)</code>
              <span>
                {isTh
                  ? 'เปิด Google Classroom API และ Google Calendar API สำหรับดึงตารางเรียนและวันสอบ'
                  : 'Enable Google Classroom API and Google Calendar API for live timetable & exam seating sync'}
              </span>
            </div>
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-3">
              <code className="block text-[var(--text-primary)] font-medium mb-1">3. Time-driven Trigger</code>
              <span>
                {isTh
                  ? 'ตั้งทริกเกอร์ให้ฟังก์ชัน sendClassroomDigest() รันรายชั่วโมง หรือทุก 15 นาที'
                  : 'Schedule sendClassroomDigest() to run hourly or every 15 minutes'}
              </span>
            </div>
          </div>

          <label className="flex items-center gap-2 text-[11px] text-[var(--text-secondary)] cursor-pointer select-none">
            <input
              type="checkbox"
              data-testid="embed-webhook-in-script-toggle"
              checked={Boolean(alertSettings.embedWebhookInScript)}
              onChange={() => handleToggleSetting?.('embedWebhookInScript')}
              className="w-3.5 h-3.5 rounded accent-[var(--primary)] cursor-pointer"
            />
            <span>
              {isTh
                ? 'ฝังลิงก์ Webhook ลงในโค้ดโดยตรง (ห้ามแชร์ไฟล์โค้ดให้ผู้อื่น)'
                : 'Embed Webhook URL directly in copied script (do not share generated code publicly)'}
            </span>
          </label>

          <textarea
            readOnly
            aria-label={isTh ? 'โค้ด Google Apps Script' : 'Generated Google Apps Script Code'}
            value={generatedAppsScript}
            rows={8}
            className="w-full bg-[var(--app-bg)] border border-[var(--border)] rounded-lg p-3 text-[11px] font-mono text-[var(--text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
          />
        </div>
      )}
    </section>
  );
}
