import { GoogleRepository } from '../repositories/GoogleRepository';
import { AuthError, ValidationError } from '../utils/errors';
import { sanitizeExternalUrl } from '../utils/sanitize';
import { logger } from '../utils/logger';

const isHostMatch = (url, allowedHosts) => {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return allowedHosts.some((host) => hostname === host || hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
};

export class ClassroomService {
  /**
   * Fetch and format user profile
   * @param {string} accessToken
   * @param {{signal?: AbortSignal}} [options]
   * @returns {Promise<{name: string, studentId: string, email: string, major: string, avatarUrl: string}>}
   */
  static async fetchProfile(accessToken, options = {}) {
    const data = await GoogleRepository.fetchUserProfile(accessToken, options);
    if (!data || !data.email) {
      throw new ValidationError('Google profile response did not contain a valid email address.');
    }
    return {
      name: data.name || 'Google User',
      studentId: '',
      email: String(data.email).trim().toLowerCase(),
      major: '',
      avatarUrl: sanitizeExternalUrl(data.picture) || ''
    };
  }

  /**
   * Helper to map materials and links to attachments list
   * @param {any[]} [materials=[]]
   * @param {string} [textDescription='']
   * @returns {{name: string, link: string, size: string}[]}
   */
  static mapAttachments(materials = [], textDescription = '') {
    const attachments = [];
    const seenLinks = new Set();

    (Array.isArray(materials) ? materials : []).forEach(mat => {
      if (!mat) return;
      let name = '';
      let rawLink = '';
      let size = '';

      if (mat.driveFile?.driveFile) {
        name = mat.driveFile.driveFile.title || 'Google Drive File';
        rawLink = mat.driveFile.driveFile.alternateLink;
        size = 'Google Drive File';
      } else if (mat.link) {
        name = mat.link.title || 'Attachment Link';
        rawLink = mat.link.url;
        size = 'External Link';
      } else if (mat.youtubeVideo) {
        name = mat.youtubeVideo.title || 'YouTube Video';
        rawLink = mat.youtubeVideo.alternateLink;
        size = 'Video';
      } else if (mat.form) {
        name = mat.form.title || 'Google Form';
        rawLink = mat.form.formUrl || mat.form.responseUrl;
        size = 'Google Form';
      }

      const safeLink = sanitizeExternalUrl(rawLink);
      if (safeLink && !seenLinks.has(safeLink.toLowerCase())) {
        attachments.push({ name, link: safeLink, size });
        seenLinks.add(safeLink.toLowerCase());
      }
    });

    if (textDescription && typeof textDescription === 'string') {
      const urlRegex = /(https?:\/\/[^\s\n\r]+)/g;
      const matches = textDescription.match(urlRegex) || [];
      matches.forEach(url => {
        const cleanUrl = url.replace(/[.,;)]+$/, '');
        const safeUrl = sanitizeExternalUrl(cleanUrl);
        if (!safeUrl) return;
        const lowerUrl = safeUrl.toLowerCase();
        if (!seenLinks.has(lowerUrl)) {
          let name = 'External Document Link';
          let size = 'External Link';
          
          if (isHostMatch(safeUrl, ['drive.google.com', 'docs.google.com'])) {
            name = 'Google Drive Document';
            size = 'Google Drive File';
          } else if (isHostMatch(safeUrl, ['youtube.com', 'youtu.be'])) {
            name = 'YouTube Video';
            size = 'Video';
          }
          
          attachments.push({ name, link: safeUrl, size });
          seenLinks.add(lowerUrl);
        }
      });
    }

    return attachments;
  }

  /**
   * Fetch and consolidate Google Classroom courses, coursework, announcements, and materials.
   * Utilizes concurrency batching to prevent parallel connection storms.
   * @param {string} accessToken
   * @param {{signal?: AbortSignal, getToken?: (() => string|null)}} [options]
   * @returns {Promise<{courses: any[], assignments: any[], resources: any[], topics: any[], failedCourseIds?: string[]}>}
   */
  static async fetchClassroomData(accessToken, options = {}) {
    const reqOptions = {
      signal: options.signal,
      getToken: options.getToken
    };
    const currentToken = (typeof reqOptions.getToken === 'function' ? reqOptions.getToken() : null) || accessToken;
    const rawCourses = await GoogleRepository.fetchCourses(currentToken, reqOptions);
    
    // Filter active courses
    const activeCourses = rawCourses.filter(c => c.courseState === 'ACTIVE');
    const colorPalette = ['emerald', 'blue', 'amber', 'rose', 'purple'];
    
    const mappedCourses = activeCourses.map((c, index) => ({
      id: c.id,
      name: c.name || 'Untitled Course',
      code: c.section || 'CLASSROOM',
      instructor: c.descriptionHeading || c.room || 'Google Classroom',
      color: colorPalette[index % colorPalette.length]
    }));

    const courseMap = new Map(mappedCourses.map(c => [c.id, c]));

    // Batch courses processing (concurrency limit = 3 courses in parallel)
    const results = [];
    const failedFeeds = {
      coursework: new Set(),
      submissions: new Set(),
      announcements: new Set(),
      materials: new Set(),
      topics: new Set()
    };
    const concurrencyLimit = 3;

    for (let i = 0; i < activeCourses.length; i += concurrencyLimit) {
      if (reqOptions.signal?.aborted) {
        const abortErr = new Error('Classroom sync aborted');
        abortErr.name = 'AbortError';
        throw abortErr;
      }

      const chunk = activeCourses.slice(i, i + concurrencyLimit);
      const chunkToken = (typeof reqOptions.getToken === 'function' ? reqOptions.getToken() : null) || accessToken;
      
      const chunkPromises = chunk.map(async (course) => {
        try {
          const [cwRes, subRes, annRes, matRes, topicsRes] = await Promise.allSettled([
            GoogleRepository.fetchCoursework(chunkToken, course.id, reqOptions),
            GoogleRepository.fetchSubmissions(chunkToken, course.id, reqOptions),
            GoogleRepository.fetchAnnouncements(chunkToken, course.id, reqOptions),
            GoogleRepository.fetchMaterials(chunkToken, course.id, reqOptions),
            GoogleRepository.fetchTopics(chunkToken, course.id, reqOptions)
          ]);

          // Propagate auth/abort errors immediately instead of masking them
          for (const settled of [cwRes, subRes, annRes, matRes, topicsRes]) {
            if (settled.status === 'rejected') {
              const reason = settled.reason;
              if (reason?.name === 'AbortError' || reason instanceof AuthError || reason?.code === 401) {
                throw reason;
              }
            }
          }

          const rawCW = cwRes.status === 'fulfilled' ? cwRes.value : [];
          const rawSub = subRes.status === 'fulfilled' ? subRes.value : [];
          const rawAnn = annRes.status === 'fulfilled' ? annRes.value : [];
          const rawMat = matRes.status === 'fulfilled' ? matRes.value : [];
          const rawTopics = topicsRes.status === 'fulfilled' ? topicsRes.value : [];

          const courseworkFailed = cwRes.status === 'rejected';
          const submissionsFailed = subRes.status === 'rejected';
          const announcementsFailed = annRes.status === 'rejected';
          const materialsFailed = matRes.status === 'rejected';
          const topicsFailed = topicsRes.status === 'rejected';

          if (courseworkFailed) failedFeeds.coursework.add(course.id);
          if (submissionsFailed) failedFeeds.submissions.add(course.id);
          if (announcementsFailed) failedFeeds.announcements.add(course.id);
          if (materialsFailed) failedFeeds.materials.add(course.id);
          if (topicsFailed) failedFeeds.topics.add(course.id);

          const submissionMap = new Map(rawSub.map(sub => [sub.courseWorkId, sub]));
          const courseDetails = courseMap.get(course.id) || { name: course.name, color: 'blue', code: 'CLASSROOM' };

          // 1. Process Assignments
          const pad = (n) => String(n).padStart(2, '0');
          const mappedAssignments = rawCW.map(cw => {
            const submission = submissionMap.get(cw.id);
            let apiStatus = submissionsFailed ? null : 'todo';
            if (submission) {
              const state = submission.state; // TURNED_IN, RETURNED
              if (state === 'TURNED_IN' || state === 'RETURNED') {
                apiStatus = 'done';
              }
            }

            let formattedDueDate = '';
            if (cw.dueDate?.year && cw.dueDate?.month && cw.dueDate?.day) {
              if (cw.dueTime) {
                const utcMs = Date.UTC(
                  cw.dueDate.year,
                  cw.dueDate.month - 1,
                  cw.dueDate.day,
                  cw.dueTime.hours || 0,
                  cw.dueTime.minutes || 0,
                  cw.dueTime.seconds || 0
                );
                formattedDueDate = new Date(utcMs).toISOString();
              } else {
                // Google Classroom date-only due date (no dueTime) represents the local calendar day
                formattedDueDate = `${cw.dueDate.year}-${pad(cw.dueDate.month)}-${pad(cw.dueDate.day)}`;
              }
            }

            return {
              id: cw.id,
              title: cw.title || 'Untitled Assignment',
              course: courseDetails.name,
              courseCode: courseDetails.code,
              dueDate: formattedDueDate,
              status: apiStatus,
              points: typeof cw.maxPoints === 'number' ? cw.maxPoints : null,
              description: cw.description || '',
              attachments: this.mapAttachments(cw.materials, cw.description),
              courseColor: courseDetails.color,
              courseId: course.id,
              googleLink: sanitizeExternalUrl(cw.alternateLink),
              topicId: cw.topicId || null,
              creationTime: cw.creationTime || new Date().toISOString(),
              updateTime: cw.updateTime || new Date().toISOString(),
              updatedAt: cw.updateTime || cw.creationTime || new Date().toISOString()
            };
          });

          // 2. Process Announcements
          const mappedAnnouncements = rawAnn.map(ann => {
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
              attachments: this.mapAttachments(ann.materials, text),
              googleLink: sanitizeExternalUrl(ann.alternateLink)
            };
          });

          // 3. Process Course Materials
          const mappedMaterials = rawMat.map(mat => {
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
              attachments: this.mapAttachments(mat.materials, mat.description),
              googleLink: sanitizeExternalUrl(mat.alternateLink),
              topicId: mat.topicId || null
            };
          });

          const mappedTopics = rawTopics.map(t => ({
            id: t.topicId,
            courseId: course.id,
            name: t.name
          }));

          return {
            assignments: mappedAssignments,
            resources: [...mappedAnnouncements, ...mappedMaterials],
            topics: mappedTopics
          };

        } catch (e) {
          if (e?.name === 'AbortError' || e instanceof AuthError || e?.code === 401) {
            throw e;
          }
          logger.error(`Error processing course: ${course.name}`, e);
          failedFeeds.coursework.add(course.id);
          failedFeeds.submissions.add(course.id);
          failedFeeds.announcements.add(course.id);
          failedFeeds.materials.add(course.id);
          failedFeeds.topics.add(course.id);
          return { assignments: [], resources: [], topics: [] };
        }
      });

      const chunkResults = await Promise.all(chunkPromises);
      results.push(...chunkResults);
    }

    const assignments = results.map(r => r.assignments || []).flat();
    const resources = results.map(r => r.resources || []).flat();
    const topics = results.map(r => r.topics || []).flat();
    const failedCourseIds = Array.from(new Set([
      ...failedFeeds.coursework,
      ...failedFeeds.submissions,
      ...failedFeeds.announcements,
      ...failedFeeds.materials,
      ...failedFeeds.topics
    ]));

    return {
      courses: mappedCourses,
      assignments,
      resources,
      topics,
      failedCourseIds,
      failedFeeds: {
        coursework: Array.from(failedFeeds.coursework),
        submissions: Array.from(failedFeeds.submissions),
        announcements: Array.from(failedFeeds.announcements),
        materials: Array.from(failedFeeds.materials),
        topics: Array.from(failedFeeds.topics)
      }
    };
  }
}