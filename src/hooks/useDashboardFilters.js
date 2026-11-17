import { useState, useMemo } from 'react';
import { isDueToday, isOverdue } from '../utils/dateUtils';

export function useDashboardFilters(visibleAssignments) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [sortBy, setSortBy] = useState('due-asc');
  const [viewType, setViewType] = useState('list');

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

  // Extract critical groups (not filtered by general status filter to avoid missing overdue alerts)
  const allFilteredAssignments = useMemo(() => {
    return visibleAssignments.filter(a => {
      const matchesSearch = a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            a.course.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCourse = selectedCourse === 'all' || a.course === selectedCourse;
      return matchesSearch && matchesCourse;
    });
  }, [visibleAssignments, searchQuery, selectedCourse]);

  const overdueTasks = useMemo(() => allFilteredAssignments.filter(a => isOverdue(a.dueDate) && a.status !== 'done'), [allFilteredAssignments]);
  const todayTasks = useMemo(() => allFilteredAssignments.filter(a => isDueToday(a.dueDate) && !isOverdue(a.dueDate) && a.status !== 'done'), [allFilteredAssignments]);

  // Split assignments for Kanban columns
  const todoTasks = useMemo(() => sortedAssignments.filter(a => a.status === 'todo'), [sortedAssignments]);
  const doingTasks = useMemo(() => sortedAssignments.filter(a => a.status === 'doing'), [sortedAssignments]);
  const doneTasks = useMemo(() => sortedAssignments.filter(a => a.status === 'done'), [sortedAssignments]);

  return {
    searchQuery, setSearchQuery,
    selectedCourse, setSelectedCourse,
    selectedStatus, setSelectedStatus,
    sortBy, setSortBy,
    viewType, setViewType,
    filteredAssignments,
    sortedAssignments,
    overdueTasks,
    todayTasks,
    todoTasks,
    doingTasks,
    doneTasks
  };
}
