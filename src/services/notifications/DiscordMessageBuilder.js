import { sanitizeExternalUrl } from '../../utils/sanitize';
import { classifyExamKind, resolveExamIsoDate } from '../../utils/courseEndDate';
import {
  DEFAULT_TIMEZONE,
  diffIsoCalendarDays,
  formatZonedDateTimeLabel,
  getZonedDateParts,
  normalizeTimezone
} from './timeUtils';
import { PRIORITY } from './notificationSchema';

export const EMBED_COLORS = {
  P0: 0xE5484D, // Critical — Rose
  P1: 0xE5A93B, // High — Amber
  P2: 0x3B82F6, // Normal — Classroom Blue
  P3: 0x4CC38A, // Briefing — Emerald
  WEEKLY: 0x5865F2, // Weekly Report — Blurple
  SUCCESS: 0x34D399,
  MUTED: 0x6B7280
};

const truncateText = (value, maxLen = 1024, fallback = '-') => {
  if (value === null || value === undefined) return fallback;
  const clean = String(value).replace(/\r\n/g, '\n').trim();
  if (!clean) return fallback;
  if (clean.length <= maxLen) return clean;
  if (maxLen <= 1) return clean.slice(0, maxLen);
  return `${clean.slice(0, maxLen - 1)}…`;
};

const buildFooterText = (categoryLabel, timeZone = DEFAULT_TIMEZONE) =>
  `Classroom Hub • ${categoryLabel} • ${normalizeTimezone(timeZone)}`;

const formatSubmissionStatus = (task, isPastDeadline = false) => {
  const raw = String(task?.submissionState || task?.status || 'todo').toLowerCase();
  if (raw === 'turned_in' || raw === 'returned' || raw === 'done') return 'Submitted';
  if (raw === 'read') return 'Reviewed';
  if (isPastDeadline) return 'Missing / Overdue';
  if (raw === 'doing' || raw === 'in_progress') return 'In Progress';
  return 'Not Submitted';
};

const formatCourseLabel = (courseName, courseCode) => {
  const code = String(courseCode || '').trim();
  const name = String(courseName || '').trim() || 'Course';
  if (code && code.toUpperCase() !== 'CLASSROOM' && !name.toLowerCase().startsWith(code.toLowerCase())) {
    return `${code} • ${name}`;
  }
  return name;
};

