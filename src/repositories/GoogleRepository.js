import { httpClient } from '../utils/httpClient';
import { GOOGLE_CONFIG } from '../config/google';
import { logger } from '../utils/logger';

const MAX_PAGES = 50;

export const GoogleRepository = {
  /**
   * Fetch all paginated pages for a Google API collection endpoint
   */
  async fetchAllPages(baseUrl, accessToken, itemsKey, options = {}) {
    const { signal, getToken } = options;
    const items = [];
    const seenTokens = new Set();
    let pageToken = '';

    for (let page = 0; page < MAX_PAGES; page++) {
      const separator = baseUrl.includes('?') ? '&' : '?';
      const url = pageToken
        ? `${baseUrl}${separator}pageToken=${encodeURIComponent(pageToken)}`
        : baseUrl;

      const token = (typeof getToken === 'function' ? getToken() : null) || accessToken;
      const headers = { 'Authorization': `Bearer ${token}` };
      const data = await httpClient.request(url, { headers, signal });

      if (data && Array.isArray(data[itemsKey])) {
        items.push(...data[itemsKey]);
      }

      const nextToken = data?.nextPageToken;
      if (!nextToken || seenTokens.has(nextToken)) {
        break;
      }
      seenTokens.add(nextToken);
      pageToken = nextToken;
    }

    return items;
  },

  /**
   * Fetch user info profile
   */
  async fetchUserProfile(accessToken, options = {}) {
    const url = `${GOOGLE_CONFIG.userinfoBaseUrl}/userinfo`;
    const headers = { 'Authorization': `Bearer ${accessToken}` };
    return await httpClient.request(url, { headers, signal: options.signal });
  },

  /**
   * Fetch active enrolled courses
   */
  async fetchCourses(accessToken, options = {}) {
    const url = `${GOOGLE_CONFIG.classroomBaseUrl}/courses?studentId=me&courseStates=ACTIVE`;
    return await this.fetchAllPages(url, accessToken, 'courses', options);
  },

  /**
   * Fetch coursework (assignments) for a specific course
   */
  async fetchCoursework(accessToken, courseId, options = {}) {
    const url = `${GOOGLE_CONFIG.classroomBaseUrl}/courses/${encodeURIComponent(courseId)}/courseWork`;
    return await this.fetchAllPages(url, accessToken, 'courseWork', options);
  },

  /**
   * Fetch student submissions for a specific course
   */
  async fetchSubmissions(accessToken, courseId, options = {}) {
    const url = `${GOOGLE_CONFIG.classroomBaseUrl}/courses/${encodeURIComponent(courseId)}/courseWork/-/studentSubmissions?userId=me`;
    return await this.fetchAllPages(url, accessToken, 'studentSubmissions', options);
  },

  /**
   * Fetch announcements for a specific course
   */
  async fetchAnnouncements(accessToken, courseId, options = {}) {
    const url = `${GOOGLE_CONFIG.classroomBaseUrl}/courses/${encodeURIComponent(courseId)}/announcements`;
    return await this.fetchAllPages(url, accessToken, 'announcements', options);
  },

  /**
   * Fetch course work materials for a specific course
   */
  async fetchMaterials(accessToken, courseId, options = {}) {
    const url = `${GOOGLE_CONFIG.classroomBaseUrl}/courses/${encodeURIComponent(courseId)}/courseWorkMaterials`;
    return await this.fetchAllPages(url, accessToken, 'courseWorkMaterial', options);
  },

  /**
   * Fetch topics for a specific course
   */
  async fetchTopics(accessToken, courseId, options = {}) {
    const url = `${GOOGLE_CONFIG.classroomBaseUrl}/courses/${encodeURIComponent(courseId)}/topics`;
    return await this.fetchAllPages(url, accessToken, 'topic', options);
  },

  /**
   * Send Gmail Notification (RFC 822 MIME message format)
   */
  async sendEmail(accessToken, toEmail, subject, htmlBody) {
    const safeToEmail = String(toEmail || '').replace(/[\r\n]+/g, '').trim();
    const cleanSubject = String(subject || '').replace(/[\r\n]+/g, ' ').trim();
    const utf8Subject = `=?utf-8?B?${btoa(unescape(encodeURIComponent(cleanSubject)))}?=`;
    const emailLines = [
      `To: ${safeToEmail}`,
      `Subject: ${utf8Subject}`,
      'Content-Type: text/html; charset=utf-8',
      'MIME-Version: 1.0',
      '',
      htmlBody
    ];
    
    const rawEmail = emailLines.join('\r\n');
    const base64UrlEmail = btoa(unescape(encodeURIComponent(rawEmail)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const url = GOOGLE_CONFIG.gmailBaseUrl;
    logger.debug(`Sending email notification to ${toEmail}`);
    return await httpClient.request(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        raw: base64UrlEmail
      })
    });
  }
};
