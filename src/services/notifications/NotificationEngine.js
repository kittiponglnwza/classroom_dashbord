import { DAYS, JS_DAY_MAP } from '../../constants/dateConstants';
import {
  classifyExamKind,
  isEntryPausedOnDate,
  isScheduleEntryActiveOnDate,
  resolveExamIsoDate
} from '../../utils/courseEndDate';
import { getMergedExams, normalizeExamCode } from '../../utils/examMerger';
import { matchSchedulesAndExams } from '../../utils/scheduleMatcher';
import { DiscordMessageBuilder } from './DiscordMessageBuilder';
import { buildEventIdentity } from './NotificationLedger';
import { isPriorityAllowed, PRIORITY, resolveNotificationPriority } from './notificationSchema';
import {
  DEFAULT_TIMEZONE,
  diffIsoCalendarDays,
  evaluateDueTiming,
  getZonedDateParts,
  getZonedSundayDateStr,
  hasTimePassedToday,
  isWithinQuietHours,
  normalizeClockStr,
  normalizeTimezone,
  parseClockMinutes,
  shiftIsoDate,
  zonedWallTimeToUtcMs
} from './timeUtils';

const OVERDUE_MAX_LOOKBACK_DAYS = 30;
const NEW_ACTIVITY_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
const RECENT_ANNOUNCEMENT_BRIEFING_MS = 24 * 60 * 60 * 1000;
const WEEKLY_ACTIVITY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

const DAY_LABELS_EN = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun'
};

const isTaskCompleted = (task) => {
  if (!task) return true;
  const status = String(task.status || '').toLowerCase();
  const sub = String(task.submissionState || '').toUpperCase();
  return status === 'done' || status === 'read' || sub === 'TURNED_IN' || sub === 'RETURNED';
};

/**
 * Produces a canonical exam identifier across KMUTNB SciBase, Reg, and Manual exam sources
 * so source upgrades (Reg -> SciBase official seating) preserve continuity instead of double-alerting.
 */
export function resolveCanonicalExamKey(exam) {
  const normCode = normalizeExamCode(exam);
  const kind = classifyExamKind(exam);
  if (normCode && (kind === 'midterm' || kind === 'final')) {
    return `${normCode}_${kind}`;
  }
  if (normCode) {
    const iso = resolveExamIsoDate(exam);
    return iso ? `${normCode}_${iso}` : normCode;
  }
  const cleanTitle = String(exam?.subjectName || exam?.courseName || exam?.id || 'exam')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u0E00-\u0E7F]+/g, '_')
    .slice(0, 40);
  return `custom_${cleanTitle || 'exam'}`;
}

export function buildExamSlotFingerprint(exam) {
  const iso = resolveExamIsoDate(exam) || String(exam?.date || '').trim();
  const time = String(exam?.time || '').trim().toLowerCase();
  const room = String(exam?.room || '').trim().toLowerCase();
  return `${iso}|${time}|${room}`;
}

/**
 * Computes active schedule classes & exam overrides on a specific YYYY-MM-DD date,
 * honoring deletedAt, courseEndDate (1 week before Finals), Midterm pause weeks, and exam conflicts.
 */
export function resolveScheduleForIsoDate(schedule = [], mergedExams = [], targetIsoDate = '') {
  if (!targetIsoDate || !/^\d{4}-\d{2}-\d{2}$/.test(targetIsoDate)) {
    return { classes: [], midtermPausedCount: 0 };
  }

  const [y, m, d] = targetIsoDate.split('-').map(Number);
  const weekdayIdx = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const dayKey = JS_DAY_MAP[weekdayIdx];

  const safeSchedule = Array.isArray(schedule) ? schedule : [];
  const safeExams = Array.isArray(mergedExams) ? mergedExams : [];

  let midtermPausedCount = 0;
  for (const entry of safeSchedule) {
    if (!entry || entry.day !== dayKey) continue;
    if (entry.deletedAt && targetIsoDate >= entry.deletedAt) continue;
    if (isEntryPausedOnDate(entry, targetIsoDate, safeExams)) {
      midtermPausedCount++;
    }
  }

  const regularActive = safeSchedule.filter((entry) => {
    if (!entry || entry.day !== dayKey) return false;
    return isScheduleEntryActiveOnDate(entry, targetIsoDate, safeExams);
  });

  const examEntriesOnDate = safeExams
    .map((ex) => {
      const exIso = resolveExamIsoDate(ex);
      if (exIso !== targetIsoDate) return null;

      let startTime = '09:00';
      let endTime = '12:00';
      if (typeof ex.time === 'string' && ex.time.trim()) {
        const parts = ex.time.split(/[-–]/).map((s) => normalizeClockStr(s, null));
        if (parts.length === 2 && parts[0] && parts[1]) {
          startTime = parts[0];
          endTime = parts[1];
        }
      }

      return {
        id: `exam-${ex.id || resolveCanonicalExamKey(ex)}`,
        title: ex.subjectName || ex.courseName || 'Examination',
        courseCode: ex.subjectCode || ex.courseCode || '',
        day: dayKey,
        date: targetIsoDate,
        startTime,
        endTime,
        room: [ex.room, ex.seat ? `(${ex.seat})` : ''].filter(Boolean).join(' '),
        isExam: true
      };
    })
    .filter(Boolean);

  const mergedClasses = matchSchedulesAndExams(regularActive, examEntriesOnDate);
  return {
    classes: mergedClasses,
    midtermPausedCount
  };
}

