/* eslint-disable react-refresh/only-export-components, react-hooks/exhaustive-deps */
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { 
  getAssignments, updateAssignmentStatus, updateAssignmentNotes,
  addAssignment, getCourses, saveCourses, getLastSync, setLastSync,
  syncClassroomAssignments, getHiddenCourses, saveHiddenCourses,
  getResources, saveResources, saveAssignments, getActiveEmail, resetDatabase,
  getSchedule, saveSchedule
} from '../utils/storage';
import { ClassroomService } from '../services/ClassroomService';
import { syncManager } from '../services/SyncManager';
import { calendarSyncManager } from '../services/CalendarSyncManager';
import { NotificationService } from '../services/NotificationService';
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



  const syncClassroom = async (forcedToken = null) => {
    const tokenToUse = forcedToken || accessToken;
    if (!tokenToUse) return;

    try {
      logger.info('[Sync] Loading profile and classroom updates...');
      const userProfile = await ClassroomService.fetchProfile(tokenToUse);
      const userEmail = updateProfileFromGoogle(userProfile);

      // Restore language settings
      const savedUserLang = localStorage.getItem(`classroom_hub_${userEmail}_language`);
      if (savedUserLang) {
        setLang(savedUserLang);
        localStorage.setItem('classroom_hub_language', savedUserLang);
      } else {
        localStorage.setItem(`classroom_hub_${userEmail}_language`, lang);
      }

      loadLocalData(userEmail);

      // Perform a blocking, immediate settings synchronization on first load
      await syncManager.executeSync(tokenToUse, userEmail);
      loadLocalData(userEmail);
      reloadSettings();

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

      setAssignments(syncedAssigns);
      setCourses(classroomData.courses);
      setResources(classroomData.resources || []);
      
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
      ? schedule.map(s => s.id === entry.id ? entry : s)
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
    assignments, courses, resources, hiddenCourseIds, schedule, isSyncing, lastSyncTime, syncState,
    visibleCourses, visibleAssignments, visibleResources,
    syncClassroom, handleStatusChange, handleNotesChange, handleAddAssignment,
    handleDeleteScheduleEntry, handleSaveScheduleEntry, handleClearSchedule,
    handleToggleCourseVisibility, handleToggleBulkCourses, handleTrackAsAssignment, handleUntrackAssignment, resetData
  }), [
    assignments, courses, resources, hiddenCourseIds, schedule, isSyncing, lastSyncTime, syncState,
    visibleCourses, visibleAssignments, visibleResources,
    syncClassroom, handleStatusChange, handleNotesChange, handleAddAssignment,
    handleDeleteScheduleEntry, handleSaveScheduleEntry, handleClearSchedule,
    handleToggleCourseVisibility, handleToggleBulkCourses, handleTrackAsAssignment, handleUntrackAssignment, resetData
  ]);

  return <ClassroomContext.Provider value={value}>{children}</ClassroomContext.Provider>;
};

export const useClassroom = () => useContext(ClassroomContext);