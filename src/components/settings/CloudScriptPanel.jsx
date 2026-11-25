import { useState, useRef, useEffect } from 'react';
import { Copy, Check, ExternalLink, Terminal, ShieldCheck, CheckCircle2 } from 'lucide-react';

export default function CloudScriptPanel({
  lang = 'en',
  hiddenCourseCount = 0,
  embedWebhookInScript = false,
  onToggleEmbedWebhook,
  generatedAppsScript = ''
}) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef(null);
  const isTh = lang === 'th';

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const handleCopy = async () => {
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
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 2800);
    } catch {
      // Ignore clipboard failures in restricted environments
    }
  };

  const steps = [
    {
      num: '01',
      title: isTh ? 'สร้างโปรเจกต์และวางสคริปต์' : 'Create project & paste script',
      desc: isTh
        ? 'กดคัดลอกสคริปต์ด้านบน เปิด script.google.com สร้าง New Project แล้ววางทับลงในไฟล์ Code.gs'
        : 'Copy the script above, open script.google.com, create a New Project, and paste into Code.gs'
    },
    {
      num: '02',
      title: isTh ? 'เปิด Services และตั้งค่า Webhook' : 'Enable Services & Webhook property',
      desc: isTh
        ? 'กด Services (+) เพิ่ม Google Classroom API และ Google Calendar API จากนั้นใส่ DISCORD_WEBHOOK_URL ใน Project Settings'
        : 'Add Google Classroom API & Google Calendar API under Services (+), then save DISCORD_WEBHOOK_URL in Script Properties'
    },
    {
      num: '03',
      title: isTh ? 'ตั้งเวลาทำงานอัตโนมัติ (Trigger)' : 'Add time-driven trigger',
      desc: isTh
        ? 'ไปที่เมนู Triggers เลือกฟังก์ชัน sendClassroomDigest ให้รันอัตโนมัติทุก 15 นาที หรือทุก 1 ชั่วโมง'
        : 'Open Triggers and schedule sendClassroomDigest to run automatically every 15 or 60 minutes'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Ready-to-Copy Package Card (No raw code dump!) */}
      <div className="rounded-2xl bg-[#141821] border border-[var(--border-strong)] p-5 sm:p-6 space-y-5 shadow-[inset_0_1px_0_rgba(238,240,245,0.05)]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[var(--app-bg)] border border-[var(--border)] flex items-center justify-center shrink-0">
              <Terminal size={18} strokeWidth={1.5} className="text-[var(--text-heading)]" />
            </div>

            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-medium text-[var(--text-heading)]">
                  {isTh ? 'สคริปต์แจ้งเตือนอัตโนมัติ 24 ชั่วโมง' : '24/7 Google Apps Script Package'}
                </h2>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--surface-elevated)] border border-[var(--border)] text-[11px] font-mono tabular-nums text-[var(--text-secondary)]">
                  <CheckCircle2 size={11} strokeWidth={1.6} className="text-[var(--success)]" />
                  <span>{isTh ? `ซิงก์กฎล่าสุดแล้ว · ซ่อน ${hiddenCourseCount} วิชา` : `Synced · ${hiddenCourseCount} hidden`}</span>
                </span>
              </div>

              <p className="text-xs sm:text-[13px] text-[var(--text-secondary)] leading-relaxed max-w-2xl">
                {isTh
                  ? 'ทำงานบน Google Cloud ของคุณเองตลอด 24 ชม. แม้ปิดเครื่องคอมพิวเตอร์ โดยดึงค่าเวลาแจ้งเตือน ตารางสอบ และวิชาที่ซ่อนไว้ไปสร้างเป็นสคริปต์พร้อมใช้งานทันทีโดยไม่ต้องแก้โค้ดเอง'
                  : 'Runs 24/7 on your own Google account even while your computer is off, pre-configured with your active notification rules, exam seating, and hidden courses'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              data-testid="copy-apps-script-btn"
              onClick={handleCopy}
              className="h-9 inline-flex items-center justify-center gap-2 px-4 rounded-lg bg-[#EEF0F5] hover:bg-white text-[#0C0F16] text-xs font-medium transition-colors cursor-pointer whitespace-nowrap"
            >
              {copied ? (
                <Check size={14} strokeWidth={1.8} className="text-[#15803D]" />
              ) : (
                <Copy size={14} strokeWidth={1.6} />
              )}
              <span>
                {copied
                  ? (isTh ? 'คัดลอกสคริปต์แล้ว' : 'Script copied')
                  : (isTh ? 'คัดลอกสคริปต์พร้อมใช้' : 'Copy Ready Script')}
              </span>
            </button>

            <a
              href="https://script.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="h-9 inline-flex items-center justify-center gap-2 px-3.5 rounded-lg bg-[var(--surface-elevated)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-xs font-medium text-[var(--text-primary)] transition-colors whitespace-nowrap"
            >
              <span>{isTh ? 'เปิด Google Apps Script' : 'Open script.google.com'}</span>
              <ExternalLink size={13} strokeWidth={1.5} className="text-[var(--text-muted)]" />
            </a>
          </div>
        </div>

        {/* Security Option Footer inside Package Card */}
        <div className="pt-4 border-t border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <label className="flex items-start sm:items-center gap-2.5 text-xs text-[var(--text-secondary)] cursor-pointer select-none">
            <input
              type="checkbox"
              data-testid="embed-webhook-in-script-toggle"
              checked={Boolean(embedWebhookInScript)}
              onChange={onToggleEmbedWebhook}
              className="mt-0.5 sm:mt-0 w-4 h-4 rounded accent-[var(--primary)] cursor-pointer shrink-0"
            />
            <span>
              {isTh
                ? 'ฝังลิงก์ Discord Webhook ลงในสคริปต์ที่คัดลอกเลย (ข้ามขั้นตอนตั้งค่า Script Properties แต่ห้ามแชร์สคริปต์ให้ผู้อื่น)'
                : 'Embed Discord Webhook URL directly in copied script (skips Script Properties, do not share script publicly)'}
            </span>
          </label>

          {!embedWebhookInScript && (
            <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--success)] shrink-0">
              <ShieldCheck size={13} strokeWidth={1.5} />
              <span>{isTh ? 'โหมดปลอดภัย: แยกโทเคนไว้ใน Properties' : 'Safe mode: secret isolated'}</span>
            </span>
          )}
        </div>
      </div>

      {/* Clean 3-Step Setup Guide */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-0 md:divide-x divide-[var(--border)] pt-1">
        {steps.map((step, idx) => (
          <div
            key={step.num}
            className={`space-y-1.5 ${idx > 0 ? 'md:pl-6' : ''} ${idx < 2 ? 'md:pr-6' : ''}`}
          >
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono tabular-nums text-[var(--primary-bright)]">
                {step.num}
              </span>
              <h3 className="text-xs sm:text-[13px] font-medium text-[var(--text-heading)]">
                {step.title}
              </h3>
            </div>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              {step.desc}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