/**
 * Builds the next state snapshot of assignments and merged exams for future change/deletion detection.
 */
export function buildAcademicSnapshot({
  assignments = [],
  mergedExams = [],
  hiddenCourseIds = [],
  timeZone = DEFAULT_TIMEZONE,
  prevSnapshot = null,
  failedCourseIds = [],
  preserveSciBaseSnapshot = false
} = {}) {
  const safeTz = normalizeTimezone(timeZone);
  const hiddenSet = new Set((hiddenCourseIds || []).map(String));
  const failedSet = new Set((failedCourseIds || []).map(String));
  const nextAssignments = {};

  // Preserve previous snapshot entries for courses whose Classroom API feed temporarily failed
  if (prevSnapshot?.assignments && failedSet.size > 0) {
    Object.entries(prevSnapshot.assignments).forEach(([id, prevTask]) => {
      if (prevTask?.courseId && failedSet.has(String(prevTask.courseId))) {
        nextAssignments[id] = prevTask;
      }
    });
  }

  for (const task of Array.isArray(assignments) ? assignments : []) {
    if (!task?.id) continue;
    if (task.courseId && hiddenSet.has(String(task.courseId))) continue;
    const timing = task.dueDate ? evaluateDueTiming(task.dueDate, new Date(), safeTz) : null;
    nextAssignments[String(task.id)] = {
      id: String(task.id),
      courseId: task.courseId ? String(task.courseId) : '',
      course: task.course || '',
      courseCode: task.courseCode || '',
      title: task.title || '',
      dueDate: task.dueDate || '',
      dueFingerprint: timing ? timing.fingerprint : '',
      status: isTaskCompleted(task) ? 'done' : (task.status || 'todo'),
      isCustom: Boolean(task.isCustom),
      googleLink: task.googleLink || ''
    };
  }

  const nextExams = {};
  // Preserve SciBase exam baseline across transient 10-minute SciBase cache TTL flushes
  if (preserveSciBaseSnapshot && prevSnapshot?.exams) {
    Object.entries(prevSnapshot.exams).forEach(([k, prevExam]) => {
      if (prevExam?.source === 'scibase') {
        nextExams[k] = prevExam;
      }
    });
  }
  for (const exam of Array.isArray(mergedExams) ? mergedExams : []) {
    if (!exam) continue;
    const canonicalKey = resolveCanonicalExamKey(exam);
    const iso = resolveExamIsoDate(exam);
    nextExams[canonicalKey] = {
      canonicalKey,
      id: String(exam.id || canonicalKey),
      courseCode: exam.courseCode || exam.subjectCode || '',
      courseName: exam.courseName || exam.subjectName || '',
      date: exam.date || iso || '',
      dateIso: iso || '',
      time: exam.time || '',
      room: exam.room || '',
      seat: exam.seat || '',
      source: exam.source || (exam.isManual ? 'manual' : 'scibase'),
      slotFingerprint: buildExamSlotFingerprint(exam)
    };
  }

  return {
    version: 1,
    initializedAt: prevSnapshot?.initializedAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    assignments: nextAssignments,
    exams: nextExams
  };
}

/**
 * Checks priority threshold & quiet hours for a candidate notification event.
 */
export function checkDeliveryGate(priority, alertSettings, now = new Date()) {
  const timeZone = normalizeTimezone(alertSettings?.timezone);
  if (!isPriorityAllowed(priority, alertSettings?.minPriority || PRIORITY.P3_DIGEST)) {
    return { allowed: false, reason: 'below_min_priority' };
  }

  if (isWithinQuietHours(now, alertSettings, timeZone)) {
    if (priority === PRIORITY.P0_CRITICAL && alertSettings?.quietHoursAllowCritical !== false) {
      return { allowed: true, reason: 'critical_bypass_quiet_hours' };
    }
    return { allowed: false, reason: 'quiet_hours_deferred' };
  }

  return { allowed: true, reason: 'allowed' };
}

