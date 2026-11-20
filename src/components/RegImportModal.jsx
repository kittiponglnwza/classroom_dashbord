import { useState, useEffect, useMemo, useRef } from 'react';
import {
  X, Upload, ClipboardPaste, Bookmark, ShieldCheck, CheckCircle2,
  AlertCircle, CalendarDays, ClipboardCheck, GraduationCap, ExternalLink,
  Copy, Check, Trash2
} from 'lucide-react';
import { parseKmutnbRegInput, buildKmutnbRegBookmarklet } from '../services/parsers/kmutnbRegParser';
import { useClassroom } from '../contexts/ClassroomContext';

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
  const { courses, handleImportRegData } = useClassroom();
  const [inputMode, setInputMode] = useState('paste'); // paste | file | bookmarklet
  const [rawText, setRawText] = useState(initialText);
  const [fileName, setFileName] = useState('');
  const [importSchedule, setImportSchedule] = useState(true);
  const [replaceRegSchedule, setReplaceRegSchedule] = useState(true);
  const [importExams, setImportExams] = useState(true);
  const [importGrades, setImportGrades] = useState(true);
  const [copiedBookmarklet, setCopiedBookmarklet] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={isTh ? 'นำเข้าข้อมูลจาก KMUTNB Reg' : 'Import from KMUTNB Reg'}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="bg-[#252526] border border-[#3C3C3C] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#3C3C3C] flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-[#FFFFFF] flex items-center gap-2">
              <GraduationCap size={18} className="text-[#3794FF] shrink-0" />
              <span className="truncate">
                {isTh ? 'นำเข้าข้อมูลจาก KMUTNB Reg' : 'Import from KMUTNB Reg'}
              </span>
            </h2>
            <p className="text-[11px] text-[#9D9D9D] mt-0.5">
              {isTh
                ? 'รองรับหน้า ตารางเรียน/สอบ (timetable) และ ผลการศึกษา (grade) — วางรวมกันทีเดียวได้เลย'
                : 'Supports Timetable/Exams (timetable) and Grades (grade) — paste separately or together.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={isTh ? 'ปิดหน้าต่าง' : 'Close'}
            className="p-1.5 rounded-lg text-[#9D9D9D] hover:text-[#FFFFFF] hover:bg-[#2A2D2E] transition-colors cursor-pointer shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Privacy Notice */}
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-3.5 py-2.5 flex items-start gap-2.5 text-xs text-emerald-300">
            <ShieldCheck size={16} className="text-emerald-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              {isTh
                ? 'ปลอดภัย 100%: แกะข้อมูลบนเครื่องของคุณเท่านั้น ไม่ต้องกรอกรหัส ICIT ระบบจะตัดชื่อ-สกุลและข้อมูลส่วนตัวทิ้งอัตโนมัติ เก็บเฉพาะรายวิชา ตารางเรียน วันสอบ และเกรด (ซิงค์เฉพาะ Google Drive ส่วนตัวของคุณ)'
                : '100% Client-Side & Private: No ICIT password needed. Personal identifiers (name, student ID, phone) are stripped automatically. Only course, schedule, exam, and grade records are stored in your private Drive appDataFolder.'}
            </p>
          </div>

          {/* Direct Links to KMUTNB Reg */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-[#9D9D9D] font-medium">
              {isTh ? 'เปิดหน้าเว็บ มจพ.:' : 'Open KMUTNB Reg:'}
            </span>
            <a
              href="https://reg.kmutnb.ac.th/registrar/timetable"
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors font-medium ${
                defaultFocus === 'schedule'
                  ? 'bg-[#007ACC]/20 border-[#007ACC]/50 text-[#3794FF]'
                  : 'bg-[#1E1E1E] border-[#3C3C3C] text-[#D4D4D4] hover:border-[#007ACC]/60'
              }`}
            >
              <CalendarDays size={13} className="text-[#3794FF]" />
              <span>{isTh ? 'ตารางเรียน/สอบ' : 'Timetable & Exams'}</span>
              <ExternalLink size={11} />
            </a>
            <a
              href="https://reg.kmutnb.ac.th/registrar/grade"
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors font-medium ${
                defaultFocus === 'academic'
                  ? 'bg-[#007ACC]/20 border-[#007ACC]/50 text-[#3794FF]'
                  : 'bg-[#1E1E1E] border-[#3C3C3C] text-[#D4D4D4] hover:border-[#007ACC]/60'
              }`}
            >
              <GraduationCap size={13} className="text-emerald-400" />
              <span>{isTh ? 'ผลการศึกษา (เกรด)' : 'Grade Report'}</span>
              <ExternalLink size={11} />
            </a>
          </div>

          {/* Input Mode Selector */}
          <div className="flex bg-[#1E1E1E] border border-[#3C3C3C] p-1 rounded-xl gap-1">
            {[
              { id: 'paste', icon: ClipboardPaste, labelTh: 'วางข้อความ (Ctrl+A → C)', labelEn: 'Paste Text (Ctrl+A → C)' },
              { id: 'file', icon: Upload, labelTh: 'อัปโหลดไฟล์ .html', labelEn: 'Upload .html File' },
              { id: 'bookmarklet', icon: Bookmark, labelTh: 'Bookmarklet 1 คลิก', labelEn: '1-Click Bookmarklet' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setInputMode(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  inputMode === tab.id
                    ? 'bg-[#094771]/70 text-[#FFFFFF] border border-[#007ACC]/50'
                    : 'text-[#9D9D9D] hover:text-[#D4D4D4]'
                }`}
              >
                <tab.icon size={13} />
                <span className="truncate">{isTh ? tab.labelTh : tab.labelEn}</span>
              </button>
            ))}
          </div>

          {/* Input Area */}
          {inputMode === 'paste' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="kmutnb-reg-paste" className="text-[#D4D4D4] font-medium">
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
                    <Trash2 size={11} />
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
                className="w-full bg-[#1E1E1E] border border-[#3C3C3C] rounded-xl p-3 text-xs text-[#D4D4D4] placeholder-[#858585] font-mono focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007ACC] resize-y"
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
                className="w-full py-8 px-4 rounded-xl border-2 border-dashed border-[#3C3C3C] hover:border-[#007ACC]/70 bg-[#1E1E1E] flex flex-col items-center justify-center gap-2 text-center transition-colors cursor-pointer"
              >
                <Upload size={24} className="text-[#3794FF]" />
                <span className="text-xs font-medium text-[#FFFFFF]">
                  {fileName
                    ? `${isTh ? 'เลือกไฟล์แล้ว:' : 'Selected:'} ${fileName}`
                    : (isTh ? 'คลิกเพื่อเลือกไฟล์ .html / .txt ที่บันทึกจากหน้า Reg มจพ.' : 'Click to choose .html / .txt saved from KMUTNB Reg')}
                </span>
                <span className="text-[11px] text-[#858585]">
                  {isTh ? 'กด Ctrl+S (Save Page As) ที่หน้า ตารางเรียน/สอบ หรือ ผลการศึกษา แล้วอัปโหลดที่นี่' : 'Press Ctrl+S on KMUTNB Reg page and upload the saved file here'}
                </span>
              </button>
            </div>
          )}

          {inputMode === 'bookmarklet' && (
            <div className="bg-[#1E1E1E] border border-[#3C3C3C] rounded-xl p-4 space-y-3 text-xs">
              <p className="text-[#D4D4D4] font-medium">
                {isTh ? 'วิธีตั้งค่าปุ่มซิงค์ 1 คลิก (ทำครั้งเดียวใช้ได้ตลอดไป):' : 'One-time setup for 1-Click Sync:'}
              </p>
              <ol className="list-decimal list-inside space-y-1.5 text-[#9D9D9D] leading-relaxed">
                <li>{isTh ? 'กดปุ่ม "คัดลอกโค้ด Bookmarklet" ด้านล่าง' : 'Click "Copy Bookmarklet Code" below.'}</li>
                <li>{isTh ? 'สร้าง Bookmark ใหม่บนเบราว์เซอร์ ตั้งชื่อว่า "Sync KMUTNB Reg" แล้ววางโค้ดลงในช่อง URL' : 'Create a new browser bookmark named "Sync KMUTNB Reg" and paste the code into its URL field.'}</li>
                <li>{isTh ? 'เวลาเปิดหน้า ตารางเรียน/สอบ หรือ ผลการศึกษา บน reg.kmutnb.ac.th กด Bookmark นี้ 1 ที → หน้าต่าง Classroom Hub จะเด้งพร้อมข้อมูลทันที!' : 'While viewing Timetable or Grades on reg.kmutnb.ac.th, click the bookmark → Classroom Hub opens with your preview ready!'}</li>
              </ol>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCopyBookmarklet}
                  className="inline-flex items-center gap-1.5 bg-[#007ACC] hover:bg-[#1177BB] text-white font-medium px-3.5 py-2 rounded-lg transition-colors cursor-pointer"
                >
                  {copiedBookmarklet ? <Check size={14} /> : <Copy size={14} />}
                  <span>
                    {copiedBookmarklet
                      ? (isTh ? 'คัดลอกโค้ดแล้ว!' : 'Copied!')
                      : (isTh ? 'คัดลอกโค้ด Bookmarklet' : 'Copy Bookmarklet Code')}
                  </span>
                </button>
                <span className="text-[11px] text-[#858585]">
                  {isTh ? 'ไม่แตะ Cookie/รหัสผ่าน และลบข้อมูลออกจาก URL ทันทีที่เปิด' : 'Never reads passwords/cookies and scrubs URL hash immediately.'}
                </span>
              </div>
            </div>
          )}

          {/* Live Parse Preview */}
          {parsed && !parsed.success && (
            <div className="bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs px-4 py-3 rounded-xl flex items-start gap-2.5">
              <AlertCircle size={15} className="text-rose-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">
                  {isTh ? 'ยังไม่พบรูปแบบตารางของ KMUTNB Reg' : 'Could not recognize KMUTNB Reg table format'}
                </p>
                <p className="text-[11px] text-rose-300/80 mt-0.5">
                  {isTh
                    ? 'ลองเปิดหน้า ตารางเรียน/สอบ (timetable) หรือ ผลการศึกษา (grade) แล้วกด Ctrl+A → Ctrl+C มาวางทั้งหมดเลยครับ'
                    : 'Make sure you copy the full page (Ctrl+A → Ctrl+C) from reg.kmutnb.ac.th/registrar/timetable or /grade.'}
                </p>
              </div>
            </div>
          )}

          {parsed?.success && (
            <div className="bg-[#1E1E1E] border border-[#3C3C3C] rounded-xl p-4 space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 size={15} />
                  <span>{isTh ? 'ตรวจพบข้อมูลพร้อมนำเข้า!' : 'Detected Data Ready to Import'}</span>
                </h3>
                {parsed.timetable.academicYear && (
                  <span className="text-[11px] px-2 py-0.5 rounded-md bg-[#252526] border border-[#3C3C3C] text-[#9D9D9D]">
                    {isTh ? `ปีการศึกษา ${parsed.timetable.academicYear}` : `Year ${parsed.timetable.academicYear}`}
                  </span>
                )}
              </div>

              {/* Summary badges */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {parsed.meta.hasTimetable && (
                  <div className="bg-[#252526] border border-[#3C3C3C] rounded-xl p-3">
                    <div className="flex items-center gap-1.5 text-[11px] text-[#9D9D9D]">
                      <CalendarDays size={13} className="text-[#3794FF]" />
                      <span>{isTh ? 'ตารางเรียน' : 'Class Schedule'}</span>
                    </div>
                    <p className="text-sm font-semibold text-[#FFFFFF] mt-1">
                      {parsed.meta.totalScheduleSlots} {isTh ? 'คาบ' : 'slots'}
                    </p>
                    <p className="text-[11px] text-[#858585]">
                      {parsed.meta.totalEnrolledCourses} {isTh ? 'วิชา' : 'courses'} • {parsed.meta.totalEnrolledCredits} {isTh ? 'นก.' : 'cr'}
                    </p>
                  </div>
                )}

                {parsed.meta.totalExams > 0 && (
                  <div className="bg-[#252526] border border-[#3C3C3C] rounded-xl p-3">
                    <div className="flex items-center gap-1.5 text-[11px] text-[#9D9D9D]">
                      <ClipboardCheck size={13} className="text-rose-400" />
                      <span>{isTh ? 'วันสอบกลางภาค/ปลายภาค' : 'Midterm & Final Exams'}</span>
                    </div>
                    <p className="text-sm font-semibold text-[#FFFFFF] mt-1">
                      {parsed.meta.totalExams} {isTh ? 'รอบสอบ' : 'exams'}
                    </p>
                    <p className="text-[11px] text-[#858585]">
                      {isTh ? 'ตัดรายการซ้ำ S/L ให้อัตโนมัติ' : 'Deduplicated across S/L sections'}
                    </p>
                  </div>
                )}

                {parsed.meta.hasGrades && (
                  <div className="bg-[#252526] border border-[#3C3C3C] rounded-xl p-3">
                    <div className="flex items-center gap-1.5 text-[11px] text-[#9D9D9D]">
                      <GraduationCap size={13} className="text-emerald-400" />
                      <span>{isTh ? 'ผลการศึกษา' : 'Grade History'}</span>
                    </div>
                    <p className="text-sm font-semibold text-[#FFFFFF] mt-1">
                      {parsed.meta.totalSemesters} {isTh ? 'เทอม' : 'semesters'}
                    </p>
                    <p className="text-[11px] text-[#858585]">
                      {parsed.meta.totalGradeRows} {isTh ? 'รายวิชา' : 'graded rows'}
                    </p>
                  </div>
                )}
              </div>

              {/* Selectable Import Options */}
              <div className="space-y-2 pt-1 border-t border-[#3C3C3C]">
                {parsed.meta.totalScheduleSlots > 0 && (
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-2 text-xs text-[#D4D4D4] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={importSchedule}
                        onChange={(e) => setImportSchedule(e.target.checked)}
                        className="w-3.5 h-3.5 accent-[#007ACC] cursor-pointer"
                      />
                      <span>
                        {isTh
                          ? `นำเข้าตารางเรียน ${parsed.meta.totalScheduleSlots} คาบ เข้าหน้าตารางเรียน (+ ซิงค์ Google Calendar)`
                          : `Import ${parsed.meta.totalScheduleSlots} class slots to Schedule (+ Google Calendar sync)`}
                      </span>
                    </label>
                    {importSchedule && (
                      <label className="flex items-center gap-2 text-[11px] text-[#9D9D9D] pl-5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={replaceRegSchedule}
                          onChange={(e) => setReplaceRegSchedule(e.target.checked)}
                          className="w-3 h-3 accent-[#007ACC] cursor-pointer"
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
                  <label className="flex items-center gap-2 text-xs text-[#D4D4D4] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={importExams}
                      onChange={(e) => setImportExams(e.target.checked)}
                      className="w-3.5 h-3.5 accent-[#007ACC] cursor-pointer"
                    />
                    <span>
                      {isTh
                        ? `นำเข้าวันสอบ ${parsed.meta.totalExams} รายการ เข้าหน้าห้องสอบ & ตารางเรียน`
                        : `Import ${parsed.meta.totalExams} exam dates to Exam Room & Schedule`}
                    </span>
                  </label>
                )}

                {(parsed.meta.hasGrades || parsed.meta.totalEnrolledCourses > 0) && (
                  <label className="flex items-center gap-2 text-xs text-[#D4D4D4] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={importGrades}
                      onChange={(e) => setImportGrades(e.target.checked)}
                      className="w-3.5 h-3.5 accent-[#007ACC] cursor-pointer"
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
                <div className="pt-2 border-t border-[#3C3C3C]">
                  <p className="text-[11px] font-medium text-[#9D9D9D] mb-1.5">
                    {isTh ? 'ตัวอย่างตารางเรียนที่จะนำเข้า:' : 'Schedule Preview:'}
                  </p>
                  <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                    {parsed.timetable.scheduleEntries.map((slot) => (
                      <div
                        key={slot.id}
                        className="flex items-center justify-between gap-2 text-[11px] bg-[#252526] border border-[#3C3C3C] rounded-lg px-2.5 py-1.5"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: slot.color }}
                          />
                          <span className="font-mono text-[#3794FF] shrink-0">
                            {DAY_LABELS[slot.day]?.[lang] || slot.day} {slot.startTime}-{slot.endTime}
                          </span>
                          <span className="text-[#D4D4D4] truncate">{slot.title}</span>
                        </div>
                        <span className="text-[#858585] font-mono shrink-0">{slot.room || '-'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {parsed.grades.semesters.length > 0 && (
                <div className="pt-2 border-t border-[#3C3C3C]">
                  <p className="text-[11px] font-medium text-[#9D9D9D] mb-1.5">
                    {isTh ? 'เทอมที่ตรวจพบในผลการศึกษา:' : 'Detected Grade Semesters:'}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {parsed.grades.semesters.map((s) => (
                      <span
                        key={s.semesterId}
                        className="text-[11px] px-2.5 py-1 rounded-lg bg-[#252526] border border-[#3C3C3C] text-[#D4D4D4]"
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
        <div className="px-5 py-3.5 border-t border-[#3C3C3C] bg-[#1E1E1E] flex items-center justify-end gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium bg-[#252526] border border-[#3C3C3C] text-[#D4D4D4] hover:bg-[#2A2D2E] transition-colors cursor-pointer"
          >
            {isTh ? 'ยกเลิก' : 'Cancel'}
          </button>
          <button
            type="button"
            disabled={!canConfirm}
            onClick={handleConfirm}
            className="px-4 py-2 rounded-xl text-xs font-medium bg-[#007ACC] hover:bg-[#1177BB] disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors cursor-pointer"
          >
            {isTh ? 'ยืนยันนำเข้าข้อมูล' : 'Confirm Import'}
          </button>
        </div>
      </div>
    </div>
  );
}
