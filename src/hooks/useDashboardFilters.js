import { useState, useMemo, useCallback } from 'react';
import { useInRouterContext, useSearchParams } from 'react-router-dom';
import { isDueToday, isOverdue } from '../utils/dateUtils';

function useUrlOrStateFilters() {
  const inRouter = useInRouterContext();
  if (inRouter) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [searchParams, setSearchParams] = useSearchParams();
    const searchQuery = searchParams.get('q') || '';
    const selectedCourse = searchParams.get('course') || 'all';
    const selectedStatus = searchParams.get('status') || 'all';
    const sortBy = searchParams.get('sort') || 'due-asc';
    const viewType = searchParams.get('view') || 'list';

    // eslint-disable-next-line react-hooks/rules-of-hooks
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

    // eslint-disable-next-line react-hooks/rules-of-hooks
    const setSearchQuery = useCallback((v) => updateParam('q', '', v), [updateParam]);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const setSelectedCourse = useCallback((v) => updateParam('course', 'all', v), [updateParam]);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const setSelectedStatus = useCallback((v) => updateParam('status', 'all', v), [updateParam]);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const setSortBy = useCallback((v) => updateParam('sort', 'due-asc', v), [updateParam]);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const setViewType = useCallback((v) => updateParam('view', 'list', v), [updateParam]);

    return {
      searchQuery,
      setSearchQuery,
      selectedCourse,
      setSelectedCourse,
      selectedStatus,
      setSelectedStatus,
      sortBy,
      setSortBy,
      viewType,
      setViewType,
    };
  }

  // Fallback for standalone unit tests outside Router
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [searchQuery, setSearchQuery] = useState('');
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [selectedCourse, setSelectedCourse] = useState('all');
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [selectedStatus, setSelectedStatus] = useState('all');
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [sortBy, setSortBy] = useState('due-asc');
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [viewType, setViewType] = useState('list');

  return {
    searchQuery, setSearchQuery,
    selectedCourse, setSelectedCourse,
    selectedStatus, setSelectedStatus,
    sortBy, setSortBy,
    viewType, setViewType,
  };
}

export function useDashboardFilters(visibleAssignments) {
  const {
    searchQuery, setSearchQuery,
    selectedCourse, setSelectedCourse,
    selectedStatus, setSelectedStatus,
    sortBy, setSortBy,
    viewType, setViewType
  } = useUrlOrStateFilters();

  // Filter assignments
  const filteredAssignments = useMemo(() => {
    return visibleAssignments.filter(assignment => {
      const matchesSearch = assignment.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            assignment.course.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCourse = selectedCourse === 'all' || assignment.course === selectedCourse;
      const matchesStatus = selectedStatus === 'all' || assignment.status === selectedStatus;
      return matchesSearch && matchesCourse && matchesStatus;
    });
  }, [visibleAssignments, searchQuery, selectedCourse, selectedStatus]);

  // Sort assignments
  const sortedAssignments = useMemo(() => {
    return [...filteredAssignments].sort((a, b) => {
      if (sortBy === 'due-asc' || sortBy === 'due-desc') {
        const timeA = a.dueDate ? new Date(a.dueDate).getTime() : NaN;
        const timeB = b.dueDate ? new Date(b.dueDate).getTime() : NaN;
        const validA = Number.isFinite(timeA);
        const validB = Number.isFinite(timeB);
        if (!validA && !validB) return 0;
        if (!validA) return 1;
        if (!validB) return -1;
        return sortBy === 'due-asc' ? timeA - timeB : timeB - timeA;
      } else if (sortBy === 'points-desc') {
        return (b.points || 0) - (a.points || 0);
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
    return visibleAssignments.filter(a => {
      const matchesSearch = a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            a.course.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCourse = selectedCourse === 'all' || a.course === selectedCourse;
      return matchesSearch && matchesCourse;
    });
  }, [visibleAssignments, searchQuery, selectedCourse]);

  const todoTasks = useMemo(() => allFilteredAssignments.filter(a => a.status === 'todo'), [allFilteredAssignments]);
  const doingTasks = useMemo(() => allFilteredAssignments.filter(a => a.status === 'doing'), [allFilteredAssignments]);
  const doneTasks = useMemo(() => allFilteredAssignments.filter(a => a.status === 'done'), [allFilteredAssignments]);

  return {
    searchQuery, setSearchQuery,
    selectedCourse, setSelectedCourse,
    selectedStatus, setSelectedStatus,
    sortBy, setSortBy,
    viewType, setViewType,
    sortedAssignments,
    overdueTasks,
    todayTasks,
    todoTasks,
    doingTasks,
    doneTasks
  };
}
