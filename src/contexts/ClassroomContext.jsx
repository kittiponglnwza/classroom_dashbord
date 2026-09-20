/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { 
  getAssignments, updateAssignmentStatus, updateAssignmentNotes, updateAssignmentDueDate,
  addAssignment, getCourses, saveCourses, getLastSync, setLastSync,
  syncClassroomAssignments,
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
import { useBackgroundSync } from '../hooks/useBackgroundSync';
import { useToast } from '../hooks/useToast';

export const ClassroomContext = createContext(null);

export const ClassroomProvider = ({ children }) => {
  const { accessToken, isLoggedIn, updateProfileFromGoogle, logout: authLogout } = useAuth();
  const { lang, setLang, reloadSettings } = useSettings();
  const { addToast } = useToast();

  const [assignments, setAssignments] = useState([]);
  const [courses, setCourses] = useState([]);
  const [resources, setResources] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [topics, setTopics] = useState([]);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  
  const [syncState, setSyncState] = useState('idle');
  const autoSyncedRef = useRef(false);

  const loadLocalData = useCallback((email = '') => {
    setAssignments(getAssignments(email));
    setCourses(getCourses(email));
    setResources(getResources(email));
    setSchedule(getSchedule(email));
    setTopics(getTopics(email));
    setLastSyncTime(getLastSync(email));
  }, []);

  useEffect(() => {
    return syncManager.subscribe((newState) => {
      setSyncState(newState);
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

  useEffect(() => {
    const handleStorageChange = (e) => {
      if (!e.key) return;
      const activeEmail = getActiveEmail();
      if (!activeEmail) return;
      if (e.key.startsWith('classroom_hub_')) {
        loadLocalData(activeEmail);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [loadLocalData]);

  // Handle Background Polling
  useBackgroundSync(isLoggedIn, accessToken);

  const syncClassroom = useCallback(async (forcedToken = null) => {
    const tokenToUse = forcedToken || accessToken;
    if (!tokenToUse) return;

    try {
      logger.info('[Sync] Loading profile and classroom updates...');
      const userProfile = await ClassroomService.fetchProfile(tokenToUse);
      const userEmail = userProfile.email.toLowerCase().trim();

      setActiveEmail(userEmail);
      await syncManager.executeSync(tokenToUse, userEmail);

      updateProfileFromGoogle(userProfile);

      const savedUserLang = localStorage.getItem(`classroom_hub_${userEmail}_language`);
      if (savedUserLang) {
        setLang(savedUserLang);
        localStorage.setItem('classroom_hub_language', savedUserLang);
      } else {
        localStorage.setItem(`classroom_hub_${userEmail}_language`, lang);
      }

      loadLocalData(userEmail);
      reloadSettings();

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

      const classroomData = await ClassroomService.fetchClassroomData(tokenToUse);
      
      const prevAssignments = getAssignments(userEmail);
      const prevResources = getResources(userEmail);
      const cachedAssignmentIds = prevAssignments.map(a => a.id);
      const cachedResourceIds = prevResources.map(r => r.id);
      const lastSync = getLastSync(userEmail);

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

      syncManager.queueSync(tokenToUse, userEmail);
      calendarSyncManager.queueSync(tokenToUse, userEmail);

      addToast(lang === 'th' ? 'ซิงค์ข้อมูลสำเร็จ' : 'Sync completed successfully', 'success');

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
        addToast(lang === 'th' ? 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่' : 'Session expired, please login again.', 'error');
      } else if (e.name === 'NetworkError' || e.message?.toLowerCase().includes('network') || !navigator.onLine) {
        addToast(lang === 'th' ? 'เครือข่ายมีปัญหา กรุณาตรวจสอบการเชื่อมต่อ' : 'Network issue. Please check your connection.', 'warning');
      } else {
        addToast(e.message || (lang === 'th' ? 'การซิงค์ล้มเหลว' : 'Sync failed'), 'error');
      }
    }
  }, [accessToken, lang, setLang, updateProfileFromGoogle, loadLocalData, reloadSettings, authLogout, addToast]);

  const handleStatusChange = useCallback((id, newStatus) => {
    const email = getActiveEmail();
    setAssignments(updateAssignmentStatus(id, newStatus, email));
    syncManager.queueSync(accessToken, email);
  }, [accessToken]);

  const handleNotesChange = useCallback((id, newNotes) => {
    const email = getActiveEmail();
    setAssignments(updateAssignmentNotes(id, newNotes, email));
    syncManager.queueSync(accessToken, email);
  }, [accessToken]);

  const handleDueDateChange = useCallback((id, newDueDate) => {
    const email = getActiveEmail();
    setAssignments(updateAssignmentDueDate(id, newDueDate, email));
    syncManager.queueSync(accessToken, email);
    calendarSyncManager.queueSync(accessToken, email);
  }, [accessToken]);

  const handleAddAssignment = useCallback((newAssign) => {
    const email = getActiveEmail();
    setAssignments(addAssignment(newAssign, email));
    syncManager.queueSync(accessToken, email);
    calendarSyncManager.queueSync(accessToken, email);
  }, [accessToken]);

  const handleTrackAsAssignment = useCallback((resource) => {
    handleAddAssignment({
      title: resource.title, course: resource.course, courseCode: resource.courseCode,
      dueDate: '', status: 'todo', points: 100, description: resource.description || '',
      attachments: resource.attachments || [], courseColor: resource.courseColor,
      courseId: resource.courseId, googleLink: resource.googleLink || '', parentResourceId: resource.id
    });
  }, [handleAddAssignment]);

  const handleUntrackAssignment = useCallback((resourceId) => {
    const email = getActiveEmail();
    setAssignments(prev => {
      const updated = prev.filter(a => a.parentResourceId !== resourceId);
      saveAssignments(updated, email);
      return updated;
    });
    syncManager.queueSync(accessToken, email);
    calendarSyncManager.queueSync(accessToken, email);
  }, [accessToken]);

  const resetData = useCallback(() => {
    const email = getActiveEmail();
    const reset = resetDatabase(email);
    setAssignments(reset.assignments);
    setCourses(reset.courses);
    setResources([]);
    setLastSyncTime(null);
    setSchedule([]);
  }, []);

  const handleSaveScheduleEntry = useCallback((entry) => {
    const email = getActiveEmail();
    setSchedule(prev => {
      const isEdit = prev.some(s => s.id === entry.id);
      const updated = isEdit
        ? prev.map(s => s.id === entry.id ? { ...entry, updatedAt: new Date().toISOString() } : s)
        : [...prev, { ...entry, id: entry.id || `sched-${Date.now()}`, updatedAt: new Date().toISOString() }];
      saveSchedule(updated, email);
      return updated;
    });
    syncManager.queueSync(accessToken, email);
    calendarSyncManager.queueSync(accessToken, email);
  }, [accessToken]);

  const handleDeleteScheduleEntry = useCallback((id, deletedDateStr = null) => {
    const email = getActiveEmail();
    setSchedule(prev => {
      const entry = prev.find(s => s.id === id);
      if (!entry) return prev;
      let updated;
      if (entry.date || !deletedDateStr) {
        updated = prev.filter(s => s.id !== id);
      } else {
        updated = prev.map(s => s.id === id ? { ...s, deletedAt: deletedDateStr, updatedAt: new Date().toISOString() } : s);
      }
      saveSchedule(updated, email);
      return updated;
    });
    syncManager.queueSync(accessToken, email);
    calendarSyncManager.queueSync(accessToken, email);
  }, [accessToken]);

  const handleClearSchedule = useCallback(() => {
    const email = getActiveEmail();
    setSchedule([]);
    saveSchedule([], email);
    syncManager.queueSync(accessToken, email);
    calendarSyncManager.queueSync(accessToken, email);
  }, [accessToken]);

  const isSyncing = syncState === 'uploading' || syncState === 'queued';

  useEffect(() => {
    const controller = new AbortController();
    if (isLoggedIn && accessToken && !autoSyncedRef.current) {
      autoSyncedRef.current = true;
      syncClassroom(accessToken, controller.signal);
    }
    return () => controller.abort();
  }, [isLoggedIn, accessToken, syncClassroom]);

  const value = React.useMemo(() => ({
    assignments, courses, resources, schedule, isSyncing, lastSyncTime, syncState, topics,
    syncClassroom, handleStatusChange, handleNotesChange, handleDueDateChange, handleAddAssignment,
    handleDeleteScheduleEntry, handleSaveScheduleEntry, handleClearSchedule,
    handleTrackAsAssignment, handleUntrackAssignment, resetData
  }), [
    assignments, courses, resources, schedule, isSyncing, lastSyncTime, syncState, topics,
    syncClassroom, handleStatusChange, handleNotesChange, handleDueDateChange, handleAddAssignment,
    handleDeleteScheduleEntry, handleSaveScheduleEntry, handleClearSchedule,
    handleTrackAsAssignment, handleUntrackAssignment, resetData
  ]);

  return <ClassroomContext.Provider value={value}>{children}</ClassroomContext.Provider>;
};

export const useClassroom = () => useContext(ClassroomContext);