export class DiscordMessageBuilder {
  /**
   * 1. Morning Briefing — 07:00 Asia/Bangkok
   * Single consolidated, scannable Discord Embed per day. Never renders empty sections.
   */
  static buildMorningBriefing({
    now = new Date(),
    timeZone = DEFAULT_TIMEZONE,
    todayClasses = [],
    midtermPausedCount = 0,
    dueTodayTasks = [],
    upcomingTasks = [],
    overdueTasks = [],
    totalPendingTasks = 0,
    upcomingExams = [],
    recentAnnouncements = [],
    dashboardUrl = ''
  } = {}) {
    const safeTz = normalizeTimezone(timeZone);
    const nowParts = getZonedDateParts(now, safeTz);
    const readableDate = new Date(now).toLocaleDateString('en-US', {
      timeZone: safeTz,
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });

    const regularClasses = todayClasses.filter((c) => !c.isExam);
    const todayExamsInSchedule = todayClasses.filter((c) => c.isExam);

    const summaryBadges = [
      `**${regularClasses.length}** class${regularClasses.length === 1 ? '' : 'es'} today`,
      `**${totalPendingTasks}** pending task${totalPendingTasks === 1 ? '' : 's'}`,
      `**${upcomingExams.length}** upcoming exam${upcomingExams.length === 1 ? '' : 's'}`
    ];
    if (overdueTasks.length > 0) {
      summaryBadges.push(`**${overdueTasks.length}** overdue`);
    }

    const fields = [];

    // Section A: Today's Class Timetable (always explicit about class vs free/paused day)
    if (todayClasses.length > 0) {
      const lines = todayClasses.slice(0, 10).map((item) => {
        const timeRange = `${item.startTime || '--:--'}–${item.endTime || '--:--'}`;
        const label = formatCourseLabel(item.title, item.courseCode);
        const roomPart = item.room ? ` — \`${truncateText(item.room, 40, '')}\`` : '';
        const examTag = item.isExam ? ' **[EXAM]**' : '';
        return `• \`${timeRange}\` **${truncateText(label, 65, 'Class')}**${examTag}${roomPart}`;
      });
      if (todayClasses.length > 10) {
        lines.push(`*+${todayClasses.length - 10} more session(s) today*`);
      }
      fields.push({
        name: `Today's Schedule (${todayClasses.length})`,
        value: lines.join('\n'),
        inline: false
      });
    } else {
      const freeDayReason = midtermPausedCount > 0
        ? 'Regular classes are paused for Midterm examination week.'
        : 'No scheduled classes today. Good day to review coursework or upcoming exams.';
      fields.push({
        name: "Today's Schedule",
        value: freeDayReason,
        inline: false
      });
    }

    // Section B: Assignments Due Today (P0 focus — omitted when empty)
    if (dueTodayTasks.length > 0) {
      const lines = dueTodayTasks.slice(0, 6).map((task) => {
        const link = sanitizeExternalUrl(task.googleLink);
        const title = truncateText(task.title, 65, 'Assignment');
        const linked = link ? `[${title}](${link})` : `**${title}**`;
        const dueLabel = formatZonedDateTimeLabel(task.dueDate, safeTz).split(', ')[1] || '23:59';
        return `• ${linked} (${truncateText(task.course, 36, 'Course')}) — \`${dueLabel}\``;
      });
      if (dueTodayTasks.length > 6) {
        lines.push(`*+${dueTodayTasks.length - 6} more due today*`);
      }
      fields.push({
        name: `Due Today (${dueTodayTasks.length})`,
        value: lines.join('\n'),
        inline: false
      });
    }

    // Section C: Overdue Highlights (only if any)
    if (overdueTasks.length > 0) {
      const lines = overdueTasks.slice(0, 4).map((task) => {
        const link = sanitizeExternalUrl(task.googleLink);
        const title = truncateText(task.title, 60, 'Assignment');
        const linked = link ? `[${title}](${link})` : `**${title}**`;
        return `• ${linked} — ${truncateText(task.course, 36, 'Course')}`;
      });
      if (overdueTasks.length > 4) {
        lines.push(`*+${overdueTasks.length - 4} more overdue task(s)*`);
      }
      fields.push({
        name: `Overdue Attention (${overdueTasks.length})`,
        value: lines.join('\n'),
        inline: false
      });
    }

    // Section D: Upcoming Deadlines (next 7 days, excluding due today)
    if (upcomingTasks.length > 0) {
      const lines = upcomingTasks.slice(0, 5).map((task) => {
        const link = sanitizeExternalUrl(task.googleLink);
        const title = truncateText(task.title, 60, 'Assignment');
        const linked = link ? `[${title}](${link})` : `**${title}**`;
        const dDiff = task._daysDiff;
        const leftStr = dDiff === 1 ? 'Tomorrow' : `${dDiff}d left`;
        return `• ${linked} (${truncateText(task.course, 32, 'Course')}) — \`${leftStr}\``;
      });
      if (upcomingTasks.length > 5) {
        lines.push(`*+${upcomingTasks.length - 5} more upcoming deadline(s)*`);
      }
      fields.push({
        name: `Upcoming Deadlines (${upcomingTasks.length})`,
        value: lines.join('\n'),
        inline: false
      });
    }

    // Section E: Upcoming Examinations (omitted when none)
    if (upcomingExams.length > 0) {
      const lines = upcomingExams.slice(0, 5).map((ex) => {
        const examIso = resolveExamIsoDate(ex);
        const diff = nowParts && examIso ? diffIsoCalendarDays(examIso, nowParts.dateStr) : null;
        const countLabel = diff === 0 ? 'TODAY' : diff === 1 ? 'Tomorrow' : diff !== null ? `in ${diff}d` : ex.date;
        const subj = formatCourseLabel(ex.subjectName || ex.courseName || 'Exam', ex.subjectCode || ex.courseCode);
        const roomSeat = [ex.room ? `Room ${ex.room}` : '', ex.seat ? `Seat ${ex.seat}` : '']
          .filter(Boolean)
          .join(', ');
        return `• **${truncateText(subj, 55, 'Exam')}** — \`${ex.date || examIso}\` (${countLabel})${roomSeat ? ` • ${roomSeat}` : ''}`;
      });
      if (upcomingExams.length > 5) {
        lines.push(`*+${upcomingExams.length - 5} more exam(s) scheduled*`);
      }
      fields.push({
        name: `Upcoming Examinations (${upcomingExams.length})`,
        value: lines.join('\n'),
        inline: false
      });
    }

    // Section F: Important Recent Announcements (omitted when none)
    if (recentAnnouncements.length > 0) {
      const lines = recentAnnouncements.slice(0, 3).map((ann) => {
        const link = sanitizeExternalUrl(ann.googleLink);
        const text = truncateText(ann.title || ann.description, 75, 'Announcement');
        const linked = link ? `[${text}](${link})` : text;
        return `• **${truncateText(ann.course, 32, 'Course')}:** ${linked}`;
      });
      fields.push({
        name: `Recent Announcements (${recentAnnouncements.length})`,
        value: lines.join('\n'),
        inline: false
      });
    }

    const hasCriticalToday = todayExamsInSchedule.length > 0 || dueTodayTasks.length > 0;
    const safeDash = sanitizeExternalUrl(dashboardUrl);

    return {
      username: 'Classroom Hub',
      embeds: [
        {
          title: `Morning Briefing — ${readableDate}`,
          url: safeDash || undefined,
          description: summaryBadges.join('  •  '),
          color: hasCriticalToday ? EMBED_COLORS.P1 : EMBED_COLORS.P3,
          fields,
          footer: { text: buildFooterText('Morning Briefing', safeTz) },
          timestamp: new Date(now).toISOString()
        }
      ]
    };
  }

