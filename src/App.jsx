import { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import { Globe, BookOpen } from 'lucide-react';
import { t } from './utils/i18n';

// Lazy loaded pages
const Home = lazy(() => import('./pages/Home'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Courses = lazy(() => import('./pages/Courses'));
const AssignmentDetail = lazy(() => import('./pages/AssignmentDetail'));
const Settings = lazy(() => import('./pages/Settings'));
const ExamRoom = lazy(() => import('./pages/ExamRoom'));
const Schedule = lazy(() => import('./pages/Schedule'));

// Import Providers
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SettingsProvider, useSettings } from './contexts/SettingsContext';
import { ToastProvider } from './contexts/ToastContext';
import { ClassroomProvider } from './contexts/ClassroomContext';
import { ClassroomUIProvider } from './contexts/ClassroomUIContext';
import ErrorBoundary from './components/ErrorBoundary';
import CookieConsentBanner from './components/CookieConsentBanner';

function AppContent() {
  const { isLoggedIn, login, initClient, rememberedAccount, rememberMe = true, handleRememberMeChange } = useAuth();
  const { lang, toggleLang } = useSettings();

  useEffect(() => {
    document.documentElement.classList.remove('dark');
  }, []);

  // Initialize Google Auth Client
  useEffect(() => {
    const cleanup = initClient(lang, () => {});
    return cleanup;
  }, [initClient, lang]);

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen w-screen flex flex-col items-center justify-center bg-[#F5F5F7] text-[#1D1D1F] relative px-4">
        {/* Language Toggle */}
        <div className="absolute top-5 right-5 z-20">
          <button
            type="button"
            onClick={toggleLang}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#D2D2D7] text-xs font-medium rounded-lg text-[#1D1D1F] hover:bg-[#F5F5F7] transition-colors cursor-pointer select-none"
          >
            <Globe size={14} className="text-[#6E6E73]" />
            <span>{lang === 'en' ? 'EN' : 'TH'}</span>
          </button>
        </div>

        {/* Minimalist Apple-Inspired Sign-In Card */}
        <div className="w-full max-w-sm bg-white border border-[#D2D2D7]/80 rounded-2xl p-8 space-y-6 text-center shadow-xs">
          <div className="flex flex-col items-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-[#0071E3]/10 text-[#0071E3] flex items-center justify-center mb-1">
              <BookOpen size={22} />
            </div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-[#1D1D1F] tracking-tight">Classroom Hub</h1>
              <span className="bg-[#F5F5F7] border border-[#D2D2D7] text-[#6E6E73] text-[10px] px-2 py-0.5 rounded-full font-medium">
                Beta
              </span>
            </div>
            <p className="text-xs text-[#6E6E73]">
              {lang === 'en'
                ? 'Academic workspace for Google Classroom, schedules, and exams.'
                : 'พื้นที่จัดการงานเรียน ตารางเรียน และตารางสอบในที่เดียว'}
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <button
              type="button"
              onClick={() => login()}
              className="w-full flex items-center justify-center gap-2.5 bg-[#0071E3] hover:bg-[#0077ED] active:bg-[#0062C4] text-white font-medium text-sm py-3 px-5 rounded-xl transition-colors cursor-pointer"
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
                className="text-xs text-[#0071E3] hover:underline cursor-pointer"
              >
                {t('useAnotherAccount', lang)}
              </button>
            )}

            <label className="flex items-center justify-center gap-2 text-xs text-[#6E6E73] cursor-pointer select-none pt-1">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => handleRememberMeChange && handleRememberMeChange(e.target.checked)}
                className="w-3.5 h-3.5 rounded accent-[#0071E3] cursor-pointer"
              />
              <span>{lang === 'en' ? 'Remember my account on this device' : 'จดจำบัญชีของฉันไว้ในอุปกรณ์นี้'}</span>
            </label>

            <p className="text-xs text-[#6E6E73] leading-relaxed pt-2 border-t border-[#D2D2D7]/60">
              {t('loginFooterText', lang)}
            </p>
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
            <div className="flex h-64 items-center justify-center text-[#6E6E73]">
              <div className="w-6 h-6 rounded-full border-2 border-[#D2D2D7] border-t-[#0071E3] animate-spin" />
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
