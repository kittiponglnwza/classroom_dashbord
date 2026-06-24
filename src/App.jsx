import { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import Courses from './pages/Courses';
import AssignmentDetail from './pages/AssignmentDetail';
import Settings from './pages/Settings';
import { Globe } from 'lucide-react';
import { 
  getAssignments, 
  updateAssignmentStatus, 
  updateAssignmentNotes,
  addAssignment, 
  getCourses, 
  saveCourses,
  getProfile, 
  saveProfile, 
  resetDatabase,
  getToken,
  saveToken,
  clearToken,
  getLastSync,
  setLastSync,
  syncClassroomAssignments,
  getHiddenCourses,
  saveHiddenCourses,
  getResources,
  saveResources,
  saveAssignments,
  getActiveEmail,
  setActiveEmail
} from './utils/storage';
import { 
  initGoogleClient, 
  fetchGoogleProfile, 
  fetchGoogleClassroomData 
} from './services/googleClassroom';
import { evaluateNotifications, evaluateNewPostDigest } from './utils/notifications';
import { t } from './utils/i18n';

export default function App() {
  // Application Data States
  const [assignments, setAssignments] = useState([]);
  const [lang, setLang] = useState(() => localStorage.getItem('classroom_hub_language') || 'en');

  const toggleLang = () => {
    const nextLang = lang === 'en' ? 'th' : 'en';
    setLang(nextLang);
    localStorage.setItem('classroom_hub_language', nextLang);

    const email = getActiveEmail();
    if (email) {
      localStorage.setItem(`classroom_hub_${email}_language`, nextLang);
    }
  };
  const [courses, setCourses] = useState([]);
  const [profile, setProfile] = useState({});
  const [hiddenCourseIds, setHiddenCourseIds] = useState([]);
  const [resources, setResources] = useState([]);

  // Auth & Theme States
  const [accessToken, setAccessToken] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  
  // Google GIS Token Client ref
  const [tokenClient, setTokenClient] = useState(null);

  // 1. Initial configuration mount
  useEffect(() => {
    // Force dark theme as default
    document.documentElement.classList.add('dark');

    const sessionToken = getToken();
    const activeEmail = getActiveEmail();

    if (sessionToken && activeEmail) {
      setAccessToken(sessionToken);
      setIsLoggedIn(true);
      
      // Load user-scoped caches
      setAssignments(getAssignments(activeEmail));
      setCourses(getCourses(activeEmail));
      setProfile(getProfile(activeEmail));
      setLastSyncTime(getLastSync(activeEmail));
      setHiddenCourseIds(getHiddenCourses(activeEmail));
      setResources(getResources(activeEmail));

      // Load user-scoped language preference if exists
      const userLangKey = `classroom_hub_${activeEmail}_language`;
      const savedUserLang = localStorage.getItem(userLangKey);
      if (savedUserLang) {
        setLang(savedUserLang);
        localStorage.setItem('classroom_hub_language', savedUserLang);
      }
    } else {
      // Load empty/default caches
      setAssignments(getAssignments(''));
      setCourses(getCourses(''));
      setProfile(getProfile(''));
      setLastSyncTime(getLastSync(''));
      setHiddenCourseIds(getHiddenCourses(''));
      setResources(getResources(''));
      
      if (sessionToken) {
        clearToken();
      }
      setActiveEmail('');
      setIsLoggedIn(false);
      setAccessToken(null);
    }
  }, []);

  // 2. Google OAuth client setup (Polling checks until script is loaded)
  useEffect(() => {
    const checkGisLoaded = setInterval(() => {
      if (window.google?.accounts?.oauth2) {
        clearInterval(checkGisLoaded);
        
        const client = initGoogleClient(
          (tokenResponse) => {
            const token = tokenResponse.access_token;
            setAccessToken(token);
            saveToken(token);
            setIsLoggedIn(true);
            // Auto sync immediately upon fresh login
            handleGoogleSync(token);
          },
          (err) => {
            console.error('Google authorization error:', err);
            alert(t('authAuthError', lang));
          }
        );
        setTokenClient(client);
      }
    }, 400);

    return () => clearInterval(checkGisLoaded);
  }, [lang]); // Reinitialize client if lang changes to update callback references if needed, though mostly static.

  // Handler for Google Login click
  const handleLogin = () => {
    if (tokenClient) {
      tokenClient.requestAccessToken();
    } else {
      alert(t('authInitError', lang));
    }
  };

  // Handler for Google Logout/Disconnect
  const handleLogout = () => {
    if (confirm(t('disconnectConfirm', lang))) {
      clearToken();
      setActiveEmail('');
      setAccessToken(null);
      setIsLoggedIn(false);
      setProfile({});
      
      // Reset states back to default (no email)
      setAssignments(getAssignments(''));
      setCourses(getCourses(''));
      setLastSyncTime(null);
      setHiddenCourseIds([]);
      setResources([]);
    }
  };

  // Handler to fetch real Google Classroom data on demand
  const handleGoogleSync = async (forcedToken = null) => {
    const tokenToUse = forcedToken || accessToken;
    if (!tokenToUse) return;

    setIsSyncing(true);
    try {
      // 1. Fetch user email/avatar details
      const userProfile = await fetchGoogleProfile(tokenToUse);
      const userEmail = userProfile.email;
      
      setActiveEmail(userEmail);

      // Load user-scoped language preference if exists
      const userLangKey = `classroom_hub_${userEmail}_language`;
      const savedUserLang = localStorage.getItem(userLangKey);
      if (savedUserLang) {
        setLang(savedUserLang);
        localStorage.setItem('classroom_hub_language', savedUserLang);
      } else {
        localStorage.setItem(userLangKey, lang);
      }

      // Merge with existing profile to preserve customized settings
      const existingProfile = getProfile(userEmail);
      const mergedProfile = existingProfile && existingProfile.isCustomized
        ? { ...userProfile, ...existingProfile, email: userEmail }
        : userProfile;

      saveProfile(mergedProfile, userEmail);
      setProfile(mergedProfile);

      // Pre-load user-scoped cached data from localStorage into states immediately
      setAssignments(getAssignments(userEmail));
      setCourses(getCourses(userEmail));
      setResources(getResources(userEmail));
      setHiddenCourseIds(getHiddenCourses(userEmail));
      setLastSyncTime(getLastSync(userEmail));

      // 2. Fetch classroom subjects and assignments
      const classroomData = await fetchGoogleClassroomData(tokenToUse);
      
      // Get previously cached IDs for new posts evaluation before updating
      const prevAssignments = getAssignments(userEmail);
      const prevResources = getResources(userEmail);
      const cachedAssignmentIds = prevAssignments.map(a => a.id);
      const cachedResourceIds = prevResources.map(r => r.id);
      const lastSync = getLastSync(userEmail);

      // Sync assignments with local overrides, save courses and resources
      const syncedAssigns = syncClassroomAssignments(classroomData.assignments, userEmail);
      saveCourses(classroomData.courses, userEmail);
      saveResources(classroomData.resources || [], userEmail);

      // Update local states
      setAssignments(syncedAssigns);
      setCourses(classroomData.courses);
      setResources(classroomData.resources || []);
      
      const now = new Date().toISOString();
      setLastSync(now, userEmail);
      setLastSyncTime(now);

      // Trigger evaluations asynchronously to not block the UI sync state transitions
      setTimeout(async () => {
        try {
          if (lastSync) {
            await evaluateNewPostDigest(
              tokenToUse,
              userEmail,
              classroomData.assignments,
              classroomData.resources || [],
              cachedAssignmentIds,
              cachedResourceIds
            );
          }
          await evaluateNotifications(
            tokenToUse,
            userEmail,
            syncedAssigns,
            classroomData.courses,
            classroomData.resources || []
          );
        } catch (err) {
          console.error("Error evaluating Gmail notifications during sync:", err);
        }
      }, 0);

    } catch (e) {
      console.error('Failed to sync Google Classroom data', e);
      if (e.message === 'UNAUTHORIZED') {
        alert(t('sessionExpired', lang));
        handleLogout();
      } else {
        alert(t('syncFailed', lang));
      }
    } finally {
      setIsSyncing(false);
    }
  };

  // Toggle visibility status of course
  const handleToggleCourseVisibility = (courseId) => {
    const email = getActiveEmail();
    const updated = hiddenCourseIds.includes(courseId)
      ? hiddenCourseIds.filter(id => id !== courseId)
      : [...hiddenCourseIds, courseId];
    setHiddenCourseIds(updated);
    saveHiddenCourses(updated, email);
  };

  // Toggle visibility of courses in bulk
  const handleToggleBulkCourses = (courseIds, shouldHideAll) => {
    const email = getActiveEmail();
    const updated = shouldHideAll ? [...courseIds] : [];
    setHiddenCourseIds(updated);
    saveHiddenCourses(updated, email);
  };

  // Local state alteration handlers
  const handleStatusChange = (id, newStatus) => {
    const email = getActiveEmail();
    const updated = updateAssignmentStatus(id, newStatus, email);
    setAssignments(updated);
  };

  const handleNotesChange = (id, newNotes) => {
    const email = getActiveEmail();
    const updated = updateAssignmentNotes(id, newNotes, email);
    setAssignments(updated);
  };

  const handleAddAssignment = (newAssign) => {
    const email = getActiveEmail();
    const updated = addAssignment(newAssign, email);
    setAssignments(updated);
  };

  const handleTrackAsAssignment = (resource) => {
    const newAssign = {
      title: resource.title,
      course: resource.course,
      courseCode: resource.courseCode,
      dueDate: '',
      status: 'todo',
      points: 100,
      description: resource.description || '',
      attachments: resource.attachments || [],
      courseColor: resource.courseColor,
      courseId: resource.courseId,
      googleLink: resource.googleLink || '',
      parentResourceId: resource.id
    };
    handleAddAssignment(newAssign);
  };

  const handleUntrackAssignment = (resourceId) => {
    const email = getActiveEmail();
    const updated = assignments.filter(a => a.parentResourceId !== resourceId);
    setAssignments(updated);
    saveAssignments(updated, email);
  };

  const handleProfileSave = (updatedProfile) => {
    const email = getActiveEmail();
    const profileToSave = {
      ...updatedProfile,
      isCustomized: true
    };
    saveProfile(profileToSave, email);
    setProfile(profileToSave);
  };

  const handleReset = () => {
    const email = getActiveEmail();
    const resetData = resetDatabase(email);
    setAssignments(resetData.assignments);
    setCourses(resetData.courses);
    setProfile(resetData.profile);
    setResources([]);
    setLastSyncTime(null);
    setHiddenCourseIds([]);
    
    if (email) {
      clearToken();
      setActiveEmail('');
      setIsLoggedIn(false);
      setAccessToken(null);
    }
    document.documentElement.classList.add('dark');
  };

  // Dynamic filter sets based on hidden Course IDs
  const visibleCourses = courses.filter(c => !hiddenCourseIds.includes(c.id));
  const visibleAssignments = assignments.filter(a => {
    if (a.courseId && hiddenCourseIds.includes(a.courseId)) {
      return false;
    }
    const courseObj = courses.find(c => c.name === a.course);
    if (courseObj && hiddenCourseIds.includes(courseObj.id)) {
      return false;
    }
    return true;
  });

  const visibleResources = resources.filter(r => {
    if (r.courseId && hiddenCourseIds.includes(r.courseId)) {
      return false;
    }
    const courseObj = courses.find(c => c.name === r.course);
    if (courseObj && hiddenCourseIds.includes(courseObj.id)) {
      return false;
    }
    return true;
  });

  return (
    <Router>
      <LoginRedirect isLoggedIn={isLoggedIn} />
      {!isLoggedIn ? (
        <div className="min-h-screen w-screen flex items-center justify-center bg-dark-bg p-4 select-none relative">
          {/* Top Right Lang Switcher on Login Screen */}
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
            {/* Visual abstract gradient blob for premium feel */}
            <div className="absolute -top-16 -left-16 w-32 h-32 bg-brand-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-16 -right-16 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />

            {/* Branding Logo */}
            <div className="flex flex-col items-center space-y-2">
              <div className="flex items-center gap-2.5 select-none">
                <span className="font-heading font-extrabold text-white text-2xl">CH</span>
                <h1 className="text-xl font-bold text-white font-heading tracking-wide">Classroom Hub</h1>
              </div>
              <p className="text-[7.5px] text-dark-muted font-bold tracking-[0.25em] uppercase leading-none">
                Learning • Connection • Community
              </p>
            </div>

            {/* Google Connect Action */}
            <div className="space-y-4 pt-2">
              <button
                onClick={handleLogin}
                className="w-full flex items-center justify-center gap-3 bg-white hover:bg-zinc-100 text-zinc-900 font-semibold text-xs py-3.5 px-5 rounded-2xl transition-all duration-200 hover:scale-[1.01] hover:shadow-md cursor-pointer active:scale-[0.99]"
              >
                {/* Google G logo SVG */}
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>{t('connectGoogleBtn', lang)}</span>
              </button>
              
              <p className="text-[10px] text-dark-muted max-w-[280px] mx-auto leading-relaxed">
                {t('loginFooterText', lang)}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <Layout 
          courses={visibleCourses} 
          assignments={visibleAssignments}
          isLoggedIn={isLoggedIn}
          isSyncing={isSyncing}
          lastSyncTime={lastSyncTime}
          onSync={() => handleGoogleSync()}
          onLogin={handleLogin}
          onLogout={handleLogout}
          profile={profile}
          lang={lang}
          toggleLang={toggleLang}
        >
          <Routes>
            <Route 
              path="/" 
              element={
                <Home 
                  assignments={visibleAssignments} 
                  onStatusChange={handleStatusChange} 
                  courses={visibleCourses} 
                  profile={profile}
                  resources={visibleResources}
                  lang={lang}
                />
              } 
            />
            <Route 
              path="/dashboard" 
              element={
                <Dashboard 
                  assignments={visibleAssignments} 
                  onStatusChange={handleStatusChange} 
                  onAddAssignment={handleAddAssignment}
                  courses={visibleCourses} 
                  isLoggedIn={isLoggedIn}
                  isSyncing={isSyncing}
                  onSync={() => handleGoogleSync()}
                  lang={lang}
                />
              } 
            />
            <Route 
              path="/courses" 
              element={
                <Courses 
                  courses={courses} 
                  assignments={assignments} 
                  resources={resources}
                  onStatusChange={handleStatusChange}
                  hiddenCourseIds={hiddenCourseIds}
                  onToggleCourseVisibility={handleToggleCourseVisibility}
                  onToggleBulkCourses={handleToggleBulkCourses}
                  onTrackAsAssignment={handleTrackAsAssignment}
                  onUntrackAssignment={handleUntrackAssignment}
                  lang={lang}
                />
              } 
            />
            <Route 
              path="/assignments/:id" 
              element={
                <AssignmentDetail 
                  assignments={assignments} 
                  onStatusChange={handleStatusChange} 
                  onNotesChange={handleNotesChange}
                  lang={lang}
                />
              } 
            />
            <Route 
              path="/settings" 
              element={
                <Settings 
                  key={profile.email || 'guest'}
                  profile={profile} 
                  onProfileSave={handleProfileSave} 
                  isLoggedIn={isLoggedIn}
                  onLogout={handleLogout}
                  onLogin={handleLogin}
                  accessToken={accessToken}
                  assignments={assignments}
                  lang={lang}
                />
              } 
            />
          </Routes>
        </Layout>
      )}
    </Router>
  );
}

function LoginRedirect({ isLoggedIn }) {
  const navigate = useNavigate();
  const prevLoggedIn = useRef(isLoggedIn);

  useEffect(() => {
    if (isLoggedIn && !prevLoggedIn.current) {
      navigate('/');
    }
    prevLoggedIn.current = isLoggedIn;
  }, [isLoggedIn, navigate]);

  return null;
}
