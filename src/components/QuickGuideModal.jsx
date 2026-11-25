import { useState, useEffect } from 'react';
import { Link, useInRouterContext } from 'react-router-dom';
import {
  X, HelpCircle, BookOpen, CalendarDays, GraduationCap,
  Bell, Puzzle, Download, ShieldCheck, ArrowRight, PlayCircle
} from 'lucide-react';

function SafeGuideLink({ to, onNavigate, className, children }) {
  const inRouter = useInRouterContext();
  if (inRouter) {
    return (
      <Link to={to} onClick={onNavigate} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <a href={to} onClick={onNavigate} className={className}>
      {children}
    </a>
  );
}

/**
 * Interactive non-technical Quick Guide modal helping new students discover
 * KMUTNB Reg import, extension download, Gmail/Discord notifications, and PWA install.
 */
export default function QuickGuideModal({ isOpen, onClose, lang = 'th' }) {
  const [activeTab, setActiveTab] = useState('start');
  const isTh = lang === 'th';

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const tabs = [
    { id: 'start', icon: PlayCircle, labelTh: 'เริ่มใช้งาน 1 นาที', labelEn: 'Quick Start' },
    { id: 'reg', icon: GraduationCap, labelTh: 'ดึงตาราง & เกรด', labelEn: 'Reg & Exams' },
    { id: 'alerts', icon: Bell, labelTh: 'แจ้งเตือน Gmail/Discord', labelEn: 'Notifications' },
    { id: 'app', icon: Download, labelTh: 'ติดตั้งแอป & ความปลอดภัย', labelEn: 'App & Privacy' },
  ];

  const cardClass = 'bg-[var(--app-bg)] border border-[var(--border)] rounded-lg p-4 space-y-2.5';
  const navBtnClass =
    'inline-flex items-center gap-1.5 text-xs font-medium text-[var(--primary-bright)] hover:underline';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-guide-title"
      data-testid="quick-guide-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 animate-fade-in"
    >
      <div className="bg-[var(--surface)] border border-[var(--border-strong)] rounded-xl w-full max-w-2xl max-h-[88vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <h2 id="quick-guide-title" className="text-base font-medium text-[var(--text-heading)] flex items-center gap-2">
              <HelpCircle size={18} strokeWidth={1.5} className="text-[var(--primary-bright)] shrink-0" />
              <span className="truncate">
                {isTh ? 'คู่มือใช้งานฉบับย่อ (สำหรับนักศึกษา)' : 'Student Quick Guide'}
              </span>
            </h2>
            <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
              {isTh
                ? 'สรุปขั้นตอนการใช้งานหลักทั้งหมด เข้าใจง่ายใน 1 นาที ไม่ต้องมีความรู้เขียนโค้ด'
                : 'Everything you need to get started in 1 minute — no technical setup required.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={isTh ? 'ปิดคู่มือ' : 'Close guide'}
            className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-heading)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-5 pt-4 shrink-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 bg-[var(--app-bg)] border border-[var(--border)] p-1 rounded-lg gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-[var(--primary-active)] text-white border border-[var(--primary)]/50'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <tab.icon size={13} strokeWidth={1.5} className="shrink-0" />
                <span className="truncate">{isTh ? tab.labelTh : tab.labelEn}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-3.5 text-xs text-[var(--text-primary)] flex-1">
          {activeTab === 'start' && (
            <>
              <div className={cardClass}>
                <h3 className="text-xs font-medium text-[var(--text-heading)] flex items-center gap-2">
                  <BookOpen size={14} strokeWidth={1.5} className="text-[var(--primary-bright)]" />
                  <span>{isTh ? '1. ติดตามการบ้านและประกาศเรียน' : '1. Track Assignments & Courses'}</span>
                </h3>
                <p className="text-[var(--text-secondary)] leading-relaxed">
                  {isTh
                    ? 'เมื่อเข้าสู่ระบบด้วย Google งานและเอกสารทั้งหมดจาก Google Classroom จะเข้ามาอัตโนมัติ คุณสามารถกดเปลี่ยนสถานะ (ยังไม่เริ่ม → กำลังทำ → เสร็จแล้ว), จดโน้ตส่วนตัวในงานแต่ละชิ้น และซ่อนวิชาเก่าได้ในหน้า "วิชาเรียน"'
                    : 'Signing in pulls your Google Classroom tasks and announcements automatically. Update progress statuses, write private notes inside tasks, and hide old semesters from Courses.'}
                </p>
                <SafeGuideLink to="/dashboard" onNavigate={onClose} className={navBtnClass}>
                  <span>{isTh ? 'ไปหน้ารายการงาน' : 'Open Assignments'}</span>
                  <ArrowRight size={12} strokeWidth={1.5} />
                </SafeGuideLink>
              </div>

              <div className={cardClass}>
                <h3 className="text-xs font-medium text-[var(--text-heading)] flex items-center gap-2">
                  <CalendarDays size={14} strokeWidth={1.5} className="text-[var(--primary-bright)]" />
                  <span>{isTh ? '2. นำเข้าตารางเรียน วันสอบ และเกรด (แนะนำ)' : '2. Import Timetable, Exams & Grades'}</span>
                </h3>
                <p className="text-[var(--text-secondary)] leading-relaxed">
                  {isTh
                    ? 'แค่เปิดหน้า ตารางเรียน หรือ ผลการศึกษา บน reg.kmutnb.ac.th แล้วกด Ctrl+A → Ctrl+C มาวางในปุ่ม "นำเข้าจาก Reg มจพ." หน้าเว็บจะแปลงเป็นตารางเรียน วันสอบ พร้อมซิงค์ลง Google Calendar ให้อัตโนมัติ'
                    : 'Copy-paste from reg.kmutnb.ac.th (Ctrl+A → Ctrl+C → Ctrl+V) inside "Import KMUTNB Reg" on Schedule or Academic to populate your timetable, exam dates, GPA tracker, and Google Calendar.'}
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('reg')}
                  className={`${navBtnClass} cursor-pointer`}
                >
                  <span>{isTh ? 'ดูขั้นตอนแบบละเอียด' : 'See step-by-step Reg guide'}</span>
                  <ArrowRight size={12} strokeWidth={1.5} />
                </button>
              </div>

              <div className={cardClass}>
                <h3 className="text-xs font-medium text-[var(--text-heading)] flex items-center gap-2">
                  <Bell size={14} strokeWidth={1.5} className="text-[var(--primary-bright)]" />
                  <span>{isTh ? '3. ตั้งแจ้งเตือนกันลืมส่งงาน' : '3. Turn On Deadline Reminders'}</span>
                </h3>
                <p className="text-[var(--text-secondary)] leading-relaxed">
                  {isTh
                    ? 'เลือกแจ้งเตือนเข้า Gmail (กดรูปกระดิ่งมุมขวาบน) หรือส่งเข้าห้องแชท Discord (ตั้งค่าใน Settings) เพื่อเตือนก่อนถึงกำหนดส่ง 3 วัน, 1 วัน และวันส่งจริง'
                    : 'Enable Gmail alerts from the top-right bell icon, or connect a Discord Webhook in Settings for due-date and new-post alerts.'}
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('alerts')}
                  className={`${navBtnClass} cursor-pointer`}
                >
                  <span>{isTh ? 'ดูวิธีตั้งค่าแจ้งเตือน' : 'How to enable alerts'}</span>
                  <ArrowRight size={12} strokeWidth={1.5} />
                </button>
              </div>
            </>
          )}

          {activeTab === 'reg' && (
            <>
              <div className={cardClass}>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-medium text-[var(--text-heading)]">
                    {isTh ? 'วิธีที่ 1 (ง่ายที่สุด — 10 วินาที): ก๊อปวางจากเว็บ Reg' : 'Method 1 (Easiest — 10 Seconds): Copy & Paste'}
                  </h3>
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shrink-0">
                    {isTh ? 'แนะนำ' : 'Recommended'}
                  </span>
                </div>
                <ol className="list-decimal list-inside space-y-1.5 text-[var(--text-secondary)] leading-relaxed">
                  <li>{isTh ? 'เข้าหน้า "ตารางเรียน" หรือ "ผลการเรียน & เกณฑ์จบ" แล้วกดปุ่ม "นำเข้าจาก Reg มจพ."' : 'Open Schedule or Academic & GPA and click "Import KMUTNB Reg".'}</li>
                  <li>{isTh ? 'ล็อกอิน reg.kmutnb.ac.th แล้วเปิดหน้า "ตารางเรียน/สอบ" และ/หรือ "ผลการศึกษา"' : 'Sign in to reg.kmutnb.ac.th and open Timetable and/or Grade Report.'}</li>
                  <li>{isTh ? 'กด Ctrl+A (เลือกทั้งหมด) แล้ว Ctrl+C (คัดลอก) จากนั้นกลับมา Ctrl+V วางลงช่อง' : 'Press Ctrl+A then Ctrl+C on the Reg page, come back and paste (Ctrl+V).'}</li>
                </ol>
                <div className="flex flex-wrap items-center gap-4 pt-1">
                  <SafeGuideLink to="/schedule" onNavigate={onClose} className={navBtnClass}>
                    <span>{isTh ? 'เปิดหน้าตารางเรียน' : 'Open Schedule'}</span>
                    <ArrowRight size={12} strokeWidth={1.5} />
                  </SafeGuideLink>
                  <SafeGuideLink to="/academic" onNavigate={onClose} className={navBtnClass}>
                    <span>{isTh ? 'เปิดหน้าผลการเรียน' : 'Open Academic & GPA'}</span>
                    <ArrowRight size={12} strokeWidth={1.5} />
                  </SafeGuideLink>
                </div>
              </div>

              <div className={cardClass}>
                <h3 className="text-xs font-medium text-[var(--text-heading)] flex items-center gap-2">
                  <Puzzle size={14} strokeWidth={1.5} className="text-[var(--primary-bright)]" />
                  <span>{isTh ? 'วิธีที่ 2: ใช้ Chrome/Edge Extension ซิงค์อัตโนมัติ' : 'Method 2: Browser Extension (Auto-Sync)'}</span>
                </h3>
                <ol className="list-decimal list-inside space-y-1.5 text-[var(--text-secondary)] leading-relaxed">
                  <li>{isTh ? 'ดาวน์โหลดไฟล์ .zip ด้านล่าง แล้วคลิกขวาแตกไฟล์ (Extract All) ลงโฟลเดอร์บนเครื่อง' : 'Download the ZIP below and extract it to a folder on your computer.'}</li>
                  <li>{isTh ? 'เปิด chrome://extensions (Chrome) หรือ edge://extensions (Edge) และเปิด Developer mode มุมขวาบน' : 'Open chrome://extensions or edge://extensions and turn on Developer mode.'}</li>
                  <li>{isTh ? 'กด Load unpacked แล้วเลือกโฟลเดอร์ที่แตกไว้ จากนั้นเปิดเว็บ Reg ก็ซิงค์อัตโนมัติเลย' : 'Click Load unpacked, pick the extracted folder, then visit Reg to sync automatically.'}</li>
                </ol>
                <div className="pt-1">
                  <a
                    href="/classrooms-reg-extension.zip"
                    download="classrooms-reg-extension.zip"
                    className="inline-flex items-center gap-1.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-medium text-xs px-3.5 py-2 rounded-lg transition-colors"
                  >
                    <Download size={13} strokeWidth={1.5} />
                    <span>{isTh ? 'ดาวน์โหลด Extension (.zip)' : 'Download Extension (.zip)'}</span>
                  </a>
                </div>
              </div>

              <div className={cardClass}>
                <h3 className="text-xs font-medium text-[var(--text-heading)]">
                  {isTh ? 'เช็กที่นั่งสอบ (สำหรับคนที่ใช้ Gmail ส่วนตัว)' : 'Exam Seating Tip (Personal Gmail Accounts)'}
                </h3>
                <p className="text-[var(--text-secondary)] leading-relaxed">
                  {isTh
                    ? 'ถ้าไม่ได้ล็อกอินด้วยเมลสถาบัน (s6xxxxxxx@email.kmutnb.ac.th) สามารถกรอกรหัสนักศึกษา 13 หลักไว้ในหน้า "โปรไฟล์ & ตั้งค่า" หรือค้นหาโดยตรงในหน้า "ที่นั่งสอบ" ได้'
                    : 'If you sign in with a personal Gmail account, enter your 13-digit Student ID in Settings or search directly inside Exam Seating.'}
                </p>
                <SafeGuideLink to="/exam-room" onNavigate={onClose} className={navBtnClass}>
                  <span>{isTh ? 'เปิดหน้าตรวจสอบที่นั่งสอบ' : 'Open Exam Seating'}</span>
                  <ArrowRight size={12} strokeWidth={1.5} />
                </SafeGuideLink>
              </div>
            </>
          )}

          {activeTab === 'alerts' && (
            <>
              <div className={cardClass}>
                <h3 className="text-xs font-medium text-[var(--text-heading)]">
                  {isTh ? '1. แจ้งเตือนทาง Gmail (เปิดใช้ได้เลยในแอป)' : '1. Gmail Alerts (One-Click Inside App)'}
                </h3>
                <ol className="list-decimal list-inside space-y-1.5 text-[var(--text-secondary)] leading-relaxed">
                  <li>{isTh ? 'กดไอคอนรูปกระดิ่งที่แถบด้านบน → เลือกแท็บ "ตั้งค่าแจ้งเตือน"' : 'Click the Bell icon in the top bar → switch to "Settings".'}</li>
                  <li>{isTh ? 'เปิดสวิตช์เมลและเลือกช่วงเวลาที่ต้องการ (ส่งสูงสุด 10 ฉบับ/วันเมื่อเปิดเว็บหรือซิงก์)' : 'Turn on the Gmail toggle and pick reminder triggers (runs on open/sync, up to 10 emails/day).'}</li>
                </ol>
              </div>

              <div className={cardClass}>
                <h3 className="text-xs font-medium text-[var(--text-heading)]">
                  {isTh ? '2. แจ้งเตือนเข้า Discord Webhook' : '2. Discord Channel Webhook Alerts'}
                </h3>
                <ol className="list-decimal list-inside space-y-1.5 text-[var(--text-secondary)] leading-relaxed">
                  <li>{isTh ? 'เปิด Discord → เข้าห้องที่ต้องการ → กดฟันเฟือง Edit Channel → Integrations → Webhooks' : 'Open Discord → Channel Settings (gear icon) → Integrations → Webhooks.'}</li>
                  <li>{isTh ? 'กด New Webhook แล้วกดปุ่ม Copy Webhook URL' : 'Click New Webhook, then click Copy Webhook URL.'}</li>
                  <li>{isTh ? 'กลับมาหน้า "โปรไฟล์ & ตั้งค่า" → วางลิงก์ในช่อง Discord Webhook → เปิดสวิตช์และกดทดสอบได้ทันที' : 'Paste the URL inside Settings → Discord Notifications, enable the toggle, and test.'}</li>
                </ol>
              </div>

              <div className={cardClass}>
                <h3 className="text-xs font-medium text-[var(--text-heading)]">
                  {isTh ? '3. เปิดแจ้งเตือน 24 ชม. แม้ปิดหน้าเว็บ (Google Apps Script)' : '3. Optional 24/7 Cloud Script (Even When Browser Closed)'}
                </h3>
                <ol className="list-decimal list-inside space-y-1.5 text-[var(--text-secondary)] leading-relaxed">
                  <li>{isTh ? 'ในหน้า Settings กล่อง Discord กดปุ่ม "คัดลอกโค้ด" แล้วเปิด script.google.com' : 'In Settings (Discord card), click "Copy Script" and open script.google.com.'}</li>
                  <li>{isTh ? 'สร้างโปรเจกต์ใหม่ วางโค้ดทับทั้งหมด แล้วกดเซฟ' : 'Create a New Project, paste the script replacing the default code, and save.'}</li>
                  <li>{isTh ? 'แถบซ้ายกด Services (+) เลือกเพิ่ม Google Classroom API → กด Triggers (รูปนาฬิกา) ตั้งให้รัน sendClassroomDigest ทุก 1 ชั่วโมง' : 'In the left sidebar: click Services (+) to add Google Classroom API, then Triggers (clock icon) to run sendClassroomDigest hourly.'}</li>
                </ol>
                <SafeGuideLink to="/settings" onNavigate={onClose} className={navBtnClass}>
                  <span>{isTh ? 'ไปหน้าโปรไฟล์ & ตั้งค่า' : 'Open Profile & Settings'}</span>
                  <ArrowRight size={12} strokeWidth={1.5} />
                </SafeGuideLink>
              </div>
            </>
          )}

          {activeTab === 'app' && (
            <>
              <div className={cardClass}>
                <h3 className="text-xs font-medium text-[var(--text-heading)]">
                  {isTh ? 'ติดตั้งเป็นแอปบนมือถือและคอม (PWA)' : 'Install as an App (Mobile & Desktop)'}
                </h3>
                <ul className="list-disc list-inside space-y-1.5 text-[var(--text-secondary)] leading-relaxed">
                  <li>{isTh ? 'Chrome / Edge (คอม & Android): กดปุ่ม "ติดตั้งแอป" ที่แถบด้านบน หรือไอคอนติดตั้งในแถบ URL' : 'Chrome / Edge (Desktop & Android): click "Install App" in the top bar or address bar icon.'}</li>
                  <li>{isTh ? 'iPhone / iPad (Safari): กดปุ่ม Share (ลูกศรชี้ขึ้น) → เลือก "Add to Home Screen"' : 'iPhone / iPad (Safari): tap Share → "Add to Home Screen".'}</li>
                </ul>
              </div>

              <div className={cardClass}>
                <h3 className="text-xs font-medium text-[var(--text-heading)] flex items-center gap-2">
                  <ShieldCheck size={14} strokeWidth={1.5} className="text-[var(--success)]" />
                  <span>{isTh ? 'ความปลอดภัย & การใช้บนคอมส่วนรวม' : 'Privacy, Cloud Sync & Shared Computers'}</span>
                </h3>
                <ul className="list-disc list-inside space-y-1.5 text-[var(--text-secondary)] leading-relaxed">
                  <li>{isTh ? 'ข้อมูลทั้งหมดทำงานบนเบราว์เซอร์ของคุณและเก็บสำรองข้ามเครื่องใน Google Drive ส่วนตัว (appDataFolder) ไม่มีเซิร์ฟเวอร์กลางมาแอบอ่านข้อมูล' : 'Runs directly in your browser with automatic cross-device sync via your private Google Drive appDataFolder (no custom backend storing your data).'}</li>
                  <li>{isTh ? 'ไม่เก็บรหัสผ่าน ICIT และข้อมูลที่ซิงค์จาก Reg จะถูกตัดชื่อ-สกุลทิ้งก่อนบันทึกทุกครั้ง' : 'Never asks for or stores ICIT passwords, and strips personal identifiers from Reg tables automatically.'}</li>
                  <li>{isTh ? 'หากใช้คอมสาธารณะ/ห้องสมุด: ไม่ต้องติ๊ก "จดจำบัญชี" และกดปุ่ม "ล็อกเอาต์ (Disconnect)" ในหน้า Settings ทุกครั้งหลังใช้งาน' : 'On shared computers: leave "Remember me" unchecked and click Disconnect in Settings when done to clear local caches.'}</li>
                </ul>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[var(--border)] flex items-center justify-between gap-3 text-[11px] text-[var(--text-muted)] shrink-0">
          <span>
            {isTh
              ? 'เปิดดูคู่มือนี้ได้ทุกเมื่อจากปุ่ม (?) ด้านบนขวา'
              : 'Reopen this guide anytime from the (?) button in the top bar.'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="bg-[var(--surface-elevated)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] border border-[var(--border)] px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer"
          >
            {isTh ? 'เข้าใจแล้ว' : 'Got it'}
          </button>
        </div>
      </div>
    </div>
  );
}