/**
 * Evaluates Assignment Deadline Reminders (7d / 3d / 1d / Due Today / Overdue catch-up)
 * + Lifecycle Deltas (Deadline Changes, Deleted Assignments, Submission Status).
 */
export function evaluateAssignmentCandidates({
  assignments = [],
  hiddenCourseIds = [],
  deletedTaskIds = [],
  alertSettings = {},
  prevSnapshot = null,
  failedCourseIds = [],
  authoritativeSync = false,
  now = new Date()
} = {}) {
  const timeZone = normalizeTimezone(alertSettings.timezone);
  const hiddenSet = new Set((hiddenCourseIds || []).map(String));
  const failedSet = new Set((failedCourseIds || []).map(String));
  const deletedSet = new Set((deletedTaskIds || []).map(String));
  const candidates = [];

  const currentById = new Map();
  for (const a of Array.isArray(assignments) ? assignments : []) {
    if (!a?.id) continue;
    currentById.set(String(a.id), a);
  }

  // 1. Lifecycle Diffs (only when a previous baseline snapshot exists — prevents initial-sync noise)
  if (prevSnapshot?.assignments && typeof prevSnapshot.assignments === 'object') {
    for (const [id, prevTask] of Object.entries(prevSnapshot.assignments)) {
      if (prevTask.courseId && (hiddenSet.has(String(prevTask.courseId)) || failedSet.has(String(prevTask.courseId)))) {
        continue;
      }

      const currTask = currentById.get(id);
      if (!currTask) {
        // Assignment disappeared from Google Classroom
        if (
          authoritativeSync &&
          alertSettings.notifyDeletedAssignments &&
          prevTask.status !== 'done' &&
          !prevTask.isCustom &&
          !deletedSet.has(id)
        ) {
          const priority = resolveNotificationPriority('assignment', 'deleted');
          candidates.push({
            eventKey: buildEventIdentity('assignment', id, 'deleted', prevTask.dueFingerprint || 'nodue'),
            eventType: 'assignment',
            sourceId: id,
            stage: 'deleted',
            priority,
            task: prevTask,
            payload: DiscordMessageBuilder.buildAssignmentLifecycleAlert(prevTask, 'deleted', {}, timeZone),
            historyTitle: `Assignment removed in Classroom: '${prevTask.title}'`,
            targetPath: '/dashboard'
          });
        }
        continue;
      }

      const currDone = isTaskCompleted(currTask);
      const prevDone = prevTask.status === 'done';

      if (!prevDone && currDone && alertSettings.notifySubmissionStatus) {
        const priority = resolveNotificationPriority('assignment', 'status_changed');
        candidates.push({
          eventKey: buildEventIdentity('assignment', id, 'status_changed', 'done'),
          eventType: 'assignment',
          sourceId: id,
          stage: 'status_changed',
          priority,
          task: currTask,
          payload: DiscordMessageBuilder.buildAssignmentLifecycleAlert(currTask, 'status_changed', {}, timeZone),
          historyTitle: `Submitted '${currTask.title}'`,
          targetPath: `/assignments/${id}`
        });
      }

      if (!currDone && alertSettings.notifyDeadlineChanges) {
        const currTiming = currTask.dueDate ? evaluateDueTiming(currTask.dueDate, now, timeZone) : null;
        const currFp = currTiming ? currTiming.fingerprint : '';
        const prevFp = prevTask.dueFingerprint || '';
        if (prevFp !== currFp && (prevFp || currFp)) {
          const priority = resolveNotificationPriority('assignment', 'deadline_changed');
          candidates.push({
            eventKey: buildEventIdentity('assignment', id, 'deadline_changed', `${prevFp || 'none'}->${currFp || 'none'}`),
            eventType: 'assignment',
            sourceId: id,
            stage: 'deadline_changed',
            priority,
            task: currTask,
            payload: DiscordMessageBuilder.buildAssignmentLifecycleAlert(
              currTask,
              'deadline_changed',
              { previousDueDate: prevTask.dueDate },
              timeZone
            ),
            historyTitle: `Deadline updated for '${currTask.title}'`,
            targetPath: `/assignments/${id}`
          });
        }
      }
    }
  }

  // 2. Scheduled Deadline Reminders (7d / 3d / 1d / Due Today / Overdue recovery)
  for (const task of Array.isArray(assignments) ? assignments : []) {
    if (!task?.id || !task.dueDate) continue;
    if (isTaskCompleted(task)) continue;
    if (task.courseId && hiddenSet.has(String(task.courseId))) continue;
    if (deletedSet.has(String(task.id))) continue;

    const timing = evaluateDueTiming(task.dueDate, now, timeZone);
    if (!timing || timing.calendarDaysDiff === null) continue;

    const diff = timing.calendarDaysDiff;
    let stage = null;
    let legacyTriggerType = null;
    let warningLabel = '';
    let emailSubject = '';

    if (diff === 7 && alertSettings.due7Days) {
      stage = 'due_7_days';
      legacyTriggerType = 'due_7_days';
      warningLabel = 'Due in 7 days';
      emailSubject = `[Classroom Hub] Upcoming (7 Days): ${task.title}`;
    } else if (diff === 3 && alertSettings.due3Days) {
      stage = 'due_3_days';
      legacyTriggerType = 'due_3_days';
      warningLabel = 'Due in 3 days';
      emailSubject = `[Classroom Hub] Reminder: 3 Days Before Due: ${task.title}`;
    } else if (diff === 1 && alertSettings.due1Day) {
      stage = 'due_1_day';
      legacyTriggerType = 'due_1_day';
      warningLabel = 'Due tomorrow';
      emailSubject = `[Classroom Hub] Urgent: Due Tomorrow: ${task.title}`;
    } else if (diff === 0 && alertSettings.dueToday) {
      stage = 'due_today';
      legacyTriggerType = 'due_today';
      warningLabel = 'Due today';
      emailSubject = `[Classroom Hub] Due Today: ${task.title}`;
    } else if (diff < 0 && diff >= -OVERDUE_MAX_LOOKBACK_DAYS && alertSettings.overdue1Day) {
      // Overdue catch-up: even if user did not open the app on diff === -1, catches once per deadline fingerprint!
      stage = 'overdue_1_day';
      legacyTriggerType = 'overdue_1_day';
      const daysOver = Math.abs(diff);
      warningLabel = daysOver === 1 ? 'Overdue by 1 day' : `Overdue by ${daysOver} days`;
      emailSubject = `[Classroom Hub] Overdue: ${task.title}`;
    }

    if (!stage) continue;

    const priority = resolveNotificationPriority('assignment', stage);
    candidates.push({
      // Keyed by deadline fingerprint so extended deadlines re-arm cleanly while static deadlines never repeat!
      eventKey: buildEventIdentity('assignment', task.id, stage, timing.fingerprint),
      eventType: 'assignment',
      sourceId: String(task.id),
      stage,
      legacyTriggerType,
      legacyDiscordType: `discord:${legacyTriggerType}`,
      priority,
      warningLabel,
      emailSubject,
      task,
      payload: DiscordMessageBuilder.buildAssignmentReminder(task, stage, {
        timeZone,
        warningLabel
      }),
      historyTitle: `Sent Discord reminder for '${task.title}' (${warningLabel})`,
      targetPath: `/assignments/${task.id}`
    });
  }

  return candidates;
}

