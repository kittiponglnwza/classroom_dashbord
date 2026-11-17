/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { getHiddenCourses, saveHiddenCourses, getActiveEmail } from '../utils/storage';
import { useClassroom } from './ClassroomContext';
import { useAuth } from './AuthContext';
import { syncManager } from '../services/SyncManager';
import { calendarSyncManager } from '../services/CalendarSyncManager';

export const ClassroomUIContext = createContext(null);

export const ClassroomUIProvider = ({ children }) => {
  const { accessToken, isLoggedIn, profile } = useAuth();
  const { courses, assignments, resources } = useClassroom();
  
  const [hiddenCourseIds, setHiddenCourseIds] = useState([]);
  const hiddenCourseIdsRef = useRef(hiddenCourseIds);

  useEffect(() => {
    hiddenCourseIdsRef.current = hiddenCourseIds;
  }, [hiddenCourseIds]);

  const loadHiddenCourses = useCallback((email = '') => {
    setHiddenCourseIds(getHiddenCourses(email));
  }, []);

  useEffect(() => {
    const activeEmail = profile?.email || getActiveEmail();
    if (isLoggedIn && activeEmail) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadHiddenCourses(activeEmail);
    } else {
      loadHiddenCourses('');
    }
  }, [isLoggedIn, profile?.email, loadHiddenCourses]);

  useEffect(() => {
    const unsub = syncManager.subscribe((newState) => {
      if (newState === 'success') {
        const activeEmail = profile?.email || getActiveEmail();
        if (activeEmail) loadHiddenCourses(activeEmail);
      }
    });
    const handleStorage = (e) => {
      if (e.key && e.key.startsWith('classroom_hub_hidden_courses')) {
        const activeEmail = profile?.email || getActiveEmail();
        if (activeEmail) loadHiddenCourses(activeEmail);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => {
      unsub();
      window.removeEventListener('storage', handleStorage);
    };
  }, [profile?.email, loadHiddenCourses]);

  const handleToggleCourseVisibility = useCallback((courseId) => {
    const email = getActiveEmail();
    const current = hiddenCourseIdsRef.current;
    const updated = current.includes(courseId)
      ? current.filter(id => id !== courseId)
      : [...current, courseId];
    hiddenCourseIdsRef.current = updated;
    setHiddenCourseIds(updated);
    saveHiddenCourses(updated, email);
    syncManager.queueSync(accessToken, email);
    calendarSyncManager.queueSync(accessToken, email);
  }, [accessToken]);

  const handleToggleBulkCourses = useCallback((courseIds, shouldHideAll) => {
    const email = getActiveEmail();
    const updated = shouldHideAll ? [...courseIds] : [];
    hiddenCourseIdsRef.current = updated;
    setHiddenCourseIds(updated);
    saveHiddenCourses(updated, email);
    syncManager.queueSync(accessToken, email);
    calendarSyncManager.queueSync(accessToken, email);
  }, [accessToken]);

  const courseNameMap = useMemo(() => new Map(courses.map(c => [c.name, c])), [courses]);

  const visibleCourses = useMemo(() => 
    courses.filter(c => !hiddenCourseIds.includes(c.id)),
  [courses, hiddenCourseIds]);

  const visibleAssignments = useMemo(() => 
    assignments.filter(a => {
      if (a.courseId) {
        return !hiddenCourseIds.includes(a.courseId);
      }
      const courseObj = courseNameMap.get(a.course);
      if (courseObj && hiddenCourseIds.includes(courseObj.id)) return false;
      return true;
    }),
  [assignments, courseNameMap, hiddenCourseIds]);

  const visibleResources = useMemo(() => 
    resources.filter(r => {
      if (r.courseId) {
        return !hiddenCourseIds.includes(r.courseId);
      }
      const courseObj = courseNameMap.get(r.course);
      if (courseObj && hiddenCourseIds.includes(courseObj.id)) return false;
      return true;
    }),
  [resources, courseNameMap, hiddenCourseIds]);

  const value = useMemo(() => ({
    hiddenCourseIds,
    visibleCourses,
    visibleAssignments,
    visibleResources,
    handleToggleCourseVisibility,
    handleToggleBulkCourses
  }), [
    hiddenCourseIds, visibleCourses, visibleAssignments, visibleResources,
    handleToggleCourseVisibility, handleToggleBulkCourses
  ]);

  return <ClassroomUIContext.Provider value={value}>{children}</ClassroomUIContext.Provider>;
};

export const useClassroomUI = () => useContext(ClassroomUIContext);
