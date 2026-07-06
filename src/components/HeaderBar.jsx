import { useState, useRef } from 'react';
import { Menu, Bell, RefreshCw, AlertTriangle, Globe } from 'lucide-react';
import { t } from '../utils/i18n';
import NotificationPopover from './NotificationPopover';
import { formatRelativeTime } from '../utils/dateUtils';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { useClassroom } from '../contexts/ClassroomContext';

export default function HeaderBar({ setMobileMenuOpen }) {
  const { isLoggedIn, profile } = useAuth();
  const { lang, toggleLang } = useSettings();
  const { visibleAssignments, isSyncing, lastSyncTime, syncClassroom } = useClassroom();
  
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const bellButtonRef = useRef(null);

  const totalActive = visibleAssignments.filter(a => a.status !== 'done').length;
  const overdueCount = visibleAssignments.filter(a => {
    if (a.status === 'done' || !a.dueDate) return false;
    return new Date(a.dueDate) < new Date();
  }).length;

  return (
    <header className="h-16 border-b border-dark-border bg-dark-sidebar/50 backdrop-blur-md px-6 flex items-center justify-between flex-shrink-0 z-30">
      <div className="flex items-center gap-3">
        <button 
          onClick={() => setMobileMenuOpen(true)}
          className="md:hidden p-2 text-dark-muted hover:text-white hover:bg-dark-hover rounded-lg transition-colors border border-dark-border cursor-pointer"
        >
          <Menu size={20} />
        </button>
        <div className="hidden sm:flex items-center gap-3">
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
        {isLoggedIn && (
          <div className="flex items-center gap-3 text-xs pr-4 border-r border-dark-border">
            <span className="text-dark-muted hidden lg:inline">
              {t('lastSync', lang)} <span className="text-white font-medium">{formatRelativeTime(lastSyncTime, lang)}</span>
            </span>
            <button
              onClick={() => syncClassroom()}
              disabled={isSyncing}
              className="flex items-center gap-1.5 bg-dark-card hover:bg-dark-hover text-brand-400 hover:text-brand-300 font-medium px-3.5 py-1.5 rounded-lg border border-dark-border transition-colors disabled:opacity-50 cursor-pointer"
              title="Sync Google Classroom data"
            >
              <RefreshCw size={13} className={isSyncing ? 'animate-spin' : ''} />
              <span>{isSyncing ? t('syncing', lang) : t('sync', lang)}</span>
            </button>
          </div>
        )}

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

        <button
          onClick={toggleLang}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-dark-card hover:bg-dark-hover border border-dark-border text-xs font-semibold rounded-lg text-dark-muted hover:text-white transition-all shadow-sm cursor-pointer select-none active:scale-95 shrink-0"
          title={lang === 'en' ? 'Switch to Thai' : 'เปลี่ยนเป็นภาษาอังกฤษ'}
        >
          <Globe size={13} className="text-dark-muted group-hover:text-white" />
          <span>{lang === 'en' ? 'EN' : 'TH'}</span>
        </button>

        <div className="relative">
          <button 
            ref={bellButtonRef}
            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
            className={`p-2 rounded-lg transition-colors border relative cursor-pointer ${
              isNotificationsOpen 
                ? 'text-white bg-dark-hover border-dark-border' 
                : 'text-dark-muted hover:text-white hover:bg-dark-hover border-transparent hover:border-dark-border'
            }`}
          >
            <Bell size={18} />
            {overdueCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full animate-bounce" />
            )}
          </button>

          <NotificationPopover 
            isNotificationsOpen={isNotificationsOpen} 
            setIsNotificationsOpen={setIsNotificationsOpen} 
            bellButtonRef={bellButtonRef} 
          />
        </div>

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
  );
}
