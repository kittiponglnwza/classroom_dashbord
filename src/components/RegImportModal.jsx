import { useState, useMemo, useRef } from 'react';
import {
  X, Upload, ClipboardPaste, Bookmark, ShieldCheck, CheckCircle2,
  AlertCircle, CalendarDays, ClipboardCheck, GraduationCap, ExternalLink,
  Copy, Check, Trash2, Puzzle, RefreshCw
} from 'lucide-react';
import { parseKmutnbRegInput, buildKmutnbRegBookmarklet } from '../services/parsers/kmutnbRegParser';
import { useClassroom } from '../contexts/ClassroomContext';
import { useDialogFocusTrap } from '../hooks/useDialogFocusTrap';

const DAY_LABELS = {
  mon: { th: 'จ.', en: 'Mon' },
  tue: { th: 'อ.', en: 'Tue' },
  wed: { th: 'พ.', en: 'Wed' },
  thu: { th: 'พฤ.', en: 'Thu' },
  fri: { th: 'ศ.', en: 'Fri' },
  sat: { th: 'ส.', en: 'Sat' },
  sun: { th: 'อา.', en: 'Sun' },
};

export default function RegImportModal({
  isOpen,
  onClose,
  onImported,
  initialText = '',
  defaultFocus = 'all',
  lang = 'th'
}) {
  const { courses, handleImportRegData, extensionStatus, requestExtensionSync } = useClassroom();
  const [inputMode, setInputMode] = useState('paste'); // paste | file | extension | bookmarklet
  const [rawText, setRawText] = useState(initialText);
  const [fileName, setFileName] = useState('');
  const [importSchedule, setImportSchedule] = useState(true);
  const [replaceRegSchedule, setReplaceRegSchedule] = useState(true);
  const [importExams, setImportExams] = useState(true);
  const [importGrades, setImportGrades] = useState(true);
  const [copiedBookmarklet, setCopiedBookmarklet] = useState(false);
  const fileInputRef = useRef(null);
  const dialogRef = useRef(null);

  useDialogFocusTrap(isOpen, dialogRef, { onClose });

  const parsed = useMemo(() => {
    if (!rawText.trim()) return null;
    return parseKmutnbRegInput(rawText, courses || []);
  }, [rawText, courses]);

  const bookmarkletHref = useMemo(() => {
    const origin = typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://classrooms-hub.vercel.app';
    return buildKmutnbRegBookmarklet(origin);
  }, []);

  if (!isOpen) return null;

  const isTh = lang === 'th';

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = String(ev.target?.result || '');
      setRawText(content);
    };
    reader.readAsText(file, 'utf-8');
  };

  const handleCopyBookmarklet = async () => {
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(bookmarkletHref);
      } else {
        const ta = document.createElement('textarea');
        ta.value = bookmarkletHref;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopiedBookmarklet(true);
      setTimeout(() => setCopiedBookmarklet(false), 3000);
    } catch {
      // Fallback ignored silently
    }
  };

  const canConfirm = Boolean(
    parsed?.success &&
    (
      (importSchedule && parsed.meta.totalScheduleSlots > 0) ||
      (importExams && parsed.meta.totalExams > 0) ||
      (importGrades && (parsed.meta.hasGrades || parsed.meta.totalEnrolledCourses > 0))
    )
  );

  const handleConfirm = () => {
    if (!canConfirm) return;
    handleImportRegData(parsed, {
      importSchedule,
      replaceRegSchedule,
      importExams,
      importGrades,
    });
    onImported?.(parsed);
    onClose?.();
  };

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={isTh ? 'นำเข้าข้อมูลจาก KMUTNB Reg' : 'Import from KMUTNB Reg'}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="bg-[var(--surface)] border border-[var(--border-strong)] rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <h2 className="text-base font-medium text-[var(--text-heading)] flex items-center gap-2">
              <GraduationCap size={18} strokeWidth={1.5} className="text-[var(--primary-bright)] shrink-0" />
              <span className="truncate">
                {isTh ? 'นำเข้าข้อมูลจาก KMUTNB Reg' : 'Import from KMUTNB Reg'}
              </span>
            </h2>
            <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
              {isTh
                ? 'รองรับหน้า ตารางเรียน/สอบ (timetable) และ ผลการศึกษา (grade) — วางรวมกันทีเดียวได้เลย'
                : 'Supports Timetable/Exams (timetable) and Grades (grade) — paste separately or together.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={isTh ? 'ปิดหน้าต่าง' : 'Close'}
            className="w-11 h-11 sm:w-9 sm:h-9 -mr-2 sm:mr-0 flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-heading)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Privacy Notice */}
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3.5 py-2.5 flex items-start gap-2.5 text-xs text-emerald-300">
            <ShieldCheck size={16} strokeWidth={1.5} className="text-emerald-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              {isTh
                ? 'ปลอดภัย 100%: แกะข้อมูลบนเครื่องของคุณเท่านั้น ไม่ต้องกรอกรหัส ICIT ระบบจะตัดชื่อ-สกุลและข้อมูลส่วนตัวทิ้งอัตโนมัติ เก็บเฉพาะรายวิชา ตารางเรียน วันสอบ และเกรด (ซิงค์เฉพาะ Google Drive ส่วนตัวของคุณ)'
                : '100% Client-Side & Private: No ICIT password needed. Personal identifiers (name, student ID, phone) are stripped automatically. Only course, schedule, exam, and grade records are stored in your private Drive appDataFolder.'}
            </p>
          </div>

          {/* Direct Links to KMUTNB Reg */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-[var(--text-secondary)] font-medium">
              {isTh ? 'เปิดหน้าเว็บ มจพ.:' : 'Open KMUTNB Reg:'}
            </span>
            <a
              href="https://reg.kmutnb.ac.th/registrar/timetable"
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors font-medium ${
                defaultFocus === 'schedule'
                  ? 'bg-[var(--primary)]/15 border-[var(--primary)]/40 text-[var(--primary-bright)]'
                  : 'bg-[var(--app-bg)] border-[var(--border)] text-[var(--text-primary)] hover:border-[var(--primary)]/60'
              }`}
            >
              <CalendarDays size={13} strokeWidth={1.5} className="text-[var(--primary-bright)]" />
              <span>{isTh ? 'ตารางเรียน/สอบ' : 'Timetable & Exams'}</span>
              <ExternalLink size={11} strokeWidth={1.5} />
            </a>
            <a
              href="https://reg.kmutnb.ac.th/registrar/grade"
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors font-medium ${
                defaultFocus === 'academic'
                  ? 'bg-[var(--primary)]/15 border-[var(--primary)]/40 text-[var(--primary-bright)]'
                  : 'bg-[var(--app-bg)] border-[var(--border)] text-[var(--text-primary)] hover:border-[var(--primary)]/60'
              }`}
            >
              <GraduationCap size={13} strokeWidth={1.5} className="text-emerald-400" />
              <span>{isTh ? 'ผลการศึกษา (เกรด)' : 'Grade Report'}</span>
              <ExternalLink size={11} strokeWidth={1.5} />
            </a>
          </div>

          {/* Extension Auto-Sync Status Bar (if installed) */}
          {extensionStatus?.connected && (
            <div className="bg-[var(--primary)]/12 border border-[var(--primary)]/35 rounded-lg px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 text-[var(--text-primary)]">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                <span>
                  {isTh
                    ? 'เชื่อมต่อ Chrome Extension Auto-Sync แล้ว — แค่เปิดหน้า Reg มจพ. ระบบจะซิงค์ให้อัตโนมัติ'
                    : 'Chrome Extension Auto-Sync connected — visiting KMUTNB Reg pages syncs automatically.'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  requestExtensionSync?.();
                  onClose?.();
                }}
                className="inline-flex items-center gap-1.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-medium px-3 py-1.5 rounded-lg transition-colors cursor-pointer shrink-0"
              >
                <RefreshCw size={12} strokeWidth={1.5} />
                <span>{isTh ? 'ซิงค์จาก Extension เดี๋ยวนี้' : 'Sync from Extension Now'}</span>
              </button>
            </div>
          )}

          {/* Input Mode Selector */}
          <div className="grid grid-cols-2 sm:grid-cols-4 bg-[var(--app-bg)] border border-[var(--border)] p-1 rounded-lg gap-1">
            {[
              { id: 'paste', icon: ClipboardPaste, labelTh: 'วางข้อความ (แนะนำ)', labelEn: 'Paste (Recommended)' },
              { id: 'extension', icon: Puzzle, labelTh: 'Extension (Auto)', labelEn: 'Extension (Auto)' },
              { id: 'file', icon: Upload, labelTh: 'ไฟล์ .html', labelEn: '.html File' },
              { id: 'bookmarklet', icon: Bookmark, labelTh: 'Bookmarklet', labelEn: 'Bookmarklet' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setInputMode(tab.id)}
                className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  inputMode === tab.id
                    ? 'bg-[var(--surface-elevated)] text-[var(--text-heading)] border border-[var(--border-strong)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <tab.icon size={13} strokeWidth={1.5} className="shrink-0" />
                <span className="truncate">{isTh ? tab.labelTh : tab.labelEn}</span>
              </button>
            ))}
          </div>

          {/* Input Area */}
          {inputMode === 'paste' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="kmutnb-reg-paste" className="text-[var(--text-primary)] font-medium">
                  {isTh
                    ? '1. เปิดหน้าเว็บ มจพ. → กด Ctrl+A แล้ว Ctrl+C → 2. วางลงช่องด้านล่าง (Ctrl+V)'
                    : '1. On KMUTNB Reg press Ctrl+A then Ctrl+C → 2. Paste below (Ctrl+V)'}
                </label>
                {rawText && (
                  <button
                    type="button"
                    onClick={() => {
                      setRawText('');
                      setFileName('');
                    }}
                    className="text-[11px] text-rose-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 size={11} strokeWidth={1.5} />
                    <span>{isTh ? 'ล้างข้อความ' : 'Clear'}</span>
                  </button>
                )}
              </div>
              <textarea
                id="kmutnb-reg-paste"
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                rows={6}
                placeholder={
                  isTh
                    ? 'วางข้อความจากหน้า ตารางเรียน/สอบ หรือ ผลการศึกษา ของ reg.kmutnb.ac.th ที่นี่ (วางต่อกันทั้ง 2 หน้าได้เลย)...'
                    : 'Paste text copied from reg.kmutnb.ac.th timetable or grade report here...'
                }
                className="w-full bg-[var(--app-bg)] border border-[var(--border)] rounded-lg p-3 text-base sm:text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] font-mono focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] resize-y"
              />
            </div>
          )}

          {inputMode === 'file' && (
            <div className="space-y-2.5">
              <input
                ref={fileInputRef}
                type="file"
                accept=".html,.htm,.txt"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-8 px-4 rounded-lg border-2 border-dashed border-[var(--border)] hover:border-[var(--primary)]/70 bg-[var(--app-bg)] flex flex-col items-center justify-center gap-2 text-center transition-colors cursor-pointer"
              >
                <Upload size={24} strokeWidth={1.5} className="text-[var(--primary-bright)]" />
                <span className="text-xs font-medium text-[var(--text-heading)]">
                  {fileName
                    ? `${isTh ? 'เลือกไฟล์แล้ว:' : 'Selected:'} ${fileName}`
                    : (isTh ? 'คลิกเพื่อเลือกไฟล์ .html / .txt ที่บันทึกจากหน้า Reg มจพ.' : 'Click to choose .html / .txt saved from KMUTNB Reg')}
                </span>
                <span className="text-[11px] text-[var(--text-muted)]">
                  {isTh ? 'กด Ctrl+S (Save Page As) ที่หน้า ตารางเรียน/สอบ หรือ ผลการศึกษา แล้วอัปโหลดที่นี่' : 'Press Ctrl+S on KMUTNB Reg page and upload the saved file here'}
                </span>
              </button>
            </div>
          )}

          {inputMode === 'extension' && (
            <div className="bg-[var(--app-bg)] border border-[var(--border)] rounded-lg p-4 space-y-3 text-xs">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[var(--text-heading)] font-medium flex items-center gap-1.5">
                  <Puzzle size={14} strokeWidth={1.5} className="text-[var(--primary-bright)]" />
                  <span>
                    {isTh
                      ? 'Chrome / Edge Extension — ซิงค์อัตโนมัติไม่ต้องก๊อปวาง'
                      : 'Chrome / Edge Extension — Zero-Copy Auto-Sync'}
                  </span>
                </p>
                <span
                  className={`text-[11px] font-medium px-2 py-0.5 rounded-lg border ${
                    extensionStatus?.connected
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      : 'bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border)]'
                  }`}
                >
                  {extensionStatus?.connected
                    ? (isTh ? 'เชื่อมต่อแล้ว' : 'Connected')
                    : (isTh ? 'ยังไม่ได้ติดตั้ง' : 'Not Installed')}
                </span>
              </div>

              <ol className="list-decimal list-inside space-y-1.5 text-[var(--text-secondary)] leading-relaxed">
                <li>
                  {isTh
                    ? 'กดปุ่ม "ดาวน์โหลด Extension (.zip)" ด้านล่าง แล้วคลิกขวาแตกไฟล์ (Extract All) ลงโฟลเดอร์'
                    : 'Click "Download Extension (.zip)" below and extract it into a folder on your computer.'}
                </li>
                <li>
                  {isTh
                    ? 'เปิดหน้า chrome://extensions (Chrome) หรือ edge://extensions (Edge) แล้วเปิดสวิตช์ Developer mode มุมขวาบน'
                    : 'Open chrome://extensions (or edge://extensions) and enable Developer mode.'}
                </li>
                <li>
                  {isTh
                    ? 'กดปุ่ม Load unpacked แล้วเลือกโฟลเดอร์ที่เพิ่งแตกไฟล์ออกมา'
                    : 'Click Load unpacked and select the extracted folder.'}
                </li>
                <li>
                  {isTh
                    ? 'หลังจากนั้น แค่เปิดหน้า ตารางเรียน/สอบ หรือ ผลการศึกษา บน reg.kmutnb.ac.th ระบบจะเก็บข้อมูลให้อัตโนมัติ และซิงค์เข้าเว็บนี้ทันทีเมื่อคุณกลับมาเปิด'
                    : 'Whenever you visit Timetable or Grades on reg.kmutnb.ac.th, the extension captures the sanitized table and auto-syncs it here.'}
                </li>
              </ol>

              <div className="pt-1 flex flex-wrap items-center gap-2">
                <a
                  href="/classrooms-reg-extension.zip"
                  download="classrooms-reg-extension.zip"
                  className="inline-flex items-center gap-1.5 bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--text-heading)] border border-[var(--border)] font-medium px-3.5 py-2 rounded-lg transition-colors"
                >
                  <Upload size={13} strokeWidth={1.5} className="rotate-180 text-[var(--primary-bright)]" />
                  <span>{isTh ? 'ดาวน์โหลด Extension (.zip)' : 'Download Extension (.zip)'}</span>
                </a>
                {extensionStatus?.connected && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        requestExtensionSync?.();
                        onClose?.();
                      }}
                      className="inline-flex items-center gap-1.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-medium px-3.5 py-2 rounded-lg transition-colors cursor-pointer"
                    >
                      <RefreshCw size={13} strokeWidth={1.5} />
                      <span>{isTh ? 'ดึงข้อมูลล่าสุดจาก Extension เดี๋ยวนี้' : 'Pull Latest from Extension'}</span>
                    </button>
                    {extensionStatus.timetableCount > 0 && (
                      <span className="text-[11px] text-[var(--text-secondary)] font-mono tabular-nums">
                        {isTh ? `ตารางเรียนพร้อมส่ง: ${extensionStatus.timetableCount} วิชา` : `Timetable ready: ${extensionStatus.timetableCount} courses`}
                      </span>
                    )}
                    {extensionStatus.gradeCount > 0 && (
                      <span className="text-[11px] text-[var(--text-secondary)] font-mono tabular-nums">
                        {isTh ? `ผลการศึกษาพร้อมส่ง: ${extensionStatus.gradeCount} เทอม` : `Grades ready: ${extensionStatus.gradeCount} semesters`}
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {inputMode === 'bookmarklet' && (
            <div className="bg-[var(--app-bg)] border border-[var(--border)] rounded-lg p-4 space-y-3 text-xs">
              <p className="text-[var(--text-primary)] font-medium">
                {isTh ? 'วิธีตั้งค่าปุ่มซิงค์ 1 คลิก (ทำครั้งเดียวใช้ได้ตลอดไป):' : 'One-time setup for 1-Click Sync:'}
              </p>
              <ol className="list-decimal list-inside space-y-1.5 text-[var(--text-secondary)] leading-relaxed">
                <li>{isTh ? 'กดปุ่ม "คัดลอกโค้ด Bookmarklet" ด้านล่าง' : 'Click "Copy Bookmarklet Code" below.'}</li>
                <li>{isTh ? 'สร้าง Bookmark ใหม่บนเบราว์เซอร์ ตั้งชื่อว่า "Sync KMUTNB Reg" แล้ววางโค้ดลงในช่อง URL' : 'Create a new browser bookmark named "Sync KMUTNB Reg" and paste the code into its URL field.'}</li>
                <li>{isTh ? 'เวลาเปิดหน้า ตารางเรียน/สอบ หรือ ผลการศึกษา บน reg.kmutnb.ac.th กด Bookmark นี้ 1 ที → หน้าต่าง Classroom Hub จะเปิดพร้อมข้อมูลทันที' : 'While viewing Timetable or Grades on reg.kmutnb.ac.th, click the bookmark → Classroom Hub opens with your preview ready.'}</li>
              </ol>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCopyBookmarklet}
                  className="inline-flex items-center gap-1.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-medium px-3.5 py-2 rounded-lg transition-colors cursor-pointer"
                >
                  {copiedBookmarklet ? <Check size={14} strokeWidth={1.5} /> : <Copy size={14} strokeWidth={1.5} />}
                  <span>
                    {copiedBookmarklet
                      ? (isTh ? 'คัดลอกโค้ดแล้ว' : 'Copied')
                      : (isTh ? 'คัดลอกโค้ด Bookmarklet' : 'Copy Bookmarklet Code')}
                  </span>
                </button>
                <span className="text-[11px] text-[var(--text-muted)]">
                  {isTh ? 'ไม่แตะ Cookie/รหัสผ่าน และลบข้อมูลออกจาก URL ทันทีที่เปิด' : 'Never reads passwords/cookies and scrubs URL hash immediately.'}
                </span>
              </div>
            </div>
          )}

          {/* Live Parse Preview */}
          {parsed && !parsed.success && (
            <div className="bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs px-4 py-3 rounded-lg flex items-start gap-2.5">
              <AlertCircle size={15} strokeWidth={1.5} className="text-rose-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">
                  {isTh ? 'ยังไม่พบรูปแบบตารางของ KMUTNB Reg' : 'Could not recognize KMUTNB Reg table format'}
                </p>
                <p className="text-[11px] text-rose-300/80 mt-0.5">
                  {isTh
                    ? 'ลองเปิดหน้า ตารางเรียน/สอบ (timetable) หรือ ผลการศึกษา (grade) แล้วกด Ctrl+A → Ctrl+C มาวางทั้งหมด'
                    : 'Make sure you copy the full page (Ctrl+A → Ctrl+C) from reg.kmutnb.ac.th/registrar/timetable or /grade.'}
                </p>
              </div>
            </div>
          )}

          {parsed?.success && (
            <div className="bg-[var(--app-bg)] border border-[var(--border)] rounded-lg p-4 space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-medium text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 size={15} strokeWidth={1.5} />
                  <span>{isTh ? 'ตรวจพบข้อมูลพร้อมนำเข้า' : 'Detected Data Ready to Import'}</span>
                </h3>
                {parsed.timetable.academicYear && (
                  <span className="text-[11px] font-mono tabular-nums px-2 py-0.5 rounded-md bg-[var(--surface)] border border-[var(--border)] text-[var(--text-secondary)]">
                    {isTh ? `ปีการศึกษา ${parsed.timetable.academicYear}` : `Year ${parsed.timetable.academicYear}`}
                  </span>
                )}
              </div>

              {/* Summary badges */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {parsed.meta.hasTimetable && (
                  <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-3">
                    <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)]">
                      <CalendarDays size={13} strokeWidth={1.5} className="text-[var(--primary-bright)]" />
                      <span>{isTh ? 'ตารางเรียน' : 'Class Schedule'}</span>
                    </div>
                    <p className="text-sm font-medium text-[var(--text-heading)] font-mono tabular-nums mt-1">
                      {parsed.meta.totalScheduleSlots} {isTh ? 'คาบ' : 'slots'}
                    </p>
                    <p className="text-[11px] text-[var(--text-muted)] font-mono tabular-nums">
                      {parsed.meta.totalEnrolledCourses} {isTh ? 'วิชา' : 'courses'} • {parsed.meta.totalEnrolledCredits} {isTh ? 'นก.' : 'cr'}
                    </p>
                  </div>
                )}

                {parsed.meta.totalExams > 0 && (
                  <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-3">
                    <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)]">
                      <ClipboardCheck size={13} strokeWidth={1.5} className="text-rose-400" />
                      <span>{isTh ? 'วันสอบกลางภาค/ปลายภาค' : 'Midterm & Final Exams'}</span>
                    </div>
                    <p className="text-sm font-medium text-[var(--text-heading)] font-mono tabular-nums mt-1">
                      {parsed.meta.totalExams} {isTh ? 'รอบสอบ' : 'exams'}
                    </p>
                    <p className="text-[11px] text-[var(--text-muted)]">
                      {isTh ? 'ตัดรายการซ้ำ S/L ให้อัตโนมัติ' : 'Deduplicated across S/L sections'}
                    </p>
                  </div>
                )}

                {parsed.meta.hasGrades && (
                  <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-3">
                    <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)]">
                      <GraduationCap size={13} strokeWidth={1.5} className="text-emerald-400" />
                      <span>{isTh ? 'ผลการศึกษา' : 'Grade History'}</span>
                    </div>
                    <p className="text-sm font-medium text-[var(--text-heading)] font-mono tabular-nums mt-1">
                      {parsed.meta.totalSemesters} {isTh ? 'เทอม' : 'semesters'}
                    </p>
                    <p className="text-[11px] text-[var(--text-muted)] font-mono tabular-nums">
                      {parsed.meta.totalGradeRows} {isTh ? 'รายวิชา' : 'graded rows'}
                    </p>
                  </div>
                )}
              </div>

              {/* Selectable Import Options */}
              <div className="space-y-2 pt-1 border-t border-[var(--border)]">
                {parsed.meta.hasTimetable && parsed.meta.totalScheduleSlots === 0 && (
                  <div className="bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] px-3 py-2 rounded-lg">
                    {isTh
                      ? 'พบรายวิชาที่ลงทะเบียน แต่ไม่พบวัน-เวลาเรียนในข้อความนี้ — หากต้องการให้ขึ้นบนตารางเรียนและปฏิทิน ให้ก๊อปจากหน้า "ตารางเรียน/สอบ" (timetable)'
                      : 'Enrolled courses found, but no class times were detected — copy from the "Timetable" page to populate Schedule & Calendar.'}
                  </div>
                )}

                {parsed.meta.totalScheduleSlots > 0 && (
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-2 text-xs text-[var(--text-primary)] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={importSchedule}
                        onChange={(e) => setImportSchedule(e.target.checked)}
                        className="w-3.5 h-3.5 accent-[var(--primary)] cursor-pointer"
                      />
                      <span>
                        {isTh
                          ? `นำเข้าตารางเรียน ${parsed.meta.totalScheduleSlots} คาบ เข้าหน้าตารางเรียน (+ ซิงค์ Google Calendar)`
                          : `Import ${parsed.meta.totalScheduleSlots} class slots to Schedule (+ Google Calendar sync)`}
                      </span>
                    </label>
                    {importSchedule && (
                      <label className="flex items-center gap-2 text-[11px] text-[var(--text-secondary)] pl-5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={replaceRegSchedule}
                          onChange={(e) => setReplaceRegSchedule(e.target.checked)}
                          className="w-3 h-3 accent-[var(--primary)] cursor-pointer"
                        />
                        <span>
                          {isTh
                            ? 'แทนที่ตารางเรียนที่เคยนำเข้าจาก Reg เดิม (คงคาบที่เพิ่มเองไว้)'
                            : 'Replace previously imported Reg classes (keeps manually added classes)'}
                        </span>
                      </label>
                    )}
                  </div>
                )}

                {parsed.meta.totalExams > 0 && (
                  <label className="flex items-center gap-2 text-xs text-[var(--text-primary)] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={importExams}
                      onChange={(e) => setImportExams(e.target.checked)}
                      className="w-3.5 h-3.5 accent-[var(--primary)] cursor-pointer"
                    />
                    <span>
                      {isTh
                        ? `นำเข้าวันสอบ ${parsed.meta.totalExams} รายการ เข้าหน้าห้องสอบ & ตารางเรียน`
                        : `Import ${parsed.meta.totalExams} exam dates to Exam Room & Schedule`}
                    </span>
                  </label>
                )}

                {(parsed.meta.hasGrades || parsed.meta.totalEnrolledCourses > 0) && (
                  <label className="flex items-center gap-2 text-xs text-[var(--text-primary)] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={importGrades}
                      onChange={(e) => setImportGrades(e.target.checked)}
                      className="w-3.5 h-3.5 accent-[var(--primary)] cursor-pointer"
                    />
                    <span>
                      {isTh
                        ? parsed.meta.hasGrades
                          ? `นำเข้าเกรด ${parsed.meta.totalSemesters} เทอม + อัปเดตรายวิชาที่ผ่านแล้วและเกณฑ์จบหลักสูตร`
                          : `บันทึกรายวิชาที่กำลังลงทะเบียน (${parsed.meta.totalEnrolledCourses} วิชา / ${parsed.meta.totalEnrolledCredits} นก.) เพื่อคิดเกณฑ์จบ & จำลองเกรด`
                        : parsed.meta.hasGrades
                          ? `Import ${parsed.meta.totalSemesters} semesters of grades & recalculate graduation progress`
                          : `Save ${parsed.meta.totalEnrolledCourses} enrolled courses (${parsed.meta.totalEnrolledCredits} cr) for graduation & GPA simulator`}
                    </span>
                  </label>
                )}
              </div>

              {/* Quick Preview List */}
              {parsed.timetable.scheduleEntries.length > 0 && (
                <div className="pt-2 border-t border-[var(--border)]">
                  <p className="text-[11px] font-medium text-[var(--text-secondary)] mb-1.5">
                    {isTh ? 'ตัวอย่างตารางเรียนที่จะนำเข้า:' : 'Schedule Preview:'}
                  </p>
                  <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                    {parsed.timetable.scheduleEntries.map((slot) => (
                      <div
                        key={slot.id}
                        className="flex items-center justify-between gap-2 text-[11px] bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2.5 py-1.5"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: slot.color }}
                          />
                          <span className="font-mono tabular-nums text-[var(--primary-bright)] shrink-0">
                            {DAY_LABELS[slot.day]?.[lang] || slot.day} {slot.startTime}-{slot.endTime}
                          </span>
                          <span className="text-[var(--text-primary)] truncate">{slot.title}</span>
                        </div>
                        <span className="text-[var(--text-muted)] font-mono shrink-0">{slot.room || '-'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {parsed.grades.semesters.length > 0 && (
                <div className="pt-2 border-t border-[var(--border)]">
                  <p className="text-[11px] font-medium text-[var(--text-secondary)] mb-1.5">
                    {isTh ? 'เทอมที่ตรวจพบในผลการศึกษา:' : 'Detected Grade Semesters:'}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {parsed.grades.semesters.map((s) => (
                      <span
                        key={s.semesterId}
                        className="text-[11px] px-2.5 py-1 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] font-mono tabular-nums"
                      >
                        {s.semesterId} ({s.courses.length} {isTh ? 'วิชา' : 'courses'})
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-[var(--border)] bg-[var(--app-bg)] flex items-center justify-end gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-medium bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
          >
            {isTh ? 'ยกเลิก' : 'Cancel'}
          </button>
          <button
            type="button"
            disabled={!canConfirm}
            onClick={handleConfirm}
            className="px-4 py-2 rounded-lg text-xs font-medium bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors cursor-pointer"
          >
            {isTh ? 'ยืนยันนำเข้าข้อมูล' : 'Confirm Import'}
          </button>
        </div>
      </div>
    </div>
  );
}
