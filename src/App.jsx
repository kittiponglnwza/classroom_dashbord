import { useState, useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
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
import { ClassroomProvider } from './contexts/ClassroomContext';
import { ClassroomUIProvider } from './contexts/ClassroomUIContext';
import ErrorBoundary from './components/ErrorBoundary';
import CookieConsentBanner from './components/CookieConsentBanner';

function NotFoundView({ lang }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center space-y-4">
      <div className="w-12 h-12 rounded-2xl bg-[#252526] border border-[#3C3C3C] flex items-center justify-center text-[#858585]">
        <AlertCircle size={22} />
      </div>
      <div className="space-y-1">
        <h1 className="text-lg font-semibold text-[#FFFFFF]">
          {lang === 'th' ? 'ไม่พบหน้าที่คุณต้องการ' : 'Page Not Found'}
        </h1>
        <p className="text-xs text-[#9D9D9D]">
          {lang === 'th' ? 'เส้นทางนี้ไม่มีอยู่ในแอปพลิเคชัน หรืออาจถูกย้ายแล้ว' : 'The requested route does not exist or may have moved.'}
        </p>
      </div>
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#007ACC] hover:bg-[#1177BB] text-white text-xs font-medium transition-colors"
      >
        <ArrowLeft size={14} />
        <span>{lang === 'th' ? 'กลับหน้าแรก' : 'Back to Home'}</span>
      </Link>
    </div>
  );
}