  /**
   * 2. Assignment Reminder (7d / 3d / 1d / Due Today / Overdue)
   * Individual embed with urgency indicator, course + code, deadline, points, submission status, description & link.
   */
  static buildAssignmentReminder(task, stage, { timeZone = DEFAULT_TIMEZONE, warningLabel = '' } = {}) {
    const safeTz = normalizeTimezone(timeZone);
    const stageMeta = {
      due_7_days: { badge: 'Due in 7 Days', color: EMBED_COLORS.P2 },
      due_7d: { badge: 'Due in 7 Days', color: EMBED_COLORS.P2 },
      due_3_days: { badge: 'Due in 3 Days', color: EMBED_COLORS.P1 },
      due_3d: { badge: 'Due in 3 Days', color: EMBED_COLORS.P1 },
      due_1_day: { badge: 'Due Tomorrow', color: EMBED_COLORS.P1 },
      due_1d: { badge: 'Due Tomorrow', color: EMBED_COLORS.P1 },
      due_today: { badge: 'Due Today', color: EMBED_COLORS.P0 },
      overdue: { badge: 'Overdue', color: EMBED_COLORS.P0 },
      overdue_1_day: { badge: 'Overdue', color: EMBED_COLORS.P0 }
    };

    const meta = stageMeta[stage] || {
      badge: warningLabel || 'Assignment Reminder',
      color: String(stage).includes('overdue') ? EMBED_COLORS.P0 : EMBED_COLORS.P1
    };
    const isOverdue = String(stage).includes('overdue');
    const labelText = warningLabel || meta.badge;
    const safeLink = sanitizeExternalUrl(task?.googleLink);
    const dueFormatted = formatZonedDateTimeLabel(task?.dueDate, safeTz);
    const pointsLabel = typeof task?.points === 'number' ? `${task.points} pts` : 'Ungraded';
    const submissionLabel = formatSubmissionStatus(task, isOverdue);
    const courseLabel = formatCourseLabel(task?.course, task?.courseCode);
    const desc = truncateText(task?.description || 'No additional instructions provided.', 500, 'No additional instructions provided.');

    const fields = [
      {
        name: 'Course',
        value: truncateText(courseLabel, 240, 'Course'),
        inline: true
      },
      {
        name: 'Deadline',
        value: truncateText(dueFormatted, 240, 'No due date'),
        inline: true
      },
      {
        name: 'Status & Score',
        value: `${submissionLabel} • ${pointsLabel}`,
        inline: true
      }
    ];

    if (safeLink) {
      fields.push({
        name: 'Classroom Link',
        value: `[Open Assignment in Google Classroom](${safeLink})`,
        inline: false
      });
    }

    return {
      username: 'Classroom Hub',
      embeds: [
        {
          title: `[${labelText}] ${truncateText(task?.title, 200, 'Untitled Assignment')}`,
          url: safeLink || undefined,
          description: desc,
          color: meta.color,
          fields,
          footer: { text: buildFooterText('Assignment Reminder', safeTz) },
          timestamp: new Date().toISOString()
        }
      ]
    };
  }

