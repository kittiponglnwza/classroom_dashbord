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
  syncClassroomAssignments
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

  // Auth States
  const [accessToken, setAccessToken] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  
  // Google GIS Token Client ref
  const [tokenClient, setTokenClient] = useState(null);

  // 1. Initial configuration mount
  useEffect(() => {
    // Load local storage caches
    setAssignments(getAssignments());
    setCourses(getCourses());
    setProfile(getProfile());
    setLastSyncTime(getLastSync());

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
      setLastSyncTime(null);
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
      
      // Sync assignments with local overrides, save courses
      const syncedAssigns = syncClassroomAssignments(classroomData.assignments);
      saveCourses(classroomData.courses);

      // Update local states
      setAssignments(syncedAssigns);
      setCourses(classroomData.courses);
      
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

  const handleProfileSave = (updatedProfile) => {
    saveProfile(updatedProfile);
    setProfile(updatedProfile);
  };

  const handleReset = () => {
    const resetData = resetDatabase();
    setAssignments(resetData.assignments);
    setCourses(resetData.courses);
    setProfile(resetData.profile);
    setLastSyncTime(null);
    setIsLoggedIn(false);
    setAccessToken(null);
  };

  return (
    <Router>
      <Layout 
        courses={courses} 
        assignments={assignments}
        isLoggedIn={isLoggedIn}
        isSyncing={isSyncing}
        lastSyncTime={lastSyncTime}
        onSync={() => handleGoogleSync()}
        onLogin={handleLogin}
        onLogout={handleLogout}
        profile={profile}
      >
        <Routes>
          <Route 
            path="/" 
            element={
              <Home 
                assignments={assignments} 
                onStatusChange={handleStatusChange} 
                courses={courses} 
              />
            } 
          />
          <Route 
            path="/dashboard" 
            element={
              <Dashboard 
                assignments={assignments} 
                onStatusChange={handleStatusChange} 
                onAddAssignment={handleAddAssignment}
                courses={courses} 
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
                onStatusChange={handleStatusChange} 
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
                onResetDatabase={handleReset} 
              />
            } 
          />
        </Routes>
      </Layout>
    </Router>
  );
}
