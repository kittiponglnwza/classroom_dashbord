import { useState } from 'react';
import { User, GraduationCap, Code, LogIn, LogOut, Mail, CheckCircle2, ChevronRight, Settings2, Sparkles, Layers, BookOpen } from 'lucide-react';
import { t } from '../utils/i18n';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';

const GithubIcon = ({ size = 16, className = '' }) => (
  <svg height={size} width={size} viewBox="0 0 16 16" version="1.1" fill="currentColor" className={className} aria-hidden="true">
    <path fillRule="evenodd" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
  </svg>
);

const InputField = ({ label, value, onChange, type = "text" }) => (
  <div className="space-y-1.5 group/input relative">
    <label className="block text-[10px] font-bold text-dark-muted uppercase tracking-wider group-focus-within/input:text-brand-400 transition-colors">
      {label}
    </label>
    <input
      type={type}
      required
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-transparent border-b border-dark-border/60 pb-2 pt-1 text-sm text-white placeholder-dark-muted focus:outline-none focus:border-brand-500 transition-all rounded-none"
    />
    <div className="absolute bottom-0 left-0 h-[2px] w-0 bg-brand-500 transition-all duration-300 group-focus-within/input:w-full"></div>
  </div>
);

export default function Settings() {
  const { lang } = useSettings();
  const { profile, isLoggedIn, handleProfileSave, login, logout } = useAuth();
  
  const [name, setName] = useState(profile.name || '');
  const [studentId, setStudentId] = useState(profile.studentId || '');
  const [email, setEmail] = useState(profile.email || '');
  const [major, setMajor] = useState(profile.major || '');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const techStack = [
    { name: 'React 19', category: 'Frontend', color: 'emerald' },
    { name: 'Vite 8', category: 'Build Tool', color: 'purple' },
    { name: 'React Router 7', category: 'Routing', color: 'rose' },
    { name: 'Tailwind CSS v4', category: 'Styling', color: 'blue' },
    { name: 'Classroom API', category: 'Integrations', color: 'brand' },
  ];

  const getPillColor = (color) => {
    switch (color) {
      case 'emerald': return 'bg-emerald-500/5 text-emerald-400 border-emerald-500/10 hover:border-emerald-500/30 hover:bg-emerald-500/10';
      case 'purple': return 'bg-purple-500/5 text-purple-400 border-purple-500/10 hover:border-purple-500/30 hover:bg-purple-500/10';
      case 'rose': return 'bg-rose-500/5 text-rose-400 border-rose-500/10 hover:border-rose-500/30 hover:bg-rose-500/10';
      case 'blue': return 'bg-blue-500/5 text-blue-400 border-blue-500/10 hover:border-blue-500/30 hover:bg-blue-500/10';
      default: return 'bg-brand-500/5 text-brand-400 border-brand-500/10 hover:border-brand-500/30 hover:bg-brand-500/10';
    }
  };

  const devInfo = {
    name: 'KITTIPONG TEERASEE',
    nickname: 'Kittiponglnwza',
    email: 's6704082611115@email.kmutnb.ac.th',
    university: 'King Mongkut\'s University of Technology North Bangkok',
    github: 'https://github.com/kittiponglnwza',
    bio: 'Student Developer crafting minimalist, high-performance tools and web applications.'
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    handleProfileSave({
      name,
      studentId,
      email,
      major,
      avatarUrl: profile.avatarUrl
    });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 relative">
      
      {/* Abstract Background Elements */}
      <div className="fixed top-20 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-brand-500/5 rounded-full blur-[120px] pointer-events-none -z-10"></div>
      
      {/* Header section */}
      <div className="text-center space-y-4 mb-14 opacity-0 animate-fade-in" style={{ animationDelay: '50ms' }}>
        <div className="inline-flex items-center justify-center p-3 bg-brand-500/10 rounded-2xl mb-2 shadow-lg shadow-brand-500/10">
          <Settings2 size={24} className="text-brand-400" />
        </div>
        <h1 className="text-3xl md:text-4xl font-bold font-heading text-white tracking-tight">{t('settingsTitle', lang)}</h1>
        <p className="text-sm text-dark-muted max-w-md mx-auto leading-relaxed">{t('settingsDesc', lang)}</p>
      </div>

      {saveSuccess && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs px-4 py-3 rounded-2xl flex items-center justify-center gap-2 max-w-md mx-auto mb-8 opacity-0 animate-fade-in backdrop-blur-md shadow-lg shadow-emerald-500/5" style={{ animationDelay: '50ms' }}>
          <CheckCircle2 size={16} />
          {t('profileSuccess', lang)}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 relative">
        
        {/* Left Column (Profile & Integrations) */}
        <div className="lg:col-span-7 space-y-8">
          
          {/* Profile Card */}
          <div className="bg-dark-card/40 backdrop-blur-xl border border-white/5 rounded-3xl p-8 relative overflow-hidden group transition-all duration-500 hover:border-brand-500/20 opacity-0 animate-fade-in" style={{ animationDelay: '150ms' }}>
            <div className="absolute top-0 right-0 p-6 opacity-20 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
              <Sparkles size={80} className="text-brand-500 blur-2xl group-hover:blur-xl transition-all" />
            </div>

            <form onSubmit={handleSubmit} className="relative z-10 space-y-10">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left">
                <div className="w-24 h-24 rounded-full p-1 bg-gradient-to-br from-brand-500 to-transparent shadow-2xl relative shrink-0">
                  <div className="w-full h-full rounded-full overflow-hidden bg-dark-sidebar border-2 border-dark-bg relative group-hover:scale-[0.98] transition-transform duration-500">
                    <img 
                      src={profile.avatarUrl || 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&q=80&w=200'} 
                      alt="Avatar" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
                <div className="pt-2">
                  <h3 className="text-xl font-bold text-white mb-1.5">{name || 'Student'}</h3>
                  <div className="inline-flex items-center gap-2 bg-dark-bg/50 border border-white/5 px-3 py-1 rounded-full text-[10px] font-semibold text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
                    {lang === 'en' ? 'Synced Profile' : 'ซิงค์ข้อมูลแล้ว'}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-8">
                <InputField label={t('studentNameLabel', lang)} value={name} onChange={setName} />
                <InputField label={t('studentIdLabel', lang)} value={studentId} onChange={setStudentId} />
                <InputField label={t('studentEmailLabel', lang)} value={email} onChange={setEmail} type="email" />
                <InputField label={t('studentMajorLabel', lang)} value={major} onChange={setMajor} />
              </div>
              
              <div className="pt-2">
                <button type="submit" className="w-full sm:w-auto bg-white/5 hover:bg-white/10 border border-white/10 text-white px-8 py-3 rounded-2xl font-medium text-xs transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 cursor-pointer">
                  {lang === 'en' ? 'Save Preferences' : 'บันทึกการตั้งค่า'}
                </button>
              </div>
            </form>
          </div>

          {/* Integration Card */}
          <div className="bg-gradient-to-br from-brand-500/5 to-transparent border border-brand-500/10 rounded-3xl p-8 hover:border-brand-500/30 transition-all duration-500 opacity-0 animate-fade-in group" style={{ animationDelay: '250ms' }}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div className="flex-1 min-w-0 pr-2">
                <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                  <Layers className="text-brand-400 shrink-0" size={18} />
                  <span className="truncate">{lang === 'en' ? 'Classroom Integration' : 'บัญชี Google Classroom'}</span>
                </h3>
                <p className="text-xs text-dark-muted leading-relaxed break-all">
                  {isLoggedIn 
                    ? (lang === 'en' ? `Connected securely as ${profile.email || email}` : `เชื่อมต่อแล้วด้วยอีเมล ${profile.email || email}`) 
                    : (lang === 'en' ? 'Connect your account to sync assignments automatically.' : 'เชื่อมต่อบัญชีเพื่อซิงค์ข้อมูลการบ้านอัตโนมัติ')}
                </p>
              </div>
              {isLoggedIn ? (
                <button onClick={logout} className="shrink-0 bg-rose-500/10 hover:bg-rose-500 hover:text-white text-rose-400 border border-rose-500/20 px-6 py-3 rounded-2xl text-xs font-bold transition-all duration-300 cursor-pointer">
                  {t('disconnectBtn', lang)}
                </button>
              ) : (
                <button onClick={login} className="shrink-0 bg-brand-500 hover:bg-brand-400 text-white shadow-lg shadow-brand-500/25 px-6 py-3 rounded-2xl text-xs font-bold transition-all duration-300 hover:-translate-y-0.5 cursor-pointer">
                  {t('connectBtn', lang)}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Column (Developer & Info) */}
        <div className="lg:col-span-5 space-y-8">
          
          {/* Developer Card */}
          <div className="bg-dark-card/30 backdrop-blur-xl border border-white/5 rounded-3xl p-8 hover:border-white/10 transition-all duration-500 opacity-0 animate-fade-in group" style={{ animationDelay: '350ms' }}>
            <div className="flex flex-col gap-6 mb-8">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-brand-500/20 to-transparent border border-brand-500/20 flex items-center justify-center rotate-3 group-hover:rotate-6 transition-transform duration-500">
                <Code size={24} className="text-brand-400" />
              </div>
              <div>
                <h4 className="font-bold text-white text-lg tracking-tight mb-1">{t('developerHeader', lang)}</h4>
                <p className="text-xs font-medium text-brand-400">@{devInfo.nickname}</p>
              </div>
            </div>
            
            <p className="text-xs text-zinc-400 leading-relaxed mb-8">
              {devInfo.bio}
            </p>
            
            <div className="space-y-4 mb-8 text-[11px] font-medium">
              <div className="flex items-center gap-3 text-zinc-400">
                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center shrink-0">
                  <GraduationCap size={14} className="text-brand-400" />
                </div>
                <span className="leading-snug">{devInfo.university}</span>
              </div>
              <div className="flex items-center gap-3 text-zinc-400">
                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center shrink-0">
                  <Mail size={14} className="text-brand-400" />
                </div>
                <a href={`mailto:${devInfo.email}`} className="hover:text-white transition-colors">{devInfo.email}</a>
              </div>
            </div>
            
            <a 
              href={devInfo.github} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="flex items-center justify-between w-full bg-white/5 hover:bg-white/10 border border-white/5 p-4 rounded-2xl transition-all duration-300 group/btn"
            >
              <div className="flex items-center gap-3 text-xs font-bold text-white">
                <GithubIcon size={16} /> GitHub Profile
              </div>
              <ChevronRight size={16} className="text-dark-muted group-hover/btn:text-white group-hover/btn:translate-x-1 transition-all" />
            </a>
          </div>


          
        </div>
      </div>
    </div>
  );
}
