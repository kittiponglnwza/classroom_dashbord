import { useState, useMemo } from 'react';
import { RotateCw, Wifi } from 'lucide-react';

const SEGMENT_LABELS = {
  en: {
    year: 'Entry YY',
    faculty: 'Faculty',
    department: 'Dept',
    program: 'Program',
    running: 'Running'
  },
  th: {
    year: 'ปีที่เข้า',
    faculty: 'รหัสคณะ',
    department: 'ภาควิชา',
    program: 'หลักสูตร',
    running: 'เลขลำดับ'
  }
};

function formatOfficialKmutnbId(raw) {
  const clean = String(raw || '').replace(/[\s-]/g, '').trim();
  if (/^\d{13}$/.test(clean)) {
    return `${clean.slice(0, 2)}-${clean.slice(2, 8)}-${clean.slice(8, 12)}-${clean.slice(12)}`;
  }
  return clean;
}

function buildDeterministicBarcodeBars(seedStr) {
  const src = seedStr || '6704062611115';
  const bars = [];
  for (let i = 0; i < 44; i++) {
    const code = src.charCodeAt(i % src.length) + i * 17;
    const width = (code % 3) + 1;
    const gap = ((code >> 2) % 2) + 1;
    bars.push({ width, gap });
  }
  return bars;
}

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
  const [isFlipped, setIsFlipped] = useState(false);

  const isTh = lang === 'th';
  const langKey = isTh ? 'th' : 'en';
  const displayName = (name || '').trim() || (isTh ? 'นักศึกษา' : 'Student');
  const initial = displayName.charAt(0).toUpperCase();
  const normalizedId = String(studentId || '').replace(/[\s-]/g, '').trim();
  const formattedId = formatOfficialKmutnbId(normalizedId);
  const showAvatar = Boolean(avatarUrl) && failedAvatarUrl !== avatarUrl;

  const barcodeBars = useMemo(
    () => buildDeterministicBarcodeBars(normalizedId || email || displayName),
    [normalizedId, email, displayName]
  );

  const statusDot = isLoggedIn
    ? 'bg-[#16A34A]'
    : cachedMode
      ? 'bg-[#D97706]'
      : 'bg-[#64748B]';

  const statusLabel = isLoggedIn
    ? (isTh ? 'ยืนยันตัวตนแล้ว' : 'Verified')
    : cachedMode
      ? (isTh ? 'โหมดแคช' : 'Cached')
      : (isTh ? 'ออฟไลน์' : 'Local');

  return (
    <div className="space-y-2.5 select-none">
      {/* Locked Fixed-Height Card Stage (Zero vertical shift when flipping Front <-> Back) */}
      <div className="h-[282px]">
        {!isFlipped ? (
          /* ── FRONT: Realistic Physical KMUTNB Smart Student ID Card ── */
          <div className="relative h-full overflow-hidden rounded-[16px] bg-[#F5F3EE] text-[#17191F] border border-white/25 shadow-[0_18px_40px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.85)] flex flex-col justify-between">
            {/* Top Header Band — Authentic KMUTNB "สีแดงหมากสุก" */}
            <div className="relative bg-[#932124] px-3.5 py-2.5 border-b-[2.5px] border-[#C69C47] flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-full bg-[#7A181B] border border-[#E5C878]/65 flex items-center justify-center shrink-0">
                  <svg
                    viewBox="0 0 24 24"
                    className="w-4 h-4 text-[#F4DF9E]"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="5" />
                    <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8" />
                  </svg>
                </div>

                <div className="min-w-0 leading-tight">
                  <div className="text-[11px] sm:text-xs font-semibold text-[#FFFDF9] truncate">
                    {decodedKmutnb
                      ? 'มหาวิทยาลัยเทคโนโลยีพระจอมเกล้าพระนครเหนือ'
                      : 'CLASSROOM HUB ACADEMIC PASS'}
                  </div>
                  <div className="text-[8px] font-medium text-[#F5D7B8] truncate">
                    {decodedKmutnb
                      ? "KING MONGKUT'S UNIVERSITY OF TECHNOLOGY NORTH BANGKOK"
                      : 'STUDENT WORKSPACE CREDENTIAL'}
                  </div>
                </div>
              </div>

              <span className="hidden sm:inline-block px-1.5 py-0.5 rounded bg-[#741619] border border-[#E5C878]/40 text-[8.5px] font-mono font-medium text-[#FCEAC7] shrink-0">
                {isTh ? 'บัตร นศ.' : 'KMUTNB'}
              </span>
            </div>

            {/* Subtle Guilloche Security Wave Pattern */}
            <svg
              aria-hidden="true"
              viewBox="0 0 440 210"
              fill="none"
              className="pointer-events-none absolute inset-x-0 bottom-0 h-[82%] w-full opacity-[0.07]"
            >
              <path d="M-20 150 C 90 95, 210 195, 460 115" stroke="#932124" strokeWidth="1.2" />
              <path d="M-20 166 C 100 110, 220 210, 460 132" stroke="#932124" strokeWidth="1" />
              <circle cx="365" cy="95" r="78" stroke="#932124" strokeWidth="0.9" />
            </svg>

            {/* Main Card Face Body */}
            <div className="relative px-4 pt-3 pb-2.5 flex-1 flex flex-col justify-between min-h-0">
              <div className="grid grid-cols-[minmax(0,1fr)_82px] sm:grid-cols-[minmax(0,1fr)_86px] gap-3 items-start">
                <div className="min-w-0 space-y-2">
                  {/* Gold Smart Chip + Contactless + Year Pill */}
                  <div className="flex items-center justify-between gap-2 pr-1">
                    <div className="flex items-center gap-2">
                      <div
                        aria-hidden="true"
                        className="w-9 h-6.5 rounded-[5px] bg-[#D6B46C] border border-[#A4813B] relative overflow-hidden shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] shrink-0"
                      >
                        <div className="absolute inset-y-0 left-1/3 w-px bg-[#9B7832]/65" />
                        <div className="absolute inset-y-0 right-1/3 w-px bg-[#9B7832]/65" />
                        <div className="absolute inset-x-0 top-1/2 h-px bg-[#9B7832]/65" />
                        <div className="absolute inset-[5px] rounded-[2px] border border-[#9B7832]/55" />
                      </div>
                      <Wifi
                        size={13}
                        strokeWidth={1.75}
                        className="text-[#6E7482] rotate-90 shrink-0"
                        aria-hidden="true"
                      />
                    </div>

                    {decodedKmutnb?.yearLevel && (
                      <span className="px-2 py-0.5 rounded bg-[#932124]/10 border border-[#932124]/25 text-[10px] font-mono font-semibold tabular-nums text-[#881D20]">
                        {isTh ? `ชั้นปีที่ ${decodedKmutnb.yearLevel}` : `YEAR ${decodedKmutnb.yearLevel}`}
                      </span>
                    )}
                  </div>

                  {/* Official Hyphenated Student ID + Name */}
                  <div className="space-y-0.5">
                    <div className="text-[10px] font-medium text-[#5F6673]">
                      {isTh ? 'รหัสประจำตัวนักศึกษา / Student ID' : 'Student Identification No.'}
                    </div>
                    <div className="text-sm sm:text-[15px] font-mono font-semibold tabular-nums tracking-[0.03em] text-[#12141A] truncate">
                      {formattedId || (isTh ? 'ยังไม่ระบุรหัสนักศึกษา' : 'ID NOT SET')}
                    </div>
                  </div>

                  <div className="space-y-0.5">
                    <div className="text-[10px] font-medium text-[#5F6673]">
                      {isTh ? 'ชื่อ - สกุล / Name' : 'Student Name'}
                    </div>
                    <h2 className="text-sm font-semibold text-[#12141A] truncate">
                      {displayName}
                    </h2>
                  </div>

                  {/* Decoded KMUTNB Faculty / Department / Campus */}
                  {decodedKmutnb ? (
                    <div data-testid="kmutnb-profile-breakdown" className="space-y-0.5">
                      <div className="text-xs font-semibold text-[#881D20] truncate">
                        {decodedKmutnb.faculty[langKey]}
                      </div>
                      {(decodedKmutnb.department || decodedKmutnb.program) && (
                        <div className="text-[10.5px] text-[#373D49] truncate">
                          {decodedKmutnb.department
                            ? (decodedKmutnb.program
                                ? `${decodedKmutnb.department[langKey]} · ${decodedKmutnb.program[langKey]}`
                                : decodedKmutnb.department[langKey])
                            : decodedKmutnb.program?.[langKey]}
                        </div>
                      )}
                      <div className="text-[10px] font-medium text-[#5F6673] flex flex-wrap items-center gap-1">
                        <span>{decodedKmutnb.campusLabel[langKey]}</span>
                        <span>·</span>
                        <span>{isTh ? `ปริญญาตรี (รหัส ${decodedKmutnb.yearShort})` : `Undergraduate (${decodedKmutnb.entryYearBE})`}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-[11px] text-[#4E5563] truncate">
                      {email || (isTh ? 'เชื่อมต่อ Google เพื่อซิงก์ข้อมูลเรียน' : 'Connect Google Classroom to sync')}
                    </div>
                  )}
                </div>

                {/* Right Column: Authentic 3:4 Student ID Portrait Frame */}
                <div className="flex flex-col items-center gap-1.5">
                  <div className="w-[80px] h-[102px] sm:w-[84px] sm:h-[108px] rounded-[8px] overflow-hidden bg-[#CBE3F8] border-[1.5px] border-[#C9C5BA] shadow-xs flex items-center justify-center relative shrink-0">
                    {showAvatar ? (
                      <img
                        src={avatarUrl}
                        alt="Avatar"
                        referrerPolicy="no-referrer"
                        onError={() => setFailedAvatarUrl(avatarUrl)}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-end bg-[#CFE4F7] pt-3">
                        <span className="text-xl font-semibold text-[#1E3A5F] leading-none mb-1">
                          {initial}
                        </span>
                        <div className="w-12 h-7 rounded-t-full bg-[#233858]" />
                      </div>
                    )}
                  </div>

                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/80 border border-[#D5D1C7] text-[9px] font-medium text-[#373D49]">
                    <span className={`w-1.5 h-1.5 rounded-full ${statusDot}`} />
                    <span>{statusLabel}</span>
                  </span>
                </div>
              </div>

              {/* Bottom Barcode & Issue Strip */}
              <div className="pt-1.5 border-t border-[#DCD8CE] flex items-center justify-between gap-3">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 180 22"
                  className="h-3.5 w-32 text-[#181A20] shrink-0"
                  fill="currentColor"
                >
                  {(() => {
                    let x = 0;
                    return barcodeBars.map((b, idx) => {
                      const rectX = x;
                      x += b.width + b.gap;
                      if (rectX + b.width > 180) return null;
                      return <rect key={idx} x={rectX} y="1" width={b.width} height="20" />;
                    });
                  })()}
                </svg>

                <span className="text-[9px] font-mono tabular-nums text-[#5F6673] truncate">
                  {email || 'ICIT · KMUTNB'}
                </span>
              </div>
            </div>
          </div>
        ) : (
          /* ── BACK: Smart Card Magnetic Stripe + 13-Digit ID Structure Decoder (Identical 282px Height) ── */
          <div className="relative h-full overflow-hidden rounded-[16px] bg-[#ECE9E1] text-[#17191F] border border-white/25 shadow-[0_18px_40px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.8)] flex flex-col justify-between pb-3">
            <div>
              {/* Magnetic Stripe */}
              <div className="h-9 w-full bg-[#191C24] mt-3.5" />

              <div className="px-4 pt-3.5 space-y-3">
                {/* Signature & ICIT Account Strip */}
                <div className="flex items-center justify-between gap-2 bg-[#F8F7F3] border border-[#D6D2C7] rounded-md px-3 py-1.5">
                  <span className="text-[11px] font-mono text-[#373D49] truncate">
                    {email || 'sXXXXXXXXXXXXX@email.kmutnb.ac.th'}
                  </span>
                  <span className="text-[10px] font-mono font-semibold text-[#932124] shrink-0">
                    ICIT SSO
                  </span>
                </div>

                {/* 13-Digit Segment Breakdown */}
                {decodedKmutnb ? (
                  <div data-testid="kmutnb-profile-breakdown" className="space-y-2 pt-0.5">
                    <div className="text-[10px] font-semibold text-[#5F6673]">
                      {isTh ? 'โครงสร้างรหัสนักศึกษา 13 หลัก มจพ.' : 'KMUTNB 13-digit ID structure'}
                    </div>
                    <div className="grid grid-cols-5 gap-1.5">
                      {decodedKmutnb.segments.map((seg) => (
                        <div
                          key={seg.key}
                          className="rounded-md bg-white border border-[#D5D1C7] px-1.5 py-2 text-center"
                        >
                          <div className="text-xs font-mono font-semibold tabular-nums text-[#12141A]">
                            {seg.value}
                          </div>
                          <div className="text-[9px] text-[#5F6673] mt-0.5 truncate">
                            {SEGMENT_LABELS[langKey][seg.key]}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="text-[10px] text-[#4E5563] flex items-center justify-between gap-2 pt-0.5">
                      <span className="truncate">{decodedKmutnb.faculty[langKey]}</span>
                      <span className="font-medium text-[#17191F] shrink-0">{decodedKmutnb.campusLabel[langKey]}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-[#4E5563] py-4">
                    {isTh
                      ? 'กรอกรหัสนักศึกษา 13 หลักด้านขวาเพื่อถอดรหัสคณะ ภาควิชา และชั้นปีอัตโนมัติ'
                      : 'Enter your 13-digit KMUTNB Student ID on the right to decode faculty and year'}
                  </p>
                )}
              </div>
            </div>

            <div className="mx-4 pt-2 border-t border-[#D6D2C7] flex items-center justify-between text-[9px] text-[#5F6673]">
              <span>
                {isTh
                  ? 'ใช้ยืนยันตัวตนตารางเรียนและค้นหาผังที่นั่งสอบ'
                  : 'Used for timetable & exam seating lookup'}
              </span>
              <span className="font-mono">REG · SCIBASE</span>
            </div>
          </div>
        )}
      </div>

      {/* Quiet Flip Card Button (Fixed position, zero shift) */}
      <div className="flex items-center justify-between px-1 h-5">
        <span className="text-[11px] text-[var(--text-muted)] truncate">
          {isFlipped
            ? (isTh ? 'ด้านหลังบัตร (โครงสร้างรหัส 13 หลัก)' : 'Card back (13-digit breakdown)')
            : (isTh ? 'หน้าบัตรประจำตัวนักศึกษา มจพ.' : 'KMUTNB student card preview')}
        </span>

        <button
          type="button"
          data-testid="flip-student-card-btn"
          onClick={() => setIsFlipped((prev) => !prev)}
          className="inline-flex items-center justify-end gap-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-heading)] transition-colors cursor-pointer shrink-0 min-w-[116px]"
        >
          <RotateCw size={12} strokeWidth={1.6} />
          <span>{isFlipped ? (isTh ? 'พลิกกลับด้านหน้า' : 'Show front') : (isTh ? 'พลิกดูหลังบัตร' : 'Flip card')}</span>
        </button>
      </div>
    </div>
  );
}