/**
 * Evaluates Examination Countdown (7d / 3d / 1d / Exam Day) + Reschedule / Cancellation Alerts
 * using canonical `getMergedExams()` records.
 */
export function evaluateExamCandidates({
  exams = [],
  manualExams = [],
  alertSettings = {},
  prevSnapshot = null,
  explicitExamSync = false,
  now = new Date()
} = {}) {
  const timeZone = normalizeTimezone(alertSettings.timezone);
  const nowParts = getZonedDateParts(now, timeZone);
  if (!nowParts) return { candidates: [], mergedExams: [] };

  const safeSci = Array.isArray(exams) ? exams : [];
  const safeManual = Array.isArray(manualExams) ? manualExams : [];
  const mergedExams = getMergedExams(safeSci, safeManual, { todayIso: nowParts.dateStr });

  if (!alertSettings.includeExams && !alertSettings.examCountdownEnabled) {
    return { candidates: [], mergedExams };
  }

  const candidates = [];
  const currentByCanonical = new Map();
  for (const ex of mergedExams) {
    if (!ex) continue;
    currentByCanonical.set(resolveCanonicalExamKey(ex), ex);
  }

  // 1. Detect Exam Rescheduling / Room Assignment Changes & Cancellations
  if (alertSettings.notifyExamChanges && prevSnapshot?.exams && typeof prevSnapshot.exams === 'object') {
    for (const [canonicalKey, prevExam] of Object.entries(prevSnapshot.exams)) {
      const currExam = currentByCanonical.get(canonicalKey);

      if (!currExam) {
        // Only treat as cancelled if it was strictly upcoming (>= today) and NOT merely a transient SciBase cache TTL expiry
        const wasFutureOrToday = prevExam.dateIso && prevExam.dateIso >= nowParts.dateStr;
        const likelySciBaseTtlFlush = prevExam.source === 'scibase' && safeSci.length === 0 && !explicitExamSync;
        if (wasFutureOrToday && !likelySciBaseTtlFlush) {
          const priority = resolveNotificationPriority('exam', 'exam_cancelled');
          candidates.push({
            eventKey: buildEventIdentity('exam', canonicalKey, 'exam_cancelled', prevExam.dateIso),
            eventType: 'exam',
            sourceId: canonicalKey,
            stage: 'exam_cancelled',
            priority,
            payload: DiscordMessageBuilder.buildExamChangeAlert(null, 'exam_cancelled', prevExam, timeZone),
            historyTitle: `Exam removed from schedule: '${prevExam.courseName || prevExam.courseCode}'`,
            targetPath: '/exams'
          });
        }
        continue;
      }

      const currIso = resolveExamIsoDate(currExam);
      if (currIso && currIso < nowParts.dateStr) continue;

      const currSlotFp = buildExamSlotFingerprint(currExam);
      if (prevExam.slotFingerprint && prevExam.slotFingerprint !== currSlotFp) {
        const priority = resolveNotificationPriority('exam', 'exam_changed');
        candidates.push({
          eventKey: buildEventIdentity('exam', canonicalKey, 'exam_changed', currSlotFp),
          eventType: 'exam',
          sourceId: canonicalKey,
          stage: 'exam_changed',
          priority,
          payload: DiscordMessageBuilder.buildExamChangeAlert(currExam, 'exam_changed', prevExam, timeZone),
          historyTitle: `Exam schedule updated: '${currExam.subjectName || currExam.courseName || currExam.courseCode}'`,
          targetPath: '/exams'
        });
      }
    }
  }

  // 2. Exam Countdown Stages (7d / 3d / 1d / Exam Day) — never fires for past exams (< 0)
  if (alertSettings.examCountdownEnabled !== false) {
    for (const exam of mergedExams) {
      const examIso = resolveExamIsoDate(exam);
      if (!examIso) continue;

      const diffDays = diffIsoCalendarDays(examIso, nowParts.dateStr);
      if (diffDays === null || diffDays < 0) continue;

      let stage = null;
      if (diffDays === 7 && alertSettings.exam7Days) stage = 'exam_7d';
      else if (diffDays === 3 && alertSettings.exam3Days) stage = 'exam_3d';
      else if (diffDays === 1 && alertSettings.exam1Day) stage = 'exam_1d';
      else if (diffDays === 0 && alertSettings.examToday) stage = 'exam_today';

      if (!stage) continue;

      const canonicalKey = resolveCanonicalExamKey(exam);
      const priority = resolveNotificationPriority('exam', stage);
      const subjName = exam.subjectName || exam.courseName || exam.courseCode || 'Examination';

      candidates.push({
        // Keyed by examIso so rescheduled exam dates get fresh countdowns while unchanged dates never duplicate
        eventKey: buildEventIdentity('exam', canonicalKey, stage, examIso),
        eventType: 'exam',
        sourceId: canonicalKey,
        stage,
        priority,
        exam,
        payload: DiscordMessageBuilder.buildExamCountdown(exam, stage, {
          daysLeft: diffDays,
          timeZone
        }),
        historyTitle:
          diffDays === 0
            ? `Exam today: '${subjName}'`
            : `Exam countdown (${diffDays}d left): '${subjName}'`,
        targetPath: '/exams'
      });
    }
  }

  return { candidates, mergedExams };
}

