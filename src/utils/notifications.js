import { NotificationService } from '../services/NotificationService';

export function buildExamsHtml(toEmail, isWeeklyDigest = false) {
  return NotificationService.buildExamsHtml(toEmail, isWeeklyDigest);
}

export async function triggerTestEmail(accessToken, toEmail) {
  return await NotificationService.triggerTestEmail(accessToken, toEmail);
}

export async function triggerManualDigest(accessToken, toEmail, assignments) {
  return await NotificationService.triggerManualDigest(accessToken, toEmail, assignments);
}

export async function triggerTestDiscord(toEmail, webhookUrlOverride = '') {
  return await NotificationService.triggerTestDiscord(toEmail, webhookUrlOverride);
}

export async function triggerManualDiscordDigest(toEmail, assignments, webhookUrlOverride = '') {
  return await NotificationService.triggerManualDiscordDigest(toEmail, assignments, webhookUrlOverride);
}

export async function evaluateNotifications(accessToken, toEmail, assignments, courses, resources, options = {}) {
  return await NotificationService.evaluateNotifications(accessToken, toEmail, assignments, courses, resources, options);
}

export async function evaluateNewPostDigest(accessToken, toEmail, freshAssignments, freshResources, cachedAssignmentIds, cachedResourceIds) {
  return await NotificationService.evaluateNewPostDigest(
    accessToken, toEmail, freshAssignments, freshResources, cachedAssignmentIds, cachedResourceIds
  );
}
