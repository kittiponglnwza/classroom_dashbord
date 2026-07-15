import { GoogleRepository } from '../repositories/GoogleRepository';
import { logger } from '../utils/logger';

export class ClassroomService {
  /**
   * Fetch and format user profile
   */
  static async fetchProfile(accessToken) {
    const data = await GoogleRepository.fetchUserProfile(accessToken);
    return {
      name: data.name || 'Google User',
      studentId: 'Google Sync User',
      email: data.email,
      major: 'Connected Account',
      avatarUrl: data.picture || 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&q=80&w=200'
    };
  }

  /**
   * Helper to map materials and links to attachments list
   */
  static mapAttachments(materials = [], textDescription = '') {
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
        const cleanUrl = url.replace(/[.,;)]+$/, '');
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
  }

  /**
   * Fetch and consolidate Google Classroom courses, coursework, announcements, and materials.
   * Utilizes concurrency batching to prevent parallel connection storms.
   */
  static async fetchClassroomData(accessToken) {
    const rawCourses = await GoogleRepository.fetchCourses(accessToken);
    
    // Filter active courses
    const activeCourses = rawCourses.filter(c => c.courseState === 'ACTIVE');
    const colorPalette = ['emerald', 'blue', 'amber', 'rose', 'purple'];
    
    const mappedCourses = activeCourses.map((c, index) => ({
      id: c.id,
      name: c.name,
      code: c.section || 'CLASSROOM',
      instructor: c.teacherFolder?.title || 'Course Instructor',
      color: colorPalette[index % colorPalette.length],
      bgBanner: `from-${colorPalette[index % colorPalette.length]}-950/40 to-${colorPalette[index % colorPalette.length]}-900/10`
    }));

    const courseMap = new Map(mappedCourses.map(c => [c.id, c]));

    // Batch courses processing (concurrency limit = 3 courses in parallel)
    const results = [];
    const concurrencyLimit = 3;

    for (let i = 0; i < activeCourses.length; i += concurrencyLimit) {
      const chunk = activeCourses.slice(i, i + concurrencyLimit);
      
      const chunkPromises = chunk.map(async (course) => {
        try {
          // Fetch course resources concurrently for this specific course
          const [rawCW, rawSub, rawAnn, rawMat, rawTopics] = await Promise.all([
            GoogleRepository.fetchCoursework(accessToken, course.id),
            GoogleRepository.fetchSubmissions(accessToken, course.id),
            GoogleRepository.fetchAnnouncements(accessToken, course.id),
            GoogleRepository.fetchMaterials(accessToken, course.id),
            GoogleRepository.fetchTopics(accessToken, course.id)
          ]);

          const submissionMap = new Map(rawSub.map(sub => [sub.courseWorkId, sub]));
          const courseDetails = courseMap.get(course.id) || { name: course.name, color: 'blue', code: 'CLASSROOM' };

          // 1. Process Assignments
          const pad = (n) => String(n).padStart(2, '0');
          const mappedAssignments = rawCW.map(cw => {
            const submission = submissionMap.get(cw.id);
            let apiStatus = 'todo';
            if (submission) {
              const state = submission.state; // TURNED_IN, RETURNED
              if (state === 'TURNED_IN' || state === 'RETURNED') {
                apiStatus = 'done';
              }
            }

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
              attachments: this.mapAttachments(cw.materials, cw.description),
              courseColor: courseDetails.color,
              courseId: course.id,
              googleLink: cw.alternateLink,
              topicId: cw.topicId || null,
              updatedAt: new Date().toISOString()
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
              googleLink: ann.alternateLink
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
              googleLink: mat.alternateLink,
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
          logger.error(`Error processing course: ${course.name}`, e);
          return { assignments: [], resources: [], topics: [] };
        }
      });

      const chunkResults = await Promise.all(chunkPromises);
      results.push(...chunkResults);
    }

    const assignments = results.map(r => r.assignments || []).flat();
    const resources = results.map(r => r.resources || []).flat();
    const topics = results.map(r => r.topics || []).flat();

    return {
      courses: mappedCourses,
      assignments,
      resources,
      topics
    };
  }
}