import { useState } from 'react';
import {
  ExternalLink,
  RefreshCw,
  Mail,
  Copy,
  Check,
  GitBranch,
  Layers,
  Calendar,
  Bell
} from 'lucide-react';

export const GithubMark = ({ size = 16, className = '' }) => (
  <svg
    height={size}
    width={size}
    viewBox="0 0 16 16"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path
      fillRule="evenodd"
      d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"
    />
  </svg>
);

const InstagramMark = ({ size = 15, className = '' }) => (
  <svg
    height={size}
    width={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </svg>
);

// Deterministic contribution-matrix pattern (24 weeks x 5 rows) for calm GitHub craft identity
const CONTRIB_LEVELS = [
  [0, 1, 2, 0, 1, 3, 2, 1, 0, 2, 3, 4, 2, 1, 0, 1, 2, 3, 2, 4, 3, 2, 3, 4],
  [1, 2, 1, 1, 2, 2, 3, 2, 1, 3, 2, 3, 1, 2, 2, 3, 1, 2, 4, 3, 2, 4, 3, 2],
  [0, 0, 2, 3, 1, 0, 1, 3, 2, 1, 4, 2, 3, 2, 1, 2, 3, 4, 3, 2, 4, 3, 4, 3],
  [1, 1, 0, 2, 2, 3, 1, 0, 2, 2, 1, 3, 2, 0, 1, 3, 2, 1, 2, 3, 1, 2, 3, 4],
  [0, 2, 1, 0, 1, 2, 0, 2, 1, 0, 2, 1, 1, 3, 2, 0, 1, 2, 3, 1, 2, 3, 2, 3]
];

const LEVEL_COLORS = [
  'bg-[#1D2330]',
  'bg-[#143529]',
  'bg-[#1D563E]',
  'bg-[#2B825B]',
  'bg-[#4CC38A]'
];

export default function DeveloperShowcase({
  devInfo,
  lang = 'en',
  appVersion = '',
  appCommit = '',
  formattedBuildTime = '',
  onCheckUpdates
}) {
  const [copiedEmail, setCopiedEmail] = useState(false);
  const isTh = lang === 'th';

  const handleCopyEmail = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(devInfo.email);
        setCopiedEmail(true);
        setTimeout(() => setCopiedEmail(false), 2400);
      }
    } catch {
      // Ignore clipboard failures silently; mailto link remains available
    }
  };

  const modules = [
    {
      icon: Layers,
      title: 'Google Classroom API',
      desc: isTh ? 'ซิงก์การบ้าน ประกาศ และเอกสารประกอบการสอน' : 'Coursework, announcements & lecture material sync'
    },
    {
      icon: GitBranch,
      title: 'KMUTNB Reg & SciBase',
      desc: isTh ? 'แปลงตารางเรียนและดึงผังที่นั่งสอบอัตโนมัติ' : 'Timetable parser & automated exam seat lookup'
    },
    {
      icon: Calendar,
      title: 'Calendar & Drive Sync',
      desc: isTh ? 'ซิงก์ลงปฏิทินและสำรองตั้งค่าข้ามอุปกรณ์' : 'Primary Google Calendar & private Drive state sync'
    },
    {
      icon: Bell,
      title: 'Discord & Apps Script',
      desc: isTh ? 'แจ้งเตือนอัตโนมัติและสคริปต์รันบนคลาวด์ 24 ชม.' : 'Webhook assistant & 24/7 cloud Apps Script engine'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Featured GitHub Creator & Repository Card */}
      <div className="rounded-2xl bg-[#141821] border border-[var(--border-strong)] overflow-hidden shadow-[inset_0_1px_0_rgba(238,240,245,0.06)]">
        {/* Top Repository Bar */}
        <div className="px-5 py-3 bg-[#10131B] border-b border-[var(--border)] flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 font-mono text-[var(--text-secondary)] min-w-0">
            <GithubMark size={14} className="text-[var(--text-muted)] shrink-0" />
            <span className="truncate">{devInfo.nickname}</span>
            <span className="text-[var(--text-muted)]">/</span>
            <span className="text-[var(--text-heading)] font-medium truncate">Classroom-Hub</span>
          </div>

          <div className="flex items-center gap-2 font-mono tabular-nums text-[11px] text-[var(--text-muted)]">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[var(--surface)] border border-[var(--border)] text-[var(--text-secondary)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)]" />
              <span>v{appVersion}</span>
            </span>
            {appCommit && (
              <span className="px-2 py-0.5 rounded bg-[var(--surface)] border border-[var(--border)]">
                #{appCommit}
              </span>
            )}
          </div>
        </div>

        {/* Main Creator Profile Split */}
        <div className="p-5 sm:p-6 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_260px] gap-6 items-center">
          <div className="space-y-4 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="relative w-15 h-15 rounded-2xl bg-[#10131B] border border-[var(--border-strong)] flex items-center justify-center shrink-0 shadow-[inset_0_1px_0_rgba(238,240,245,0.08)]">
                <span className="text-base font-mono font-semibold tracking-tight text-[var(--text-heading)]">
                  KT
                </span>
                <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#141821] border border-[var(--border-strong)] flex items-center justify-center text-[var(--text-secondary)]">
                  <GithubMark size={11} />
                </span>
              </div>

              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-medium text-[var(--text-heading)] tracking-[-0.01em]">
                    {devInfo.name}
                  </h3>
                  <span className="px-2 py-0.5 rounded-md bg-[var(--surface-elevated)] border border-[var(--border)] text-[11px] font-medium text-[var(--text-secondary)]">
                    {isTh ? `นักพัฒนา · ${devInfo.university}` : `Creator · ${devInfo.university}`}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text-muted)] font-mono">
                  <span>@{devInfo.nickname}</span>
                  <span>·</span>
                  <a
                    href={`mailto:${devInfo.email}`}
                    className="hover:text-[var(--text-primary)] transition-colors truncate"
                  >
                    {devInfo.email}
                  </a>
                </div>
              </div>
            </div>

            <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed max-w-2xl">
              {isTh
                ? 'ออกแบบและพัฒนา Classroom Hub เพื่อรวมงานเรียน ตารางสอน ผังที่นั่งสอบ และระบบแจ้งเตือนอัตโนมัติของนักศึกษา มจพ. ให้ทำงานร่วมกันในพื้นที่เดียว'
                : 'Designed and engineered Classroom Hub to unify Google Classroom coursework, KMUTNB timetables, exam seating, and automated study alerts in one calm workspace'}
            </p>

            {/* Intentional High-Craft Action Row (Off-white GitHub CTA — never clashes with form buttons) */}
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <a
                href={devInfo.github}
                target="_blank"
                rel="noopener noreferrer"
                className="h-9 inline-flex items-center justify-center gap-2 bg-[#EEF0F5] hover:bg-white text-[#0C0F16] px-4 rounded-lg text-xs font-medium transition-colors whitespace-nowrap"
              >
                <GithubMark size={14} />
                <span>{isTh ? 'ดูโปรไฟล์ GitHub' : 'GitHub Profile'}</span>
                <ExternalLink size={12} strokeWidth={1.6} />
              </a>

              <a
                href={devInfo.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="h-9 inline-flex items-center justify-center gap-2 bg-[var(--surface-elevated)] hover:bg-[var(--surface-hover)] border border-[var(--border)] px-3.5 rounded-lg text-xs font-medium text-[var(--text-primary)] transition-colors whitespace-nowrap"
              >
                <InstagramMark size={14} className="text-[var(--text-secondary)]" />
                <span>Instagram</span>
              </a>

              <button
                type="button"
                onClick={handleCopyEmail}
                className="h-9 inline-flex items-center justify-center gap-1.5 bg-[var(--app-bg)] hover:bg-[var(--surface-hover)] border border-[var(--border)] px-3 rounded-lg text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer whitespace-nowrap"
              >
                {copiedEmail ? (
                  <Check size={13} strokeWidth={1.5} className="text-[var(--success)]" />
                ) : (
                  <Copy size={13} strokeWidth={1.5} className="text-[var(--text-muted)]" />
                )}
                <span>
                  {copiedEmail
                    ? (isTh ? 'คัดลอกอีเมลแล้ว' : 'Email copied')
                    : (isTh ? 'คัดลอกอีเมล' : 'Copy email')}
                </span>
              </button>

              <a
                href={`mailto:${devInfo.email}`}
                aria-label="Send email"
                title={devInfo.email}
                className="h-9 w-9 inline-flex items-center justify-center rounded-lg bg-[var(--app-bg)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                <Mail size={14} strokeWidth={1.5} />
              </a>
            </div>
          </div>

          {/* Right: GitHub Contribution Pulse Artifact */}
          <div className="rounded-xl bg-[#10131B] border border-[var(--border)] p-4 space-y-3">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-[var(--text-secondary)] font-medium">
                {isTh ? 'จังหวะการพัฒนาโปรเจกต์' : 'Active build cadence'}
              </span>
              <span className="font-mono text-[var(--success)] tabular-nums">
                {appCommit ? `HEAD · ${appCommit}` : 'main'}
              </span>
            </div>

            <div
              aria-hidden="true"
              className="grid grid-rows-5 grid-flow-col gap-[3px] justify-between py-1"
            >
              {CONTRIB_LEVELS[0].map((_, colIdx) =>
                CONTRIB_LEVELS.map((row, rowIdx) => (
                  <span
                    key={`${colIdx}-${rowIdx}`}
                    className={`w-[7px] h-[7px] rounded-[2px] ${LEVEL_COLORS[row[colIdx]]}`}
                  />
                ))
              )}
            </div>

            <div className="flex items-center justify-between text-[10px] font-mono text-[var(--text-muted)] pt-1 border-t border-[var(--border-subtle)]">
              <span>KMUTNB Open Workspace</span>
              <div className="flex items-center gap-1">
                {LEVEL_COLORS.map((cls, i) => (
                  <span key={i} className={`w-2 h-2 rounded-[2px] ${cls}`} />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Architecture Stack Strip */}
        <div className="border-t border-[var(--border)] bg-[#11151E] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[var(--border)]">
          {modules.map((mod) => {
            const Icon = mod.icon;
            return (
              <div key={mod.title} className="p-4 space-y-1">
                <div className="flex items-center gap-2 text-xs font-medium text-[var(--text-primary)]">
                  <Icon size={14} strokeWidth={1.5} className="text-[var(--text-muted)] shrink-0" />
                  <span className="truncate">{mod.title}</span>
                </div>
                <p className="text-[11px] text-[var(--text-muted)] leading-snug">
                  {mod.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Release & Update Row */}
      <div
        data-testid="settings-version-badge"
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3 border-t border-[var(--border)] text-xs"
      >
        <div className="space-y-0.5">
          <div className="font-medium text-[var(--text-primary)]">
            {isTh ? 'เวอร์ชันและการอัปเดตแอปพลิเคชัน' : 'Application release & PWA cache'}
          </div>
          <div className="text-[11px] font-mono tabular-nums text-[var(--text-muted)]">
            Classroom Hub v{appVersion}{appCommit ? ` (${appCommit})` : ''} · {isTh ? 'อัปเดต ' : 'Updated '}{formattedBuildTime}
          </div>
        </div>

        <button
          type="button"
          onClick={onCheckUpdates}
          className="h-9 self-start sm:self-auto inline-flex items-center gap-2 px-3.5 rounded-lg bg-[var(--surface-elevated)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-xs font-medium text-[var(--text-primary)] transition-colors cursor-pointer"
        >
          <RefreshCw size={14} strokeWidth={1.5} className="text-[var(--text-secondary)]" />
          <span>{isTh ? 'เช็กอัปเดตล่าสุด' : 'Check for updates'}</span>
        </button>
      </div>
    </div>
  );
}