  /**
   * 2b. Assignment Lifecycle Change Alert (Deadline Changed / Assignment Deleted / Submitted)
   */
  static buildAssignmentLifecycleAlert(task, changeType, details = {}, timeZone = DEFAULT_TIMEZONE) {
    const safeTz = normalizeTimezone(timeZone);
    const safeLink = sanitizeExternalUrl(task?.googleLink);
    const courseLabel = formatCourseLabel(task?.course, task?.courseCode);

    if (changeType === 'deadline_changed') {
      const prevLabel = details.previousDueDate
        ? formatZonedDateTimeLabel(details.previousDueDate, safeTz)
        : 'No due date';
      const nextLabel = task?.dueDate
        ? formatZonedDateTimeLabel(task.dueDate, safeTz)
        : 'No due date';

      return {
        username: 'Classroom Hub',
        embeds: [
          {
            title: `[Deadline Updated] ${truncateText(task?.title, 200, 'Assignment')}`,
            url: safeLink || undefined,
            description: `Instructor updated the submission deadline for **${truncateText(courseLabel, 120, 'Course')}**.`,
            color: EMBED_COLORS.P0,
            fields: [
              { name: 'Previous Deadline', value: prevLabel, inline: true },
              { name: 'New Deadline', value: nextLabel, inline: true },
              ...(safeLink ? [{ name: 'Classroom Link', value: `[View Updated Assignment](${safeLink})`, inline: false }] : [])
            ],
            footer: { text: buildFooterText('Deadline Update', safeTz) },
            timestamp: new Date().toISOString()
          }
        ]
      };
    }

    if (changeType === 'deleted') {
      return {
        username: 'Classroom Hub',
        embeds: [
          {
            title: `[Assignment Removed] ${truncateText(task?.title, 200, 'Assignment')}`,
            description: `An unsubmitted assignment in **${truncateText(courseLabel, 120, 'Course')}** is no longer listed in Google Classroom.`,
            color: EMBED_COLORS.MUTED,
            fields: [
              {
                name: 'Last Known Deadline',
                value: task?.dueDate ? formatZonedDateTimeLabel(task.dueDate, safeTz) : 'No due date',
                inline: true
              }
            ],
            footer: { text: buildFooterText('Classroom Sync Update', safeTz) },
            timestamp: new Date().toISOString()
          }
        ]
      };
    }

    // status_changed -> submitted
    return {
      username: 'Classroom Hub',
      embeds: [
        {
          title: `[Submitted] ${truncateText(task?.title, 200, 'Assignment')}`,
          url: safeLink || undefined,
          description: `Marked as submitted in **${truncateText(courseLabel, 120, 'Course')}**. Scheduled deadline reminders have been stopped.`,
          color: EMBED_COLORS.SUCCESS,
          footer: { text: buildFooterText('Submission Confirmed', safeTz) },
          timestamp: new Date().toISOString()
        }
      ]
    };
  }

