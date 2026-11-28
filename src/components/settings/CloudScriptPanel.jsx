import { useState, useRef, useEffect } from 'react';
import { Copy, Check, ExternalLink, Terminal, ShieldCheck, CheckCircle2 } from 'lucide-react';

export default function CloudScriptPanel({
  lang = 'en',
  hiddenCourseCount = 0,
  embedWebhookInScript = false,
  onToggleEmbedWebhook,
  deliveryAuthority = 'browser',
  onSelectAuthority,
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
      title: isTh ? 'คัดลอกและวางสคริปต์ใน Code.gs' : 'Copy & paste into Code.gs',
      desc: isTh
        ? 'ติ๊กช่อง "ฝังลิงก์ Discord Webhook" ด้านบนเพื่อให้พร้อมใช้ทันที กดคัดลอก แล้วนำไปวางทับใน Code.gs บน script.google.com'
        : 'Check "Embed Discord Webhook URL" above for zero-config setup, copy the script, and paste into Code.gs on script.google.com'
    },
    {
      num: '02',
      title: isTh ? 'เพิ่ม Google Classroom & Calendar API' : 'Add Classroom & Calendar Services',
      desc: isTh
        ? 'กด Services (+) แถบซ้าย เพิ่ม Google Classroom API (จำเป็น) และ Google Calendar API (เพื่อซิงก์ตารางเรียน/สอบสด)'
        : 'Click Services (+) on the left sidebar and add Google Classroom API (required) plus Google Calendar API'
    },
    {
      num: '03',
      title: isTh ? 'กด Run ฟังก์ชัน install24x7Trigger ครั้งเดียวจบ' : 'Run install24x7Trigger once',
      desc: isTh
        ? 'เลือกฟังก์ชัน install24x7Trigger ด้านบนแล้วกด Run 1 ครั้ง ระบบจะสร้าง Trigger รันอัตโนมัติทุก 15 นาทีตลอด 24 ชม. และยิงข้อความยืนยันเข้า Discord ทันที'
        : 'Select install24x7Trigger in the toolbar and click Run once — it automatically schedules 15-minute 24/7 runs and confirms in Discord'
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
              <span>{isTh ? 'โหมดปลอดภัย: ต้องตั้ง DISCORD_WEBHOOK_URL ใน Script Properties' : 'Safe mode: set DISCORD_WEBHOOK_URL in Script Properties'}</span>
            </span>
          )}
        </div>

        {onSelectAuthority && (
          <div className="pt-3 border-t border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <span className="text-[var(--text-secondary)]">
              {deliveryAuthority === 'apps_script'
                ? (isTh
                    ? 'เปิดโหมด 24/7 Cloud เป็นตัวหลักแล้ว — หน้าเว็บจะไม่ยิงข้อความซ้ำตอนคุณกดเข้าเว็บ'
                    : '24/7 Cloud is set as primary authority — opening the web app will not double-send alerts')
                : (isTh
                    ? 'หลังกด Run install24x7Trigger สำเร็จ แนะนำให้สลับเป็นโหมด 24/7 Cloud เพื่อป้องกันหน้าเว็บส่งข้อความซ้ำ'
                    : 'Once install24x7Trigger is active, switch to 24/7 Cloud authority so opening the web app never double-sends')}
            </span>
            <button
              type="button"
              data-testid="quick-switch-cloud-authority-btn"
              onClick={() => onSelectAuthority(deliveryAuthority === 'apps_script' ? 'browser' : 'apps_script')}
              className="h-8 px-3 rounded-lg bg-[var(--surface-elevated)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-xs font-medium text-[var(--text-primary)] transition-colors cursor-pointer shrink-0 whitespace-nowrap"
            >
              {deliveryAuthority === 'apps_script'
                ? (isTh ? 'สลับกลับเป็นโหมดหน้าเว็บ' : 'Switch back to Browser mode')
                : (isTh ? 'ใช้ 24/7 Cloud เป็นตัวส่งหลัก' : 'Set 24/7 Cloud as Primary')}
            </button>
          </div>
        )}
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
