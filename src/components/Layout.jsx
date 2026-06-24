import { useState } from 'react';
import Sidebar from './Sidebar';
import { Menu, X, Bell, RefreshCw, LogIn, LogOut, Award, AlertTriangle, Globe } from 'lucide-react';
import { t } from '../utils/i18n';

export default function Layout({ 
  children, 
  courses = [], 
  assignments = [], 
  isLoggedIn = false, 
  isSyncing = false, 
  lastSyncTime = null, 
  onSync = null,
  onLogout = null,
  onLogin = null,
  profile = {},
  lang = 'en',
  toggleLang = null
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Format Sync Time to user-friendly string
  const formatSyncTime = (timestamp) => {
    if (!timestamp) return t('neverSynced', lang);
    const date = new Date(timestamp);
    return date.toLocaleTimeString(lang === 'en' ? 'en-US' : 'th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' ' + 
           date.toLocaleDateString(lang === 'en' ? 'en-US' : 'th-TH', { day: 'numeric', month: 'short' });
  };

  // Count active tasks
  const totalActive = assignments.filter(a => a.status !== 'done').length;
  // Count overdue tasks
  const overdueCount = assignments.filter(a => {
    if (a.status === 'done' || !a.dueDate) return false;
    return new Date(a.dueDate) - new Date() < 0;
  }).length;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-dark-bg text-dark-text">
      {/* Desktop Sidebar */}
      <div className="hidden md:block h-full">
        <Sidebar courses={courses} assignments={assignments} profile={profile} lang={lang} />
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden bg-black/60 backdrop-blur-sm">
          <div className="h-full w-64 animate-fade-in">
            <Sidebar courses={courses} assignments={assignments} profile={profile} onLinkClick={() => setMobileMenuOpen(false)} lang={lang} />
          </div>
          <button 
            onClick={() => setMobileMenuOpen(false)}
            className="p-3 text-white absolute top-4 right-4 bg-dark-card rounded-full border border-dark-border"
          >
            <X size={20} />
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Header Bar */}
        <header className="h-16 border-b border-dark-border bg-dark-sidebar/50 backdrop-blur-md px-6 flex items-center justify-between flex-shrink-0 z-30">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 text-dark-muted hover:text-white hover:bg-dark-hover rounded-lg transition-colors border border-dark-border"
            >
              <Menu size={20} />
            </button>
            <div className="hidden sm:flex items-center gap-3">
              <span className="text-xs text-dark-muted">{t('academicTerm', lang)}</span>
              {isLoggedIn ? (
                <span className="text-[10px] font-bold bg-brand-500/10 text-brand-400 border border-brand-500/20 px-2 py-0.5 rounded-full">
                  {t('googleConnected', lang)}
                </span>
              ) : (
                <span className="text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full">
                  {t('mockActive', lang)}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Sync classroom actions */}
            {isLoggedIn && onSync && (
              <div className="flex items-center gap-3 text-xs pr-4 border-r border-dark-border">
                <span className="text-dark-muted hidden lg:inline">
                  {t('lastSync', lang)} <span className="text-white font-medium">{formatSyncTime(lastSyncTime)}</span>
                </span>
                <button
                  onClick={onSync}
                  disabled={isSyncing}
                  className="flex items-center gap-1.5 bg-dark-card hover:bg-dark-hover text-brand-400 hover:text-brand-300 font-medium px-3.5 py-1.5 rounded-lg border border-dark-border transition-colors disabled:opacity-50"
                  title="Sync Google Classroom data"
                >
                  <RefreshCw size={13} className={isSyncing ? 'animate-spin' : ''} />
                  <span>{isSyncing ? t('syncing', lang) : t('sync', lang)}</span>
                </button>
              </div>
            )}

            {/* Quick Stats Summary */}
            <div className="hidden lg:flex items-center gap-4 text-xs pr-4 mr-2 border-r border-dark-border">
              <div className="text-right">
                <span className="text-dark-muted block">{t('tasksPending', lang)}</span>
                <span className="font-semibold text-brand-400">{totalActive} {totalActive === 1 ? t('taskPlural', lang) : t('tasksPlural', lang)}</span>
              </div>
              {overdueCount > 0 && (
                <div className="text-right">
                  <span className="text-rose-400 block font-semibold flex items-center gap-1">
                    <AlertTriangle size={11} /> {t('overdueHeader', lang)}
                  </span>
                  <span className="font-bold text-rose-400">{overdueCount} {overdueCount === 1 ? t('taskPlural', lang) : t('tasksPlural', lang)}</span>
                </div>
              )}
            </div>

            {/* Language Switcher */}
            {toggleLang && (
              <button
                onClick={toggleLang}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-dark-card hover:bg-dark-hover border border-dark-border text-xs font-semibold rounded-lg text-dark-muted hover:text-white transition-all shadow-sm cursor-pointer select-none active:scale-95 shrink-0"
                title={lang === 'en' ? 'Switch to Thai' : 'เปลี่ยนเป็นภาษาอังกฤษ'}
              >
                <Globe size={13} className="text-dark-muted group-hover:text-white" />
                <span>{lang === 'en' ? 'EN' : 'TH'}</span>
              </button>
            )}

            {/* Notification Bell */}
            <button className="p-2 text-dark-muted hover:text-white hover:bg-dark-hover rounded-lg transition-colors border border-transparent hover:border-dark-border relative">
              <Bell size={18} />
              {overdueCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full animate-bounce" />
              )}
            </button>

            {/* Theme toggle removed, locked to Dark Mode default */}

            {/* Profile Avatar & Login/Logout Trigger */}
            <div className="flex items-center gap-3 pl-2">
              <div className="w-8 h-8 rounded-full overflow-hidden bg-brand-500/10 border border-dark-border">
                <img 
                  src={profile.avatarUrl || "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&q=80&w=200"} 
                  alt="Student Avatar" 
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="hidden sm:flex flex-col text-left max-w-[120px]">
                <span className="text-xs font-semibold text-white truncate">
                  {profile.name || 'Student'}
                </span>
                <span className="text-[9px] text-dark-muted truncate mt-0.5">
                  {profile.email || t('connected', lang)}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Dynamic Page Container */}
        <main className="flex-1 overflow-y-auto bg-dark-bg p-6 md:p-8">
          <div className="max-w-7xl mx-auto w-full animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