/**
 * Evaluates Morning Briefing (07:00 configurable) & Pre-Class Reminders (30m / 5m).
 */
export function evaluateScheduleAndBriefingCandidates({
  schedule = [],
  assignments = [],
  resources = [],
  exams = [],
  manualExams = [],
  hiddenCourseIds = [],
  alertSettings = {},
  now = new Date(),
  forcePreview = false
} = {}) {
  const timeZone = normalizeTimezone(alertSettings.timezone);
  const nowParts = getZonedDateParts(now, timeZone);
  if (!nowParts) return { briefingCandidate: null, classCandidates: [] };

  const hiddenSet = new Set((hiddenCourseIds || []).map(String));
  const mergedExams = getMergedExams(exams || [], manualExams || [], { todayIso: nowParts.dateStr });
  const { classes: todayClasses, midtermPausedCount } = resolveScheduleForIsoDate(
    schedule,
    mergedExams,
    nowParts.dateStr
  );

  // Active coursework buckets
  const activeTodo = (Array.isArray(assignments) ? assignments : []).filter((a) => {
    if (!a || isTaskCompleted(a)) return false;
    if (a.courseId && hiddenSet.has(String(a.courseId))) return false;
    return true;
  });

  const dueTodayTasks = [];
  const overdueTasks = [];
  const upcomingTasks = [];

  for (const task of activeTodo) {
    if (!task.dueDate) continue;
    const timing = evaluateDueTiming(task.dueDate, now, timeZone);
    if (!timing || timing.calendarDaysDiff === null) continue;
    if (timing.calendarDaysDiff === 0) {
      dueTodayTasks.push(task);
    } else if (timing.calendarDaysDiff < 0 && timing.calendarDaysDiff >= -OVERDUE_MAX_LOOKBACK_DAYS) {
      overdueTasks.push(task);
    } else if (timing.calendarDaysDiff > 0 && timing.calendarDaysDiff <= 7) {
      upcomingTasks.push({ ...task, _daysDiff: timing.calendarDaysDiff });
    }
  }
  upcomingTasks.sort((a, b) => (a._daysDiff ?? 99) - (b._daysDiff ?? 99));

  const upcomingExams = mergedExams
    .filter((ex) => {
      const iso = resolveExamIsoDate(ex);
      if (!iso) return false;
      const d = diffIsoCalendarDays(iso, nowParts.dateStr);
      return d !== null && d >= 0 && d <= 14;
    })
    .sort((a, b) => (resolveExamIsoDate(a) > resolveExamIsoDate(b) ? 1 : -1));

  const recentCutoffMs = new Date(now).getTime() - RECENT_ANNOUNCEMENT_BRIEFING_MS;
  const recentAnnouncements = (Array.isArray(resources) ? resources : []).filter((r) => {
    if (!r || r.type !== 'announcement') return false;
    if (r.courseId && hiddenSet.has(String(r.courseId))) return false;
    const createdMs = r.creationTime ? new Date(r.creationTime).getTime() : NaN;
    return Number.isFinite(createdMs) && createdMs >= recentCutoffMs;
  });

  // 1. Morning Briefing Candidate
  let briefingCandidate = null;
  const briefingReady =
    forcePreview ||
    (alertSettings.morningBriefingEnabled &&
      hasTimePassedToday(now, alertSettings.morningBriefingTime || '07:00', timeZone));

  if (briefingReady) {
    const hasAnyAcademicSignal =
      todayClasses.length > 0 ||
      midtermPausedCount > 0 ||
      dueTodayTasks.length > 0 ||
      overdueTasks.length > 0 ||
      upcomingTasks.length > 0 ||
      upcomingExams.length > 0 ||
      recentAnnouncements.length > 0;

    const shouldSendToday =
      forcePreview ||
      todayClasses.length > 0 ||
      (alertSettings.morningBriefingSendOnFreeDays !== false && hasAnyAcademicSignal);

    if (shouldSendToday) {
      const payload = DiscordMessageBuilder.buildMorningBriefing({
        now,
        timeZone,
        todayClasses,
        midtermPausedCount,
        dueTodayTasks,
        upcomingTasks,
        overdueTasks,
        totalPendingTasks: activeTodo.length,
        upcomingExams,
        recentAnnouncements
      });

      briefingCandidate = {
        eventKey: buildEventIdentity('briefing', 'morning', 'daily', nowParts.dateStr),
        eventType: 'briefing',
        sourceId: 'morning',
        stage: 'daily',
        priority: PRIORITY.P3_DIGEST,
        payload,
        historyTitle: `Sent Morning Briefing (${todayClasses.length} class${todayClasses.length === 1 ? '' : 'es'}, ${activeTodo.length} pending tasks)`,
        targetPath: '/schedule'
      };
    }
  }

  // 2. Pre-Class Reminders (30m configurable + optional 5m final alert)
  const classCandidates = [];
  if (alertSettings.classReminderEnabled) {
    const leadMins = Number(alertSettings.classReminderLeadMinutes) || 30;
    for (const cls of todayClasses) {
      if (!cls || cls.isExam) continue;
      const startMins = parseClockMinutes(cls.startTime, null);
      if (startMins === null) continue;
      const minsUntil = startMins - nowParts.minutesOfDay;

      if (minsUntil > 0 && minsUntil <= leadMins) {
        // Avoid double-sending 30m if within 5m and 5m is also active
        if (!(alertSettings.classReminderFinal5m && minsUntil <= 5 && leadMins > 5)) {
          classCandidates.push({
            eventKey: buildEventIdentity(
              'class_reminder',
              cls.id || cls.title,
              `lead_${leadMins}m`,
              `${nowParts.dateStr}_${cls.startTime}`
            ),
            eventType: 'class_reminder',
            sourceId: String(cls.id || cls.title),
            stage: `lead_${leadMins}m`,
            priority: PRIORITY.P1_HIGH,
            payload: DiscordMessageBuilder.buildClassStartingSoon(cls, minsUntil, timeZone),
            historyTitle: `Class starting in ${minsUntil}m: '${cls.title}'`,
            targetPath: '/schedule'
          });
        }
      }

      if (alertSettings.classReminderFinal5m && minsUntil > 0 && minsUntil <= 5) {
        classCandidates.push({
          eventKey: buildEventIdentity(
            'class_reminder',
            cls.id || cls.title,
            'lead_5m',
            `${nowParts.dateStr}_${cls.startTime}`
          ),
          eventType: 'class_reminder',
          sourceId: String(cls.id || cls.title),
          stage: 'lead_5m',
          priority: PRIORITY.P0_CRITICAL,
          payload: DiscordMessageBuilder.buildClassStartingSoon(cls, minsUntil, timeZone),
          historyTitle: `Class starting in ${minsUntil}m: '${cls.title}'`,
          targetPath: '/schedule'
        });
      }
    }
  }

  return { briefingCandidate, classCandidates, todayClasses };
}

