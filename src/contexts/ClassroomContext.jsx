/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { 
  getAssignments, updateAssignmentStatus, updateAssignmentNotes, updateAssignmentDueDate,
  addAssignment, deleteAssignment, getCourses, saveCourses, getLastSync, setLastSync,
  syncClassroomAssignments, getToken, getProfile, recordDeletedId, getHiddenCourses,
  getResources, saveResources, saveAssignments, getActiveEmail, setActiveEmail, resetDatabase,
  getSchedule, saveSchedule, getTopics, saveTopics,
  getAcademicData, saveAcademicData, createDefaultAcademicData
} from '../utils/storage';
import { ClassroomService } from '../services/ClassroomService';
import { syncManager } from '../services/SyncManager';
import { clearDriveSyncCache } from '../services/driveSync';
import { calendarSyncManager } from '../services/CalendarSyncManager';
import { NotificationService } from '../services/NotificationService';
import { examRepository } from '../repositories/examRepository';
import { parseKmutnbRegInput } from '../services/parsers/kmutnbRegParser';
import { hashStudentIdForBridge } from '../utils/kmutnbStudentId';
import { getCookieConsent } from '../utils/cookieConsent';
import { useAuth } from './AuthContext';
import { useSettings } from './SettingsContext';
import { logger } from '../utils/logger';
import { useBackgroundSync } from '../hooks/useBackgroundSync';
import { useToast } from '../hooks/useToast';

export const ClassroomContext = createContext(null);

