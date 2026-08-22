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
const Schedule = lazy(() => import('./pages/Schedule'));

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
    const cleanup = initClient(lang, () => {
      // Auto-sync could be dispatched here or managed by ClassroomContext.
      // Currently ClassroomContext watches for isLoggedIn to become true.
    });
    return cleanup;
  }, [initClient, lang]);

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen w-screen flex bg-zinc-950 text-white relative">
        {/* Language Toggle */}
        <div className="absolute top-4 right-4 z-50">
          <button
            onClick={toggleLang}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-black/60 backdrop-blur-md border border-red-900/30 text-xs font-semibold rounded-lg text-zinc-400 hover:text-red-400 hover:border-red-500/50 transition-all cursor-pointer select-none active:scale-95"
          >
            <Globe size={13} />
            <span>{lang === 'en' ? 'EN' : 'TH'}</span>
          </button>
        </div>

        {/* Left Side: Image (Hidden on smaller screens) */}
        <div className="hidden lg:flex w-1/2 relative bg-zinc-900 border-r border-red-900/20 overflow-hidden items-center justify-center">
          {/* Akatsuki Red Glows */}
          <div className="absolute top-0 left-0 w-full h-full bg-red-600/10 mix-blend-overlay z-10"></div>
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-600/20 rounded-full blur-[100px] pointer-events-none z-0"></div>
          
          <img 
            src="/images/ninja-avatar.png" 
            alt="Ninja Avatar" 
            className="w-auto h-[80%] object-contain opacity-90 z-10 drop-shadow-[0_0_15px_rgba(220,38,38,0.5)]"
            style={{ mixBlendMode: 'luminosity' }}
          />
          
          {/* Gradient to blend smoothly with the right side */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-zinc-950/50 to-zinc-950 z-20"></div>
        </div>

        {/* Right Side: Login Form */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-4 relative overflow-hidden bg-zinc-950">
          {/* Akatsuki Red background accents */}
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-red-900/10 rounded-full blur-[120px] pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-rose-900/10 rounded-full blur-[120px] pointer-events-none"></div>

          <div className="w-full max-w-sm bg-black/40 backdrop-blur-xl border border-red-900/30 rounded-3xl p-8 space-y-8 text-center shadow-[0_0_40px_rgba(220,38,38,0.05)] relative z-10 animate-fade-in">
            <div className="absolute -top-16 -left-16 w-32 h-32 bg-red-600/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-16 -right-16 w-32 h-32 bg-red-800/20 rounded-full blur-3xl pointer-events-none" />

            <div className="flex flex-col items-center space-y-2 relative z-10">
              <div className="flex items-center gap-2.5 select-none">
                <span className="font-heading font-black text-red-500 text-3xl tracking-tighter drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]">CH</span>
                <h1 className="text-xl font-bold text-zinc-100 font-heading tracking-wide">Classroom Hub</h1>
              </div>
              <p className="text-[7.5px] text-red-400/80 font-bold tracking-[0.3em] uppercase leading-none mt-2">
                Akatsuki • Connection • Community
              </p>
            </div>

            <div className="space-y-4 pt-4 relative z-10">
              <button
                onClick={() => login(lang)}
                className="w-full flex items-center justify-center gap-3 bg-zinc-900 border border-red-900/50 hover:bg-red-950 hover:border-red-500/50 text-white font-semibold text-xs py-3.5 px-5 rounded-2xl transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_20px_rgba(220,38,38,0.2)] cursor-pointer active:scale-[0.98]"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>{t('connectGoogleBtn', lang)}</span>
              </button>
              <p className="text-[10px] text-zinc-500 max-w-[280px] mx-auto leading-relaxed">
                {t('loginFooterText', lang)}
              </p>
            </div>
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
            <Route path="/schedule" element={<Schedule />} />
          </Routes>
        </Suspense>
      </Layout>
    </>
  );
}
import { ClassroomUIProvider } from './contexts/ClassroomUIContext';

export default function App() {
  return (
    <ErrorBoundary>
      <Router>
        <AuthProvider>
          <SettingsProvider>
            <ClassroomProvider>
              <ClassroomUIProvider>
                <AppContent />
              </ClassroomUIProvider>
            </ClassroomProvider>
          </SettingsProvider>
        </AuthProvider>
      </Router>
    </ErrorBoundary>
  );
}