/**
 * Filters genuinely new Classroom coursework, announcements, and materials (excluding mere edits to old records).
 */
export function filterNewClassroomItems({
  freshAssignments = [],
  freshResources = [],
  cachedAssignmentIds = [],
  cachedResourceIds = [],
  hiddenCourseIds = [],
  alertSettings = {},
  isAlreadyNotified = () => false,
  now = new Date()
} = {}) {
  if (!alertSettings.newPosts) {
    return { newAssignments: [], newResources: [] };
  }

  const hiddenSet = new Set((hiddenCourseIds || []).map(String));
  const cachedAssignSet = new Set((cachedAssignmentIds || []).map(String));
  const cachedResSet = new Set((cachedResourceIds || []).map(String));
  const cutoffMs = new Date(now).getTime() - NEW_ACTIVITY_MAX_AGE_MS;

  const isGenuinelyRecent = (item) => {
    if (!item?.creationTime) return true;
    const createdMs = new Date(item.creationTime).getTime();
    if (Number.isNaN(createdMs)) return true;
    return createdMs >= cutoffMs;
  };

  const newAssignments = alertSettings.newAssignments === false
    ? []
    : (Array.isArray(freshAssignments) ? freshAssignments : []).filter((item) => {
        if (!item?.id) return false;
        const idStr = String(item.id);
        if (cachedAssignSet.has(idStr)) return false;
        if (item.courseId && hiddenSet.has(String(item.courseId))) return false;
        if (!isGenuinelyRecent(item)) return false;
        if (isAlreadyNotified('assignment', idStr)) return false;
        return true;
      });

  const newResources = (Array.isArray(freshResources) ? freshResources : []).filter((item) => {
    if (!item?.id) return false;
    const idStr = String(item.id);
    if (cachedResSet.has(idStr)) return false;
    if (item.courseId && hiddenSet.has(String(item.courseId))) return false;
    if (item.type === 'announcement' && alertSettings.newAnnouncements === false) return false;
    if (item.type === 'material' && alertSettings.newMaterials === false) return false;
    if (!isGenuinelyRecent(item)) return false;
    const evtType = item.type === 'material' ? 'material' : 'announcement';
    if (isAlreadyNotified(evtType, idStr)) return false;
    return true;
  });

  return { newAssignments, newResources };
}

