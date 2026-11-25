import { useState, useRef, useEffect } from 'react';
import { Copy, Check, ExternalLink, Terminal, ShieldCheck } from 'lucide-react';

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
      timerRef.current = setTimeout(() => setCopied(false), 2600);
    } catch {
      // Textarea remains selectable for manual copy
    }
  };

  const steps = [
    {
      num: '01',
      title: 'Script Properties',
      desc: isTh
        ? 'สร้างคีย์ DISCORD_WEBHOOK_URL ในหน้า Project Settings เพื่อแยกโทเคนความลับออกจากซอร์สโค้ด'
        : 'Add DISCORD_WEBHOOK_URL under Project Settings to keep your webhook secret out of source code'
    },
    {
      num: '02',
      title: 'Services (+)',
      desc: isTh
        ? 'กดเปิดใช้งาน Google Classroom API และ Google Calendar API ในแถบซ้ายของ Apps Script'
        : 'Enable Google Classroom API and Google Calendar API in the left Services panel'
    },
    {
      num: '03',
      title: 'Time-driven Trigger',
      desc: isTh
        ? 'ตั้งเวลาให้ฟังก์ชัน sendClassroomDigest รันอัตโนมัติทุก 15 นาที หรือทุก 1 ชั่วโมง'
        : 'Schedule sendClassroomDigest to run automatically every 15 or 60 minutes'
    }
  ];

  const lineCount = generatedAppsScript ? generatedAppsScript.split('\n').length : 0;

  return (
    <div className="space-y-6">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-[var(--border)]">
        <div className="space-y-1 max-w-2xl">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-medium text-[var(--text-heading)]">
              {isTh ? 'สคริปต์รันบนคลาวด์ 24 ชั่วโมง (Google Apps Script)' : '24/7 Google Apps Script Automation'}
            </h2>
            <span className="px-2 py-0.5 rounded bg-[var(--surface-elevated)] border border-[var(--border)] text-[11px] font-mono tabular-nums text-[var(--text-secondary)]">
              {isTh ? `ซ่อน ${hiddenCourseCount} วิชา` : `${hiddenCourseCount} hidden`}
            </span>
          </div>
          <p className="text-xs sm:text-[13px] text-[var(--text-secondary)] leading-relaxed">
            {isTh
              ? 'รันระบบแจ้งเตือนบนบัญชี Google ของคุณโดยตรงแม้ปิดคอมพิวเตอร์ โค้ดด้านล่างสร้างขึ้นตามกฎเวลาและวิชาที่คุณตั้งค่าไว้ล่าสุดโดยอัตโนมัติ'
              : 'Runs your notification rules directly on Google infrastructure even when your browser is closed, automatically synced with your active schedule and hidden courses'}
          </p>
        </div>

        <a
          href="https://script.google.com"
          target="_blank"
          rel="noopener noreferrer"
          className="h-9 self-start inline-flex items-center gap-2 px-3.5 rounded-lg bg-[var(--surface-elevated)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-xs font-medium text-[var(--text-primary)] transition-colors shrink-0 whitespace-nowrap"
        >
          <span>{isTh ? 'เปิด Google Apps Script' : 'Open script.google.com'}</span>
          <ExternalLink size={13} strokeWidth={1.5} className="text-[var(--text-muted)]" />
        </a>
      </div>

      {/* 3-Step Horizontal Setup Strip (Hairline columns, no nested card clutter) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-0 md:divide-x divide-[var(--border)] pb-5 border-b border-[var(--border)]">
        {steps.map((step, idx) => (
          <div
            key={step.num}
            className={`space-y-1.5 ${idx > 0 ? 'md:pl-5' : ''} ${idx < 2 ? 'md:pr-5' : ''}`}
          >
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono tabular-nums text-[var(--primary-bright)]">
                {step.num}
              </span>
              <span className="text-xs font-medium text-[var(--text-heading)] font-mono">
                {step.title}
              </span>
            </div>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              {step.desc}
            </p>
          </div>
        ))}
      </div>

      {/* Security Option Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-1">
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
              ? 'ฝังลิงก์ Webhook ลงในโค้ดโดยตรง (สะดวกขึ้น แต่ห้ามส่งไฟล์โค้ดนี้ต่อให้ผู้อื่น)'
              : 'Embed Webhook URL directly inside generated script (convenient, do not share code publicly)'}
          </span>
        </label>

        {!embedWebhookInScript && (
          <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--success)] shrink-0">
            <ShieldCheck size={13} strokeWidth={1.5} />
            <span>{isTh ? 'ปลอดภัย: ซ่อนโทเคนไว้ใน Properties' : 'Secret isolated via Script Properties'}</span>
          </span>
        )}
      </div>

      {/* Code Workbench */}
      <div className="rounded-xl overflow-hidden border border-[var(--border-strong)] bg-[#0E1118]">
        <div className="px-4 py-2.5 bg-[#141821] border-b border-[var(--border)] flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-mono text-[var(--text-secondary)]">
            <Terminal size={14} strokeWidth={1.5} className="text-[var(--text-muted)]" />
            <span className="text-[var(--text-heading)] font-medium">Code.gs</span>
            <span className="text-[var(--text-muted)]">·</span>
            <span className="tabular-nums text-[11px] text-[var(--text-muted)]">
              {lineCount} {isTh ? 'บรรทัด' : 'lines'}
            </span>
          </div>

          <button
            type="button"
            onClick={handleCopy}
            className="h-8 inline-flex items-center gap-1.5 px-3 rounded-lg bg-[#EEF0F5] hover:bg-white text-[#0C0F16] text-xs font-medium transition-colors cursor-pointer"
          >
            {copied ? (
              <Check size={13} strokeWidth={1.8} className="text-[#15803D]" />
            ) : (
              <Copy size={13} strokeWidth={1.6} />
            )}
            <span>
              {copied
                ? (isTh ? 'คัดลอกโค้ดแล้ว' : 'Copied to clipboard')
                : (isTh ? 'คัดลอกโค้ดทั้งหมด' : 'Copy Script')}
            </span>
          </button>
        </div>

        <textarea
          readOnly
          aria-label={isTh ? 'โค้ด Google Apps Script' : 'Generated Google Apps Script Code'}
          value={generatedAppsScript}
          rows={13}
          className="w-full bg-transparent p-4 text-[11px] leading-relaxed font-mono text-[var(--text-primary)] focus:outline-none resize-y"
        />
      </div>
    </div>
  );
}
