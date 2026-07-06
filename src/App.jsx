import { useEffect, useRef, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import { Globe } from 'lucide-react';
import { t } from './utils/i18n';

// Lazy loaded pages
const Home = lazy(() => import('./pages/Home'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Courses = lazy(() => import('./pages/Courses'));
const AssignmentDetail = lazy(() => import('./pages/AssignmentDetail'));
const Settings = lazy(() => import('./pages/Settings'));
const ExamRoom = lazy(() => import('./pages/ExamRoom'));

// Import Providers
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SettingsProvider, useSettings } from './contexts/SettingsContext';
import { ClassroomProvider } from './contexts/ClassroomContext';
import ErrorBoundary from './components/ErrorBoundary';

function LoginRedirect() {
  const { isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const prevLoggedIn = useRef(isLoggedIn);

  useEffect(() => {
    if (isLoggedIn && !prevLoggedIn.current) {
      if (location.pathname === '/') {
        navigate('/dashboard');
      }
    }
    prevLoggedIn.current = isLoggedIn;
  }, [isLoggedIn, navigate, location.pathname]);

  return null;
}

function AppContent() {
  const { isLoggedIn, login, initClient } = useAuth();
  const { lang, toggleLang } = useSettings();

  // Force dark theme as default
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  // Initialize Google Auth Client
  useEffect(() => {
    const cleanup = initClient(lang, (token) => {
      // Auto-sync could be dispatched here or managed by ClassroomContext.
      // Currently ClassroomContext watches for isLoggedIn to become true.
    });
    return cleanup;
  }, [initClient, lang]);

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen w-screen flex items-center justify-center bg-dark-bg p-4 select-none relative">
        <div className="absolute top-4 right-4 z-50">
          <button
            onClick={toggleLang}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-dark-card hover:bg-dark-hover border border-dark-border text-xs font-semibold rounded-lg text-dark-muted hover:text-white transition-all cursor-pointer select-none active:scale-95"
          >
            <Globe size={13} />
            <span>{lang === 'en' ? 'EN' : 'TH'}</span>
          </button>
        </div>
        <div className="w-full max-w-sm bg-dark-card/20 border border-dark-border/30 rounded-3xl p-8 space-y-8 text-center shadow-lg relative overflow-hidden animate-fade-in">
          <div className="absolute -top-16 -left-16 w-32 h-32 bg-brand-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-16 -right-16 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />

          <div className="flex flex-col items-center space-y-2">
            <div className="flex items-center gap-2.5 select-none">
              <span className="font-heading font-extrabold text-white text-2xl">CH</span>
              <h1 className="text-xl font-bold text-white font-heading tracking-wide">Classroom Hub</h1>
            </div>
            <p className="text-[7.5px] text-dark-muted font-bold tracking-[0.25em] uppercase leading-none">
              Learning • Connection • Community
            </p>
          </div>

          <div className="space-y-4 pt-2">
            <button
              onClick={() => login(lang)}
              className="w-full flex items-center justify-center gap-3 bg-white hover:bg-zinc-100 text-zinc-900 font-semibold text-xs py-3.5 px-5 rounded-2xl transition-all duration-200 hover:scale-[1.01] hover:shadow-md cursor-pointer active:scale-[0.99]"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>{t('connectGoogleBtn', lang)}</span>
            </button>
            <p className="text-[10px] text-dark-muted max-w-[280px] mx-auto leading-relaxed">
              {t('loginFooterText', lang)}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <LoginRedirect />
      <Layout>
        <Suspense fallback={
          <div className="flex h-screen items-center justify-center bg-dark-bg text-dark-muted animate-pulse">
            <div className="w-8 h-8 rounded-full border-2 border-brand-500/20 border-t-brand-400 animate-spin mx-auto" />
          </div>
        }>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/courses" element={<Courses />} />
            <Route path="/assignments/:id" element={<AssignmentDetail />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/exam-room" element={<ExamRoom />} />
          </Routes>
        </Suspense>
      </Layout>
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <Router>
        <AuthProvider>
          <SettingsProvider>
            <ClassroomProvider>
              <AppContent />
            </ClassroomProvider>
          </SettingsProvider>
        </AuthProvider>
      </Router>
    </ErrorBoundary>
  );
}