  /**
   * 3. Examination Countdown (7d / 3d / 1d / Exam Day)
   * Uses real exam fields, handles missing room/seat gracefully, includes checklist only when actionable (<=1d).
   */
  static buildExamCountdown(exam, stage, { daysLeft = 0, timeZone = DEFAULT_TIMEZONE } = {}) {
    const safeTz = normalizeTimezone(timeZone);
    const stageLabels = {
      exam_today: { badge: 'EXAM TODAY', color: EMBED_COLORS.P0 },
      exam_1d: { badge: 'Exam Tomorrow (1 Day Left)', color: EMBED_COLORS.P1 },
      exam_3d: { badge: 'Exam in 3 Days', color: EMBED_COLORS.P1 },
      exam_7d: { badge: 'Exam in 7 Days', color: EMBED_COLORS.P2 }
    };
    const meta = stageLabels[stage] || {
      badge: daysLeft <= 0 ? 'EXAM TODAY' : `Exam in ${daysLeft} Day${daysLeft === 1 ? '' : 's'}`,
      color: daysLeft <= 0 ? EMBED_COLORS.P0 : daysLeft <= 3 ? EMBED_COLORS.P1 : EMBED_COLORS.P2
    };

    const kind = classifyExamKind(exam);
    const kindBadge = kind === 'midterm' ? 'Midterm' : kind === 'final' ? 'Final' : 'Examination';
    const subjectTitle = formatCourseLabel(
      exam?.subjectName || exam?.courseName || 'Subject',
      exam?.subjectCode || exam?.courseCode
    );
    const examIso = resolveExamIsoDate(exam);
    const dateDisplay = exam?.date || examIso || 'Scheduled';
    const timeDisplay = exam?.time && String(exam.time).trim() ? String(exam.time).trim() : 'Time TBA';
    const roomDisplay = exam?.room && String(exam.room).trim() ? String(exam.room).trim() : 'TBA (Check seating portal)';
    const seatDisplay = exam?.seat && String(exam.seat).trim() ? String(exam.seat).trim() : 'Not assigned yet';

    const fields = [
      {
        name: 'Date & Time',
        value: `${dateDisplay}\n\`${timeDisplay}\``,
        inline: true
      },
      {
        name: 'Room',
        value: truncateText(roomDisplay, 200, 'TBA'),
        inline: true
      },
      {
        name: 'Seat',
        value: truncateText(seatDisplay, 200, 'Not assigned yet'),
        inline: true
      }
    ];

    // Useful preparation note ONLY on exam day or 1 day before
    if (stage === 'exam_today' || stage === 'exam_1d' || daysLeft <= 1) {
      fields.push({
        name: 'Before You Leave',
        value: 'Bring your Student ID card, verify building/room code, and arrive at least 15 minutes before start time.',
        inline: false
      });
    }

    return {
      username: 'Classroom Hub',
      embeds: [
        {
          title: `[${meta.badge}] ${truncateText(subjectTitle, 190, 'Examination')}`,
          description: `**${kindBadge}** countdown for **${truncateText(subjectTitle, 140, 'Subject')}**.`,
          color: meta.color,
          fields,
          footer: { text: buildFooterText('Examination Countdown', safeTz) },
          timestamp: new Date().toISOString()
        }
      ]
    };
  }

