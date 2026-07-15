export const STORAGE_CONFIG = {
  schemaVersion: 2,
  keys: {
    assignments: 'classroom_hub_assignments',
    courses: 'classroom_hub_courses',
    profile: 'classroom_hub_profile',
    lastSync: 'classroom_hub_last_sync',
    accessToken: 'classroom_hub_access_token',
    resources: 'classroom_hub_resources',
    hiddenCourses: 'classroom_hub_hidden_courses',
    activeEmail: 'classroom_hub_active_email',
    schedule: 'classroom_hub_schedule',
    exams: 'classroom_hub_exam_results',
    topics: 'classroom_hub_topics'
  },
  
  // Cache TTLs in milliseconds
  ttls: {
    assignments: 5 * 60 * 1000,      // 5 minutes
    courses: 30 * 60 * 1000,         // 30 minutes
    resources: 10 * 60 * 1000,       // 10 minutes (Announcements/Materials)
    exams: 10 * 60 * 1000,           // 10 minutes
    profile: 60 * 60 * 1000          // 60 minutes
  }
};
