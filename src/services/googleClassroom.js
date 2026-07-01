const CLASSROOM_BASE_URL = 'https://classroom.googleapis.com/v1';
const USERINFO_BASE_URL = 'https://www.googleapis.com/oauth2/v3';

// Scopes required for the app (Minimized scopes)
export const CLIENT_SCOPES = [
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.me.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.students.readonly',
  'https://www.googleapis.com/auth/classroom.announcements.readonly',
  'https://www.googleapis.com/auth/classroom.courseworkmaterials.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/drive.appdata',
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

  // 2. Fetch assignments, submissions, announcements, and materials for each course in parallel
  const allAssignmentsPromises = activeCourses.map(async (course) => {
    try {
      const courseWorkUrl = `${CLASSROOM_BASE_URL}/courses/${course.id}/courseWork`;
      const submissionsUrl = `${CLASSROOM_BASE_URL}/courses/${course.id}/courseWork/-/studentSubmissions?userId=me`;
      const announcementsUrl = `${CLASSROOM_BASE_URL}/courses/${course.id}/announcements`;
      const materialsUrl = `${CLASSROOM_BASE_URL}/courses/${course.id}/courseWorkMaterials`;

      // Fetch all concurrently
      const [cwResponse, subResponse, annResponse, matResponse] = await Promise.all([
        fetchFromGoogle(courseWorkUrl, accessToken).catch((err) => {
          console.error(`Failed to fetch coursework for course ${course.name} (${course.id}):`, err);
          return { courseWork: [] };
        }),
        fetchFromGoogle(submissionsUrl, accessToken).catch((err) => {
          console.error(`Failed to fetch student submissions for course ${course.name} (${course.id}):`, err);
          return { studentSubmissions: [] };
        }),
        fetchFromGoogle(announcementsUrl, accessToken).catch((err) => {
          console.error(`Failed to fetch announcements for course ${course.name} (${course.id}):`, err);
          return { announcements: [] };
        }),
        fetchFromGoogle(materialsUrl, accessToken).catch((err) => {
          console.error(`Failed to fetch courseWorkMaterials for course ${course.name} (${course.id}):`, err);
          return { courseWorkMaterial: [] };
        })
      ]);

      const rawCourseWorks = cwResponse.courseWork || [];
      const rawSubmissions = subResponse.studentSubmissions || [];
      const rawAnnouncements = annResponse.announcements || [];
      const rawMaterials = matResponse.courseWorkMaterial || [];

      // Create a map of submissions keyed by courseWorkId
      const submissionMap = {};
      rawSubmissions.forEach(sub => {
        submissionMap[sub.courseWorkId] = sub;
      });

      // Helper to map materials/attachments to UI format and extract text links
      const mapAttachments = (materials = [], textDescription = '') => {
        const attachments = [];
        const seenLinks = new Set();

        materials.forEach(mat => {
          let name = '';
          let link = '';
          let size = '';

          if (mat.driveFile) {
            name = mat.driveFile.driveFile.title;
            link = mat.driveFile.driveFile.alternateLink;
            size = 'Google Drive File';
          } else if (mat.link) {
            name = mat.link.title || 'Attachment Link';
            link = mat.link.url;
            size = 'External Link';
          } else if (mat.youtubeVideo) {
            name = mat.youtubeVideo.title || 'YouTube Video';
            link = mat.youtubeVideo.alternateLink;
            size = 'Video';
          }

          if (link) {
            attachments.push({ name, link, size });
            seenLinks.add(link.toLowerCase().trim());
          }
        });

        if (textDescription) {
          const urlRegex = /(https?:\/\/[^\s\n\r]+)/g;
          const matches = textDescription.match(urlRegex) || [];
          matches.forEach(url => {
            const cleanUrl = url.replace(/[.,;)]+$/, ''); // Clean trailing punctuation
            const lowerUrl = cleanUrl.toLowerCase().trim();
            if (!seenLinks.has(lowerUrl)) {
              let name = 'External Document Link';
              let size = 'External Link';
              
              if (lowerUrl.includes('drive.google.com')) {
                name = 'Google Drive Document';
                size = 'Google Drive File';
              } else if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) {
                name = 'YouTube Video';
                size = 'Video';
              }
              
              attachments.push({ name, link: cleanUrl, size });
              seenLinks.add(lowerUrl);
            }
          });
        }

        return attachments;
      };

      const courseDetails = courseMap[course.id] || { name: course.name, color: 'blue', code: 'CLASSROOM' };

      // Map to UI Assignment format
      const mappedAssignments = rawCourseWorks.map(cw => {
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

        return {
          id: cw.id,
          title: cw.title,
          course: courseDetails.name,
          courseCode: courseDetails.code,
          dueDate: formattedDueDate,
          status: apiStatus,
          points: cw.maxPoints || 100,
          description: cw.description || '',
          attachments: mapAttachments(cw.materials, cw.description),
          courseColor: courseDetails.color,
          courseId: course.id,
          googleLink: cw.alternateLink // Link directly to Google Classroom coursework
        };
      });

      // Map to UI Announcements format
      const mappedAnnouncements = rawAnnouncements.map(ann => {
        const text = ann.text || '';
        const firstLine = text.split('\n')[0].trim();
        const title = firstLine.substring(0, 80) + (firstLine.length > 80 ? '...' : '') || 'Announcement';

        return {
          id: ann.id,
          courseId: course.id,
          course: courseDetails.name,
          courseCode: courseDetails.code,
          courseColor: courseDetails.color,
          type: 'announcement',
          title: title,
          description: text,
          creationTime: ann.creationTime || new Date().toISOString(),
          attachments: mapAttachments(ann.materials, text),
          googleLink: ann.alternateLink
        };
      });

      // Map to UI Materials format
      const mappedMaterials = rawMaterials.map(mat => {
        return {
          id: mat.id,
          courseId: course.id,
          course: courseDetails.name,
          courseCode: courseDetails.code,
          courseColor: courseDetails.color,
          type: 'material',
          title: mat.title || 'Course Material',
          description: mat.description || '',
          creationTime: mat.creationTime || new Date().toISOString(),
          attachments: mapAttachments(mat.materials, mat.description),
          googleLink: mat.alternateLink
        };
      });

      return {
        assignments: mappedAssignments,
        resources: [...mappedAnnouncements, ...mappedMaterials]
      };

    } catch (e) {
      console.error(`Failed to fetch coursework/resources for course ${course.name}`, e);
      return { assignments: [], resources: [] };
    }
  });

  const results = await Promise.all(allAssignmentsPromises);
  const flattenedAssignments = results.map(r => r.assignments || []).flat();
  const flattenedResources = results.map(r => r.resources || []).flat();

  return {
    courses: mappedCourses,
    assignments: flattenedAssignments,
    resources: flattenedResources
  };
}

/**
 * Send Gmail Notification via Google REST API
 * Constructs RFC 822 MIME message and base64url encodes it
 */
export async function sendGmailNotification(accessToken, toEmail, subject, htmlBody) {
  // 1. Construct MIME RFC 822 raw message
  // UTF-8 friendly Base64 subject encoding
  const utf8Subject = `=?utf-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
  const emailLines = [
    `To: ${toEmail}`,
    `Subject: ${utf8Subject}`,
    'Content-Type: text/html; charset=utf-8',
    'MIME-Version: 1.0',
    '',
    htmlBody
  ];
  
  const rawEmail = emailLines.join('\r\n');
  
  // 2. Base64Url encode the raw email content
  const base64UrlEmail = btoa(unescape(encodeURIComponent(rawEmail)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  // 3. POST request to Gmail API send endpoint
  const url = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      raw: base64UrlEmail
    })
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('UNAUTHORIZED');
    }
    const errText = await response.text();
    throw new Error(`Gmail API Error (${response.status}): ${errText}`);
  }

  return response.json();
}
