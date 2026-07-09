import { initGoogleClient as initClientHelper } from './googleClassroomClient';
import { ClassroomService } from './ClassroomService';
import { GoogleRepository } from '../repositories/GoogleRepository';
import { GOOGLE_CONFIG } from '../config/google';

export const CLIENT_SCOPES = GOOGLE_CONFIG.scopes;

/**
 * Initialize Google OAuth 2.0 Token Client (delegated to sub-helper client init)
 */
export const initGoogleClient = (onSuccess, onError) => {
  return initClientHelper(onSuccess, onError);
};

/**
 * Fetch Student Profile details (delegated to service)
 */
export async function fetchGoogleProfile(accessToken) {
  return await ClassroomService.fetchProfile(accessToken);
}

/**
 * Fetch and consolidate Classroom Hub Courses and Assignments (delegated to service)
 */
export async function fetchGoogleClassroomData(accessToken) {
  return await ClassroomService.fetchClassroomData(accessToken);
}

/**
 * Send Gmail Notification via Google REST API (delegated to repository)
 */
export async function sendGmailNotification(accessToken, toEmail, subject, htmlBody) {
  return await GoogleRepository.sendEmail(accessToken, toEmail, subject, htmlBody);
}
