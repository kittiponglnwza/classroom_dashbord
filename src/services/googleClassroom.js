const CLASSROOM_BASE_URL = 'https://classroom.googleapis.com/v1';
const USERINFO_BASE_URL = 'https://www.googleapis.com/oauth2/v3';

// Scopes required for the app (Minimized scopes)
export const CLIENT_SCOPES = [
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/classroom.course-work.readonly',
  'https://www.googleapis.com/auth/classroom.student-submissions.me.readonly',
  'openid',
  'email',
  'profile'
];

/**
 * Initialize Google OAuth 2.0 Token Client
 */
export const initGoogleClient = (onSuccess, onError) => {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  if (!clientId || clientId.includes('your-google-client-id-here')) {
    console.warn('VITE_GOOGLE_CLIENT_ID is not configured properly in .env');
    return null;
  }

  if (!window.google?.accounts?.oauth2) {
    console.error('Google Accounts OAuth2 SDK is not loaded. Make sure the script is in index.html');
    return null;
  }

  return window.google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: CLIENT_SCOPES.join(' '),
    callback: (tokenResponse) => {
      if (tokenResponse.error) {
        onError(tokenResponse);
      } else {
        onSuccess(tokenResponse);
      }
    },
  });
};

/**
 * Helper to fetch with Bearer token
 */
async function fetchFromGoogle(url, accessToken) {
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('UNAUTHORIZED');
    }
    const errText = await response.text();
    throw new Error(`Google API Error (${response.status}): ${errText}`);
  }

  return response.json();
}

/**
 * Fetch Student Profile details
 */
export async function fetchGoogleProfile(accessToken) {
  const data = await fetchFromGoogle(`${USERINFO_BASE_URL}/userinfo`, accessToken);
  return {
    name: data.name || 'Google User',
    studentId: 'Google Sync User', // Fallback identifier
    email: data.email,
    major: 'Connected Account',
    avatarUrl: data.picture || 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&q=80&w=200'
  };
}

/**
 * Fetch and consolidate Classroom Hub Courses and Assignments
 */
export async function fetchGoogleClassroomData(accessToken) {
  // 1. Fetch enrolled courses
  const coursesData = await fetchFromGoogle(`${CLASSROOM_BASE_URL}/courses?studentId=me`, accessToken);
  const rawCourses = coursesData.courses || [];

  // Filter only ACTIVE courses
  const activeCourses = rawCourses.filter(c => c.courseState === 'ACTIVE');

  // Mapped colors list for subjects
  const colorPalette = ['emerald', 'blue', 'amber', 'rose', 'purple'];
  
  const mappedCourses = activeCourses.map((c, index) => ({
    id: c.id,
    name: c.name,
    code: c.section || 'CLASSROOM',
    instructor: c.teacherFolder?.title || 'Course Instructor',
    color: colorPalette[index % colorPalette.length],
    bgBanner: `from-${colorPalette[index % colorPalette.length]}-950/40 to-${colorPalette[index % colorPalette.length]}-900/10`
  }));

  // Create course map for faster lookup
  const courseMap = {};
  mappedCourses.forEach(c => {
    courseMap[c.id] = c;
  });

  // 2. Fetch assignments (courseWork) and student submissions for each course in parallel
  const allAssignmentsPromises = activeCourses.map(async (course) => {
    try {
      const courseWorkUrl = `${CLASSROOM_BASE_URL}/courses/${course.id}/courseWork`;
      const submissionsUrl = `${CLASSROOM_BASE_URL}/courses/${course.id}/courseWork/-/studentSubmissions?userId=me`;

      // Fetch both coursework and submissions concurrently
      const [cwResponse, subResponse] = await Promise.all([
        fetchFromGoogle(courseWorkUrl, accessToken).catch(() => ({ courseWork: [] })),
        fetchFromGoogle(submissionsUrl, accessToken).catch(() => ({ studentSubmissions: [] }))
      ]);

      const rawCourseWorks = cwResponse.courseWork || [];
      const rawSubmissions = subResponse.studentSubmissions || [];

      // Create a map of submissions keyed by courseWorkId
      const submissionMap = {};
      rawSubmissions.forEach(sub => {
        submissionMap[sub.courseWorkId] = sub;
      });

      // Map to UI Assignment format
      return rawCourseWorks.map(cw => {
        const submission = submissionMap[cw.id];
        
        // Determine status based on Google submission state
        let apiStatus = 'todo';
        if (submission) {
          const state = submission.state; // TURNED_IN, RETURNED, NEW, CREATED, RECLAIMED_BY_STUDENT
          if (state === 'TURNED_IN' || state === 'RETURNED') {
            apiStatus = 'done';
          }
        }

        // Format due date to ISO string containing time (e.g. YYYY-MM-DDTHH:MM:SS)
        const pad = (n) => String(n).padStart(2, '0');
        let formattedDueDate = '';
        if (cw.dueDate) {
          formattedDueDate = `${cw.dueDate.year}-${pad(cw.dueDate.month)}-${pad(cw.dueDate.day)}`;
          if (cw.dueTime) {
            formattedDueDate += `T${pad(cw.dueTime.hours || 0)}:${pad(cw.dueTime.minutes || 0)}:00`;
          } else {
            formattedDueDate += 'T23:59:59';
          }
        }

        // Map coursework materials to attachments
        const materials = cw.materials || [];
        const attachments = [];
        materials.forEach(mat => {
          if (mat.driveFile) {
            attachments.push({ 
              name: mat.driveFile.driveFile.title, 
              link: mat.driveFile.driveFile.alternateLink, 
              size: 'Google Drive File' 
            });
          } else if (mat.link) {
            attachments.push({ 
              name: mat.link.title || 'Attachment Link', 
              link: mat.link.url, 
              size: 'External Link' 
            });
          } else if (mat.youtubeVideo) {
            attachments.push({ 
              name: mat.youtubeVideo.title || 'YouTube Video', 
              link: mat.youtubeVideo.alternateLink, 
              size: 'Video' 
            });
          }
        });

        const courseDetails = courseMap[course.id] || { name: course.name, color: 'blue' };

        return {
          id: cw.id,
          title: cw.title,
          course: courseDetails.name,
          courseCode: courseDetails.code,
          dueDate: formattedDueDate,
          status: apiStatus,
          points: cw.maxPoints || 100,
          description: cw.description || '',
          attachments: attachments,
          courseColor: courseDetails.color,
          courseId: course.id,
          googleLink: cw.alternateLink // Link directly to Google Classroom coursework
        };
      });

    } catch (e) {
      console.error(`Failed to fetch coursework for course ${course.name}`, e);
      return [];
    }
  });

  const assignmentsArray = await Promise.all(allAssignmentsPromises);
  const flattenedAssignments = assignmentsArray.flat();

  return {
    courses: mappedCourses,
    assignments: flattenedAssignments
  };
}
