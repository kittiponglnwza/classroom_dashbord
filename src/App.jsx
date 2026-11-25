import { useState, useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import ConsentAwareAnalytics from './components/ConsentAwareAnalytics';
import Layout from './components/Layout';
import { Globe, AlertCircle, ArrowLeft } from 'lucide-react';
import { t } from './utils/i18n';
import { APP_VERSION, APP_COMMIT, formatAppBuildTime } from './config/version';

// Lazy loaded pages
const Home = lazy(() => import('./pages/Home'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Courses = lazy(() => import('./pages/Courses'));
const AssignmentDetail = lazy(() => import('./pages/AssignmentDetail'));
const Settings = lazy(() => import('./pages/Settings'));
const ExamRoom = lazy(() => import('./pages/ExamRoom'));
const Schedule = lazy(() => import('./pages/Schedule'));
const Academic = lazy(() => import('./pages/Academic'));

// Import Providers
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SettingsProvider, useSettings } from './contexts/SettingsContext';
import { ToastProvider } from './contexts/ToastContext';
import { useToast } from './hooks/useToast';
import { ClassroomProvider } from './contexts/ClassroomContext';
import { ClassroomUIProvider } from './contexts/ClassroomUIContext';
import ErrorBoundary from './components/ErrorBoundary';
import CookieConsentBanner from './components/CookieConsentBanner';

function NotFoundView({ lang }) {
  return (
    <div className="min-h-[55vh] flex flex-col items-center justify-center py-16 px-4 text-center space-y-4">
      <div className="w-12 h-12 rounded-xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)]">
        <AlertCircle size={20} strokeWidth={1.5} />
      </div>
      <div className="space-y-1">
        <h1 className="text-xl font-medium text-[var(--text-heading)] tracking-[-0.01em]">
          {lang === 'th' ? 'ไม่พบหน้าที่คุณต้องการ' : 'Page Not Found'}
        </h1>
        <p className="text-sm text-[var(--text-secondary)]">
          {lang === 'th' ? 'เส้นทางนี้ไม่มีอยู่ในแอปพลิเคชัน หรืออาจถูกย้ายแล้ว' : 'The requested route does not exist or may have moved.'}
        </p>
      </div>
      <Link
        to="/"
        className="inline-flex items-center gap-2 px-4 h-9 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-medium transition-colors"
      >
        <ArrowLeft size={16} strokeWidth={1.5} />
        <span>{lang === 'th' ? 'กลับหน้าแรก' : 'Back to Home'}</span>
      </Link>
    </div>
  );
}

function AppContent() {
  const {
    isLoggedIn, isCachedSession, login, initClient, rememberedAccount,
    rememberMe = true, handleRememberMeChange, authError, clearAuthError, isAuthReady = true
  } = useAuth();
  const { lang, toggleLang } = useSettings();
  const { addToast } = useToast();
  const [failedLoginAvatar, setFailedLoginAvatar] = useState(null);
  const hasWorkspaceSession = Boolean(isLoggedIn || isCachedSession || rememberedAccount?.email);

  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  // Initialize Google Auth Client once on mount
  useEffect(() => {
    const cleanup = initClient('en', () => {});
    return cleanup;
  }, [initClient]);

  useEffect(() => {
    if (hasWorkspaceSession && authError) {
      addToast(authError, 'error');
      clearAuthError?.();
    }
  }, [hasWorkspaceSession, authError, addToast, clearAuthError]);

  if (!hasWorkspaceSession) {
    const accountEmail = rememberedAccount?.email || '';
    const accountName = rememberedAccount?.name || (accountEmail ? accountEmail.split('@')[0] : '');
    const accountPicture = rememberedAccount?.picture || '';
    const showAccountAvatar = Boolean(accountPicture) && failedLoginAvatar !== accountPicture;
    const accountInitial = (accountName || accountEmail || 'S').charAt(0).toUpperCase();

    return (
      <div className="min-h-screen w-screen flex flex-col items-center justify-center bg-[var(--app-bg)] text-[var(--text-primary)] relative px-4 overflow-hidden">
        {/* Language Toggle */}
        <div className="absolute top-6 right-6 z-20">
          <button
            type="button"
            onClick={toggleLang}
            className="flex items-center gap-2 h-8 px-3 bg-[var(--surface)] border border-[var(--border)] text-xs font-medium rounded-lg text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
          >
            <Globe size={15} strokeWidth={1.5} className="text-[var(--text-muted)]" />
            <span>{lang === 'en' ? 'EN' : 'TH'}</span>
          </button>
        </div>

        {/* Academic Ledger Sign-In Card */}
        <div className="relative z-10 w-full max-w-[380px] bg-[var(--surface)] border border-[var(--border-strong)] rounded-2xl p-6 space-y-6 text-center shadow-[inset_0_1px_0_rgba(238,240,245,0.06)]">
          <div className="flex flex-col items-center space-y-2">
            <img
              src="/Logo.svg"
              alt="Classroom Hub Logo"
              className="w-12 h-12 rounded-xl select-none"
            />
            <h1 className="text-xl font-medium text-[var(--text-heading)] tracking-[-0.01em] pt-2">
              Classroom Hub
            </h1>
            <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">
              {lang === 'en'
                ? 'Coursework, timetables, and exam seating for KMUTNB'
                : 'รวมงานเรียน ตารางสอน และที่นั่งสอบ มจพ.'}
            </p>
          </div>

          {authError && (
            <div role="alert" className="flex items-start gap-2 rounded-lg border border-rose-500/35 bg-rose-500/10 px-3 py-2 text-left text-xs text-rose-400">
              <AlertCircle size={16} strokeWidth={1.5} className="shrink-0 mt-0.5" />
              <span>{authError}</span>
            </div>
          )}

          <div className="space-y-4">
            {accountEmail && (
              <div
                onClick={() => login()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    login();
                  }
                }}
                title={accountEmail}
                className="group flex items-center justify-between gap-3 p-3 rounded-xl bg-[var(--app-bg)] hover:bg-[var(--surface-elevated)] border border-[var(--border)] hover:border-[var(--border-strong)] transition-colors cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative shrink-0">
                    <div className="w-10 h-10 rounded-full overflow-hidden border border-[var(--border)] bg-[var(--surface-elevated)] flex items-center justify-center">
                      {showAccountAvatar ? (
                        <img
                          src={accountPicture}
                          alt={accountName || 'Account Avatar'}
                          onError={() => setFailedLoginAvatar(accountPicture)}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-sm font-medium text-[var(--text-heading)] select-none">
                          {accountInitial}
                        </span>
                      )}
                    </div>
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[var(--success)] ring-2 ring-[var(--app-bg)]" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-[var(--text-heading)] truncate group-hover:text-[var(--primary-bright)] transition-colors">
                      {accountName}
                    </p>
                    <p className="text-xs text-[var(--text-muted)] truncate font-mono mt-0.5">
                      {accountEmail}
                    </p>
                  </div>
                </div>

                <span className="text-xs font-mono text-[var(--success)] shrink-0">
                  {lang === 'en' ? 'Saved' : 'จำไว้'}
                </span>
              </div>
            )}

            <button
              type="button"
              onClick={() => login()}
              aria-disabled={!isAuthReady}
              className="w-full h-11 flex items-center justify-center gap-2.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-medium text-[13px] px-4 rounded-[10px] shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] transition-[background-color,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.98] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-bright)]"
            >
              <svg className="w-4 h-4 shrink-0 bg-white rounded-full p-0.5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>
                {accountEmail
                  ? (lang === 'en' ? 'Continue with Google' : 'ดำเนินการต่อด้วย Google')
                  : t('connectGoogleBtn', lang)}
              </span>
            </button>

            <div className="flex items-center justify-between gap-2 pt-1 text-xs text-[var(--text-muted)]">
              <label className="inline-flex items-center gap-2 cursor-pointer select-none hover:text-[var(--text-primary)] transition-colors">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => handleRememberMeChange && handleRememberMeChange(e.target.checked)}
                  className="w-4 h-4 rounded accent-[var(--primary)] cursor-pointer"
                />
                <span>{lang === 'en' ? 'Remember me' : 'จดจำบัญชี'}</span>
              </label>

              {accountEmail && (
                <button
                  type="button"
                  onClick={() => login({ selectAccount: true })}
                  className="text-[var(--primary-bright)] hover:underline font-medium cursor-pointer transition-colors"
                >
                  {lang === 'en' ? 'Switch account' : 'สลับบัญชี'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Version & Build Timestamp */}
        <div
          data-testid="login-version-info"
          className="relative z-10 mt-4 flex items-center justify-center gap-2 text-xs font-mono tabular-nums text-[var(--text-muted)] select-none"
        >
          <span>v{APP_VERSION}{APP_COMMIT ? ` (${APP_COMMIT})` : ''}</span>
          <span>•</span>
          <span>{formatAppBuildTime(lang)}</span>
        </div>

        <CookieConsentBanner />
      </div>
    );
  }

  return (
    <>
      <Layout>
        <Suspense
          fallback={
            <div className="min-h-[60vh] flex items-center justify-center text-[var(--text-muted)]">
              <div className="w-6 h-6 rounded-full border-2 border-[var(--border)] border-t-[var(--primary)] animate-spin" />
            </div>
          }
        >
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/courses" element={<Courses />} />
            <Route path="/assignments/:id" element={<AssignmentDetail />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/exam-room" element={<ExamRoom />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/academic" element={<Academic />} />
            <Route path="*" element={<NotFoundView lang={lang} />} />
          </Routes>
        </Suspense>
      </Layout>
      <CookieConsentBanner />
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <Router>
        <AuthProvider>
          <SettingsProvider>
            <ToastProvider>
              <ClassroomProvider>
                <ClassroomUIProvider>
                  <AppContent />
                  <ConsentAwareAnalytics />
                </ClassroomUIProvider>
              </ClassroomProvider>
            </ToastProvider>
          </SettingsProvider>
        </AuthProvider>
      </Router>
    </ErrorBoundary>
  );
}
