import { initialAssignments, initialCourses, defaultProfile } from '../data/mockData';

const KEYS = {
  ASSIGNMENTS: 'classroom_hub_assignments',
  COURSES: 'classroom_hub_courses',
  PROFILE: 'classroom_hub_profile',
  LAST_SYNC: 'classroom_hub_last_sync',
  ACCESS_TOKEN: 'classroom_hub_access_token'
};

/* Token Handling via Secure Session Storage (Tab lifetime, immune to persistent storage leaks) */
export const saveToken = (token) => {
  if (token) {
    sessionStorage.setItem(KEYS.ACCESS_TOKEN, token);
  }
};

export const getToken = () => {
  return sessionStorage.getItem(KEYS.ACCESS_TOKEN);
};

export const clearToken = () => {
  sessionStorage.removeItem(KEYS.ACCESS_TOKEN);
};

/* Caching Last Sync timestamps */
export const setLastSync = (time) => {
  localStorage.setItem(KEYS.LAST_SYNC, time);
};

export const getLastSync = () => {
  return localStorage.getItem(KEYS.LAST_SYNC);
};

/* Local Assignments fetching */
export const getAssignments = () => {
  const stored = localStorage.getItem(KEYS.ASSIGNMENTS);
  if (!stored) {
    // Default to mock assignments on first load
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

/* 
 * Sync Classroom data to local cache preserving local user overrides (Notes and custom states)
 */
export const syncClassroomAssignments = (apiAssignments) => {
  const localAssignments = getAssignments();
  
  const merged = apiAssignments.map(apiAssign => {
    // Find existing task by ID
    const localAssign = localAssignments.find(la => la.id === apiAssign.id);
    
    if (localAssign) {
      return {
        ...apiAssign,
        // Preserve user workspace notes
        notes: localAssign.notes || '',
        // If the task was completed on Google, it stays 'done'.
        // If it was marked completed/in-progress locally by the user, keep it.
        status: apiAssign.status === 'done' ? 'done' : (localAssign.status || apiAssign.status)
      };
    }
    return {
      ...apiAssign,
      notes: ''
    };
  });

  // Also preserve manually created local tasks (tasks with no courseId, i.e. created from "Create Task" button)
  const localManualTasks = localAssignments.filter(la => !la.courseId);
  const finalAssignments = [...localManualTasks, ...merged];

  saveAssignments(finalAssignments);
  return finalAssignments;
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

export const saveCourses = (courses) => {
  localStorage.setItem(KEYS.COURSES, JSON.stringify(courses));
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
  localStorage.removeItem(KEYS.LAST_SYNC);
  localStorage.removeItem('classroom_hub_hidden_courses');
  clearToken();
  return {
    assignments: initialAssignments,
    courses: initialCourses,
    profile: defaultProfile
  };
};

/* Hidden Courses for controlling visibility of finished semesters */
export const getHiddenCourses = () => {
  const stored = localStorage.getItem('classroom_hub_hidden_courses');
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch (e) {
    return [];
  }
};

export const saveHiddenCourses = (hiddenIds) => {
  localStorage.setItem('classroom_hub_hidden_courses', JSON.stringify(hiddenIds));
};