/**
 * Builds the Weekly Academic Report context (enhanced Sunday Digest).
 */
export function buildWeeklyDigestData({
  assignments = [],
  resources = [],
  schedule = [],
  exams = [],
  manualExams = [],
  hiddenCourseIds = [],
  alertSettings = {},
  now = new Date()
} = {}) {
  const timeZone = normalizeTimezone(alertSettings.timezone);
  const nowParts = getZonedDateParts(now, timeZone);
  const hiddenSet = new Set((hiddenCourseIds || []).map(String));

  const pendingTasks = (Array.isArray(assignments) ? assignments : []).filter((a) => {
    if (!a || isTaskCompleted(a)) return false;
    if (a.courseId && hiddenSet.has(String(a.courseId))) return false;
    return true;
  });

  const noDueDateTasks = pendingTasks.filter((a) => !a.dueDate);
  const overdueTasks = pendingTasks.filter((a) => {
    if (!a.dueDate) return false;
    const timing = evaluateDueTiming(a.dueDate, now, timeZone);
    return timing && timing.calendarDaysDiff !== null && timing.calendarDaysDiff < 0;
  });

  const mergedExams = alertSettings.includeExams !== false
    ? getMergedExams(exams || [], manualExams || [], { todayIso: nowParts?.dateStr })
    : [];

  const upcomingExams = mergedExams
    .filter((ex) => {
      const iso = resolveExamIsoDate(ex);
      if (!iso || !nowParts) return false;
      const d = diffIsoCalendarDays(iso, nowParts.dateStr);
      return d !== null && d >= 0 && d <= 21;
    })
    .sort((a, b) => (resolveExamIsoDate(a) > resolveExamIsoDate(b) ? 1 : -1));

  // Compute next week's Mon-Sun timetable summary
  const nextWeekDaysSummary = [];
  let nextWeekClassesCount = 0;
  if (nowParts && Array.isArray(schedule) && schedule.length > 0) {
    const sundayIso = getZonedSundayDateStr(now, timeZone);
    const nextMondayIso = shiftIsoDate(sundayIso, 1);
    for (let i = 0; i < 7; i++) {
      const dayIso = shiftIsoDate(nextMondayIso, i);
      const { classes } = resolveScheduleForIsoDate(schedule, mergedExams, dayIso);
      if (classes.length > 0) {
        nextWeekClassesCount += classes.length;
        const dayKey = DAYS[i];
        const names = classes
          .slice(0, 3)
          .map((c) => `${c.startTime} ${c.title || c.courseCode}`)
          .join(', ');
        nextWeekDaysSummary.push(
          `• **${DAY_LABELS_EN[dayKey]} (${dayIso.slice(5)}):** ${names}${classes.length > 3 ? ` (+${classes.length - 3})` : ''}`
        );
      }
    }
  }

  const weekAgoMs = new Date(now).getTime() - WEEKLY_ACTIVITY_WINDOW_MS;
  const recentResources = (Array.isArray(resources) ? resources : []).filter((r) => {
    if (!r || (r.courseId && hiddenSet.has(String(r.courseId)))) return false;
    const createdMs = r.creationTime ? new Date(r.creationTime).getTime() : NaN;
    return Number.isFinite(createdMs) && createdMs >= weekAgoMs;
  });
  const recentAnnouncements = recentResources.filter((r) => r.type === 'announcement');
  const recentMaterials = recentResources.filter((r) => r.type === 'material');

  const hasContent =
    pendingTasks.length > 0 ||
    noDueDateTasks.length > 0 ||
    upcomingExams.length > 0 ||
    nextWeekClassesCount > 0 ||
    recentResources.length > 0;

  return {
    timeZone,
    pendingTasks,
    overdueTasks,
    noDueDateTasks,
    upcomingExams,
    nextWeekClassesCount,
    nextWeekDaysSummary,
    recentAnnouncements,
    recentMaterials,
    hasContent,
    sundayStamp: getZonedSundayDateStr(now, timeZone),
    payload: DiscordMessageBuilder.buildWeeklyAcademicReport({
      pendingTasks,
      overdueTasks,
      noDueDateTasks,
      upcomingExams,
      nextWeekClassesCount,
      nextWeekDaysSummary,
      recentAnnouncements,
      recentMaterials,
      timeZone
    })
  };
}

