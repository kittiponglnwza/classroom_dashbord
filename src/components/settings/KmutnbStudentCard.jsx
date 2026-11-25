import { useState } from 'react';
import { GraduationCap } from 'lucide-react';

const SEGMENT_LABELS = {
  en: {
    year: 'Year',
    faculty: 'Fac',
    department: 'Dept',
    program: 'Prog',
    running: 'No'
  },
  th: {
    year: 'รุ่นปี',
    faculty: 'คณะ',
    department: 'ภาค',
    program: 'หลักสูตร',
    running: 'ลำดับ'
  }
};

export default function KmutnbStudentCard({
  name = '',
  email = '',
  studentId = '',
  avatarUrl = '',
  decodedKmutnb = null,
  isLoggedIn = false,
  cachedMode = false,
  lang = 'en'
}) {
  const [failedAvatarUrl, setFailedAvatarUrl] = useState(null);
  const isTh = lang === 'th';
  const langKey = isTh ? 'th' : 'en';
  const displayName = (name || '').trim() || (isTh ? 'นักศึกษา' : 'Student');
  const initial = displayName.charAt(0).toUpperCase();
  const normalizedId = String(studentId || '').replace(/[\s-]/g, '').trim();
  const showAvatar = Boolean(avatarUrl) && failedAvatarUrl !== avatarUrl;

  const statusDot = isLoggedIn
    ? 'bg-[var(--success)]'
    : cachedMode
      ? 'bg-[var(--warning)]'
      : 'bg-[var(--text-muted)]';

  const statusLabel = isLoggedIn
    ? (isTh ? 'เชื่อมต่อแล้ว' : 'Connected')
    : cachedMode
      ? (isTh ? 'แคชออฟไลน์' : 'Cached')
      : (isTh ? 'โหมดออฟไลน์' : 'Local');

  return (
    <div className="relative overflow-hidden rounded-2xl bg-[#141821] border border-[var(--border-strong)] shadow-[inset_0_1px_0_rgba(238,240,245,0.07)] select-none">
      {/* Authentic KMUTNB brick-vermilion credential edge */}
      <div
        aria-hidden="true"
        className="h-[3px] w-full bg-[#D95B38]"
      />

      {/* Subtle architectural watermark lines */}
      <svg
        aria-hidden="true"
        viewBox="0 0 400 220"
        fill="none"
        className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.045]"
      >
        <circle cx="356" cy="36" r="92" stroke="#EEF0F5" strokeWidth="1" />
        <circle cx="356" cy="36" r="64" stroke="#EEF0F5" strokeWidth="1" />
        <path d="M0 168H400" stroke="#EEF0F5" strokeWidth="1" strokeDasharray="3 5" />
      </svg>

      <div className="relative p-5 space-y-5">
        {/* Top credential header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-xs bg-[#D95B38] shrink-0" />
              <span className="text-xs font-medium text-[var(--text-heading)] truncate">
                {decodedKmutnb
                  ? (isTh ? 'บัตรประจำตัวนักศึกษา · มจพ.' : 'KMUTNB Student Credential')
                  : (isTh ? 'บัตรโปรไฟล์ผู้เรียน' : 'Academic Workspace Pass')}
              </span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] pl-4 truncate font-mono tabular-nums">
              {decodedKmutnb
                ? (isTh ? `รหัสเข้าศึกษา พ.ศ. ${decodedKmutnb.entryYearBE}` : `Entry B.E. ${decodedKmutnb.entryYearBE}`)
                : (isTh ? 'ซิงก์ตารางเรียนและงานจาก Classroom' : 'Classroom Hub student identity')}
            </p>
          </div>

          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--app-bg)] border border-[var(--border)] text-[11px] font-medium text-[var(--text-secondary)] shrink-0">
            <span className={`w-1.5 h-1.5 rounded-full ${statusDot}`} />
            <span>{statusLabel}</span>
          </span>
        </div>

        {/* Identity row */}
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl overflow-hidden bg-[var(--app-bg)] border border-[var(--border-strong)] flex items-center justify-center shrink-0">
            {showAvatar ? (
              <img
                src={avatarUrl}
                alt="Avatar"
                referrerPolicy="no-referrer"
                onError={() => setFailedAvatarUrl(avatarUrl)}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-base font-medium text-[var(--text-heading)]">
                {initial}
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-medium text-[var(--text-heading)] truncate">
                {displayName}
              </h2>
              {decodedKmutnb?.yearLevel && (
                <span className="px-2 py-0.5 rounded bg-[var(--surface-elevated)] border border-[var(--border)] text-[11px] font-mono tabular-nums text-[var(--text-primary)]">
                  {isTh ? `ชั้นปีที่ ${decodedKmutnb.yearLevel}` : `Year ${decodedKmutnb.yearLevel}`}
                </span>
              )}
            </div>
            <p className="text-xs font-mono text-[var(--text-secondary)] truncate">
              {email || (isTh ? 'ยังไม่ได้เชื่อมบัญชี Google' : 'No Google account linked')}
            </p>
          </div>
        </div>

        {/* Segmented ID + Academic Breakdown */}
        {decodedKmutnb ? (
          <div
            data-testid="kmutnb-profile-breakdown"
            className="pt-4 border-t border-[var(--border)] space-y-3"
          >
            {/* Segmented 13-digit Student ID */}
            <div className="grid grid-cols-5 gap-1.5">
              {decodedKmutnb.segments.map((seg) => (
                <div
                  key={seg.key}
                  className="rounded-lg bg-[var(--app-bg)] border border-[var(--border)] px-2 py-1.5 text-center"
                >
                  <div className="text-xs sm:text-[13px] font-mono font-medium tabular-nums text-[var(--text-heading)]">
                    {seg.value}
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)] mt-0.5 truncate">
                    {SEGMENT_LABELS[langKey][seg.key]}
                  </div>
                </div>
              ))}
            </div>

            {/* Faculty & Department ledger */}
            <div className="space-y-1 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-[var(--text-primary)] font-medium min-w-0">
                  <GraduationCap size={14} strokeWidth={1.5} className="text-[#D95B38] shrink-0" />
                  <span className="truncate">{decodedKmutnb.faculty[langKey]}</span>
                </span>
                <span className="text-[11px] font-mono tabular-nums text-[var(--text-muted)] shrink-0">
                  {decodedKmutnb.campusLabel[langKey]}
                </span>
              </div>

              {(decodedKmutnb.department || decodedKmutnb.program) && (
                <p className="text-[11px] text-[var(--text-secondary)] pl-5 leading-snug">
                  {decodedKmutnb.department
                    ? (decodedKmutnb.program
                        ? `${decodedKmutnb.department[langKey]} · ${decodedKmutnb.program[langKey]}`
                        : decodedKmutnb.department[langKey])
                    : decodedKmutnb.program?.[langKey]}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="pt-4 border-t border-[var(--border)] flex items-center justify-between gap-3 text-xs">
            <span className="text-[var(--text-muted)]">
              {isTh ? 'รหัสประจำตัว' : 'Student ID'}
            </span>
            <span className="font-mono tabular-nums text-[var(--text-primary)]">
              {normalizedId || (isTh ? 'ยังไม่ได้ระบุ (13 หลักสำหรับ มจพ.)' : 'Not set (13 digits for KMUTNB)')}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
