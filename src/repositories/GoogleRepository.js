import { httpClient } from '../utils/httpClient';
import { GOOGLE_CONFIG } from '../config/google';
import { logger } from '../utils/logger';

export const GoogleRepository = {
  /**
   * Fetch user info profile
   */
  async fetchUserProfile(accessToken) {
    const url = `${GOOGLE_CONFIG.userinfoBaseUrl}/userinfo`;
    const headers = { 'Authorization': `Bearer ${accessToken}` };
    return await httpClient.request(url, { headers });
  },

  /**
   * Fetch active enrolled courses
   */
  async fetchCourses(accessToken) {
    const url = `${GOOGLE_CONFIG.classroomBaseUrl}/courses?studentId=me`;
    const headers = { 'Authorization': `Bearer ${accessToken}` };
    const data = await httpClient.request(url, { headers });
    return data.courses || [];
  },

  /**
   * Fetch coursework (assignments) for a specific course
   */
  async fetchCoursework(accessToken, courseId) {
    const url = `${GOOGLE_CONFIG.classroomBaseUrl}/courses/${courseId}/courseWork`;
    const headers = { 'Authorization': `Bearer ${accessToken}` };
    const data = await httpClient.request(url, { headers }).catch(err => {
      logger.error(`Failed to fetch coursework for course ${courseId}:`, err);
      return { courseWork: [] };
    });
    return data.courseWork || [];
  },

  /**
   * Fetch student submissions for a specific course
   */
  async fetchSubmissions(accessToken, courseId) {
    const url = `${GOOGLE_CONFIG.classroomBaseUrl}/courses/${courseId}/courseWork/-/studentSubmissions?userId=me`;
    const headers = { 'Authorization': `Bearer ${accessToken}` };
    const data = await httpClient.request(url, { headers }).catch(err => {
      logger.error(`Failed to fetch student submissions for course ${courseId}:`, err);
      return { studentSubmissions: [] };
    });
    return data.studentSubmissions || [];
  },

  /**
   * Fetch announcements for a specific course
   */
  async fetchAnnouncements(accessToken, courseId) {
    const url = `${GOOGLE_CONFIG.classroomBaseUrl}/courses/${courseId}/announcements`;
    const headers = { 'Authorization': `Bearer ${accessToken}` };
    const data = await httpClient.request(url, { headers }).catch(err => {
      logger.error(`Failed to fetch announcements for course ${courseId}:`, err);
      return { announcements: [] };
    });
    return data.announcements || [];
  },

  /**
   * Fetch course work materials for a specific course
   */
  async fetchMaterials(accessToken, courseId) {
    const url = `${GOOGLE_CONFIG.classroomBaseUrl}/courses/${courseId}/courseWorkMaterials`;
    const headers = { 'Authorization': `Bearer ${accessToken}` };
    const data = await httpClient.request(url, { headers }).catch(err => {
      logger.error(`Failed to fetch coursework materials for course ${courseId}:`, err);
      return { courseWorkMaterial: [] };
    });
    return data.courseWorkMaterial || [];
  },

  /**
   * Send Gmail Notification (RFC 822 MIME message format)
   */
  async sendEmail(accessToken, toEmail, subject, htmlBody) {
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
    const base64UrlEmail = btoa(unescape(encodeURIComponent(rawEmail)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const url = GOOGLE_CONFIG.gmailBaseUrl;
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
