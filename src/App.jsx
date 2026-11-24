import { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Layout from './components/Layout';
import { Globe, BookOpen, AlertCircle, ArrowLeft } from 'lucide-react';
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

  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  // Initialize Google Auth Client once on mount
  useEffect(() => {
    const cleanup = initClient('en', () => {});
    return cleanup;
  }, [initClient]);

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen w-screen flex flex-col items-center justify-center bg-[#1E1E1E] text-[#D4D4D4] relative px-4">
        {/* Language Toggle */}
        <div className="absolute top-5 right-5 z-20">
          <button
            type="button"
            onClick={toggleLang}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#252526] border border-[#3C3C3C] text-xs font-medium rounded-lg text-[#D4D4D4] hover:bg-[#2A2D2E] transition-colors cursor-pointer select-none"
          >
            <Globe size={14} className="text-[#858585]" />
            <span>{lang === 'en' ? 'EN' : 'TH'}</span>
          </button>
        </div>

        {/* VS Code Dark Sign-In Card */}
        <div className="w-full max-w-sm bg-[#252526] border border-[#3C3C3C] rounded-2xl p-8 space-y-6 text-center shadow-lg">
          <div className="flex flex-col items-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-[#007ACC]/20 text-[#3794FF] border border-[#007ACC]/30 flex items-center justify-center mb-1">
              <BookOpen size={22} />
            </div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-[#FFFFFF] tracking-tight">Classroom Hub</h1>
              <span className="bg-[#1E1E1E] border border-[#3C3C3C] text-[#3794FF] text-[10px] px-2 py-0.5 rounded-full font-mono font-medium">
                v{APP_VERSION}
              </span>
            </div>
            <p className="text-xs text-[#9D9D9D]">
              {lang === 'en'
                ? 'Academic workspace for Google Classroom, schedules, and exams.'
                : 'พื้นที่จัดการงานเรียน ตารางเรียน และตารางสอบในที่เดียว'}
            </p>
          </div>

          {authError && (
            <div role="alert" className="flex items-start gap-2 rounded-xl border border-[#F14C4C]/40 bg-[#F14C4C]/10 px-3 py-2 text-left text-xs text-[#F14C4C]">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <span>{authError}</span>
            </div>
          )}

          <div className="space-y-3 pt-2">
            <button
              type="button"
              onClick={() => login()}
              aria-disabled={!isAuthReady}
              className="w-full flex items-center justify-center gap-2.5 bg-[#007ACC] hover:bg-[#1177BB] active:bg-[#0E639C] text-white font-medium text-sm py-3 px-5 rounded-xl transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4 shrink-0 bg-white rounded-full p-0.5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span className="truncate">
                {rememberedAccount?.email
                  ? t('continueAsBtn', lang, { email: rememberedAccount.email })
                  : t('connectGoogleBtn', lang)}
              </span>
            </button>

            {rememberedAccount?.email && (
              <button
                type="button"
                onClick={() => login({ selectAccount: true })}
                className="text-xs text-[#3794FF] hover:underline cursor-pointer"
              >
                {t('useAnotherAccount', lang)}
              </button>
            )}

            <label className="flex items-center justify-center gap-2 text-xs text-[#9D9D9D] cursor-pointer select-none pt-1">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => handleRememberMeChange && handleRememberMeChange(e.target.checked)}
                className="w-3.5 h-3.5 rounded accent-[#007ACC] cursor-pointer"
              />
              <span>{lang === 'en' ? 'Remember my account on this device' : 'จดจำบัญชีของฉันไว้ในอุปกรณ์นี้'}</span>
            </label>

            <p className="text-xs text-[#858585] leading-relaxed pt-2 border-t border-[#3C3C3C]">
              {t('loginFooterText', lang)}
            </p>

            <div
              data-testid="login-version-info"
              className="pt-1 flex items-center justify-center gap-1.5 text-[10.5px] font-mono text-[#6E6E6E]"
            >
              <span>v{APP_VERSION}{APP_COMMIT ? ` (${APP_COMMIT})` : ''}</span>
              <span>•</span>
              <span>
                {lang === 'th' ? 'อัปเดตล่าสุด ' : 'Updated '}
                {formatAppBuildTime(lang)}
              </span>
            </div>
          </div>
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
