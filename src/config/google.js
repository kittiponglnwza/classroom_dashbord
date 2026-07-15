export const GOOGLE_CONFIG = {
  classroomBaseUrl: 'https://classroom.googleapis.com/v1',
  userinfoBaseUrl: 'https://www.googleapis.com/oauth2/v3',
  gmailBaseUrl: 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
  scopes: [
    'https://www.googleapis.com/auth/classroom.courses.readonly',
    'https://www.googleapis.com/auth/classroom.coursework.me.readonly',
    'https://www.googleapis.com/auth/classroom.coursework.students.readonly',
    'https://www.googleapis.com/auth/classroom.announcements.readonly',
    'https://www.googleapis.com/auth/classroom.courseworkmaterials.readonly',
    'https://www.googleapis.com/auth/classroom.topics.readonly',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/drive.appdata',
    'https://www.googleapis.com/auth/calendar.events',
    'openid',
    'email',
    'profile'
  ]
};