  /**
   * 3b. Examination Reschedule / Cancellation Alert
   */
  static buildExamChangeAlert(exam, changeType, previousExam = null, timeZone = DEFAULT_TIMEZONE) {
    const safeTz = normalizeTimezone(timeZone);
    const subjectTitle = formatCourseLabel(
      exam?.subjectName || exam?.courseName || previousExam?.subjectName || previousExam?.courseName || 'Examination',
      exam?.subjectCode || exam?.courseCode || previousExam?.subjectCode || previousExam?.courseCode
    );

    if (changeType === 'exam_cancelled') {
      return {
        username: 'Classroom Hub',
        embeds: [
          {
            title: `[Exam Removed] ${truncateText(subjectTitle, 200, 'Examination')}`,
            description: `This examination is no longer present in your active schedule (${previousExam?.date || resolveExamIsoDate(previousExam) || 'Previously scheduled'}).`,
            color: EMBED_COLORS.P0,
            footer: { text: buildFooterText('Exam Schedule Alert', safeTz) },
            timestamp: new Date().toISOString()
          }
        ]
      };
    }

    const fields = [
      {
        name: 'Previous Slot',
        value: `${previousExam?.date || resolveExamIsoDate(previousExam) || '-'} (${previousExam?.time || 'TBA'})\nRoom: ${previousExam?.room || 'TBA'}`,
        inline: true
      },
      {
        name: 'Updated Slot',
        value: `${exam?.date || resolveExamIsoDate(exam) || '-'} (${exam?.time || 'TBA'})\nRoom: ${exam?.room || 'TBA'}${exam?.seat ? ` • Seat: ${exam.seat}` : ''}`,
        inline: true
      }
    ];

    return {
      username: 'Classroom Hub',
      embeds: [
        {
          title: `[Exam Updated] ${truncateText(subjectTitle, 200, 'Examination')}`,
          description: 'Exam date, time, or seating assignment has changed.',
          color: EMBED_COLORS.P0,
          fields,
          footer: { text: buildFooterText('Exam Schedule Alert', safeTz) },
          timestamp: new Date().toISOString()
        }
      ]
    };
  }

  /**
   * 4. Class Starting Soon (30m / 5m before class)
   */
  static buildClassStartingSoon(classEntry, leadMinutes = 30, timeZone = DEFAULT_TIMEZONE) {
    const safeTz = normalizeTimezone(timeZone);
    const label = formatCourseLabel(classEntry?.title, classEntry?.courseCode);
    const room = classEntry?.room && String(classEntry.room).trim() ? String(classEntry.room).trim() : 'Room not specified';

    return {
      username: 'Classroom Hub',
      embeds: [
        {
          title: `Class in ${leadMinutes} min — ${truncateText(label, 190, 'Class')}`,
          description: `Session runs **${classEntry?.startTime || '--:--'}–${classEntry?.endTime || '--:--'}**.`,
          color: leadMinutes <= 10 ? EMBED_COLORS.P0 : EMBED_COLORS.P1,
          fields: [
            { name: 'Location', value: truncateText(room, 200, 'Room not specified'), inline: true },
            { name: 'Schedule', value: `${classEntry?.startTime || '--:--'} – ${classEntry?.endTime || '--:--'}`, inline: true }
          ],
          footer: { text: buildFooterText('Class Reminder', safeTz) },
          timestamp: new Date().toISOString()
        }
      ]
    };
  }

