/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { getHiddenCourses, saveHiddenCourses, getActiveEmail } from '../utils/storage';
import { useClassroom } from './ClassroomContext';
import { useAuth } from './AuthContext';
import { syncManager } from '../services/SyncManager';

export const ClassroomUIContext = createContext(null);

export const ClassroomUIProvider = ({ children }) => {
  const { accessToken, isLoggedIn } = useAuth();
  const { courses, assignments, resources } = useClassroom();
  
  const [hiddenCourseIds, setHiddenCourseIds] = useState([]);

  const loadHiddenCourses = useCallback((email = '') => {
    setHiddenCourseIds(getHiddenCourses(email));
  }, []);

  useEffect(() => {
    const activeEmail = getActiveEmail();
    if (isLoggedIn && activeEmail) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadHiddenCourses(activeEmail);
    } else {
      loadHiddenCourses('');
    }
  }, [isLoggedIn, loadHiddenCourses]);

  const handleToggleCourseVisibility = useCallback((courseId) => {
    const email = getActiveEmail();
    const updated = hiddenCourseIds.includes(courseId)
      ? hiddenCourseIds.filter(id => id !== courseId)
      : [...hiddenCourseIds, courseId];
    setHiddenCourseIds(updated);
    saveHiddenCourses(updated, email);
    syncManager.queueSync(accessToken, email);
  }, [hiddenCourseIds, accessToken]);

  const handleToggleBulkCourses = useCallback((courseIds, shouldHideAll) => {
    const email = getActiveEmail();
    const updated = shouldHideAll ? [...courseIds] : [];
    setHiddenCourseIds(updated);
    saveHiddenCourses(updated, email);
    syncManager.queueSync(accessToken, email);
  }, [accessToken]);

  const courseNameMap = useMemo(() => new Map(courses.map(c => [c.name, c])), [courses]);

  const visibleCourses = useMemo(() => 
    courses.filter(c => !hiddenCourseIds.includes(c.id)),
  [courses, hiddenCourseIds]);

  const visibleAssignments = useMemo(() => 
    assignments.filter(a => {
      if (a.courseId && hiddenCourseIds.includes(a.courseId)) return false;
      const courseObj = courseNameMap.get(a.course);
      if (courseObj && hiddenCourseIds.includes(courseObj.id)) return false;
      return true;
    }),
  [assignments, courseNameMap, hiddenCourseIds]);

  const visibleResources = useMemo(() => 
    resources.filter(r => {
      if (r.courseId && hiddenCourseIds.includes(r.courseId)) return false;
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
