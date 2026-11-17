import { useState, useMemo, useCallback } from 'react';
import { useInRouterContext, useSearchParams } from 'react-router-dom';
import { isDueToday, isOverdue, parseLocalDateInput } from '../utils/dateUtils';

function useRouterUrlFilters() {
  const [searchParams, setSearchParams] = useSearchParams();
  const searchQuery = searchParams.get('q') || '';
  const selectedCourse = searchParams.get('course') || 'all';
  const selectedStatus = searchParams.get('status') || 'all';
  const sortBy = searchParams.get('sort') || 'due-asc';
  const viewType = searchParams.get('view') || 'list';

  const updateParam = useCallback((key, defaultVal, nextValue) => {
    setSearchParams(prev => {
      const currentVal = prev.get(key) || defaultVal;
      const normalizedNext = nextValue || defaultVal;
      if (currentVal === normalizedNext) {
        return prev;
      }
      const next = new URLSearchParams(prev);
      if (!nextValue || nextValue === defaultVal) {
        next.delete(key);
      } else {
        next.set(key, nextValue);
      }
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const setSearchQuery = useCallback((v) => updateParam('q', '', v), [updateParam]);
  const setSelectedCourse = useCallback((v) => updateParam('course', 'all', v), [updateParam]);
  const setSelectedStatus = useCallback((v) => updateParam('status', 'all', v), [updateParam]);
  const setSortBy = useCallback((v) => updateParam('sort', 'due-asc', v), [updateParam]);
  const setViewType = useCallback((v) => updateParam('view', 'list', v), [updateParam]);
  const clearFilters = useCallback(() => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.delete('q');
      next.delete('course');
      next.delete('status');
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  return {
    searchQuery, setSearchQuery,
    selectedCourse, setSelectedCourse,
    selectedStatus, setSelectedStatus,
    sortBy, setSortBy,
    viewType, setViewType,
    clearFilters
  };
}

function useStandaloneFilters() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [sortBy, setSortBy] = useState('due-asc');
  const [viewType, setViewType] = useState('list');
  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setSelectedCourse('all');
    setSelectedStatus('all');
  }, []);

  return {
    searchQuery, setSearchQuery,
    selectedCourse, setSelectedCourse,
    selectedStatus, setSelectedStatus,
    sortBy, setSortBy,
    viewType, setViewType,
    clearFilters
  };
}

export function useDashboardFilters(visibleAssignments = []) {
  const inRouter = useInRouterContext();
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const filterState = inRouter ? useRouterUrlFilters() : useStandaloneFilters();
  const {
    searchQuery, setSearchQuery,
    selectedCourse, setSelectedCourse,
    selectedStatus, setSelectedStatus,
    sortBy, setSortBy,
    viewType, setViewType,
    clearFilters
  } = filterState;

  const safeAssignments = useMemo(
    () => (Array.isArray(visibleAssignments) ? visibleAssignments : []),
    [visibleAssignments]
  );

  // Filter assignments
  const filteredAssignments = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return safeAssignments.filter(assignment => {
      const title = String(assignment?.title || '').toLowerCase();
      const course = String(assignment?.course || '').toLowerCase();
      const matchesSearch = !q || title.includes(q) || course.includes(q);
      const matchesCourse = selectedCourse === 'all' || assignment?.course === selectedCourse;
      const matchesStatus = selectedStatus === 'all' || assignment?.status === selectedStatus;
      return matchesSearch && matchesCourse && matchesStatus;
    });
  }, [safeAssignments, searchQuery, selectedCourse, selectedStatus]);

  // Sort assignments
  const sortedAssignments = useMemo(() => {
    return [...filteredAssignments].sort((a, b) => {
      if (sortBy === 'due-asc' || sortBy === 'due-desc') {
        const parsedA = parseLocalDateInput(a?.dueDate, { endOfDayForDateOnly: true });
        const parsedB = parseLocalDateInput(b?.dueDate, { endOfDayForDateOnly: true });
        const timeA = parsedA ? parsedA.getTime() : NaN;
        const timeB = parsedB ? parsedB.getTime() : NaN;
        const validA = Number.isFinite(timeA);
        const validB = Number.isFinite(timeB);
        if (!validA && !validB) return 0;
        if (!validA) return 1;
        if (!validB) return -1;
        return sortBy === 'due-asc' ? timeA - timeB : timeB - timeA;
      } else if (sortBy === 'points-desc') {
        return (Number(b?.points) || 0) - (Number(a?.points) || 0);
      }
      return 0;
    });
  }, [filteredAssignments, sortBy]);

  // Critical groups respect active status filter (so filtering by 'done' never shows overdue todo items)
  const overdueTasks = useMemo(() => {
    if (selectedStatus === 'done') return [];
    return filteredAssignments.filter(a => a.status !== 'done' && isOverdue(a.dueDate));
  }, [filteredAssignments, selectedStatus]);

  const todayTasks = useMemo(() => {
    if (selectedStatus === 'done') return [];
    return filteredAssignments.filter(a => a.status !== 'done' && !isOverdue(a.dueDate) && isDueToday(a.dueDate));
  }, [filteredAssignments, selectedStatus]);

  // Kanban columns
  const allFilteredAssignments = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return safeAssignments.filter(a => {
      const title = String(a?.title || '').toLowerCase();
      const course = String(a?.course || '').toLowerCase();
      const matchesSearch = !q || title.includes(q) || course.includes(q);
      const matchesCourse = selectedCourse === 'all' || a?.course === selectedCourse;
      return matchesSearch && matchesCourse;
    });
  }, [safeAssignments, searchQuery, selectedCourse]);

  const todoTasks = useMemo(() => allFilteredAssignments.filter(a => a.status === 'todo'), [allFilteredAssignments]);
  const doingTasks = useMemo(() => allFilteredAssignments.filter(a => a.status === 'doing'), [allFilteredAssignments]);
  const doneTasks = useMemo(() => allFilteredAssignments.filter(a => a.status === 'done'), [allFilteredAssignments]);

  return {
    searchQuery, setSearchQuery,
    selectedCourse, setSelectedCourse,
    selectedStatus, setSelectedStatus,
    sortBy, setSortBy,
    viewType, setViewType,
    clearFilters,
    sortedAssignments,
    overdueTasks,
    todayTasks,
    todoTasks,
    doingTasks,
    doneTasks
  };
}
