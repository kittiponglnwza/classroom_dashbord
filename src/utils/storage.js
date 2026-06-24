import { initialAssignments, initialCourses, defaultProfile } from '../data/mockData';

const KEYS = {
  ASSIGNMENTS: 'classroom_hub_assignments',
  COURSES: 'classroom_hub_courses',
  PROFILE: 'classroom_hub_profile'
};

export const getAssignments = () => {
  const stored = localStorage.getItem(KEYS.ASSIGNMENTS);
  if (!stored) {
    localStorage.setItem(KEYS.ASSIGNMENTS, JSON.stringify(initialAssignments));
    return initialAssignments;
  }
  try {
    return JSON.parse(stored);
  } catch (e) {
    console.error('Failed to parse assignments from local storage', e);
    return initialAssignments;
  }
};

export const saveAssignments = (assignments) => {
  localStorage.setItem(KEYS.ASSIGNMENTS, JSON.stringify(assignments));
};

export const updateAssignmentStatus = (id, status) => {
  const assignments = getAssignments();
  const updated = assignments.map(a => a.id === id ? { ...a, status } : a);
  saveAssignments(updated);
  return updated;
};

export const updateAssignmentNotes = (id, notes) => {
  const assignments = getAssignments();
  const updated = assignments.map(a => a.id === id ? { ...a, notes } : a);
  saveAssignments(updated);
  return updated;
};

export const addAssignment = (assignment) => {
  const assignments = getAssignments();
  const newAssignment = {
    id: `assign-${Date.now()}`,
    ...assignment
  };
  const updated = [newAssignment, ...assignments];
  saveAssignments(updated);
  return updated;
};

export const getCourses = () => {
  const stored = localStorage.getItem(KEYS.COURSES);
  if (!stored) {
    localStorage.setItem(KEYS.COURSES, JSON.stringify(initialCourses));
    return initialCourses;
  }
  try {
    return JSON.parse(stored);
  } catch (e) {
    console.error('Failed to parse courses from local storage', e);
    return initialCourses;
  }
};

export const getProfile = () => {
  const stored = localStorage.getItem(KEYS.PROFILE);
  if (!stored) {
    localStorage.setItem(KEYS.PROFILE, JSON.stringify(defaultProfile));
    return defaultProfile;
  }
  try {
    return JSON.parse(stored);
  } catch (e) {
    console.error('Failed to parse profile from local storage', e);
    return defaultProfile;
  }
};

export const saveProfile = (profile) => {
  localStorage.setItem(KEYS.PROFILE, JSON.stringify(profile));
};

export const resetDatabase = () => {
  localStorage.setItem(KEYS.ASSIGNMENTS, JSON.stringify(initialAssignments));
  localStorage.setItem(KEYS.COURSES, JSON.stringify(initialCourses));
  localStorage.setItem(KEYS.PROFILE, JSON.stringify(defaultProfile));
  return {
    assignments: initialAssignments,
    courses: initialCourses,
    profile: defaultProfile
  };
};
