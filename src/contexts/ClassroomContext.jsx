/* eslint-disable react-refresh/only-export-components, react-hooks/exhaustive-deps */
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { 
  getAssignments, updateAssignmentStatus, updateAssignmentNotes, updateAssignmentDueDate,
  addAssignment, getCourses, saveCourses, getLastSync, setLastSync,
  syncClassroomAssignments, getHiddenCourses, saveHiddenCourses,
  getResources, saveResources, saveAssignments, getActiveEmail, setActiveEmail, resetDatabase,
  getSchedule, saveSchedule, getTopics, saveTopics
} from '../utils/storage';
import { ClassroomService } from '../services/ClassroomService';
import { syncManager } from '../services/SyncManager';
import { calendarSyncManager } from '../services/CalendarSyncManager';
import { NotificationService } from '../services/NotificationService';
import { examRepository } from '../repositories/examRepository';
import { useAuth } from './AuthContext';
import { useSettings } from './SettingsContext';
import { logger } from '../utils/logger';

export const ClassroomContext = createContext(null);

export const ClassroomProvider = ({ children }) => {
  const { accessToken, isLoggedIn, updateProfileFromGoogle, logout: authLogout } = useAuth();
  const { lang, setLang, reloadSettings } = useSettings();

  const [assignments, setAssignments] = useState([]);
  const [courses, setCourses] = useState([]);
  const [resources, setResources] = useState([]);
  const [hiddenCourseIds, setHiddenCourseIds] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [topics, setTopics] = useState([]);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  
  // SyncManager State integration
  const [syncState, setSyncState] = useState('idle');
  const autoSyncedRef = useRef(false);

  const loadLocalData = useCallback((email = '') => {
    setAssignments(getAssignments(email));
    setCourses(getCourses(email));
    setResources(getResources(email));
    setHiddenCourseIds(getHiddenCourses(email));
    setSchedule(getSchedule(email));
    setTopics(getTopics(email));
    setLastSyncTime(getLastSync(email));
  }, []);

  // Subscribe to SyncManager State Machine
  useEffect(() => {
    return syncManager.subscribe((newState) => {
      setSyncState(newState);
      // Reload local data if sync succeeded to reflect merged updates in the UI
      if (newState === 'success') {
        const activeEmail = getActiveEmail();
        if (activeEmail) {
          loadLocalData(activeEmail);
          reloadSettings();
        }
      }
    });
  }, [reloadSettings, loadLocalData]);

  useEffect(() => {
    const activeEmail = getActiveEmail();
    if (isLoggedIn && activeEmail) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadLocalData(activeEmail);
    } else {
      loadLocalData('');
      autoSyncedRef.current = false;
    }
  }, [isLoggedIn, loadLocalData]);

  // Cross-tab sync: listen for localStorage changes from other tabs
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (!e.key) return;
      const activeEmail = getActiveEmail();
      if (!activeEmail) return;
      // Only react to keys belonging to our app
      if (e.key.startsWith('classroom_hub_')) {
        loadLocalData(activeEmail);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [loadLocalData]);

  // Auto-polling Google Drive for real-time cross-device sync (every 60s when tab is active)
  useEffect(() => {
    if (!isLoggedIn || !accessToken) return;

    let intervalId = null;
    let isVisible = !document.hidden;

    const startPolling = () => {
      if (intervalId) return;
      intervalId = setInterval(async () => {
        const email = getActiveEmail();
        if (!email || !accessToken) return;
        try {
          await syncManager.executeSync(accessToken, email);
        } catch (err) {
          logger.debug('[Auto-Poll] Background Drive poll failed (non-critical):', err.message);
        }
      }, 60000); // Poll every 60 seconds
    };

    const stopPolling = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const handleVisibility = () => {
      isVisible = !document.hidden;
      if (isVisible) {
        // When tab becomes visible again, do an immediate sync + restart polling
        const email = getActiveEmail();
        if (email && accessToken) {
          syncManager.executeSync(accessToken, email).catch(() => {});
        }
        startPolling();
      } else {
        stopPolling();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    if (isVisible) startPolling();

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isLoggedIn, accessToken]);

  const syncClassroom = async (forcedToken = null) => {
    const tokenToUse = forcedToken || accessToken;
    if (!tokenToUse) return;

    try {
      logger.info('[Sync] Loading profile and classroom updates...');
      const userProfile = await ClassroomService.fetchProfile(tokenToUse);
      const userEmail = userProfile.email.toLowerCase().trim();

      setActiveEmail(userEmail);
      await syncManager.executeSync(tokenToUse, userEmail);

      updateProfileFromGoogle(userProfile);

      // Restore language settings
      const savedUserLang = localStorage.getItem(`classroom_hub_${userEmail}_language`);
      if (savedUserLang) {
        setLang(savedUserLang);
        localStorage.setItem('classroom_hub_language', savedUserLang);
      } else {
        localStorage.setItem(`classroom_hub_${userEmail}_language`, lang);
      }

      loadLocalData(userEmail);
      reloadSettings();

      // Fire exam fetch in the background immediately so it's ready for the dashboard
      const implicitStudentId = userEmail.match(/\d{13}/) ? userEmail.match(/\d{13}/)[0] : null;
      if (implicitStudentId) {
        examRepository.fetchExams(implicitStudentId, lang).then(result => {
          if (result.success && result.data.exams && result.data.exams.length > 0) {
            const currentCache = examRepository.getCachedExams(userEmail);
            const currentManual = (currentCache.success && currentCache.data) ? (currentCache.data.manualExams || []) : [];
            examRepository.saveToCache(userEmail, result.data.exams, currentManual, result.data.unlisted);
            sessionStorage.setItem('lastExamSearch', implicitStudentId);
            syncManager.queueSync(tokenToUse, userEmail);
            calendarSyncManager.queueSync(tokenToUse, userEmail);
          }
        }).catch(err => logger.error('[Sync] Background exam fetch failed', err));
      }

      // Fetch fresh classroom data from Google Classroom API
      const classroomData = await ClassroomService.fetchClassroomData(tokenToUse);
      
      const prevAssignments = getAssignments(userEmail);
      const prevResources = getResources(userEmail);
      const cachedAssignmentIds = prevAssignments.map(a => a.id);
      const cachedResourceIds = prevResources.map(r => r.id);
      const lastSync = getLastSync(userEmail);

      // Merge & save local data
      const syncedAssigns = syncClassroomAssignments(classroomData.assignments, userEmail);
      saveCourses(classroomData.courses, userEmail);
      saveResources(classroomData.resources || [], userEmail);
      saveTopics(classroomData.topics || [], userEmail);

      setAssignments(syncedAssigns);
      setCourses(classroomData.courses);
      setResources(classroomData.resources || []);
      setTopics(classroomData.topics || []);
      
      const now = new Date().toISOString();
      setLastSync(now, userEmail);
      setLastSyncTime(now);

      // Push final merged data to Drive
      syncManager.queueSync(tokenToUse, userEmail);

      // Push schedule/assignments/exams to Google Calendar
      calendarSyncManager.queueSync(tokenToUse, userEmail);

      // Evaluate email alerts asynchronously
      setTimeout(async () => {
        try {
          if (lastSync) {
            await NotificationService.evaluateNewPostDigest(
              tokenToUse, userEmail, classroomData.assignments, 
              classroomData.resources || [], cachedAssignmentIds, cachedResourceIds
            );
          }
          await NotificationService.evaluateNotifications(
            tokenToUse, userEmail, syncedAssigns, 
            classroomData.courses, classroomData.resources || []
          );
        } catch (err) {
          logger.error('Error processing digest alerts during sync:', err);
        }
      }, 0);

    } catch (e) {
      logger.error('Failed to sync Google Classroom data', e);
      if (e.message === 'UNAUTHORIZED' || e.code === 401) {
        authLogout();
      }
    }
  };

  const handleStatusChange = (id, newStatus) => {
    const email = getActiveEmail();
    setAssignments(updateAssignmentStatus(id, newStatus, email));
    syncManager.queueSync(accessToken, email);
  };

  const handleNotesChange = (id, newNotes) => {
    const email = getActiveEmail();
    setAssignments(updateAssignmentNotes(id, newNotes, email));
    syncManager.queueSync(accessToken, email);
  };

  const handleDueDateChange = (id, newDueDate) => {
    const email = getActiveEmail();
    setAssignments(updateAssignmentDueDate(id, newDueDate, email));
    syncManager.queueSync(accessToken, email);
    calendarSyncManager.queueSync(accessToken, email);
  };

  const handleAddAssignment = (newAssign) => {
    const email = getActiveEmail();
    setAssignments(addAssignment(newAssign, email));
    syncManager.queueSync(accessToken, email);
    calendarSyncManager.queueSync(accessToken, email);
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
    syncManager.queueSync(accessToken, email);
    calendarSyncManager.queueSync(accessToken, email);
  };

  const handleToggleCourseVisibility = (courseId) => {
    const email = getActiveEmail();
    const updated = hiddenCourseIds.includes(courseId)
      ? hiddenCourseIds.filter(id => id !== courseId)
      : [...hiddenCourseIds, courseId];
    setHiddenCourseIds(updated);
    saveHiddenCourses(updated, email);
    syncManager.queueSync(accessToken, email);
  };

  const handleToggleBulkCourses = (courseIds, shouldHideAll) => {
    const email = getActiveEmail();
    const updated = shouldHideAll ? [...courseIds] : [];
    setHiddenCourseIds(updated);
    saveHiddenCourses(updated, email);
    syncManager.queueSync(accessToken, email);
  };

  const resetData = () => {
    const email = getActiveEmail();
    const reset = resetDatabase(email);
    setAssignments(reset.assignments);
    setCourses(reset.courses);
    setResources([]);
    setLastSyncTime(null);
    setHiddenCourseIds([]);
    setSchedule([]);
  };

  const handleSaveScheduleEntry = (entry) => {
    const email = getActiveEmail();
    const isEdit = schedule.some(s => s.id === entry.id);
    const updated = isEdit
      ? schedule.map(s => s.id === entry.id ? { ...entry, updatedAt: new Date().toISOString() } : s)
      : [...schedule, { ...entry, id: entry.id || `sched-${Date.now()}`, updatedAt: new Date().toISOString() }];
    setSchedule(updated);
    saveSchedule(updated, email);
    syncManager.queueSync(accessToken, email);
    calendarSyncManager.queueSync(accessToken, email);
  };

  const handleDeleteScheduleEntry = (id) => {
    const email = getActiveEmail();
    const updated = schedule.filter(s => s.id !== id);
    setSchedule(updated);
    saveSchedule(updated, email);
    syncManager.queueSync(accessToken, email);
    calendarSyncManager.queueSync(accessToken, email);
  };

  const handleClearSchedule = () => {
    const email = getActiveEmail();
    setSchedule([]);
    saveSchedule([], email);
    syncManager.queueSync(accessToken, email);
    calendarSyncManager.queueSync(accessToken, email);
  };

  // Pre-computed maps for fast O(1) rendering lookups

  const courseNameMap = React.useMemo(() => new Map(courses.map(c => [c.name, c])), [courses]);

  const visibleCourses = React.useMemo(() => 
    courses.filter(c => !hiddenCourseIds.includes(c.id)),
  [courses, hiddenCourseIds]);

  const visibleAssignments = React.useMemo(() => 
    assignments.filter(a => {
      if (a.courseId && hiddenCourseIds.includes(a.courseId)) return false;
      const courseObj = courseNameMap.get(a.course);
      if (courseObj && hiddenCourseIds.includes(courseObj.id)) return false;
      return true;
    }),
  [assignments, courseNameMap, hiddenCourseIds]);

  const visibleResources = React.useMemo(() => 
    resources.filter(r => {
      if (r.courseId && hiddenCourseIds.includes(r.courseId)) return false;
      const courseObj = courseNameMap.get(r.course);
      if (courseObj && hiddenCourseIds.includes(courseObj.id)) return false;
      return true;
    }),
  [resources, courseNameMap, hiddenCourseIds]);

  const isSyncing = syncState === 'uploading' || syncState === 'queued';

  // Auto-sync on active session login
  useEffect(() => {
    if (isLoggedIn && accessToken && !autoSyncedRef.current) {
      autoSyncedRef.current = true;
      syncClassroom(accessToken);
    }
  }, [isLoggedIn, accessToken, syncClassroom]);

  const value = React.useMemo(() => ({
    assignments, courses, resources, hiddenCourseIds, schedule, isSyncing, lastSyncTime, syncState, topics,
    visibleCourses, visibleAssignments, visibleResources,
    syncClassroom, handleStatusChange, handleNotesChange, handleDueDateChange, handleAddAssignment,
    handleDeleteScheduleEntry, handleSaveScheduleEntry, handleClearSchedule,
    handleToggleCourseVisibility, handleToggleBulkCourses, handleTrackAsAssignment, handleUntrackAssignment, resetData
  }), [
    assignments, courses, resources, hiddenCourseIds, schedule, isSyncing, lastSyncTime, syncState, topics,
    visibleCourses, visibleAssignments, visibleResources,
    syncClassroom, handleStatusChange, handleNotesChange, handleDueDateChange, handleAddAssignment,
    handleDeleteScheduleEntry, handleSaveScheduleEntry, handleClearSchedule,
    handleToggleCourseVisibility, handleToggleBulkCourses, handleTrackAsAssignment, handleUntrackAssignment, resetData
  ]);

  return <ClassroomContext.Provider value={value}>{children}</ClassroomContext.Provider>;
};

export const useClassroom = () => useContext(ClassroomContext);