function AppContent() {
  const {
    isLoggedIn, login, initClient, rememberedAccount,
    rememberMe = true, handleRememberMeChange, authError, isAuthReady = true
  } = useAuth();
  const { lang, toggleLang } = useSettings();
  const [failedLoginAvatar, setFailedLoginAvatar] = useState(null);

  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  // Initialize Google Auth Client once on mount
  useEffect(() => {
    const cleanup = initClient('en', () => {});
    return cleanup;
  }, [initClient]);

  if (!isLoggedIn) {
    const accountEmail = rememberedAccount?.email || '';
    const accountName = rememberedAccount?.name || (accountEmail ? accountEmail.split('@')[0] : '');
    const accountPicture = rememberedAccount?.picture || '';
    const showAccountAvatar = Boolean(accountPicture) && failedLoginAvatar !== accountPicture;
    const accountInitial = (accountName || accountEmail || 'S').charAt(0).toUpperCase();

    return (
      <div className="min-h-screen w-screen flex flex-col items-center justify-center bg-[#18181A] text-[#D4D4D4] relative px-4 overflow-hidden">
        {/* Ambient Background Glow matching Logo.svg gradient */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute w-[380px] h-[380px] rounded-full bg-gradient-to-tr from-[#6366f1]/12 via-[#007ACC]/10 to-[#a855f7]/12 blur-3xl"
        />

        {/* Language Toggle */}
        <div className="absolute top-5 right-5 z-20">
          <button
            type="button"
            onClick={toggleLang}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#252526]/90 backdrop-blur-md border border-[#3C3C3C] text-xs font-medium rounded-xl text-[#D4D4D4] hover:bg-[#2A2D2E] transition-colors cursor-pointer select-none shadow-sm"
          >
            <Globe size={13} className="text-[#858585]" />
            <span>{lang === 'en' ? 'EN' : 'TH'}</span>
          </button>
        </div>

        {/* Minimalist Sign-In Card */}
        <div className="relative z-10 w-full max-w-[356px] bg-[#232326]/95 backdrop-blur-xl border border-[#38383D] ring-1 ring-white/[0.04] rounded-3xl p-7 space-y-6 text-center shadow-[0_24px_60px_rgba(0,0,0,0.55)]">
          <div className="flex flex-col items-center space-y-2">
            <div className="relative">
              <img
                src="/Logo.svg"
                alt="Classroom Hub Logo"
                className="w-12 h-12 rounded-2xl shadow-lg ring-1 ring-white/10 select-none"
              />
            </div>
            <h1 className="text-xl font-semibold text-[#FFFFFF] tracking-tight pt-1">
              Classroom Hub
            </h1>
            <p className="text-[11.5px] text-[#8E8E93] tracking-wide">
              {lang === 'en' ? 'Classroom • Schedule • Exams' : 'งานเรียน • ตารางเรียน • ตารางสอบ'}
            </p>
          </div>

          {authError && (
            <div role="alert" className="flex items-start gap-2 rounded-xl border border-[#F14C4C]/40 bg-[#F14C4C]/10 px-3 py-2 text-left text-xs text-[#F14C4C]">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span>{authError}</span>
            </div>
          )}

          <div className="space-y-3.5">
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
                className="group flex items-center justify-between gap-3 p-2.5 pr-3 rounded-2xl bg-[#1A1A1D] hover:bg-[#1E1E22] border border-[#34343A] hover:border-[#4A4A52] transition-all cursor-pointer text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative shrink-0">
                    <div className="w-10 h-10 rounded-full overflow-hidden border border-[#3C3C3C] bg-gradient-to-br from-[#6366f1] to-[#007ACC] flex items-center justify-center shadow-inner">
                      {showAccountAvatar ? (
                        <img
                          src={accountPicture}
                          alt={accountName || 'Account Avatar'}
                          onError={() => setFailedLoginAvatar(accountPicture)}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-sm font-semibold text-white select-none">
                          {accountInitial}
                        </span>
                      )}
                    </div>
                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 ring-2 ring-[#1A1A1D]" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-[#FFFFFF] truncate group-hover:text-[#3794FF] transition-colors">
                      {accountName}
                    </p>
                    <p className="text-[11px] text-[#8E8E93] truncate font-mono mt-0.5">
                      {accountEmail}
                    </p>
                  </div>
                </div>

                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 shrink-0">
                  {lang === 'en' ? 'Saved' : 'จำไว้'}
                </span>
              </div>
            )}

            <button
              type="button"
              onClick={() => login()}
              aria-disabled={!isAuthReady}
              className="w-full flex items-center justify-center gap-2.5 bg-gradient-to-r from-[#007ACC] to-[#1177BB] hover:from-[#0E86DA] hover:to-[#1683CC] active:scale-[0.99] text-white font-medium text-xs py-3 px-4 rounded-xl shadow-md shadow-[#007ACC]/20 transition-all cursor-pointer"
            >
              <svg className="w-4 h-4 shrink-0 bg-white rounded-full p-0.5 shadow-xs" viewBox="0 0 24 24">
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

            <div className="flex items-center justify-between gap-2 pt-1 text-[11px] text-[#8E8E93]">
              <label className="inline-flex items-center gap-1.5 cursor-pointer select-none hover:text-[#D4D4D4] transition-colors">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => handleRememberMeChange && handleRememberMeChange(e.target.checked)}
                  className="w-3.5 h-3.5 rounded accent-[#007ACC] cursor-pointer"
                />
                <span>{lang === 'en' ? 'Remember me' : 'จดจำบัญชี'}</span>
              </label>

              {accountEmail && (
                <button
                  type="button"
                  onClick={() => login({ selectAccount: true })}
                  className="text-[#3794FF] hover:text-[#58A6FF] hover:underline font-medium cursor-pointer transition-colors"
                >
                  {lang === 'en' ? 'Switch account' : 'สลับบัญชี'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Minimal Version & Latest Update Footer */}
        <div
          data-testid="login-version-info"
          className="relative z-10 mt-4 flex items-center justify-center gap-1.5 text-[10.5px] font-mono text-[#6E6E6E] select-none"
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
            <div className="flex h-64 items-center justify-center text-[#858585]">
              <div className="w-6 h-6 rounded-full border-2 border-[#3C3C3C] border-t-[#007ACC] animate-spin" />
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
                </ClassroomUIProvider>
              </ClassroomProvider>
            </ToastProvider>
          </SettingsProvider>
        </AuthProvider>
      </Router>
    </ErrorBoundary>
  );
}