  /**
   * 5. Weekly Academic Digest (Enhanced Sunday Digest)
   */
  static buildWeeklyAcademicReport({
    pendingTasks = [],
    overdueTasks = [],
    noDueDateTasks = [],
    upcomingExams = [],
    nextWeekClassesCount = 0,
    nextWeekDaysSummary = [],
    recentAnnouncements = [],
    recentMaterials = [],
    timeZone = DEFAULT_TIMEZONE,
    priority = PRIORITY.P3_DIGEST
  } = {}) {
    void priority;
    const safeTz = normalizeTimezone(timeZone);
    const fields = [];

    const summaryParts = [
      `**${pendingTasks.length}** pending`,
      `**${overdueTasks.length}** overdue`,
      `**${noDueDateTasks.length}** without due date`,
      `**${upcomingExams.length}** upcoming exam${upcomingExams.length === 1 ? '' : 's'}`
    ];

    if (overdueTasks.length > 0) {
      const lines = overdueTasks.slice(0, 5).map((t) => {
        const link = sanitizeExternalUrl(t.googleLink);
        const title = truncateText(t.title, 60, 'Task');
        return `• ${link ? `[${title}](${link})` : `**${title}**`} — ${truncateText(t.course, 36, 'Course')}`;
      });
      if (overdueTasks.length > 5) lines.push(`*+${overdueTasks.length - 5} more overdue*`);
      fields.push({ name: `Overdue Assignments (${overdueTasks.length})`, value: lines.join('\n'), inline: false });
    }

    const datedUpcoming = pendingTasks.filter((t) => t.dueDate && !overdueTasks.some((o) => o.id === t.id));
    if (datedUpcoming.length > 0) {
      const lines = datedUpcoming.slice(0, 6).map((t) => {
        const link = sanitizeExternalUrl(t.googleLink);
        const title = truncateText(t.title, 58, 'Task');
        const dueShort = formatZonedDateTimeLabel(t.dueDate, safeTz).split(',')[0];
        return `• ${link ? `[${title}](${link})` : `**${title}**`} (${truncateText(t.course, 28, 'Course')}) — \`${dueShort}\``;
      });
      if (datedUpcoming.length > 6) lines.push(`*+${datedUpcoming.length - 6} more scheduled task(s)*`);
      fields.push({ name: `Upcoming Coursework (${datedUpcoming.length})`, value: lines.join('\n'), inline: false });
    }

    if (noDueDateTasks.length > 0) {
      const courseGroups = {};
      noDueDateTasks.forEach((t) => {
        const c = t.course || 'General';
        if (!courseGroups[c]) courseGroups[c] = [];
        courseGroups[c].push(t);
      });
      const lines = [];
      Object.keys(courseGroups).slice(0, 5).forEach((courseName) => {
        const items = courseGroups[courseName];
        const sample = items.slice(0, 2).map((i) => truncateText(i.title, 42, 'Task')).join(', ');
        lines.push(`• **${truncateText(courseName, 36, 'Course')}** (${items.length}): ${sample}${items.length > 2 ? '…' : ''}`);
      });
      fields.push({ name: `Open Tasks Without Due Date (${noDueDateTasks.length})`, value: lines.join('\n'), inline: false });
    }

    if (upcomingExams.length > 0) {
      const lines = upcomingExams.slice(0, 5).map((ex) => {
        const subj = formatCourseLabel(ex.subjectName || ex.courseName || 'Exam', ex.subjectCode || ex.courseCode);
        const roomPart = ex.room ? ` • Room ${ex.room}` : '';
        const seatPart = ex.seat ? ` (${ex.seat})` : '';
        return `• **${truncateText(subj, 52, 'Exam')}** — \`${ex.date || resolveExamIsoDate(ex)}\`${roomPart}${seatPart}`;
      });
      if (upcomingExams.length > 5) lines.push(`*+${upcomingExams.length - 5} more upcoming exam(s)*`);
      fields.push({ name: `Upcoming Examinations (${upcomingExams.length})`, value: lines.join('\n'), inline: false });
    }

    if (nextWeekDaysSummary.length > 0) {
      fields.push({
        name: `Next Week's Timetable (${nextWeekClassesCount} session${nextWeekClassesCount === 1 ? '' : 's'})`,
        value: nextWeekDaysSummary.join('\n'),
        inline: false
      });
    }

    const totalRecentActivity = recentAnnouncements.length + recentMaterials.length;
    if (totalRecentActivity > 0) {
      const actLines = [];
      if (recentAnnouncements.length > 0) {
        actLines.push(`• **${recentAnnouncements.length}** announcement(s) posted this week`);
      }
      if (recentMaterials.length > 0) {
        actLines.push(`• **${recentMaterials.length}** learning material(s) uploaded this week`);
      }
      fields.push({
        name: 'Recent Classroom Updates',
        value: actLines.join('\n'),
        inline: false
      });
    }

    return {
      username: 'Classroom Hub',
      embeds: [
        {
          title: 'Weekly Academic Report',
          description: summaryParts.join('  •  '),
          color: EMBED_COLORS.WEEKLY,
          fields,
          footer: { text: buildFooterText('Weekly Academic Digest', safeTz) },
          timestamp: new Date().toISOString()
        }
      ]
    };
  }
}
