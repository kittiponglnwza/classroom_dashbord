import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import Courses from './pages/Courses';
import AssignmentDetail from './pages/AssignmentDetail';
import Settings from './pages/Settings';
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
  saveAssignments
} from './utils/storage';
import { 
  initGoogleClient, 
  fetchGoogleProfile, 
  fetchGoogleClassroomData 
} from './services/googleClassroom';

export default function App() {
  // Application Data States
  const [assignments, setAssignments] = useState([]);
  const [courses, setCourses] = useState([]);
  const [profile, setProfile] = useState({});
  const [hiddenCourseIds, setHiddenCourseIds] = useState([]);
  const [resources, setResources] = useState([]);

  // Auth & Theme States
  const [accessToken, setAccessToken] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [theme, setTheme] = useState('dark');
  
  // Google GIS Token Client ref
  const [tokenClient, setTokenClient] = useState(null);

  // 1. Initial configuration mount
  useEffect(() => {
    // Load local storage caches
    setAssignments(getAssignments());
    setCourses(getCourses());
    setProfile(getProfile());
    setLastSyncTime(getLastSync());
    setHiddenCourseIds(getHiddenCourses());
    setResources(getResources());

    // Recover saved theme preference
    const savedTheme = localStorage.getItem('classroom_hub_theme') || 'dark';
    setTheme(savedTheme);
    if (savedTheme === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
    }

    // Recover session token if present
    const sessionToken = getToken();
    if (sessionToken) {
      setAccessToken(sessionToken);
      setIsLoggedIn(true);
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
            alert('Failed to authorize Google Classroom Access.');
          }
        );
        setTokenClient(client);
      }
    }, 400);

    return () => clearInterval(checkGisLoaded);
  }, []);

  // Handler for Google Login click
  const handleLogin = () => {
    if (tokenClient) {
      tokenClient.requestAccessToken();
    } else {
      alert('Google Auth client is still initializing or missing Client ID in .env. Please check configuration.');
    }
  };

  // Handler for Google Logout/Disconnect
  const handleLogout = () => {
    if (confirm('Disconnect from Google Classroom and restore local default view?')) {
      clearToken();
      setAccessToken(null);
      setIsLoggedIn(false);
      
      // Wipe cache and restore default profiles
      const reset = resetDatabase();
      setAssignments(reset.assignments);
      setCourses(reset.courses);
      setProfile(reset.profile);
      setResources([]);
      setLastSyncTime(null);
      setHiddenCourseIds([]);
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
      saveProfile(userProfile);
      setProfile(userProfile);

      // 2. Fetch classroom subjects and assignments
      const classroomData = await fetchGoogleClassroomData(tokenToUse);
      
      // Sync assignments with local overrides, save courses and resources
      const syncedAssigns = syncClassroomAssignments(classroomData.assignments);
      saveCourses(classroomData.courses);
      saveResources(classroomData.resources || []);

      // Update local states
      setAssignments(syncedAssigns);
      setCourses(classroomData.courses);
      setResources(classroomData.resources || []);
      
      const now = new Date().toISOString();
      setLastSync(now);
      setLastSyncTime(now);

    } catch (e) {
      console.error('Failed to sync Google Classroom data', e);
      if (e.message === 'UNAUTHORIZED') {
        alert('Your Google Classroom authorization session expired. Please connect again.');
        handleLogout();
      } else {
        alert('Failed to sync data from Google Classroom. Please verify your connection.');
      }
    } finally {
      setIsSyncing(false);
    }
  };

  // Toggle visibility status of course
  const handleToggleCourseVisibility = (courseId) => {
    const updated = hiddenCourseIds.includes(courseId)
      ? hiddenCourseIds.filter(id => id !== courseId)
      : [...hiddenCourseIds, courseId];
    setHiddenCourseIds(updated);
    saveHiddenCourses(updated);
  };

  // Switch dark/light theme
  const handleToggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('classroom_hub_theme', newTheme);
    if (newTheme === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
    }
  };

  // Local state alteration handlers
  const handleStatusChange = (id, newStatus) => {
    const updated = updateAssignmentStatus(id, newStatus);
    setAssignments(updated);
  };

  const handleNotesChange = (id, newNotes) => {
    const updated = updateAssignmentNotes(id, newNotes);
    setAssignments(updated);
  };

  const handleAddAssignment = (newAssign) => {
    const updated = addAssignment(newAssign);
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
    const updated = assignments.filter(a => a.parentResourceId !== resourceId);
    setAssignments(updated);
    saveAssignments(updated);
  };

  const handleProfileSave = (updatedProfile) => {
    saveProfile(updatedProfile);
    setProfile(updatedProfile);
  };

  const handleReset = () => {
    const resetData = resetDatabase();
    setAssignments(resetData.assignments);
    setCourses(resetData.courses);
    setProfile(resetData.profile);
    setResources([]);
    setLastSyncTime(null);
    setIsLoggedIn(false);
    setAccessToken(null);
    setHiddenCourseIds([]);
    setTheme('dark');
    document.documentElement.classList.add('dark');
    localStorage.setItem('classroom_hub_theme', 'dark');
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
        theme={theme}
        onToggleTheme={handleToggleTheme}
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
                onTrackAsAssignment={handleTrackAsAssignment}
                onUntrackAssignment={handleUntrackAssignment}
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
              />
            } 
          />
          <Route 
            path="/settings" 
            element={
              <Settings 
                profile={profile} 
                onProfileSave={handleProfileSave} 
                isLoggedIn={isLoggedIn}
                onLogout={handleLogout}
                onLogin={handleLogin}
              />
            } 
          />
        </Routes>
      </Layout>
    </Router>
  );
}
