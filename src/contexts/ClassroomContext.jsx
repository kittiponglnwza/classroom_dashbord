import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { 
  getAssignments, updateAssignmentStatus, updateAssignmentNotes,
  addAssignment, getCourses, saveCourses, getLastSync, setLastSync,
  syncClassroomAssignments, getHiddenCourses, saveHiddenCourses,
  getResources, saveResources, saveAssignments, getActiveEmail, resetDatabase
} from '../utils/storage';
import { fetchGoogleClassroomData, fetchGoogleProfile } from '../services/googleClassroom';
import { syncSettingsWithDrive } from '../services/driveSync';
import { evaluateNotifications, evaluateNewPostDigest } from '../utils/notifications';
import { useAuth } from './AuthContext';
import { useSettings } from './SettingsContext';
import { t } from '../utils/i18n';

const ClassroomContext = createContext(null);

export const ClassroomProvider = ({ children }) => {
  const { accessToken, isLoggedIn, updateProfileFromGoogle, logout: authLogout } = useAuth();
  const { lang, setLang, reloadSettings } = useSettings();

  const [assignments, setAssignments] = useState([]);
  const [courses, setCourses] = useState([]);
  const [resources, setResources] = useState([]);
  const [hiddenCourseIds, setHiddenCourseIds] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);

  // --- Concurrency & Auto-sync Guards ---
  const syncInProgressRef = useRef(false);
  const autoSyncedRef = useRef(false);
  const pushTimerRef = useRef(null);

  /**
   * Debounced push to Google Drive (1 second).
   * Skips if a full sync is currently in progress (it will push at end).
   * Errors are caught silently so local UI is never blocked.
   */
  const pushSettingsToDrive = useCallback(() => {
    if (syncInProgressRef.current) return; // sync will push at end
    if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    pushTimerRef.current = setTimeout(() => {
      const token = accessToken;
      const email = getActiveEmail();
      if (token && email) {
        syncSettingsWithDrive(token, email).catch(err => {
          console.error('[Classroom Hub] Failed to push settings to Drive:', err);
        });
      }
    }, 1000);
  }, [accessToken]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    };
  }, []);

  const loadLocalData = (email = '') => {
    setAssignments(getAssignments(email));
    setCourses(getCourses(email));
    setResources(getResources(email));
    setHiddenCourseIds(getHiddenCourses(email));
    setLastSyncTime(getLastSync(email));
  };

  useEffect(() => {
    const activeEmail = getActiveEmail();
    if (isLoggedIn && activeEmail) {
      loadLocalData(activeEmail);
    } else {
      loadLocalData('');
      // Reset auto-sync guard on logout so next login triggers sync
      autoSyncedRef.current = false;
    }
  }, [isLoggedIn]);

  // --- Auto-sync on login/load ---
  useEffect(() => {
    if (isLoggedIn && accessToken && !autoSyncedRef.current) {
      autoSyncedRef.current = true;
      syncClassroom(accessToken);
    }
  }, [isLoggedIn, accessToken]);

  const syncClassroom = async (forcedToken = null) => {
    const tokenToUse = forcedToken || accessToken;
    if (!tokenToUse) return;

    setIsSyncing(true);
    syncInProgressRef.current = true;
    try {
      const userProfile = await fetchGoogleProfile(tokenToUse);
      const userEmail = updateProfileFromGoogle(userProfile);

      // Reload settings if needed
      const savedUserLang = localStorage.getItem(`classroom_hub_${userEmail}_language`);
      if (savedUserLang) {
        setLang(savedUserLang);
        localStorage.setItem('classroom_hub_language', savedUserLang);
      } else {
        localStorage.setItem(`classroom_hub_${userEmail}_language`, lang);
      }

      loadLocalData(userEmail);

      const remoteSettingsApplied = await syncSettingsWithDrive(tokenToUse, userEmail);
      if (remoteSettingsApplied) {
        loadLocalData(userEmail);
        reloadSettings();
        const updatedLang = localStorage.getItem(`classroom_hub_${userEmail}_language`);
        if (updatedLang) {
          setLang(updatedLang);
          localStorage.setItem('classroom_hub_language', updatedLang);
        }
      }

      const classroomData = await fetchGoogleClassroomData(tokenToUse);
      
      const prevAssignments = getAssignments(userEmail);
      const prevResources = getResources(userEmail);
      const cachedAssignmentIds = prevAssignments.map(a => a.id);
      const cachedResourceIds = prevResources.map(r => r.id);
      const lastSync = getLastSync(userEmail);

      const syncedAssigns = syncClassroomAssignments(classroomData.assignments, userEmail);
      saveCourses(classroomData.courses, userEmail);
      saveResources(classroomData.resources || [], userEmail);

      setAssignments(syncedAssigns);
      setCourses(classroomData.courses);
      setResources(classroomData.resources || []);
      
      const now = new Date().toISOString();
      setLastSync(now, userEmail);
      setLastSyncTime(now);

      await syncSettingsWithDrive(tokenToUse, userEmail);

      setTimeout(async () => {
        try {
          if (lastSync) {
            await evaluateNewPostDigest(
              tokenToUse, userEmail, classroomData.assignments, 
              classroomData.resources || [], cachedAssignmentIds, cachedResourceIds
            );
          }
          await evaluateNotifications(
            tokenToUse, userEmail, syncedAssigns, 
            classroomData.courses, classroomData.resources || []
          );
        } catch (err) {
          console.error("Error evaluating Gmail notifications during sync:", err);
        }
      }, 0);
    } catch (e) {
      console.error('Failed to sync Google Classroom data', e);
      if (e.message === 'UNAUTHORIZED') {
        alert(t('sessionExpired', lang));
        authLogout(lang);
      } else {
        alert(t('syncFailed', lang));
      }
    } finally {
      syncInProgressRef.current = false;
      setIsSyncing(false);
    }
  };

  const handleStatusChange = (id, newStatus) => {
    const email = getActiveEmail();
    setAssignments(updateAssignmentStatus(id, newStatus, email));
    pushSettingsToDrive();
  };

  const handleNotesChange = (id, newNotes) => {
    const email = getActiveEmail();
    setAssignments(updateAssignmentNotes(id, newNotes, email));
    pushSettingsToDrive();
  };

  const handleAddAssignment = (newAssign) => {
    const email = getActiveEmail();
    setAssignments(addAssignment(newAssign, email));
    pushSettingsToDrive();
  };

  const handleTrackAsAssignment = (resource) => {
    handleAddAssignment({
      title: resource.title, course: resource.course, courseCode: resource.courseCode,
      dueDate: '', status: 'todo', points: 100, description: resource.description || '',
      attachments: resource.attachments || [], courseColor: resource.courseColor,
      courseId: resource.courseId, googleLink: resource.googleLink || '', parentResourceId: resource.id
    });
  };

  const handleUntrackAssignment = (resourceId) => {
    const email = getActiveEmail();
    const updated = assignments.filter(a => a.parentResourceId !== resourceId);
    setAssignments(updated);
    saveAssignments(updated, email);
    pushSettingsToDrive();
  };

  const handleToggleCourseVisibility = (courseId) => {
    const email = getActiveEmail();
    const updated = hiddenCourseIds.includes(courseId)
      ? hiddenCourseIds.filter(id => id !== courseId)
      : [...hiddenCourseIds, courseId];
    setHiddenCourseIds(updated);
    saveHiddenCourses(updated, email);
    pushSettingsToDrive();
  };

  const handleToggleBulkCourses = (courseIds, shouldHideAll) => {
    const email = getActiveEmail();
    const updated = shouldHideAll ? [...courseIds] : [];
    setHiddenCourseIds(updated);
    saveHiddenCourses(updated, email);
    pushSettingsToDrive();
  };

  const resetData = () => {
    const email = getActiveEmail();
    const reset = resetDatabase(email);
    setAssignments(reset.assignments);
    setCourses(reset.courses);
    setResources([]);
    setLastSyncTime(null);
    setHiddenCourseIds([]);
  };

  const visibleCourses = React.useMemo(() => 
    courses.filter(c => !hiddenCourseIds.includes(c.id)),
  [courses, hiddenCourseIds]);

  const visibleAssignments = React.useMemo(() => 
    assignments.filter(a => {
      if (a.courseId && hiddenCourseIds.includes(a.courseId)) return false;
      const courseObj = courses.find(c => c.name === a.course);
      if (courseObj && hiddenCourseIds.includes(courseObj.id)) return false;
      return true;
    }),
  [assignments, courses, hiddenCourseIds]);

  const visibleResources = React.useMemo(() => 
    resources.filter(r => {
      if (r.courseId && hiddenCourseIds.includes(r.courseId)) return false;
      const courseObj = courses.find(c => c.name === r.course);
      if (courseObj && hiddenCourseIds.includes(courseObj.id)) return false;
      return true;
    }),
  [resources, courses, hiddenCourseIds]);

  const value = React.useMemo(() => ({
    assignments, courses, resources, hiddenCourseIds, isSyncing, lastSyncTime,
    visibleCourses, visibleAssignments, visibleResources,
    syncClassroom, handleStatusChange, handleNotesChange, handleAddAssignment,
    handleTrackAsAssignment, handleUntrackAssignment, handleToggleCourseVisibility,
    handleToggleBulkCourses, resetData
  }), [
    assignments, courses, resources, hiddenCourseIds, isSyncing, lastSyncTime,
    visibleCourses, visibleAssignments, visibleResources
  ]);

  return <ClassroomContext.Provider value={value}>{children}</ClassroomContext.Provider>;
};

export const useClassroom = () => useContext(ClassroomContext);
