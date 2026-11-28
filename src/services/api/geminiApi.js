import { Result, ApiError, NetworkError } from '../../utils/result';
import { getToken } from '../../utils/storage';
import { httpClient } from '../../utils/httpClient';
import { parseLocalDateInput } from '../../utils/dateUtils';

const GEMINI_ENDPOINT = '/api/gemini';
const REQUEST_TIMEOUT_MS = 45000;

const trySilentRefresh = async () => {
  if (!httpClient?.silentRefreshCallback) return null;
  try {
    return await httpClient.refreshAccessToken();
  } catch {
    return null;
  }
};

const stripText = (value, maxLen = 180) =>
  String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);

const mapAttachmentsSnapshot = (rawList, maxItems = 6) => {
  if (!Array.isArray(rawList)) return [];
  return rawList
    .slice(0, maxItems)
    .map((att) => ({
      name: stripText(att?.name, 100),
      type: stripText(att?.size || att?.type, 40),
      link: stripText(att?.link || att?.url, 200),
    }))
    .filter((att) => att.name);
};

/**
 * Builds a bounded, sanitized snapshot of the student's current workspace
 * (pending assignments with attachment filenames, course materials/announcements,
 * courses, timetable, and saved exams) for `/api/gemini`.
 */
export const buildWorkspaceSnapshot = ({
  assignments = [],
  courses = [],
  resources = [],
  schedule = [],
  exams = [],
  profile = {},
  lang = 'th',
} = {}) => {
  const pendingAssignments = (Array.isArray(assignments) ? assignments : [])
    .filter((item) => item && item.status !== 'done' && item.status !== 'read')
    .sort((a, b) => {
      const dateA = parseLocalDateInput(a.dueDate, { endOfDayForDateOnly: true });
      const dateB = parseLocalDateInput(b.dueDate, { endOfDayForDateOnly: true });
      const timeA = dateA ? dateA.getTime() : NaN;
      const timeB = dateB ? dateB.getTime() : NaN;
      const validA = Number.isFinite(timeA);
      const validB = Number.isFinite(timeB);
      if (validA && validB) return timeA - timeB;
      if (validA) return -1;
      if (validB) return 1;
      return 0;
    })
    .slice(0, 30)
    .map((item) => ({
      title: stripText(item.title, 140),
      course: stripText(item.course, 100),
      courseCode: stripText(item.courseCode, 30),
      dueDate: stripText(item.dueDate, 40),
      status: stripText(item.status || 'todo', 20),
      points: Number.isFinite(Number(item.points)) ? Number(item.points) : null,
      description: stripText(item.description, 180),
      attachments: mapAttachmentsSnapshot(item.attachments, 6),
    }));

  const recentResources = (Array.isArray(resources) ? [...resources] : [])
    .sort((a, b) => {
      const timeA = a?.creationTime ? new Date(a.creationTime).getTime() : 0;
      const timeB = b?.creationTime ? new Date(b.creationTime).getTime() : 0;
      return (Number.isFinite(timeB) ? timeB : 0) - (Number.isFinite(timeA) ? timeA : 0);
    })
    .slice(0, 12)
    .map((item) => ({
      title: stripText(item?.title, 140),
      course: stripText(item?.course, 100),
      courseCode: stripText(item?.courseCode, 30),
      type: stripText(item?.type || 'material', 24),
      description: stripText(item?.description, 140),
      attachments: mapAttachmentsSnapshot(item?.attachments, 4),
    }));

  const activeSchedule = (Array.isArray(schedule) ? schedule : [])
    .filter((slot) => slot && !slot.deletedAt)
    .slice(0, 30)
    .map((slot) => ({
      title: stripText(slot.title, 120),
      courseCode: stripText(slot.courseCode, 30),
      day: stripText(slot.day, 20),
      startTime: stripText(slot.startTime, 16),
      endTime: stripText(slot.endTime, 16),
      room: stripText(slot.room, 40),
    }));

  const savedExams = (Array.isArray(exams) ? exams : [])
    .slice(0, 20)
    .map((exam) => ({
      courseCode: stripText(exam.courseCode || exam.subjectCode, 30),
      subjectName: stripText(exam.subjectName || exam.courseName, 120),
      date: stripText(exam.date, 40),
      time: stripText(exam.time, 40),
      room: stripText(exam.room, 40),
      seat: stripText(exam.seat, 40),
    }));

  const enrolledCourses = (Array.isArray(courses) ? courses : [])
    .slice(0, 25)
    .map((course) => ({
      name: stripText(course.name, 120),
      code: stripText(course.code, 30),
    }));

  let currentLocalTime;
  try {
    currentLocalTime = new Date().toLocaleString(lang === 'en' ? 'en-US' : 'th-TH', {
      dateStyle: 'full',
      timeStyle: 'short',
    });
  } catch {
    currentLocalTime = new Date().toISOString();
  }

  return {
    lang: lang === 'en' ? 'en' : 'th',
    studentName: stripText(profile?.name, 80),
    currentLocalTime,
    assignments: pendingAssignments,
    resources: recentResources,
    schedule: activeSchedule,
    exams: savedExams,
    courses: enrolledCourses,
  };
};

