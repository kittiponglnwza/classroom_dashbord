import { NotificationService } from '../services/NotificationService';

export const getCalendarDaysDifference = (dueDateStr, today) => {
  return NotificationService.getCalendarDaysDifference(dueDateStr, today);
};

export function buildExamsHtml(toEmail, isWeeklyDigest = false) {
  return NotificationService.buildExamsHtml(toEmail, isWeeklyDigest);
}

export async function triggerTestEmail(accessToken, toEmail) {
  return await NotificationService.triggerTestEmail(accessToken, toEmail);
}

export async function triggerManualDigest(accessToken, toEmail, assignments) {
  return await NotificationService.triggerManualDigest(accessToken, toEmail, assignments);
}

export async function evaluateNotifications(accessToken, toEmail, assignments, courses, resources) {
  return await NotificationService.evaluateNotifications(accessToken, toEmail, assignments, courses, resources);
}

export async function evaluateNewPostDigest(accessToken, toEmail, freshAssignments, freshResources, cachedAssignmentIds, cachedResourceIds) {
  return await NotificationService.evaluateNewPostDigest(
    accessToken, toEmail, freshAssignments, freshResources, cachedAssignmentIds, cachedResourceIds
  );
}
