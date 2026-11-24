/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { getHiddenCourses, saveHiddenCourses, getPinnedItems, savePinnedItems, getActiveEmail } from '../utils/storage';
import { useClassroom } from './ClassroomContext';
import { useAuth } from './AuthContext';
import { syncManager } from '../services/SyncManager';
import { calendarSyncManager } from '../services/CalendarSyncManager';

export const ClassroomUIContext = createContext(null);

export const ClassroomUIProvider = ({ children }) => {
  const { accessToken, isLoggedIn, profile } = useAuth();
  const { courses, assignments, resources, syncCourses } = useClassroom();
  
  const [hiddenCourseIds, setHiddenCourseIds] = useState([]);
  const hiddenCourseIdsRef = useRef(hiddenCourseIds);
  const [pinnedItemIds, setPinnedItemIds] = useState([]);
  const pinnedItemIdsRef = useRef(pinnedItemIds);

  useEffect(() => {
    hiddenCourseIdsRef.current = hiddenCourseIds;
  }, [hiddenCourseIds]);

  useEffect(() => {
    pinnedItemIdsRef.current = pinnedItemIds;
  }, [pinnedItemIds]);

  const loadHiddenCourses = useCallback((email = '') => {
    setHiddenCourseIds(getHiddenCourses(email));
    setPinnedItemIds(getPinnedItems(email));
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
      if (e.key && (e.key.startsWith('classroom_hub_hidden_courses') || e.key.startsWith('classroom_hub_pinned_items'))) {
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
    const isUnhiding = current.includes(courseId);
    const updated = isUnhiding
      ? current.filter(id => id !== courseId)
      : [...current, courseId];
    hiddenCourseIdsRef.current = updated;
    setHiddenCourseIds(updated);
    saveHiddenCourses(updated, email);
    syncManager.queueSync(accessToken, email);
    calendarSyncManager.queueSync(accessToken, email);
    if (isUnhiding && accessToken) {
      syncCourses?.([courseId]);
    }
  }, [accessToken, syncCourses]);

  const handleToggleBulkCourses = useCallback((courseIds, shouldHideAll) => {
    const email = getActiveEmail();
    const prevHidden = hiddenCourseIdsRef.current;
    const updated = shouldHideAll ? [...courseIds] : [];
    hiddenCourseIdsRef.current = updated;
    setHiddenCourseIds(updated);
    saveHiddenCourses(updated, email);
    syncManager.queueSync(accessToken, email);
    calendarSyncManager.queueSync(accessToken, email);
    if (!shouldHideAll && accessToken) {
      const unhiddenIds = prevHidden.filter(id => courseIds.includes(id));
      if (unhiddenIds.length > 0) {
        syncCourses?.(unhiddenIds);
      }
    }
  }, [accessToken, syncCourses]);

  const handleTogglePinItem = useCallback((itemId) => {
    if (!itemId) return;
    const key = String(itemId);
    const email = getActiveEmail();
    const current = pinnedItemIdsRef.current;
    const updated = current.includes(key)
      ? current.filter(id => id !== key)
      : [key, ...current];
    pinnedItemIdsRef.current = updated;
    setPinnedItemIds(updated);
    savePinnedItems(updated, email);
    if (accessToken && email) {
      syncManager.queueSync(accessToken, email);
    }
  }, [accessToken]);

  const isItemPinned = useCallback((itemId) => {
    if (!itemId) return false;
    return pinnedItemIds.includes(String(itemId));
  }, [pinnedItemIds]);

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
    pinnedItemIds,
    isItemPinned,
    handleTogglePinItem,
    visibleCourses,
    visibleAssignments,
    visibleResources,
    handleToggleCourseVisibility,
    handleToggleBulkCourses
  }), [
    hiddenCourseIds, pinnedItemIds, isItemPinned, handleTogglePinItem,
    visibleCourses, visibleAssignments, visibleResources,
    handleToggleCourseVisibility, handleToggleBulkCourses
  ]);

  return <ClassroomUIContext.Provider value={value}>{children}</ClassroomUIContext.Provider>;
};

export const useClassroomUI = () => useContext(ClassroomUIContext);