const createCodedApiError = (message, status, code = '') => {
  const err = new ApiError(message, status);
  if (code) err.code = code;
  return err;
};

/**
 * Sends a chat message (with optional image/PDF attachments) to `/api/gemini`.
 * Attaches the user's Google OAuth Bearer token and refreshes once on 401.
 *
 * @param {Object} params
 * @param {string} [params.message]
 * @param {Array<{name: string, mimeType: string, data: string}>} [params.files]
 * @param {string|null} [params.previousInteractionId]
 * @param {Object} [params.context]
 * @param {AbortSignal} [params.signal]
 */
export const sendGeminiMessage = async ({
  message = '',
  files = [],
  previousInteractionId = null,
  context = {},
  signal,
} = {}) => {
  const cleanMessage = String(message || '').trim();
  const safeFiles = Array.isArray(files)
    ? files
        .filter((f) => f && f.mimeType && f.data)
        .map((f) => ({
          name: String(f.name || 'attachment').slice(0, 120),
          mimeType: String(f.mimeType),
          data: String(f.data),
        }))
    : [];

  if (!cleanMessage && safeFiles.length === 0) {
    return Result.fail(createCodedApiError('Message or file attachment is required.', 400, 'EMPTY_MESSAGE'));
  }

  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  const onExternalAbort = () => controller.abort(signal?.reason);
  if (signal) {
    if (signal.aborted) {
      clearTimeout(timeoutId);
      const cancelErr = new Error('Aborted');
      cancelErr.name = 'AbortError';
      return Result.fail(cancelErr);
    }
    signal.addEventListener('abort', onExternalAbort, { once: true });
  }

  try {
    const payload = JSON.stringify({
      message: cleanMessage,
      ...(safeFiles.length > 0 ? { files: safeFiles } : {}),
      ...(previousInteractionId ? { previousInteractionId } : {}),
      context,
    });

    const performFetch = (authToken) => {
      const headers = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      };
      return fetch(GEMINI_ENDPOINT, {
        method: 'POST',
        headers,
        body: payload,
        signal: controller.signal,
      });
    };

    let token = getToken();
    if (!token && httpClient?.silentRefreshCallback) {
      token = await trySilentRefresh();
    }

    if (controller.signal.aborted) {
      if (timedOut) {
        return Result.fail(new NetworkError('AI assistant request timed out. Please try again.'));
      }
      const cancelErr = new Error('Aborted');
      cancelErr.name = 'AbortError';
      return Result.fail(cancelErr);
    }

    let response = await performFetch(token);
    if (response.status === 401 && httpClient?.silentRefreshCallback) {
      const refreshedToken = await trySilentRefresh();
      if (refreshedToken && !controller.signal.aborted) {
        response = await performFetch(refreshedToken);
      }
    }

    const rawText = await response.text();
    if (rawText && rawText.includes('<div id="root">')) {
      return Result.fail(createCodedApiError('Gemini API endpoint returned HTML shell instead of JSON.', 502, 'INVALID_UPSTREAM'));
    }

    let body = null;
    try {
      body = rawText ? JSON.parse(rawText) : null;
    } catch {
      body = null;
    }

    if (!response.ok) {
      const serverMsg = body?.error || `Server returned status ${response.status}`;
      const serverCode = body?.code || (response.status === 401 ? 'UNAUTHORIZED' : '');
      return Result.fail(createCodedApiError(serverMsg, response.status, serverCode));
    }

    if (!body?.reply) {
      return Result.fail(createCodedApiError('Empty response from Study Assistant.', 502, 'EMPTY_REPLY'));
    }

    return Result.ok({
      reply: String(body.reply),
      interactionId: body.interactionId || null,
      model: body.model || null,
      remainingDaily: typeof body.remainingDaily === 'number' ? body.remainingDaily : null,
    });
  } catch (error) {
    if (error?.name === 'AbortError' && !timedOut) {
      return Result.fail(error);
    }
    if (timedOut) {
      return Result.fail(new NetworkError('Study Assistant timed out. Please try a shorter question.'));
    }
    return Result.fail(new NetworkError('Could not connect to Study Assistant. Please check your connection.'));
  } finally {
    clearTimeout(timeoutId);
    if (signal) {
      signal.removeEventListener('abort', onExternalAbort);
    }
  }
};
