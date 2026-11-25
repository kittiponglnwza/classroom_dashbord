import { useMemo } from 'react';
import { Send, RefreshCw, ClipboardList } from 'lucide-react';

const PREVIEW_MODES = [
  {
    id: 'morning',
    testId: 'preview-mode-morning',
    en: 'Briefing',
    th: 'สรุปเช้า',
    accentHex: '#3794FF'
  },
  {
    id: 'assignment',
    testId: 'preview-mode-assignment',
    en: 'Assignment',
    th: 'การบ้าน',
    accentHex: '#E5A93B'
  },
  {
    id: 'exam',
    testId: 'preview-mode-exam',
    en: 'Exam',
    th: 'วันสอบ',
    accentHex: '#E5484D'
  },
  {
    id: 'weekly',
    testId: 'preview-mode-weekly',
    en: 'Weekly',
    th: 'รายสัปดาห์',
    accentHex: '#4CC38A'
  }
];

export default function DiscordLivePreview({
  lang = 'en',
  selectedMode = 'morning',
  onSelectMode,
  alertSettings = {},
  currentAssignments = [],
  currentSchedule = [],
  mergedExams = [],
  webhookValid = false,
  busyAction = '',
  onSendSelectedPreview,
  onSendFullDigest
}) {
  const isTh = lang === 'th';
  const activeMeta = PREVIEW_MODES.find((m) => m.id === selectedMode) || PREVIEW_MODES[0];
  const isSendingPreview = busyAction === selectedMode;
  const isSendingDigest = busyAction === 'digest';
  const isAnyBusy = Boolean(busyAction);

  const previewEmbed = useMemo(() => {
    const activeTasks = (Array.isArray(currentAssignments) ? currentAssignments : []).filter(
      (a) => a && a.status !== 'done' && a.status !== 'read'
    );
    const activeClasses = (Array.isArray(currentSchedule) ? currentSchedule : []).filter(
      (c) => c && !c.deletedAt
    );
    const sampleClass = activeClasses[0] || {
      title: 'Operating Systems',
      courseCode: '040613205',
      startTime: '09:00',
      endTime: '12:00',
      room: '78-618'
    };
    const sampleTask = activeTasks[0] || {
      title: 'Kernel Thread Synchronization Lab',
      course: 'Operating Systems',
      points: 20
    };
    const sampleExam = (Array.isArray(mergedExams) && mergedExams[0]) || {
      courseCode: '040613205',
      courseName: 'Operating Systems',
      date: '12 Dec 2026',
      time: '09:00–12:00',
      room: '78-301',
      seat: 'A12'
    };

    const tz = alertSettings.timezone || 'Asia/Bangkok';
    const morningTime = alertSettings.morningBriefingTime || '07:00';
    const weeklyTime = alertSettings.weeklyDigestTime || '18:00';

    if (selectedMode === 'assignment') {
      return {
        timestamp: '09:00',
        title: isTh
          ? `กำหนดส่งในอีก 1 วัน · ${sampleTask.title}`
          : `Due in 1 day · ${sampleTask.title}`,
        description: isTh
          ? `วิชา ${sampleTask.course || 'Computer Science'} มีงานที่ยังไม่ได้ส่ง`
          : `Pending coursework in ${sampleTask.course || 'Computer Science'}`,
        rows: [
          {
            label: isTh ? 'สถานะการส่ง' : 'Submission status',
            value: sampleTask.points
              ? (isTh ? `ยังไม่ส่ง · ${sampleTask.points} คะแนน` : `Not submitted · ${sampleTask.points} pts`)
              : (isTh ? 'ยังไม่ส่งงาน' : 'Not submitted')
          },
          {
            label: isTh ? 'กำหนดส่ง' : 'Deadline',
            value: isTh ? 'พรุ่งนี้ · 23:59 น.' : 'Tomorrow · 23:59'
          }
        ],
        footer: `Classroom Hub · P1 Reminder · ${tz}`
      };
    }

    if (selectedMode === 'exam') {
      return {
        timestamp: '08:00',
        title: isTh
          ? `นับถอยหลังสอบ 3 วัน · ${sampleExam.courseName || sampleExam.courseCode}`
          : `Exam in 3 days · ${sampleExam.courseName || sampleExam.courseCode}`,
        description: isTh
          ? `รหัสวิชา ${sampleExam.courseCode || '040613205'} · ข้อมูลผังที่นั่งสอบพร้อมแล้ว`
          : `Course ${sampleExam.courseCode || '040613205'} · Official seating verified`,
        rows: [
          {
            label: isTh ? 'วันและเวลาสอบ' : 'Date & time',
            value: `${sampleExam.date || '12 Dec'} · ${sampleExam.time || '09:00–12:00'}`
          },
          {
            label: isTh ? 'ห้องสอบ · ที่นั่ง' : 'Room & seat',
            value: `${sampleExam.room || '78-301'} · ${sampleExam.seat || 'TBA'}`
          }
        ],
        footer: `Classroom Hub · SciBase + Reg · ${tz}`
      };
    }

    if (selectedMode === 'weekly') {
      return {
        timestamp: weeklyTime,
        title: isTh ? 'รายงานสรุปการเรียนประจำสัปดาห์' : 'Weekly Academic Report',
        description: isTh
          ? `งานค้างทั้งหมด ${activeTasks.length || 2} รายการ · วิชาเรียนสัปดาห์หน้า ${activeClasses.length || 4} คาบ`
          : `${activeTasks.length || 2} pending assignments · ${activeClasses.length || 4} scheduled sessions ahead`,
        rows: [
          {
            label: isTh ? 'งานใกล้ครบกำหนด' : 'Next due coursework',
            value: `• ${sampleTask.title}`
          },
          {
            label: isTh ? 'วิชาสอบถัดไป' : 'Upcoming examination',
            value: `• ${sampleExam.courseName || 'Operating Systems'} (${sampleExam.room || '78-301'})`
          }
        ],
        footer: `Classroom Hub · Weekly Digest · ${tz}`
      };
    }

    return {
      timestamp: morningTime,
      title: isTh ? 'สรุปตารางเรียนและงานวันนี้' : 'Morning Academic Briefing',
      description: isTh
        ? `วันนี้มีเรียน ${activeClasses.length || 1} วิชา · งานรอส่ง ${activeTasks.length || 2} ชิ้น · สอบใกล้ถึง ${mergedExams.length || 1} วิชา`
        : `${activeClasses.length || 1} class today · ${activeTasks.length || 2} pending tasks · ${mergedExams.length || 1} upcoming exam`,
      rows: [
        {
          label: isTh ? 'ตารางเรียนวันนี้' : "Today's schedule",
          value: `${sampleClass.startTime || '09:00'}–${sampleClass.endTime || '12:00'} ${sampleClass.title} (${sampleClass.room || '78-618'})`
        },
        {
          label: isTh ? 'งานที่ต้องโฟกัส' : 'Priority coursework',
          value: `• ${sampleTask.title}`
        }
      ],
      footer: `Classroom Hub · Daily ${morningTime} · ${tz}`
    };
  }, [selectedMode, currentAssignments, currentSchedule, mergedExams, alertSettings, isTh]);

  return (
    <div className="rounded-2xl bg-[#141821] border border-[var(--border-strong)] overflow-hidden flex flex-col shadow-[inset_0_1px_0_rgba(238,240,245,0.05)]">
      {/* Preview Top Switcher */}
      <div className="px-4 py-3 border-b border-[var(--border)] flex flex-col gap-2.5 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-[var(--text-heading)]">
            {isTh ? 'พรีวิวหน้าตาแจ้งเตือนจริง' : 'Live Discord embed preview'}
          </span>
          <span className="text-[11px] font-mono text-[var(--text-muted)]">
            #academic-alerts
          </span>
        </div>

        {/* Unified 4-Mode Segmented Control */}
        <div
          role="tablist"
          aria-label={isTh ? 'เลือกรูปแบบตัวอย่างข้อความ' : 'Preview message template'}
          className="grid grid-cols-4 gap-1 p-1 rounded-lg bg-[var(--app-bg)] border border-[var(--border)]"
        >
          {PREVIEW_MODES.map((mode) => {
            const active = selectedMode === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                role="tab"
                aria-selected={active}
                data-testid={mode.testId}
                onClick={() => onSelectMode?.(mode.id)}
                className={`h-7 px-2 rounded-md text-[11px] font-medium transition-colors cursor-pointer truncate ${
                  active
                    ? 'bg-[var(--surface-elevated)] text-[var(--text-heading)] shadow-[inset_0_1px_0_rgba(238,240,245,0.08)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
              >
                {isTh ? mode.th : mode.en}
              </button>
            );
          })}
        </div>
      </div>

      {/* Fixed-Height Simulated Authentic Discord Dark Canvas (0px shift across all 4 modes!) */}
      <div className="p-4 bg-[#1E1F22] h-[244px] overflow-hidden shrink-0">
        <div className="flex items-start gap-3 h-full">
          <div className="w-8 h-8 rounded-full bg-[#2B2D31] border border-white/10 flex items-center justify-center shrink-0 overflow-hidden">
            <img src="/Logo.svg" alt="" className="w-5 h-5" />
          </div>

          <div className="min-w-0 flex-1 flex flex-col h-full">
            {/* Bot Username + APP tag + Time */}
            <div className="flex items-center gap-1.5 pb-1.5 shrink-0">
              <span className="text-xs font-medium text-[#F2F3F5]">Classroom Hub</span>
              <span className="px-1 py-[1px] rounded-[3px] bg-[#5865F2] text-[9px] font-medium text-white leading-tight">
                APP
              </span>
              <span className="text-[10px] font-mono tabular-nums text-[#949BA4]">
                {isTh ? `วันนี้ ${previewEmbed.timestamp}` : `Today at ${previewEmbed.timestamp}`}
              </span>
            </div>

            {/* Authentic Discord Embed Box — Exact Uniform 2-Row Structure */}
            <div
              data-testid="discord-live-embed-card"
              style={{ borderLeftColor: activeMeta.accentHex }}
              className="rounded-[4px] bg-[#2B2D31] border-l-[3px] p-3 flex-1 flex flex-col justify-between min-h-0 text-left"
            >
              <div className="space-y-1 min-w-0">
                <div className="text-xs font-medium text-[#F2F3F5] truncate">
                  {previewEmbed.title}
                </div>
                <div className="text-[11px] text-[#DBDEE1] truncate">
                  {previewEmbed.description}
                </div>
              </div>

              <div className="space-y-2 py-1 min-w-0">
                {previewEmbed.rows.map((row) => (
                  <div key={row.label} className="min-w-0">
                    <div className="text-[10px] font-medium text-[#B5BAC1] leading-tight">
                      {row.label}
                    </div>
                    <div className="text-[11px] text-[#DBDEE1] font-mono truncate leading-snug">
                      {row.value}
                    </div>
                  </div>
                ))}
              </div>

              <div className="text-[10px] font-mono text-[#949BA4] truncate shrink-0">
                {previewEmbed.footer}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Single Unified Dispatch Action Bar */}
      <div className="px-4 py-3 bg-[#141821] border-t border-[var(--border)] flex items-center justify-between gap-2 shrink-0">
        <button
          type="button"
          data-testid="send-selected-preview-btn"
          disabled={isAnyBusy || !webhookValid}
          onClick={() => onSendSelectedPreview?.(selectedMode)}
          className="h-8 flex-1 inline-flex items-center justify-center gap-1.5 px-3 rounded-lg bg-[#EEF0F5] hover:bg-white text-[#0C0F16] text-xs font-medium transition-colors cursor-pointer disabled:opacity-40 whitespace-nowrap"
        >
          {isSendingPreview ? (
            <RefreshCw size={13} strokeWidth={1.6} className="animate-spin shrink-0" />
          ) : (
            <Send size={13} strokeWidth={1.6} className="shrink-0" />
          )}
          <span className="truncate">
            {isSendingPreview
              ? (isTh ? 'กำลังส่งตัวอย่าง...' : 'Sending preview...')
              : (isTh ? `ส่งตัวอย่าง (${activeMeta.th})` : `Send ${activeMeta.en} Preview`)}
          </span>
        </button>

        <button
          type="button"
          data-testid="send-full-digest-btn"
          disabled={isAnyBusy || !webhookValid}
          onClick={onSendFullDigest}
          title={isTh ? 'ส่งสรุปงานค้างและวันสอบจริงตอนนี้' : 'Send full task & exam digest now'}
          className="h-8 inline-flex items-center justify-center gap-1.5 px-3 rounded-lg bg-[var(--app-bg)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-heading)] transition-colors cursor-pointer disabled:opacity-40 shrink-0 whitespace-nowrap"
        >
          {isSendingDigest ? (
            <RefreshCw size={12} strokeWidth={1.5} className="animate-spin shrink-0" />
          ) : (
            <ClipboardList size={12} strokeWidth={1.5} className="shrink-0 opacity-75" />
          )}
          <span>{isTh ? 'ส่งสรุปจริง' : 'Send Digest'}</span>
        </button>
      </div>
    </div>
  );
}
