import { useState } from 'react';
import { User, GraduationCap, Code, LogIn, LogOut, Mail, CheckCircle2, Clipboard, Check, ExternalLink } from 'lucide-react';
import { t } from '../utils/i18n';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { useClassroom } from '../contexts/ClassroomContext';
import { getAppsScriptTemplate } from '../utils/appsScriptTemplate';

const GithubIcon = ({ size = 16, className = '' }) => (
  <svg
    height={size}
    width={size}
    viewBox="0 0 16 16"
    version="1.1"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path fillRule="evenodd" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
  </svg>
);

export default function Settings() {
  const { lang } = useSettings();
  const { profile, isLoggedIn, handleProfileSave, handleLogin, handleLogout } = useAuth();
  const { hiddenCourseIds } = useClassroom();
  
  const [name, setName] = useState(profile.name || '');
  const [studentId, setStudentId] = useState(profile.studentId || '');
  const [email, setEmail] = useState(profile.email || '');
  const [major, setMajor] = useState(profile.major || '');
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl || '');
  
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyScript = () => {
    navigator.clipboard.writeText(getAppsScriptTemplate(hiddenCourseIds));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const techStack = [
    { name: 'React 19', category: 'Frontend', color: 'emerald' },
    { name: 'Vite 8', category: 'Build Tool', color: 'purple' },
    { name: 'React Router 7', category: 'Routing', color: 'rose' },
    { name: 'Tailwind CSS v4', category: 'Styling', color: 'blue' },
    { name: 'Google Classroom API', category: 'Integrations', color: 'brand' },
    { name: 'Lucide React', category: 'Icons', color: 'amber' },
  ];

  const getPillColor = (color) => {
    switch (color) {
      case 'emerald': return 'bg-emerald-500/5 text-emerald-400 border-emerald-500/10';
      case 'purple': return 'bg-purple-500/5 text-purple-400 border-purple-500/10';
      case 'rose': return 'bg-rose-500/5 text-rose-400 border-rose-500/10';
      case 'blue': return 'bg-blue-500/5 text-blue-400 border-blue-500/10';
      case 'amber': return 'bg-amber-500/5 text-amber-400 border-amber-500/10';
      default: return 'bg-brand-500/5 text-brand-400 border-brand-500/10';
    }
  };

  const devInfo = {
    name: 'KITTIPONG TEERASEE',
    nickname: 'Kittiponglnwza',
    studentId: '6704082611115',
    email: 's6704082611115@email.kmutnb.ac.th',
    university: 'King Mongkut\'s University of Technology North Bangkok (KMUTNB)',
    github: 'https://github.com/kittiponglnwza',
    bio: 'KMUTNB Student Developer interested in building modern, high-performance web applications, productivity extensions, and APIs.'
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    handleProfileSave({
      name,
      studentId,
      email,
      major,
      avatarUrl
    });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in py-2">
      <div className="border-b border-dark-border/40 pb-5">
        <h1 className="text-xl font-bold font-heading text-white">{t('settingsTitle', lang)}</h1>
        <p className="text-[11px] text-dark-muted mt-1 leading-relaxed">{t('settingsDesc', lang)}</p>
      </div>

      {saveSuccess && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs px-4 py-3 rounded-xl flex items-center gap-2 animate-fade-in max-w-xl">
          <CheckCircle2 size={15} />
          {t('profileSuccess', lang)}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-dark-card/20 border border-dark-border/30 rounded-2xl p-6 md:p-8 space-y-6 shadow-sm">
            <div className="flex items-center gap-3 pb-3">
              <User size={16} className="text-brand-400" />
              <h3 className="font-semibold text-xs text-white uppercase tracking-wider">{t('profileSettingsHeader', lang)}</h3>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="flex flex-col sm:flex-row gap-5 items-start sm:items-center">
                <div className="w-14 h-14 rounded-full overflow-hidden bg-dark-sidebar border border-dark-border/50 flex-shrink-0 flex items-center justify-center">
                  <img 
                    src={avatarUrl || 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&q=80&w=200'} 
                    alt="Preview" 
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 w-full space-y-1">
                  <label className="block text-[10px] font-semibold text-dark-muted uppercase tracking-wider">{t('avatarUrlLabel', lang)}</label>
                  <input
                    type="url"
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    placeholder="https://example.com/avatar.jpg"
                    className="w-full bg-dark-sidebar/40 border border-dark-border/40 rounded-xl px-3.5 py-2 text-xs text-white placeholder-dark-muted focus:outline-none focus:border-brand-500/60 focus:ring-1 focus:ring-brand-500/20 transition-all duration-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-1">
                  <label className="block text-[10px] font-semibold text-dark-muted uppercase tracking-wider">{t('studentNameLabel', lang)}</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-dark-sidebar/40 border border-dark-border/40 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-brand-500/60 focus:ring-1 focus:ring-brand-500/20 transition-all duration-200"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-semibold text-dark-muted uppercase tracking-wider">{t('studentIdLabel', lang)}</label>
                  <input
                    type="text"
                    required
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    className="w-full bg-dark-sidebar/40 border border-dark-border/40 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-brand-500/60 focus:ring-1 focus:ring-brand-500/20 transition-all duration-200"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-semibold text-dark-muted uppercase tracking-wider">{t('studentEmailLabel', lang)}</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-dark-sidebar/40 border border-dark-border/40 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-brand-500/60 focus:ring-1 focus:ring-brand-500/20 transition-all duration-200"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-semibold text-dark-muted uppercase tracking-wider">{t('studentMajorLabel', lang)}</label>
                  <input
                    type="text"
                    required
                    value={major}
                    onChange={(e) => setMajor(e.target.value)}
                    className="w-full bg-dark-sidebar/40 border border-dark-border/40 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-brand-500/60 focus:ring-1 focus:ring-brand-500/20 transition-all duration-200"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="bg-brand-500 hover:bg-brand-600 text-white font-medium text-xs px-5 py-2.5 rounded-xl transition-all duration-200 shadow-md shadow-brand-500/10 hover:translate-x-0.5 cursor-pointer"
                >
                  {lang === 'en' ? 'Save Changes' : 'บันทึกการเปลี่ยนแปลง'}
                </button>
              </div>
            </form>

            <div className="pt-5 border-t border-dark-border/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <h4 className="font-semibold text-xs text-white flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${isLoggedIn ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-500'}`} />
                  {lang === 'en' ? 'Google Classroom Account' : 'บัญชี Google Classroom'}
                </h4>
                <p className="text-[11px] text-dark-muted">
                  {isLoggedIn 
                    ? (lang === 'en' ? `Connected as ${profile.email || email}` : `เชื่อมต่อโดยอีเมล ${profile.email || email}`) 
                    : (lang === 'en' ? 'Link your school Google Account to import real coursework.' : 'เชื่อมต่อบัญชี Google ของสถานบันเพื่อนำเข้าการบ้านจริง')}
                </p>
              </div>
              
              {isLoggedIn ? (
                <button
                  type="button"
                  onClick={handleLogout}
                  className="bg-rose-500/10 hover:bg-rose-500 hover:text-white text-rose-400 border border-rose-500/20 text-xs font-semibold px-4.5 py-2 rounded-xl transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <LogOut size={12} />
                  {t('disconnectBtn', lang)}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleLogin}
                  className="bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold px-4.5 py-2 rounded-xl transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-brand-500/15"
                >
                  <LogIn size={12} />
                  {t('connectBtn', lang)}
                </button>
              )}
            </div>
          </div>

          {/* Background Alerts Setup Card */}
          <div className="bg-dark-card/20 border border-dark-border/30 rounded-2xl p-6 md:p-8 space-y-6 shadow-sm">
            <div className="flex items-center gap-3 pb-3 border-b border-dark-border/40">
              <Mail size={16} className="text-brand-400" />
              <div className="flex-1">
                <h3 className="font-semibold text-xs text-white uppercase tracking-wider">
                  {lang === 'en' ? 'Offline Gmail Alerts (No Browser Required)' : 'ตั้งค่าแจ้งเตือนทาง Gmail แบบออฟไลน์ (ปิดเว็บก็เตือน)'}
                </h3>
                <p className="text-[10px] text-dark-muted mt-0.5 leading-relaxed">
                  {lang === 'en' ? 'Receive automated email reminders for pending assignments even when the website is closed.' : 'รับอีเมลแจ้งเตือนการบ้านค้างส่งโดยอัตโนมัติรันบนระบบคลาวด์ของ Google ตลอด 24 ชั่วโมง แม้จะปิดคอมพิวเตอร์'}
                </p>
              </div>
            </div>

            <div className="space-y-5 text-xs text-zinc-300">
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="w-5 h-5 rounded-full bg-brand-500/10 border border-brand-500/25 flex items-center justify-center text-[10px] font-black text-brand-400 shrink-0">1</div>
                  <div>
                    <span className="font-bold text-white">
                      {lang === 'en' ? 'Open Google Apps Script Dashboard:' : 'เปิดคอนโซล Google Apps Script:'}
                    </span>
                    <p className="mt-1">
                      <a 
                        href="https://script.google.com" 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="inline-flex items-center gap-1.5 text-brand-400 hover:text-brand-300 font-medium underline"
                      >
                        script.google.com <ExternalLink size={11} />
                      </a>
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="w-5 h-5 rounded-full bg-brand-500/10 border border-brand-500/25 flex items-center justify-center text-[10px] font-black text-brand-400 shrink-0">2</div>
                  <div>
                    <span className="font-bold text-white">
                      {lang === 'en' ? 'Create a Project:' : 'สร้างโครงการใหม่:'}
                    </span>
                    <p className="mt-1 text-dark-muted leading-relaxed">
                      {lang === 'en' ? 'Click "New Project" (โครงการใหม่) to launch the code editor.' : 'คลิกปุ่ม "โครงการใหม่" (New Project) เพื่อเปิดหน้าจอตัวแก้ไขโค้ด'}
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="w-5 h-5 rounded-full bg-brand-500/10 border border-brand-500/25 flex items-center justify-center text-[10px] font-black text-brand-400 shrink-0">3</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <span className="font-bold text-white">
                        {lang === 'en' ? 'Copy & Paste the script code:' : 'คัดลอกและวางโค้ดสคริปต์:'}
                      </span>
                      <button
                        onClick={handleCopyScript}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                          copied 
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                            : 'bg-dark-sidebar hover:bg-dark-hover text-white border-dark-border/60'
                        }`}
                      >
                        {copied ? (
                          <>
                            <Check size={11} />
                            {lang === 'en' ? 'Copied!' : 'คัดลอกแล้ว!'}
                          </>
                        ) : (
                          <>
                            <Clipboard size={11} />
                            {lang === 'en' ? 'Copy Script Code' : 'คัดลอกโค้ดสคริปต์'}
                          </>
                        )}
                      </button>
                    </div>
                    <p className="mt-1 text-dark-muted leading-relaxed">
                      {lang === 'en' ? 'Delete any auto-generated code in the editor, and paste the copied script block below.' : 'ลบโค้ดเริ่มต้นในไฟล์ Code.gs ทั้งหมดออก แล้ววางสคริปต์ที่คัดลอกมาลงไปแทน'}
                    </p>
                    
                    <div className="mt-3 relative bg-dark-sidebar/45 rounded-xl border border-dark-border/40 overflow-hidden">
                      <div className="absolute top-2.5 right-2.5 z-10 text-[9px] font-bold text-dark-muted select-none pointer-events-none uppercase">Code.gs</div>
                      <pre className="p-4 max-h-[160px] overflow-y-auto text-[10px] font-mono text-zinc-400 leading-relaxed scrollbar-thin">
                        {getAppsScriptTemplate(hiddenCourseIds)}
                      </pre>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="w-5 h-5 rounded-full bg-brand-500/10 border border-brand-500/25 flex items-center justify-center text-[10px] font-black text-brand-400 shrink-0">4</div>
                  <div>
                    <span className="font-bold text-white">
                      {lang === 'en' ? 'Add Google Classroom API Service:' : 'เพิ่มบริการ Classroom API เข้าโครงการ:'}
                    </span>
                    <p className="mt-1 text-dark-muted leading-relaxed">
                      {lang === 'en' 
                        ? 'Click the "+" next to Services on the left menu. Search for "Classroom API", select it, and click Add.' 
                        : 'คลิกเครื่องหมาย "+" ข้างคำว่า "บริการ" (Services) ในเมนูทางซ้าย ค้นหาคำว่า "Classroom API" จากนั้นกดเลือกและคลิกเพิ่ม (Add)'}
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="w-5 h-5 rounded-full bg-brand-500/10 border border-brand-500/25 flex items-center justify-center text-[10px] font-black text-brand-400 shrink-0">5</div>
                  <div>
                    <span className="font-bold text-white">
                      {lang === 'en' ? 'Grant Access & Run:' : 'กดบันทึก ตรวจสอบสิทธิ์ และทดลองรัน:'}
                    </span>
                    <p className="mt-1 text-dark-muted leading-relaxed">
                      {lang === 'en' 
                        ? 'Click Save (floppy disk icon), select the "sendClassroomDigest" function from the dropdown, and click Run. Click Review Permissions, select your student Google Account, click Advanced -> Go to Untitled Project (unsafe), and click Allow. Verify you receive the email digest!'
                        : 'กดปุ่มบันทึก (รูปแผ่นดิสก์) จากนั้นตรวจสอบว่าเลือกฟังก์ชัน "sendClassroomDigest" ไว้แล้วกดปุ่ม "รัน" (Run) จากนั้นคลิกตรวจสอบสิทธิ์และอนุญาตการเข้าถึงข้อมูลให้เรียบร้อย (คลิกขั้นสูง -> ไปยังโครงการที่ไม่มีชื่อ -> กดยอมรับ)'}
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="w-5 h-5 rounded-full bg-brand-500/10 border border-brand-500/25 flex items-center justify-center text-[10px] font-black text-brand-400 shrink-0">6</div>
                  <div>
                    <span className="font-bold text-white">
                      {lang === 'en' ? 'Schedule Background Trigger:' : 'ตั้งค่าเวลาทำงานออโต้ (Trigger):'}
                    </span>
                    <p className="mt-1 text-dark-muted leading-relaxed">
                      {lang === 'en' 
                        ? 'Click Triggers (alarm clock icon in the left menu) -> click Add Trigger (bottom-right) -> choose Event source: "Time-driven", select trigger type: "Hour timer" -> every hour, and click Save. That\'s it! The script will now check and remind you of deadlines hourly in the background!' 
                        : 'คลิกเมนู "ตัวกระตุ้น" (Triggers - รูปนาฬิกาปลุกเมนูซ้ายมือ) -> กดปุ่ม "เพิ่มตัวกระตุ้น" ที่มุมขวาล่าง -> เลือกแหล่งที่มาของเหตุการณ์: "ตามเวลาที่กำหนด" (Time-driven), เลือกประเภททริกเกอร์: "ตัวจับเวลาชั่วโมง" -> ทุกชั่วโมง แล้วกดบันทึก เป็นอันเสร็จสิ้น!'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>

        <div className="space-y-6">
          <div className="bg-dark-card/20 border border-dark-border/30 rounded-2xl p-6 space-y-5 shadow-sm">
            <div className="flex items-center gap-3 pb-2">
              <User size={16} className="text-brand-400" />
              <h3 className="font-semibold text-xs text-white uppercase tracking-wider">{t('developerHeader', lang)}</h3>
            </div>

            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-full overflow-hidden border border-brand-500/20 bg-brand-500/5 flex items-center justify-center shrink-0">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={devInfo.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-brand-400 text-xl font-bold font-heading">
                    {name ? name.charAt(0).toUpperCase() : 'K'}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <h4 className="font-semibold text-white text-xs leading-tight truncate">{devInfo.name}</h4>
                <p className="text-[10px] text-brand-400 mt-0.5">@{devInfo.nickname}</p>
              </div>
            </div>

            <p className="text-[11px] text-zinc-300 leading-relaxed leading-5">
              {devInfo.bio}
            </p>

            <div className="space-y-2.5 pt-3 border-t border-dark-border/30 text-[11px]">
              <div className="flex items-start gap-2.5">
                <GraduationCap size={13} className="text-dark-muted shrink-0 mt-0.5" />
                <span className="text-zinc-300 leading-normal">{devInfo.university}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Mail size={13} className="text-dark-muted shrink-0" />
                <a href={`mailto:${email || devInfo.email}`} className="text-zinc-300 hover:text-brand-400 transition-colors truncate">{email || devInfo.email}</a>
              </div>
            </div>

            <a 
              href={devInfo.github}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-1.5 bg-dark-sidebar/50 hover:bg-dark-hover text-white border border-dark-border/40 py-2 rounded-xl transition-colors font-medium text-xs cursor-pointer shadow-sm"
            >
              <GithubIcon size={13} />
              GitHub Profile
            </a>
          </div>

          <div className="bg-dark-card/20 border border-dark-border/30 rounded-2xl p-6 space-y-4 shadow-sm">
            <div className="flex items-center gap-3 pb-1">
              <Code size={16} className="text-brand-400" />
              <h3 className="font-semibold text-xs text-white uppercase tracking-wider">{t('projectDetailsHeader', lang)}</h3>
            </div>

            <p className="text-[11px] text-zinc-300 leading-relaxed leading-5">
              {t('projectDesc', lang)}
            </p>

            <div className="grid grid-cols-2 gap-2 pt-1.5">
              {techStack.map((tech) => (
                <div 
                  key={tech.name} 
                  className={`p-2.5 rounded-xl border flex flex-col space-y-0.5 ${getPillColor(tech.color)}`}
                >
                  <span className="text-[8px] uppercase font-semibold opacity-70 tracking-wider">
                    {tech.category}
                  </span>
                  <span className="font-bold text-[10px]">
                    {tech.name}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