/**
 * Checks if the Weekly Digest window is currently due (or genuinely missed since prevLastSync).
 */
export function isWeeklyDigestWindowDue({
  now = new Date(),
  targetDayKey = 'sun',
  targetTimeStr = '18:00',
  timeZone = DEFAULT_TIMEZONE,
  prevLastSync = null
} = {}) {
  const safeTz = normalizeTimezone(timeZone);
  const nowParts = getZonedDateParts(now, safeTz);
  if (!nowParts) return { due: false, anchorDateStr: '' };

  const targetMins = parseClockMinutes(targetTimeStr, 18 * 60);
  const targetHour = Math.floor(targetMins / 60);
  const targetMinute = targetMins % 60;

  // Compute most recent occurrence of `targetDayKey` on or before today in `safeTz`
  const dayOrder = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const curIdx = dayOrder.indexOf(nowParts.weekdayKey);
  const tgtIdx = dayOrder.indexOf(targetDayKey) !== -1 ? dayOrder.indexOf(targetDayKey) : 0;
  const daysSinceTarget = (curIdx - tgtIdx + 7) % 7;
  const anchorDateStr = shiftIsoDate(nowParts.dateStr, -daysSinceTarget);

  const isTargetDay = daysSinceTarget === 0;
  const timePassedToday = nowParts.minutesOfDay >= targetMins;

  const [ay, am, ad] = anchorDateStr.split('-').map(Number);
  const cutoffUtcMs = zonedWallTimeToUtcMs(
    { year: ay, month: am, day: ad, hour: targetHour, minute: targetMinute, second: 0 },
    safeTz
  );

  const prevSyncMs = prevLastSync ? new Date(prevLastSync).getTime() : NaN;
  const genuinelyMissedPriorCutoff = !isTargetDay && Number.isFinite(prevSyncMs) && prevSyncMs < cutoffUtcMs;

  return {
    due: (isTargetDay && timePassedToday) || genuinelyMissedPriorCutoff,
    anchorDateStr
  };
}