export const ClassroomProvider = ({ children }) => {
  const { accessToken, isLoggedIn, isCachedSession, rememberedAccount, updateProfileFromGoogle, expireSession } = useAuth();
  const hasWorkspaceSession = Boolean(isLoggedIn || isCachedSession || rememberedAccount?.email);
  const { lang, setLang, reloadSettings } = useSettings();
  const { addToast } = useToast();

  const [assignments, setAssignments] = useState([]);
  const [courses, setCourses] = useState([]);
  const [resources, setResources] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [topics, setTopics] = useState([]);
  const [academicData, setAcademicData] = useState(() => createDefaultAcademicData());
  const [extensionStatus, setExtensionStatus] = useState({ connected: false });
  const [lastSyncTime, setLastSyncTime] = useState(null);
  
  const [syncState, setSyncState] = useState('idle');
  const [isClassroomFetching, setIsClassroomFetching] = useState(false);
  const autoSyncedRef = useRef(false);
  const activeSyncRef = useRef(null);
  const syncRunIdRef = useRef(0);
  const sessionGenerationRef = useRef(0);
  const assignmentsRef = useRef(assignments);
  const coursesRef = useRef(courses);
  const scheduleRef = useRef(schedule);
  const academicRef = useRef(academicData);
  const langRef = useRef(lang);

  useEffect(() => {
    langRef.current = lang;
  }, [lang]);

  useEffect(() => {
    assignmentsRef.current = assignments;
  }, [assignments]);

  useEffect(() => {
    coursesRef.current = courses;
  }, [courses]);

  useEffect(() => {
    scheduleRef.current = schedule;
  }, [schedule]);

  useEffect(() => {
    academicRef.current = academicData;
  }, [academicData]);

  const loadLocalData = useCallback((email = '') => {
    setAssignments(getAssignments(email));
    setCourses(getCourses(email));
    setResources(getResources(email));
    setSchedule(getSchedule(email));
    setTopics(getTopics(email));
    setAcademicData(getAcademicData(email));
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
    sessionGenerationRef.current += 1;
    activeSyncRef.current?.controller?.abort();
    const activeEmail = getActiveEmail();
    if (hasWorkspaceSession && activeEmail) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadLocalData(activeEmail);
    } else {
      clearDriveSyncCache();
      loadLocalData('');
      autoSyncedRef.current = false;
    }
  }, [hasWorkspaceSession, loadLocalData]);

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

  const syncClassroom = useCallback(async (forcedToken = null, signal = undefined) => {
    const tokenToUse = forcedToken || accessToken;
    const currentLang = langRef.current;
    if (!tokenToUse) return false;
    const active = activeSyncRef.current;
    if (active && !active.signal?.aborted && active.generation === sessionGenerationRef.current) {
      logger.info('[Sync] Classroom sync already in progress; skipping duplicate request.');
      return false;
    }
    if (signal?.aborted) return false;

    const runId = ++syncRunIdRef.current;
    const generation = sessionGenerationRef.current;
    const runController = new AbortController();
    const onCallerAbort = () => runController.abort(signal?.reason);
    if (signal) {
      signal.addEventListener('abort', onCallerAbort, { once: true });
    }
    const effectiveSignal = runController.signal;
    activeSyncRef.current = { id: runId, signal: effectiveSignal, controller: runController, generation };
    setIsClassroomFetching(true);
    const isStaleRun = () =>
      effectiveSignal.aborted ||
      generation !== sessionGenerationRef.current ||
      syncRunIdRef.current !== runId;

    try {
      logger.info('[Sync] Loading profile and classroom updates...');
      const cachedEmail = getActiveEmail();
      const initialHiddenIds = cachedEmail ? getHiddenCourses(cachedEmail) : [];
      const getLatestToken = () => getToken() || tokenToUse;

      const triggerExamFetch = (emailForExam) => {
        const storedProfile = getProfile(emailForExam);
        const cleanProfileId = String(storedProfile?.studentId || '').replace(/[\s-]/g, '');
        const implicitStudentId = /^\d{13}$/.test(cleanProfileId)
          ? cleanProfileId
          : (emailForExam.match(/\d{13}/)?.[0] || null);
        if (!implicitStudentId) return;
        examRepository.fetchExams(implicitStudentId, langRef.current, effectiveSignal).then(result => {
          if (isStaleRun()) return;
          if (result.success && ((result.data.exams && result.data.exams.length > 0) || result.data.unlisted)) {
            const currentCache = examRepository.getCachedExams(emailForExam);
            const currentManual = (currentCache.success && currentCache.data) ? (currentCache.data.manualExams || []) : [];
            examRepository.saveToCache(emailForExam, result.data.exams || [], currentManual, result.data.unlisted);
            sessionStorage.setItem('lastExamSearch', implicitStudentId);
            const latestTok = getLatestToken();
            syncManager.queueSync(latestTok, emailForExam);
            calendarSyncManager.queueSync(latestTok, emailForExam);
          }
        }).catch(err => {
          if (err?.name !== 'AbortError') logger.error('[Sync] Background exam fetch failed', err);
        });
      };

      let userProfile;
      let classroomData;

      if (cachedEmail) {
        triggerExamFetch(cachedEmail);
        const [profileRes, , classroomRes] = await Promise.all([
          ClassroomService.fetchProfile(tokenToUse, { signal: effectiveSignal }),
          syncManager.executeSync(tokenToUse, cachedEmail).catch(err => {
            logger.warn('[Sync] Pre-sync Drive merge skipped:', err?.message || err);
            return false;
          }),
          ClassroomService.fetchClassroomData(tokenToUse, {
            signal: effectiveSignal,
            getToken: getLatestToken,
            hiddenCourseIds: initialHiddenIds
          })
        ]);
        if (isStaleRun()) return false;
        userProfile = profileRes;
        classroomData = classroomRes;
      } else {
        userProfile = await ClassroomService.fetchProfile(tokenToUse, { signal: effectiveSignal });
        if (isStaleRun()) return false;
        const freshEmail = userProfile.email.toLowerCase().trim();
        setActiveEmail(freshEmail);
        triggerExamFetch(freshEmail);

        const [, classroomRes] = await Promise.all([
          syncManager.executeSync(tokenToUse, freshEmail).catch(err => {
            logger.warn('[Sync] Pre-sync Drive merge skipped:', err?.message || err);
            return false;
          }),
          ClassroomService.fetchClassroomData(tokenToUse, {
            signal: effectiveSignal,
            getToken: getLatestToken,
            hiddenCourseIds: getHiddenCourses(freshEmail)
          })
        ]);
        if (isStaleRun()) return false;
        classroomData = classroomRes;
      }

      const userEmail = userProfile.email.toLowerCase().trim();
      if (cachedEmail && userEmail !== cachedEmail) {
        setActiveEmail(userEmail);
        await syncManager.executeSync(tokenToUse, userEmail).catch(err => {
          logger.warn('[Sync] Drive sync for switched account skipped:', err?.message || err);
          return false;
        });
        if (isStaleRun()) return false;
        triggerExamFetch(userEmail);
      }

      updateProfileFromGoogle(userProfile);

      const savedUserLang = localStorage.getItem(`classroom_hub_${userEmail}_language`);
      const canPersistLang = getCookieConsent()?.preferences !== false;
      const effectiveLang = savedUserLang || currentLang;
      if (savedUserLang) {
        setLang(savedUserLang);
        if (canPersistLang) localStorage.setItem('classroom_hub_language', savedUserLang);
      } else if (canPersistLang) {
        localStorage.setItem(`classroom_hub_${userEmail}_language`, currentLang);
      }

      loadLocalData(userEmail);
      reloadSettings();

      // If Drive sync unhid any course that we skipped in parallel, fetch just those unhidden courses now
      const latestHiddenSet = new Set(getHiddenCourses(userEmail));
      const skippedBeforeSync = classroomData.skippedCourseIds || [];
      const newlyUnhiddenIds = skippedBeforeSync.filter(id => !latestHiddenSet.has(id));
      if (newlyUnhiddenIds.length > 0) {
        const extraData = await ClassroomService.fetchClassroomData(tokenToUse, {
          signal: effectiveSignal,
          getToken: getLatestToken,
          onlyCourseIds: newlyUnhiddenIds,
          knownCourses: classroomData.courses
        });
        if (isStaleRun()) return false;
        const unhiddenSet = new Set(newlyUnhiddenIds);
        classroomData = {
          ...classroomData,
          assignments: [...(classroomData.assignments || []), ...(extraData.assignments || [])],
          resources: [...(classroomData.resources || []), ...(extraData.resources || [])],
          topics: [...(classroomData.topics || []), ...(extraData.topics || [])],
          skippedCourseIds: skippedBeforeSync.filter(id => !unhiddenSet.has(id)),
          failedCourseIds: Array.from(new Set([...(classroomData.failedCourseIds || []), ...(extraData.failedCourseIds || [])])),
          failedFeeds: {
            coursework: [...(classroomData.failedFeeds?.coursework || []), ...(extraData.failedFeeds?.coursework || [])],
            submissions: [...(classroomData.failedFeeds?.submissions || []), ...(extraData.failedFeeds?.submissions || [])],
            announcements: [...(classroomData.failedFeeds?.announcements || []), ...(extraData.failedFeeds?.announcements || [])],
            materials: [...(classroomData.failedFeeds?.materials || []), ...(extraData.failedFeeds?.materials || [])],
            topics: [...(classroomData.failedFeeds?.topics || []), ...(extraData.failedFeeds?.topics || [])]
          }
        };
      }

      const freshToken = getLatestToken();
      const prevAssignments = getAssignments(userEmail);
      const prevResources = getResources(userEmail);
      const prevTopics = getTopics(userEmail);
      const cachedAssignmentIds = prevAssignments.map(a => a.id);
      const cachedResourceIds = prevResources.map(r => r.id);
      const lastSync = getLastSync(userEmail);

      // Granular per-feed preservation on partial Classroom API failure or intentionally skipped hidden courses
      const skippedSet = new Set(classroomData.skippedCourseIds || []);
      const failedCW = new Set(classroomData.failedFeeds?.coursework || classroomData.failedCourseIds || []);
      const failedAnn = new Set(classroomData.failedFeeds?.announcements || classroomData.failedCourseIds || []);
      const failedMat = new Set(classroomData.failedFeeds?.materials || classroomData.failedCourseIds || []);
      const failedTop = new Set(classroomData.failedFeeds?.topics || classroomData.failedCourseIds || []);

      const freshAssignments = (failedCW.size > 0 || skippedSet.size > 0)
        ? [
            ...classroomData.assignments.filter(a => !failedCW.has(a.courseId) && !skippedSet.has(a.courseId)),
            ...prevAssignments.filter(a => (failedCW.has(a.courseId) || skippedSet.has(a.courseId)) && !String(a.id).startsWith('assign-'))
          ]
        : classroomData.assignments;

      const freshResources = (failedAnn.size > 0 || failedMat.size > 0 || skippedSet.size > 0)
        ? [
            ...(classroomData.resources || []).filter(r =>
              !skippedSet.has(r.courseId) && (r.type === 'announcement' ? !failedAnn.has(r.courseId) : !failedMat.has(r.courseId))
            ),
            ...prevResources.filter(r =>
              skippedSet.has(r.courseId) || (r.type === 'announcement' ? failedAnn.has(r.courseId) : failedMat.has(r.courseId))
            )
          ]
        : (classroomData.resources || []);

      const freshTopics = (failedTop.size > 0 || skippedSet.size > 0)
        ? [
            ...(classroomData.topics || []).filter(t => !failedTop.has(t.courseId) && !skippedSet.has(t.courseId)),
            ...prevTopics.filter(t => failedTop.has(t.courseId) || skippedSet.has(t.courseId))
          ]
        : (classroomData.topics || []);

      const hasAnyPartialFailure = (classroomData.failedCourseIds?.length || 0) > 0;
      const syncedAssigns = syncClassroomAssignments(freshAssignments, userEmail);
      saveCourses(classroomData.courses, userEmail);
      try {
        saveResources(freshResources, userEmail);
      } catch (storageErr) {
        logger.warn('[Sync] Resources cache exceeded storage quota; continuing with in-memory data.', storageErr);
      }
      try {
        saveTopics(freshTopics, userEmail);
      } catch (storageErr) {
        logger.warn('[Sync] Topics cache exceeded storage quota; continuing with in-memory data.', storageErr);
      }

      setAssignments(syncedAssigns);
      setCourses(classroomData.courses);
      setResources(freshResources);
      setTopics(freshTopics);
      
      const now = new Date().toISOString();
      setLastSync(now, userEmail);
      setLastSyncTime(now);

      addToast(
        hasAnyPartialFailure
          ? (effectiveLang === 'th' ? 'ซิงค์สำเร็จบางส่วน (บางวิชาใช้ข้อมูลแคช)' : 'Synced partially (some courses used cached data)')
          : (effectiveLang === 'th' ? 'ซิงค์ข้อมูลสำเร็จ' : 'Sync completed successfully'),
        hasAnyPartialFailure ? 'warning' : 'success'
      );

      // Run notifications, calendar sync, and Drive push asynchronously without blocking the Sync button
      void (async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
        if (isStaleRun()) return;
        try {
          if (lastSync) {
            await NotificationService.evaluateNewPostDigest(
              freshToken, userEmail, freshAssignments, 
              freshResources, cachedAssignmentIds, cachedResourceIds
            );
          }
          await NotificationService.evaluateNotifications(
            freshToken, userEmail, syncedAssigns, 
            classroomData.courses, freshResources,
            { prevLastSync: lastSync }
          );
        } catch (err) {
          logger.error('Error processing digest alerts during sync:', err);
        } finally {
          if (!isStaleRun()) {
            reloadSettings();
            const postToken = getLatestToken();
            calendarSyncManager.queueSync(postToken, userEmail);
            syncManager.queueSync(postToken, userEmail);
          }
        }
      })();
      return true;

    } catch (e) {
      if (e?.name === 'AbortError' || isStaleRun()) return false;
      logger.error('Failed to sync Google Classroom data', e);
      if (e.message === 'UNAUTHORIZED' || e.code === 401) {
        expireSession();
        addToast(langRef.current === 'th' ? 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่' : 'Session expired, please login again.', 'error');
      } else if (e.name === 'NetworkError' || e.message?.toLowerCase().includes('network') || !navigator.onLine) {
        addToast(langRef.current === 'th' ? 'เครือข่ายมีปัญหา กรุณาตรวจสอบการเชื่อมต่อ' : 'Network issue. Please check your connection.', 'warning');
      } else {
        addToast(e.message || (langRef.current === 'th' ? 'การซิงค์ล้มเหลว' : 'Sync failed'), 'error');
      }
      return false;
    } finally {
      if (signal) {
        signal.removeEventListener('abort', onCallerAbort);
      }
      if (activeSyncRef.current?.id === runId) {
        activeSyncRef.current = null;
        setIsClassroomFetching(false);
      }
    }
  }, [accessToken, setLang, updateProfileFromGoogle, loadLocalData, reloadSettings, expireSession, addToast]);

  const handleStatusChange = useCallback((id, newStatus) => {
    const email = getActiveEmail();
    setAssignments(updateAssignmentStatus(id, newStatus, email));
    syncManager.queueSync(accessToken, email);
    calendarSyncManager.queueSync(accessToken, email);
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

  const handleDeleteAssignment = useCallback((id) => {
    const email = getActiveEmail();
    setAssignments(deleteAssignment(id, email));
    syncManager.queueSync(accessToken, email);
    calendarSyncManager.queueSync(accessToken, email);
  }, [accessToken]);

  const handleUpdateAssignment = useCallback((id, patch) => {
    const email = getActiveEmail();
    const nowIso = new Date().toISOString();
    const updated = assignmentsRef.current.map(a =>
      String(a.id) === String(id) ? { ...a, ...patch, updatedAt: nowIso } : a
    );
    saveAssignments(updated, email);
    setAssignments(updated);
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
    const removed = assignmentsRef.current.filter(a => a.parentResourceId === resourceId);
    const updated = assignmentsRef.current.filter(a => a.parentResourceId !== resourceId);
    removed.forEach(a => {
      if (email && a?.id) {
        recordDeletedId('assignments', a.id, email);
      }
    });
    saveAssignments(updated, email);
    setAssignments(updated);
    syncManager.queueSync(accessToken, email);
    calendarSyncManager.queueSync(accessToken, email);
  }, [accessToken]);

  const syncCourses = useCallback(async (courseIds = []) => {
    const tokenToUse = getToken() || accessToken;
    const email = getActiveEmail();
    const ids = Array.from(new Set((Array.isArray(courseIds) ? courseIds : []).filter(Boolean)));
    if (!tokenToUse || !email || ids.length === 0) return false;
    if (activeSyncRef.current) return false;

    const generation = sessionGenerationRef.current;
    try {
      const data = await ClassroomService.fetchClassroomData(tokenToUse, {
        getToken: () => getToken() || tokenToUse,
        onlyCourseIds: ids,
        knownCourses: coursesRef.current
      });
      if (generation !== sessionGenerationRef.current || getActiveEmail() !== email) return false;

      const targetSet = new Set(ids);
      const failedCW = new Set(data.failedFeeds?.coursework || []);
      const failedAnn = new Set(data.failedFeeds?.announcements || []);
      const failedMat = new Set(data.failedFeeds?.materials || []);
      const failedTop = new Set(data.failedFeeds?.topics || []);

      const prevAssignments = getAssignments(email);
      const prevResources = getResources(email);
      const prevTopics = getTopics(email);

      const mergedAssignments = [
        ...prevAssignments.filter(a => !targetSet.has(a.courseId) || failedCW.has(a.courseId) || String(a.id).startsWith('assign-')),
        ...(data.assignments || []).filter(a => !failedCW.has(a.courseId))
      ];
      const mergedResources = [
        ...prevResources.filter(r => !targetSet.has(r.courseId) || (r.type === 'announcement' ? failedAnn.has(r.courseId) : failedMat.has(r.courseId))),
        ...(data.resources || []).filter(r => (r.type === 'announcement' ? !failedAnn.has(r.courseId) : !failedMat.has(r.courseId)))
      ];
      const mergedTopics = [
        ...prevTopics.filter(t => !targetSet.has(t.courseId) || failedTop.has(t.courseId)),
        ...(data.topics || []).filter(t => !failedTop.has(t.courseId))
      ];

      const syncedAssigns = syncClassroomAssignments(mergedAssignments, email);
      saveResources(mergedResources, email);
      saveTopics(mergedTopics, email);
      setAssignments(syncedAssigns);
      setResources(mergedResources);
      setTopics(mergedTopics);
      return true;
    } catch (err) {
      logger.warn('[Sync] Failed refreshing unhidden courses:', err?.message || err);
      return false;
    }
  }, [accessToken]);

  const resetData = useCallback(() => {
    const email = getActiveEmail();
    clearDriveSyncCache(email);
    const reset = resetDatabase(email);
    setAssignments(reset.assignments);
    setCourses(reset.courses);
    setResources([]);
    setTopics([]);
    setAcademicData(createDefaultAcademicData());
    setLastSyncTime(null);
    setSchedule([]);
  }, []);

  const handleSaveScheduleEntry = useCallback((entry) => {
    const email = getActiveEmail();
    const prev = scheduleRef.current;
    const isEdit = prev.some(s => s.id === entry.id);
    const updated = isEdit
      ? prev.map(s => s.id === entry.id ? { ...entry, updatedAt: new Date().toISOString() } : s)
      : [...prev, { ...entry, id: entry.id || `sched-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, updatedAt: new Date().toISOString() }];
    saveSchedule(updated, email);
    setSchedule(updated);
    syncManager.queueSync(accessToken, email);
    calendarSyncManager.queueSync(accessToken, email);
  }, [accessToken]);

  const handleDeleteScheduleEntry = useCallback((id, deletedDateStr = null) => {
    const email = getActiveEmail();
    const prev = scheduleRef.current;
    const entry = prev.find(s => s.id === id);
    if (!entry) return;
    let updated;
    if (entry.date || !deletedDateStr) {
      updated = prev.filter(s => s.id !== id);
    } else {
      updated = prev.map(s => s.id === id ? { ...s, deletedAt: deletedDateStr, updatedAt: new Date().toISOString() } : s);
    }
    saveSchedule(updated, email);
    setSchedule(updated);
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

  const handleSaveAcademicData = useCallback((nextOrUpdater) => {
    const email = getActiveEmail();
    const prev = academicRef.current || createDefaultAcademicData();
    const next = typeof nextOrUpdater === 'function' ? nextOrUpdater(prev) : nextOrUpdater;
    const saved = saveAcademicData(next, email);
    setAcademicData(saved);
    if (accessToken && email) {
      syncManager.queueSync(accessToken, email);
    }
    return saved;
  }, [accessToken]);

  /**
   * Unified batch importer for parsed KMUTNB Reg data (Schedule + Exams + Grades/Enrolled courses).
   */
  const handleImportRegData = useCallback((parsedResult, options = {}) => {
    const {
      importSchedule = true,
      replaceRegSchedule = true,
      importExams = true,
      importGrades = true,
    } = options;
    const email = getActiveEmail();
    const nowIso = new Date().toISOString();
    let calendarNeedsSync = false;

    // 1. Schedule import (batch write)
    if (importSchedule && parsedResult?.timetable?.scheduleEntries?.length > 0) {
      const prevSchedule = scheduleRef.current || [];
      const incoming = parsedResult.timetable.scheduleEntries.map((entry) => ({
        ...entry,
        source: 'kmutnb-reg',
        updatedAt: nowIso
      }));
      const incomingIds = new Set(incoming.map((e) => e.id));
      const kept = replaceRegSchedule
        ? prevSchedule.filter((s) => s.source !== 'kmutnb-reg' && !String(s.id || '').startsWith('reg-') && !incomingIds.has(s.id))
        : prevSchedule.filter((s) => !incomingIds.has(s.id));
      const nextSchedule = [...kept, ...incoming];
      saveSchedule(nextSchedule, email);
      setSchedule(nextSchedule);
      calendarNeedsSync = true;
    }

    // 2. Exam import (merge into manualExams without overwriting custom manual exams or SciBase seating)
    if (importExams && parsedResult?.timetable?.examEntries?.length > 0) {
      const cached = examRepository.getCachedExams(email);
      const currentExams = (cached.success && cached.data?.exams) ? cached.data.exams : [];
      const currentManual = (cached.success && cached.data?.manualExams) ? cached.data.manualExams : [];
      const currentUnlisted = (cached.success && cached.data) ? cached.data.unlisted : null;

      const preservedManual = currentManual.filter(
        (ex) => ex.source !== 'kmutnb-reg' && !String(ex.id || '').startsWith('reg-exam-')
      );
      const incomingExams = parsedResult.timetable.examEntries.map((ex) => ({
        ...ex,
        isManual: true,
        source: 'kmutnb-reg',
        updatedAt: nowIso
      }));
      examRepository.saveToCache(email, currentExams, [...preservedManual, ...incomingExams], currentUnlisted);
      if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
        window.dispatchEvent(new CustomEvent('classroom_hub_exams_updated', { detail: { email } }));
      }
      calendarNeedsSync = true;
    }

    // 3. Academic grades + currently enrolled courses import
    const hasIncomingGrades = importGrades && parsedResult?.grades?.semesters?.length > 0;
    const hasIncomingEnrolled = (importSchedule || importGrades) && parsedResult?.timetable?.enrolledCourses?.length > 0;
    if (hasIncomingGrades || hasIncomingEnrolled) {
      const prevAcademic = academicRef.current || createDefaultAcademicData();
      let nextSemesters = prevAcademic.semesters || [];

      if (hasIncomingGrades) {
        const semMap = new Map(nextSemesters.map((s) => [s.semesterId, s]));
        for (const incomingSem of parsedResult.grades.semesters) {
          semMap.set(incomingSem.semesterId, incomingSem);
        }
        nextSemesters = Array.from(semMap.values());
      }

      const nextAcademic = {
        ...prevAcademic,
        semesters: nextSemesters,
        enrolledCourses: hasIncomingEnrolled
          ? parsedResult.timetable.enrolledCourses
          : (prevAcademic.enrolledCourses || []),
        lastImportedAt: nowIso
      };
      const saved = saveAcademicData(nextAcademic, email);
      setAcademicData(saved);
    }

    const activeToken = getToken() || accessToken;
    if (activeToken && email) {
      syncManager.queueSync(activeToken, email);
      if (calendarNeedsSync) {
        calendarSyncManager.queueSync(activeToken, email);
      }
    }
  }, [accessToken]);

  const requestExtensionSync = useCallback(() => {
    if (typeof window === 'undefined') return;
    window.postMessage(
      {
        channel: 'CH_EXTENSION_BRIDGE',
        source: 'app',
        type: 'REQUEST_SYNC_NOW'
      },
      window.location.origin
    );
  }, []);

  // Chrome/Edge Extension Auto-Sync Bridge (receives sanitized KMUTNB Reg snapshots from extension/bridge.js)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const CHANNEL = 'CH_EXTENSION_BRIDGE';

    const handleBridgeMessage = (event) => {
      if (event.source !== window || event.origin !== window.location.origin) return;
      const msg = event.data;
      if (!msg || msg.channel !== CHANNEL || msg.source !== 'extension') return;

      if (msg.status && typeof msg.status === 'object') {
        setExtensionStatus({ connected: true, ...msg.status });
      }

      if (msg.type === 'REG_SYNC_EMPTY') {
        addToast(
          langRef.current === 'th'
            ? 'ยังไม่มีข้อมูลจาก Reg มจพ. ใน Extension — ลองเปิดหน้าตารางเรียนหรือผลการศึกษาบน reg.kmutnb.ac.th ก่อนครับ'
            : 'No captured KMUTNB Reg data in Extension yet — visit Timetable or Grades on reg.kmutnb.ac.th first.',
          'info'
        );
        return;
      }

      if (msg.type === 'REG_SNAPSHOT_DATA') {
        if (!hasWorkspaceSession) return;
        const activeEmail = getActiveEmail();
        const storedProfile = activeEmail ? getProfile(activeEmail) : null;
        const cleanProfileId = String(storedProfile?.studentId || '').replace(/[\s-]/g, '').trim();
        const activeStudentId = /^\d{13}$/.test(cleanProfileId)
          ? cleanProfileId
          : (String(activeEmail || '').match(/\d{13}/)?.[0] || '');
        const expectedSidHash = hashStudentIdForBridge(activeStudentId);
        const incomingSidHashes = [
          msg.payload?.timetable?.studentIdHash,
          msg.payload?.grade?.studentIdHash
        ].filter((h) => typeof h === 'string' && h.trim().length > 0);

        if (expectedSidHash && incomingSidHashes.length > 0 && incomingSidHashes.some((h) => h !== expectedSidHash)) {
          logger.warn('[Extension Bridge] Blocked snapshot import due to Student ID hash mismatch.');
          addToast(
            langRef.current === 'th'
              ? 'ข้อมูลใน Extension เป็นของรหัสนักศึกษาอื่น — ระบบบล็อกการเขียนทับข้อมูลของคุณแล้ว'
              : 'Extension snapshot belongs to a different Student ID — auto-sync blocked to protect your account.',
            'warning'
          );
          return;
        }

        const timetableText = msg.payload?.timetable?.text || '';
        const gradeText = msg.payload?.grade?.text || '';
        const combined = [timetableText, gradeText].filter(Boolean).join('\n\n');
        if (!combined.trim()) return;

        const parsed = parseKmutnbRegInput(combined, coursesRef.current || []);
        if (!parsed.success) return;

        handleImportRegData(parsed, {
          importSchedule: Boolean(parsed.meta.totalScheduleSlots > 0),
          replaceRegSchedule: true,
          importExams: Boolean(parsed.meta.totalExams > 0),
          importGrades: Boolean(parsed.meta.hasGrades || parsed.meta.totalEnrolledCourses > 0)
        });

        window.postMessage(
          {
            channel: CHANNEL,
            source: 'app',
            type: 'ACK_SYNC_COMPLETE',
            timetableHash: parsed.meta.totalScheduleSlots > 0 ? (msg.payload?.timetable?.hash || null) : null,
            gradeHash: parsed.meta.hasGrades ? (msg.payload?.grade?.hash || null) : null
          },
          window.location.origin
        );

        const parts = [];
        const isTh = langRef.current === 'th';
        if (parsed.meta.totalScheduleSlots > 0) {
          parts.push(isTh ? `ตารางเรียน ${parsed.meta.totalScheduleSlots} คาบ` : `${parsed.meta.totalScheduleSlots} classes`);
        }
        if (parsed.meta.totalExams > 0) {
          parts.push(isTh ? `วันสอบ ${parsed.meta.totalExams} รายการ` : `${parsed.meta.totalExams} exams`);
        }
        if (parsed.meta.hasGrades) {
          parts.push(isTh ? `เกรด ${parsed.meta.totalSemesters} เทอม` : `${parsed.meta.totalSemesters} semesters`);
        }
        if (parts.length > 0) {
          addToast(
            isTh
              ? `ซิงค์อัตโนมัติจาก KMUTNB Reg สำเร็จ: ${parts.join(', ')}`
              : `Auto-synced from KMUTNB Reg: ${parts.join(', ')}`,
            'success'
          );
        }
      }
    };

    window.addEventListener('message', handleBridgeMessage);
    window.postMessage(
      {
        channel: CHANNEL,
        source: 'app',
        type: 'PING_EXTENSION'
      },
      window.location.origin
    );

    return () => window.removeEventListener('message', handleBridgeMessage);
  }, [hasWorkspaceSession, handleImportRegData, addToast]);

  const isSyncing = isClassroomFetching;

  useEffect(() => {
    if (!isLoggedIn || !accessToken) {
      autoSyncedRef.current = false;
      return;
    }
    if (autoSyncedRef.current) return;

    const controller = new AbortController();
    let completed = false;
    autoSyncedRef.current = true;
    syncClassroom(accessToken, controller.signal).then((didComplete) => {
      if (didComplete && !controller.signal.aborted) {
        completed = true;
      }
    });

    return () => {
      controller.abort();
      if (!completed) {
        autoSyncedRef.current = false;
      }
    };
  }, [isLoggedIn, accessToken, syncClassroom]);

  const value = React.useMemo(() => ({
    assignments, courses, resources, schedule, academicData, extensionStatus, isSyncing, lastSyncTime, syncState, topics,
    syncClassroom, syncCourses, handleStatusChange, handleNotesChange, handleDueDateChange, handleAddAssignment,
    handleUpdateAssignment, handleDeleteAssignment, handleDeleteScheduleEntry, handleSaveScheduleEntry,
    handleClearSchedule, handleSaveAcademicData, handleImportRegData, requestExtensionSync,
    handleTrackAsAssignment, handleUntrackAssignment, resetData
  }), [
    assignments, courses, resources, schedule, academicData, extensionStatus, isSyncing, lastSyncTime, syncState, topics,
    syncClassroom, syncCourses, handleStatusChange, handleNotesChange, handleDueDateChange, handleAddAssignment,
    handleUpdateAssignment, handleDeleteAssignment, handleDeleteScheduleEntry, handleSaveScheduleEntry,
    handleClearSchedule, handleSaveAcademicData, handleImportRegData, requestExtensionSync,
    handleTrackAsAssignment, handleUntrackAssignment, resetData
  ]);

  return <ClassroomContext.Provider value={value}>{children}</ClassroomContext.Provider>;
};

export const useClassroom = () => useContext(ClassroomContext);