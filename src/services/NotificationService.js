import { 
  getEnableEmailAlerts,
  getAlertSettings,
  getSundayDigestTime,
  getSentNotifications,
  saveSentNotifications,
  getDailyEmailLimit,
  saveDailyEmailLimit,
  addNotificationHistoryLog,
  getHiddenCourses,
  getLastSync
} from '../utils/storage';
import { GoogleRepository } from '../repositories/GoogleRepository';
import { examRepository } from '../repositories/examRepository';
import { parseExamDate } from '../utils/examDate';
import { escapeHtml, sanitizeExternalUrl } from '../utils/sanitize';
import { NOTIFICATION_CONFIG } from '../config/notification';
import { logger } from '../utils/logger';
import { getCalendarDaysDiff, parseLocalDateInput } from '../utils/dateUtils';
import { getHexColor } from '../utils/colors';
import { DiscordService, DISCORD_COLORS } from './DiscordService';

// Sent-records for due/digest notifications older than this can no longer re-trigger,
// while `new_post` records are retained up to MAX_NEW_POST_RECORDS so old posts are never re-sent.
const SENT_RECORD_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
const NEW_POST_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_NEW_POST_RECORDS = 500;
const NEW_POST_RECORD_TYPE = 'new_post';
const DISCORD_NEW_POST_RECORD_TYPE = 'discord_new_post';
const isNewPostRecordType = (type) => type === NEW_POST_RECORD_TYPE || type === DISCORD_NEW_POST_RECORD_TYPE;
const inTabLocks = new Map();

export class NotificationService {

  /**
   * Wraps email body in a clean VS Code Dark+ HTML email template
   */
  static wrapHtmlEmail(title, contentHtml) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${escapeHtml(title)}</title>
        <style>
          body {
            margin: 0;
            padding: 0;
            background-color: #11141C;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            color: #E2E5EE;
            -webkit-font-smoothing: antialiased;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 36px 20px;
          }
          .header {
            text-align: center;
            padding-bottom: 20px;
          }
          .logo-badge {
            display: inline-block;
            padding: 6px 14px;
            background-color: #171B24;
            border: 1px solid #2A3140;
            border-radius: 8px;
            margin-bottom: 10px;
          }
          .logo-text {
            font-size: 12px;
            font-weight: 600;
            color: #60A5FA;
            margin: 0;
          }
          .tagline {
            font-size: 11px;
            color: #7C8598;
            margin-top: 4px;
          }
          .card {
            background-color: #171B24;
            border: 1px solid #2A3140;
            border-radius: 12px;
            padding: 28px;
            margin-top: 12px;
          }
          .title {
            font-size: 19px;
            font-weight: 600;
            color: #EEF0F5;
            margin-top: 0;
            margin-bottom: 10px;
            letter-spacing: -0.02em;
          }
          .desc {
            font-size: 13px;
            color: #A1AAB9;
            line-height: 1.6;
            margin-bottom: 20px;
          }
          .footer {
            text-align: center;
            padding-top: 28px;
            font-size: 11px;
            color: #7C8598;
            line-height: 1.6;
          }
          .button {
            display: inline-block;
            background-color: #2563EB;
            color: #FFFFFF !important;
            font-weight: 500;
            font-size: 13px;
            padding: 10px 20px;
            border-radius: 8px;
            text-decoration: none;
            margin-top: 18px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo-badge">
              <div class="logo-text">Classroom Hub</div>
            </div>
            <div class="tagline">Learning • Schedule • Exams</div>
          </div>
          
          <div class="card">
            ${contentHtml}
          </div>
          
          <div class="footer">
            This email was sent automatically from your browser via Classroom Hub Integration.<br>
            To change your email settings, open the Notifications panel in Classroom Hub.
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Local (device timezone) YYYY-MM-DD stamp. Using toISOString() here would shift the date for
   * non-UTC users (e.g. UTC+7 before 07:00) and break daily-quota / weekly-digest bookkeeping.
   */
  static localDateStamp(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  /**
   * Returns true when another email may be sent today without exceeding the daily quota.
   */
  static hasDailyQuota(email) {
    const limit = getDailyEmailLimit(email);
    const sentToday = limit.lastSentDate === this.localDateStamp() ? Number(limit.count) || 0 : 0;
    return sentToday < NOTIFICATION_CONFIG.maxDailyEmails;
  }

  /**
   * Increments today's sent counter. Call only after an email was actually sent.
   */
  static recordEmailSent(email) {
    const todayStr = this.localDateStamp();
    const limit = getDailyEmailLimit(email);
    if (limit.lastSentDate === todayStr) {
      limit.count = (Number(limit.count) || 0) + 1;
    } else {
      limit.lastSentDate = todayStr;
      limit.count = 1;
    }
    saveDailyEmailLimit(limit, email);
  }

  /**
   * Durably records that a notification (assignmentId + type) was delivered, immediately after
   * the send succeeds, so a later failure in the same run can never cause it to be re-sent.
   */
  static persistSentRecord(email, record) {
    this.persistSentRecords(email, [record]);
  }

  static persistSentRecords(email, records) {
    const current = getSentNotifications(email);
    const isKnown = (rec, list) => list.some(r => r.assignmentId === rec.assignmentId && r.type === rec.type);
    const additions = [];
    records.forEach(rec => {
      if (!isKnown(rec, current) && !isKnown(rec, additions)) additions.push(rec);
    });
    if (additions.length === 0) return;
    const cutoff = Date.now() - SENT_RECORD_RETENTION_MS;
    const newPostRecords = current.filter(r => isNewPostRecordType(r.type));
    const otherPruned = current.filter(r => {
      if (isNewPostRecordType(r.type)) return false;
      const t = new Date(r.sentAt).getTime();
      return Number.isNaN(t) || t >= cutoff;
    });
    const combinedNewPosts = [
      ...newPostRecords,
      ...additions.filter(r => isNewPostRecordType(r.type))
    ].slice(-MAX_NEW_POST_RECORDS);
    const combinedOthers = [
      ...otherPruned,
      ...additions.filter(r => !isNewPostRecordType(r.type))
    ];
    saveSentNotifications([...combinedNewPosts, ...combinedOthers], email);
  }

  /**
   * Serializes notification evaluation per user across tabs (Web Locks API) and within a tab
   * (promise chain fallback) so two concurrent runs cannot both send the same notification.
   */
  static async withNotificationLock(email, fn) {
    const lockName = `classroom_hub_notify_${(email || '').toLowerCase().trim()}`;
    if (typeof navigator !== 'undefined' && navigator.locks && typeof navigator.locks.request === 'function') {
      return navigator.locks.request(lockName, () => fn());
    }
    const previous = inTabLocks.get(lockName) || Promise.resolve();
    const run = previous.catch(() => {}).then(() => fn());
    const tail = run.catch(() => {});
    inTabLocks.set(lockName, tail);
    try {
      return await run;
    } finally {
      if (inTabLocks.get(lockName) === tail) inTabLocks.delete(lockName);
    }
  }

  /**
   * Utility to generate a beautifully styled Upcoming Exams HTML table section
   */
  static buildExamsHtml(toEmail, isWeeklyDigest = false) {
    if (!toEmail) return '';
    const emailKey = toEmail.toLowerCase().trim();

    try {
      const cachedRes = examRepository.getCachedExams(emailKey);
      if (!cachedRes.success || !cachedRes.data) return '';
      const exams = [
        ...(cachedRes.data.exams || []),
        ...(cachedRes.data.manualExams || [])
      ];
      if (exams.length === 0) return '';

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const upcomingExams = exams.filter(exam => {
        const parsedDate = parseExamDate(exam.rawIsoDate || exam.date);
        return parsedDate ? parsedDate >= today : false;
      });

      if (upcomingExams.length === 0) return '';

      upcomingExams.sort((a, b) => {
        const dateA = parseExamDate(a.rawIsoDate || a.date);
        const dateB = parseExamDate(b.rawIsoDate || b.date);
        return dateA - dateB;
      });

      const nextExam = upcomingExams[0];
      const nextExamDate = parseExamDate(nextExam.rawIsoDate || nextExam.date);
      
      const getRemainingLabel = (examDate) => {
        const diffDays = getCalendarDaysDiff(examDate, today) ?? 0;
        if (diffDays <= 0) return 'Today';
        if (diffDays === 1) return 'Tomorrow';
        return `${diffDays} days left`;
      };

      const nextExamRemaining = getRemainingLabel(nextExamDate);

      let highlightHtml = `
        <div style="margin-top: 25px; border: 1px dashed #FBBF24; background-color: #11141C; border-radius: 10px; padding: 15px; margin-bottom: 20px;">
          <span style="font-size: 11px; color: #FBBF24; font-weight: 600;">Next Exam</span>
          <h4 style="color: #EEF0F5; margin: 6px 0 2px 0; font-size: 14px;">${escapeHtml(nextExam.courseCode)} • ${escapeHtml(nextExam.courseName)}</h4>
          <div style="font-size: 12px; color: #A1AAB9; margin-top: 4px; line-height: 1.5;">
            <strong>Date:</strong> ${escapeHtml(nextExam.date)} (${nextExamRemaining})<br/>
            <strong>Time:</strong> ${escapeHtml(nextExam.time || '-')}<br/>
            <strong>Room:</strong> ${escapeHtml(nextExam.room || '-')} ${nextExam.seat ? `• <strong>Seat:</strong> ${escapeHtml(nextExam.seat)}` : ''}
          </div>
        </div>
      `;

      const limit = isWeeklyDigest ? 5 : 999;
      const displayExams = upcomingExams.slice(0, limit);
      const hiddenCount = upcomingExams.length - displayExams.length;

      let tableRows = '';
      displayExams.forEach(exam => {
        const examDate = parseExamDate(exam.rawIsoDate || exam.date);
        const remainingLabel = getRemainingLabel(examDate);
        const isManualLabel = exam.isManual ? ' <span style="font-size: 11px; color: #A78BFA; background-color: #1F2532; padding: 1px 5px; border-radius: 4px;">Manual</span>' : '';
        const seatText = exam.seat || '-';

        tableRows += `
        <tr style="border-bottom: 1px solid #2A3140;">
          <td style="padding: 12px 8px; font-size: 12px; color: #EEF0F5;">
            <strong>${escapeHtml(exam.courseCode || '')}</strong><br/>
            <span style="font-size: 11px; color: #A1AAB9;">${escapeHtml(exam.courseName || '')}</span>${isManualLabel ? '<br/>' + isManualLabel : ''}
          </td>
          <td style="padding: 12px 8px; font-size: 12px; color: #E2E5EE; white-space: nowrap;">
            ${escapeHtml(exam.date || '-')}<br/>
            <span style="font-size: 11px; color: #A1AAB9;">${escapeHtml(exam.time || '')}</span>
          </td>
          <td style="padding: 12px 8px; font-size: 11px; color: #FBBF24; white-space: nowrap; font-weight: 600;">
            ${remainingLabel}
          </td>
          <td style="padding: 12px 8px; font-size: 12px; color: #E2E5EE; text-align: center;">
            ${escapeHtml(exam.room || '-')}
          </td>
          <td style="padding: 12px 8px; font-size: 12px; color: #34D399; font-weight: 600; text-align: center;">
            ${escapeHtml(seatText)}
          </td>
        </tr>
        `;
      });

      let extraFooterHtml = '';
      if (hiddenCount > 0) {
        extraFooterHtml = `
          <div style="text-align: center; font-size: 12px; color: #A78BFA; padding: 10px; font-weight: 600;">
            + And ${hiddenCount} more upcoming exam${hiddenCount > 1 ? 's' : ''}...
          </div>
        `;
      }

      return `
        <div style="margin-top: 25px; border-top: 1px solid #2A3140; padding-top: 20px;">
          <h3 style="color: #EEF0F5; margin: 0 0 15px 0; font-size: 15px; font-weight: 600;">
            Upcoming Exam Schedule (${upcomingExams.length})
          </h3>
          
          ${highlightHtml}

          <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; text-align: left; background-color: #11141C;">
              <thead>
                <tr style="border-bottom: 2px solid #2A3140; background-color: #1F2532;">
                  <th style="padding: 10px 8px; font-size: 11px; color: #A1AAB9; font-weight: 500;">Subject</th>
                  <th style="padding: 10px 8px; font-size: 11px; color: #A1AAB9; font-weight: 500;">Date & Time</th>
                  <th style="padding: 10px 8px; font-size: 11px; color: #A1AAB9; font-weight: 500;">Remaining</th>
                  <th style="padding: 10px 8px; font-size: 11px; color: #A1AAB9; font-weight: 500; text-align: center;">Room</th>
                  <th style="padding: 10px 8px; font-size: 11px; color: #A1AAB9; font-weight: 500; text-align: center;">Seat</th>
                </tr>
              </thead>
              <tbody>
                ${tableRows}
              </tbody>
            </table>
          </div>
          ${extraFooterHtml}
        </div>
      `;
    } catch (err) {
      logger.error('Error generating exams HTML for email digest', err);
      return '';
    }
  }

  /**
   * Sends a Success Test Email
   */
  static async triggerTestEmail(accessToken, toEmail) {
    return this.withNotificationLock(toEmail, async () => {
      if (!this.hasDailyQuota(toEmail)) {
        throw new Error(`Failed to send test email: Daily email limit (${NOTIFICATION_CONFIG.maxDailyEmails}) reached.`);
      }

      const alertSettings = getAlertSettings(toEmail);
      const time = getSundayDigestTime(toEmail);

      const body = `
        <h2 class="title" style="color: #34D399;">Gmail Integration Connected</h2>
        <p class="desc">
          Classroom Hub is connected to your Gmail account and will send alerts based on your trigger preferences below.
        </p>
        <div style="border-top: 1px solid #2A3140; padding-top: 15px; margin-top: 15px;">
          <h3 style="font-size: 13px; color: #EEF0F5; margin-top: 0;">Active Trigger Summary:</h3>
          <ul style="font-size: 12px; color: #A1AAB9; padding-left: 20px; line-height: 1.8;">
            <li>3 Days Before Due: <strong>${alertSettings.due3Days ? 'Enabled' : 'Disabled'}</strong></li>
            <li>1 Day Before Due: <strong>${alertSettings.due1Day ? 'Enabled' : 'Disabled'}</strong></li>
            <li>Due Today: <strong>${alertSettings.dueToday ? 'Enabled' : 'Disabled'}</strong></li>
            <li>1 Day Overdue (Once): <strong>${alertSettings.overdue1Day ? 'Enabled' : 'Disabled'}</strong></li>
            <li>New Posts (Consolidated): <strong>${alertSettings.newPosts ? 'Enabled' : 'Disabled'}</strong></li>
            <li>Sunday Digest (No Due Date): <strong>${alertSettings.sundayDigest ? `Every Sunday at ${escapeHtml(time)}` : 'Disabled'}</strong></li>
          </ul>
        </div>
      `;

      const html = this.wrapHtmlEmail('Classroom Hub: Gmail Integration Success', body);
      await GoogleRepository.sendEmail(accessToken, toEmail, 'Classroom Hub: Gmail Integration Success', html);
      this.recordEmailSent(toEmail);
      
      addNotificationHistoryLog({
        title: 'Sent connection test email successfully',
        type: 'test_email',
        targetPath: '/settings'
      }, toEmail);
    });
  }

  /**
   * Sends a Connection Test Embed to Discord Webhook
   */
  static async triggerTestDiscord(toEmail, webhookUrlOverride = '') {
    return this.withNotificationLock(toEmail || 'default', async () => {
      const alertSettings = getAlertSettings(toEmail);
      const sundayTime = getSundayDigestTime(toEmail);
      const targetUrl = (webhookUrlOverride || alertSettings.discordWebhookUrl || '').trim();

      const payload = DiscordService.buildTestPayload(toEmail, alertSettings, sundayTime);
      await DiscordService.sendWebhook(targetUrl, payload);

      if (toEmail) {
        addNotificationHistoryLog({
          title: 'Sent connection test message to Discord successfully',
          type: 'test_discord',
          targetPath: '/settings'
        }, toEmail);
      }
    });
  }

  /**
   * Triggers a manual overall task & exam digest to Discord Webhook immediately
   */
  static async triggerManualDiscordDigest(toEmail, assignments = [], webhookUrlOverride = '') {
    return this.withNotificationLock(toEmail || 'default', async () => {
      const alertSettings = getAlertSettings(toEmail);
      const hiddenCourseIds = getHiddenCourses(toEmail);
      const targetUrl = (webhookUrlOverride || alertSettings.discordWebhookUrl || '').trim();

      const todoTasks = (Array.isArray(assignments) ? assignments : []).filter(a => {
        if (a.status === 'done' || a.status === 'read') return false;
        if (a.courseId && hiddenCourseIds.includes(a.courseId)) return false;
        return true;
      });

      const hasUpcomingExams = Boolean(alertSettings.includeExams && DiscordService.buildExamsEmbed(toEmail, false));
      if (todoTasks.length === 0 && !hasUpcomingExams) {
        throw new Error('You have no pending assignments or upcoming exams to digest!');
      }

      const payload = DiscordService.buildDigestPayload({
        title: 'Pending Assignments Digest',
        description: 'Here is a summary of all your currently unfinished coursework in Classroom Hub.',
        tasks: todoTasks,
        toEmail,
        includeExams: Boolean(alertSettings.includeExams),
        isWeeklyDigest: false
      });

      await DiscordService.sendWebhook(targetUrl, payload);

      if (toEmail) {
        addNotificationHistoryLog({
          title: `Sent pending assignments digest to Discord (Total ${todoTasks.length} items)`,
          type: 'discord_digest',
          targetPath: '/dashboard'
        }, toEmail);
      }
    });
  }

  /**
   * Triggers a manual overall task digest immediately
   */
  static async triggerManualDigest(accessToken, toEmail, assignments) {
    return this.withNotificationLock(toEmail, async () => {
      if (!this.hasDailyQuota(toEmail)) {
        throw new Error(`Failed to send task digest: Daily email limit (${NOTIFICATION_CONFIG.maxDailyEmails}) reached.`);
      }

      const alertSettings = getAlertSettings(toEmail);
      const hiddenCourseIds = getHiddenCourses(toEmail);
      
      const todoTasks = assignments.filter(a => {
        if (a.status === 'done' || a.status === 'read') return false;
        if (a.courseId && hiddenCourseIds.includes(a.courseId)) return false;
        return true;
      });

      const hasUpcomingExams = alertSettings.includeExams && this.buildExamsHtml(toEmail, false) !== '';

      if (todoTasks.length === 0 && !hasUpcomingExams) {
        throw new Error('You have no pending assignments or upcoming exams to digest!');
      }

      let tasksHtml = '';
      if (todoTasks.length > 0) {
        const courseGroups = {};
        todoTasks.forEach(task => {
          if (!courseGroups[task.course]) {
            courseGroups[task.course] = [];
          }
          courseGroups[task.course].push(task);
        });

        Object.keys(courseGroups).forEach(courseName => {
          const list = courseGroups[courseName];
          const borderHex = getHexColor(list[0].courseColor);
          
          tasksHtml += `
            <div style="margin-top: 16px; border: 1px solid #2A3140; border-left: 4px solid ${borderHex}; background-color: #11141C; border-radius: 10px; padding: 16px;">
              <h4 style="color: #EEF0F5; margin: 0 0 12px 0; font-size: 14px; font-weight: 600;">${escapeHtml(courseName)}</h4>
              <div style="font-size: 13px; color: #E2E5EE; line-height: 1.6; margin-top: 8px;">
          `;
          
          list.forEach(t => {
            const parsedDue = parseLocalDateInput(t.dueDate);
            const dueLabel = parsedDue ? parsedDue.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }) : 'No Due Date';
            tasksHtml += `
              <div style="padding: 10px 0; border-bottom: 1px solid #2A3140;">
                <div style="font-weight: 500; color: #EEF0F5; display: inline-block; max-width: 70%; vertical-align: middle;">${escapeHtml(t.title)}</div>
                <div style="display: inline-block; font-size: 11px; background-color: #1B2942; color: #60A5FA; padding: 2px 8px; border-radius: 6px; font-weight: 500; float: right; vertical-align: middle; margin-top: 2px;">${escapeHtml(dueLabel)}</div>
                <div style="clear: both;"></div>
              </div>
            `;
          });
          
          tasksHtml += `</div></div>`;
        });
      } else {
        tasksHtml = `<p style="font-size: 12px; color: #A1AAB9; margin-top: 15px;">No pending assignments.</p>`;
      }

      const examsHtml = alertSettings.includeExams ? this.buildExamsHtml(toEmail, false) : '';
      const body = `
        <h2 class="title">Pending Assignments Digest</h2>
        <p class="desc">
          Here is a summary of all your currently unfinished coursework in Classroom Hub.
        </p>
        ${tasksHtml}
        ${examsHtml}
      `;

      const html = this.wrapHtmlEmail('Pending Assignments Digest', body);
      await GoogleRepository.sendEmail(accessToken, toEmail, 'Pending Assignments Digest - Classroom Hub', html);
      this.recordEmailSent(toEmail);
      
      addNotificationHistoryLog({
        title: `Sent pending assignments digest (Total ${todoTasks.length} items)`,
        type: 'manual_digest',
        targetPath: '/dashboard'
      }, toEmail);
    });
  }

  /**
   * Main evaluator to scan deadlines and trigger email alerts.
   */
  static async evaluateNotifications(accessToken, toEmail, assignments, courses, resources, options = {}) {
    return this.withNotificationLock(toEmail, () =>
      this.evaluateNotificationsLocked(accessToken, toEmail, assignments, courses, resources, options)
    );
  }

  static async evaluateNotificationsLocked(accessToken, toEmail, assignments, courses, resources, options = {}) {
    const isEmailEnabled = getEnableEmailAlerts(toEmail);
    const alertSettings = getAlertSettings(toEmail);
    const isDiscordReady = Boolean(
      alertSettings.discordEnabled &&
      DiscordService.validateWebhookUrl(alertSettings.discordWebhookUrl).valid
    );

    if (!isEmailEnabled && !isDiscordReady) return;

    // Read inside the lock so records persisted by a previous/concurrent run are visible.
    const sentRecords = getSentNotifications(toEmail);
    const now = new Date();

    const wasSent = (assignmentId, type) =>
      sentRecords.some(r => r.assignmentId === assignmentId && r.type === type);
    const markSent = (assignmentId, type) => {
      const record = { assignmentId, type, sentAt: new Date().toISOString() };
      sentRecords.push(record);
      this.persistSentRecord(toEmail, record);
    };

    const hiddenCourseIds = getHiddenCourses(toEmail);
    const activeTodoAssignments = assignments.filter(a => {
      if (a.status === 'done' || a.status === 'read') return false;
      if (a.courseId && hiddenCourseIds.includes(a.courseId)) return false;
      return true;
    });

    // 1. Due date Reminders
    for (const task of activeTodoAssignments) {
      if (!task.dueDate) continue;

      const diffDays = getCalendarDaysDiff(task.dueDate, now);
      if (diffDays === null) continue;

      let triggerType = null;
      let subject = '';
      let warningLabel = '';

      if (diffDays === 3 && alertSettings.due3Days) {
        triggerType = 'due_3_days';
        subject = `[Classroom Hub] Reminder: 3 Days Before Due: ${task.title}`;
        warningLabel = 'Due in 3 days';
      } else if (diffDays === 1 && alertSettings.due1Day) {
        triggerType = 'due_1_day';
        subject = `[Classroom Hub] Urgent: Due Tomorrow: ${task.title}`;
        warningLabel = 'Due tomorrow';
      } else if (diffDays === 0 && alertSettings.dueToday) {
        triggerType = 'due_today';
        subject = `[Classroom Hub] Due Today: ${task.title}`;
        warningLabel = 'Due today';
      } else if (diffDays === -1 && alertSettings.overdue1Day) {
        triggerType = 'overdue_1_day';
        subject = `[Classroom Hub] Overdue: ${task.title}`;
        warningLabel = 'Overdue by 1 day';
      }

      if (!triggerType) continue;

      // 1a. Gmail Reminder Channel
      if (isEmailEnabled && !wasSent(task.id, triggerType)) {
        if (!this.hasDailyQuota(toEmail)) {
          // Not recorded as sent: it will be retried on a later sync once quota is available.
          logger.info(`[Notify] Daily email quota reached; deferring '${triggerType}' for ${task.id}.`);
        } else {
          const safeLink = sanitizeExternalUrl(task.googleLink);
          const body = `
            <h2 class="title" style="color: ${triggerType.includes('overdue') ? '#F87171' : '#FBBF24'};">
              ${escapeHtml(warningLabel)}
            </h2>
            <div style="border-left: 4px solid ${getHexColor(task.courseColor)}; background-color: #11141C; border: 1px solid #2A3140; border-left-width: 4px; border-radius: 8px; padding: 15px; margin-top: 15px;">
              <span style="font-size: 11px; color: #A1AAB9; font-weight: 500;">${escapeHtml(task.courseCode)} • ${escapeHtml(task.course)}</span>
              <h3 style="color: #EEF0F5; margin: 4px 0 10px 0; font-size: 15px;">${escapeHtml(task.title)}</h3>
              <p style="font-size: 12px; color: #E2E5EE; line-height: 1.6; margin: 0;">${escapeHtml(task.description || 'No description provided.')}</p>
            </div>
            ${safeLink ? `<a href="${escapeHtml(safeLink)}" target="_blank" rel="noopener noreferrer" class="button">View on Google Classroom</a>` : ''}
          `;
          const html = this.wrapHtmlEmail(subject, body);
          await GoogleRepository.sendEmail(accessToken, toEmail, subject, html);
          this.recordEmailSent(toEmail);
          markSent(task.id, triggerType);

          addNotificationHistoryLog({
            title: `Sent reminder for '${task.title}' (${warningLabel})`,
            type: triggerType,
            assignmentId: task.id,
            targetPath: `/assignments/${task.id}`,
            read: false
          }, toEmail);
        }
      }

      // 1b. Discord Webhook Reminder Channel
      const discordRecordType = `discord:${triggerType}`;
      if (isDiscordReady && !wasSent(task.id, discordRecordType)) {
        try {
          const discordPayload = DiscordService.buildDeadlineReminderPayload(task, triggerType, warningLabel);
          await DiscordService.sendWebhook(alertSettings.discordWebhookUrl, discordPayload);
          markSent(task.id, discordRecordType);

          if (!isEmailEnabled) {
            addNotificationHistoryLog({
              title: `Sent Discord reminder for '${task.title}' (${warningLabel})`,
              type: discordRecordType,
              assignmentId: task.id,
              targetPath: `/assignments/${task.id}`,
              read: false
            }, toEmail);
          }
        } catch (discordErr) {
          logger.warn(`[Notify] Discord reminder failed for ${task.id}:`, discordErr);
          if (!isEmailEnabled) throw discordErr;
        }
      }
    }

    // 2. Sunday Digest (No Due Date Tasks & Upcoming Exams)
    if (alertSettings.sundayDigest) {
      const isSunday = now.getDay() === 0;
      const digestTimeStr = getSundayDigestTime(toEmail);
      const [targetHour, targetMinute] = digestTimeStr.split(':').map(Number);
      
      const currentHour = now.getHours();
      const currentMin = now.getMinutes();
      const timePassedTarget = (currentHour > targetHour) || (currentHour === targetHour && currentMin >= targetMinute);
      
      const sundayDate = new Date(now);
      sundayDate.setDate(now.getDate() - now.getDay());
      // Week key must be stable for the whole local week regardless of time of day.
      const sundayStamp = this.localDateStamp(sundayDate);
      const digestRecordType = `sunday_digest_${sundayStamp}`;
      // Records written by older builds used a UTC-derived stamp; honour them to avoid a resend.
      const legacyRecordType = `sunday_digest_${sundayDate.toISOString().split('T')[0]}`;
      const discordDigestRecordType = `discord_sunday_digest_${sundayStamp}`;

      const alreadySentThisWeek = sentRecords.some(r => r.type === digestRecordType || r.type === legacyRecordType);
      const alreadySentDiscordThisWeek = sentRecords.some(r => r.type === discordDigestRecordType);

      // Compute Sunday's scheduled delivery timestamp for this week
      const sundayCutoff = new Date(sundayDate);
      sundayCutoff.setHours(Number.isFinite(targetHour) ? targetHour : 18, Number.isFinite(targetMinute) ? targetMinute : 0, 0, 0);
      const prevSyncIso = options?.prevLastSync !== undefined ? options.prevLastSync : getLastSync(toEmail);
      const prevSyncMs = prevSyncIso ? new Date(prevSyncIso).getTime() : NaN;
      const genuinelyMissedSunday = !isSunday && Number.isFinite(prevSyncMs) && prevSyncMs < sundayCutoff.getTime();

      if ((isSunday && timePassedTarget) || genuinelyMissedSunday) {
        const noDueDateTasks = activeTodoAssignments.filter(a => !a.dueDate);
        const hasUpcomingExams = alertSettings.includeExams && this.buildExamsHtml(toEmail, true) !== '';

        if (noDueDateTasks.length > 0 || hasUpcomingExams) {
          if (isEmailEnabled && !alreadySentThisWeek && this.hasDailyQuota(toEmail)) {
            let itemsHtml = '';
            if (noDueDateTasks.length > 0) {
              const courseGroups = {};
              noDueDateTasks.forEach(task => {
                if (!courseGroups[task.course]) {
                  courseGroups[task.course] = [];
                }
                courseGroups[task.course].push(task);
              });

              Object.keys(courseGroups).forEach(courseName => {
                const list = courseGroups[courseName];
                const borderHex = getHexColor(list[0].courseColor);
                
                itemsHtml += `
                  <div style="margin-top: 16px; border: 1px solid #2A3140; border-left: 4px solid ${borderHex}; background-color: #11141C; border-radius: 10px; padding: 16px;">
                    <h4 style="color: #EEF0F5; margin: 0 0 12px 0; font-size: 14px; font-weight: 600;">${escapeHtml(courseName)}</h4>
                    <div style="font-size: 13px; color: #E2E5EE; line-height: 1.6; margin-top: 8px;">
                `;
                list.forEach(t => {
                  itemsHtml += `
                    <div style="padding: 8px 0; border-bottom: 1px solid #2A3140; color: #EEF0F5; font-weight: 500;">
                      • ${escapeHtml(t.title)}
                    </div>
                  `;
                });
                itemsHtml += `</div></div>`;
              });
            } else {
              itemsHtml = `<p style="font-size: 12px; color: #A1AAB9; margin-top: 15px;">No pending assignments with no due date.</p>`;
            }

            const examsHtml = alertSettings.includeExams ? this.buildExamsHtml(toEmail, true) : '';

            const body = `
              <h2 class="title" style="color: #60A5FA;">Sunday Digest: Weekly Summary</h2>
              <p class="desc">
                Here is your weekly summary of pending tasks and upcoming exams.
              </p>
              ${itemsHtml}
              ${examsHtml}
            `;

            const digestSubject = `[Classroom Hub] Sunday Digest: Weekly summary`;
            const html = this.wrapHtmlEmail(digestSubject, body);
            await GoogleRepository.sendEmail(accessToken, toEmail, digestSubject, html);
            this.recordEmailSent(toEmail);
            markSent('sunday_digest_overall', digestRecordType);
            
            addNotificationHistoryLog({
              title: `Sent Sunday Digest email (Total ${noDueDateTasks.length} tasks)`,
              type: 'sunday_digest',
              targetPath: '/dashboard',
              read: false
            }, toEmail);
          }

          if (isDiscordReady && !alreadySentDiscordThisWeek) {
            try {
              const discordDigest = DiscordService.buildDigestPayload({
                title: '🗓️ Sunday Digest: Weekly Summary',
                description: 'Here is your weekly summary of pending tasks and upcoming exams.',
                tasks: noDueDateTasks,
                toEmail,
                includeExams: Boolean(alertSettings.includeExams),
                isWeeklyDigest: true,
                colorInt: DISCORD_COLORS.blue
              });
              await DiscordService.sendWebhook(alertSettings.discordWebhookUrl, discordDigest);
              markSent('sunday_digest_overall', discordDigestRecordType);

              if (!isEmailEnabled) {
                addNotificationHistoryLog({
                  title: `Sent Sunday Digest to Discord (Total ${noDueDateTasks.length} tasks)`,
                  type: 'discord_sunday_digest',
                  targetPath: '/dashboard',
                  read: false
                }, toEmail);
              }
            } catch (discordErr) {
              logger.warn('[Notify] Discord Sunday Digest failed:', discordErr);
              if (!isEmailEnabled) throw discordErr;
            }
          }
        }
      }
    }
  }

  /**
   * Evaluates and groups new classroom uploads into a consolidated sync email digest
   */
  static async evaluateNewPostDigest(accessToken, toEmail, freshAssignments, freshResources, cachedAssignmentIds, cachedResourceIds) {
    return this.withNotificationLock(toEmail, () =>
      this.evaluateNewPostDigestLocked(accessToken, toEmail, freshAssignments, freshResources, cachedAssignmentIds, cachedResourceIds)
    );
  }

  static async evaluateNewPostDigestLocked(accessToken, toEmail, freshAssignments, freshResources, cachedAssignmentIds, cachedResourceIds) {
    const isEmailEnabled = getEnableEmailAlerts(toEmail);
    const alertSettings = getAlertSettings(toEmail);
    const isDiscordReady = Boolean(
      alertSettings.discordEnabled &&
      DiscordService.validateWebhookUrl(alertSettings.discordWebhookUrl).valid
    );

    if ((!isEmailEnabled && !isDiscordReady) || !alertSettings.newPosts) return;

    // Per-item dedup: an item announced once is never announced again, even if a concurrent
    // sync or another device computed the same "new" diff from a stale cache.
    const sentRecords = getSentNotifications(toEmail);
    const alreadyAnnouncedEmail = (id) => sentRecords.some(r => r.assignmentId === id && r.type === NEW_POST_RECORD_TYPE);
    const alreadyAnnouncedDiscord = (id) => sentRecords.some(r => r.assignmentId === id && r.type === DISCORD_NEW_POST_RECORD_TYPE);

    const hiddenCourseIds = getHiddenCourses(toEmail);
    const cutoffRecentMs = Date.now() - NEW_POST_MAX_AGE_MS;
    const isRecentEnough = (item) => {
      if (!item?.creationTime) return true;
      const t = new Date(item.creationTime).getTime();
      return Number.isNaN(t) || t >= cutoffRecentMs;
    };

    const filterCandidates = (items, cachedIds, dedupCheck) => items.filter(item => {
      if (cachedIds.includes(item.id)) return false;
      if (item.courseId && hiddenCourseIds.includes(item.courseId)) return false;
      if (dedupCheck(item.id)) return false;
      if (!isRecentEnough(item)) return false;
      return true;
    });

    if (isEmailEnabled) {
      const newAssignments = filterCandidates(freshAssignments, cachedAssignmentIds, alreadyAnnouncedEmail);
      const newResources = filterCandidates(freshResources, cachedResourceIds, alreadyAnnouncedEmail);
      const totalNew = newAssignments.length + newResources.length;

      if (totalNew > 0) {
        if (!this.hasDailyQuota(toEmail)) {
          logger.info('[Notify] Daily email quota reached; skipping new-post digest.');
        } else {
          const courseGroups = {};
          newAssignments.forEach(t => {
            if (!courseGroups[t.course]) courseGroups[t.course] = { color: t.courseColor, assigns: [], resources: [] };
            courseGroups[t.course].assigns.push(t);
          });
          newResources.forEach(r => {
            if (!courseGroups[r.course]) courseGroups[r.course] = { color: r.courseColor, assigns: [], resources: [] };
            courseGroups[r.course].resources.push(r);
          });

          let groupHtml = '';
          Object.keys(courseGroups).forEach(courseName => {
            const group = courseGroups[courseName];
            const borderHex = getHexColor(group.color);
            
            groupHtml += `
              <div style="margin-top: 15px; border: 1px solid #2A3140; border-left: 4px solid ${borderHex}; background-color: #11141C; border-radius: 8px; padding: 12px 15px;">
                <h4 style="color: #EEF0F5; margin: 0 0 8px 0; font-size: 13px;">${escapeHtml(courseName)}</h4>
            `;
            
            if (group.assigns.length > 0) {
              groupHtml += `<p style="font-size: 11px; font-weight: 600; color: #A78BFA; margin: 8px 0 4px 0;">New Assignments (${group.assigns.length})</p>`;
              group.assigns.forEach(t => {
                groupHtml += `<div style="font-size: 12px; color: #EEF0F5; padding: 4px 0; border-bottom: 1px solid #2A3140;">• <strong>${escapeHtml(t.title)}</strong></div>`;
              });
            }
            
            if (group.resources.length > 0) {
              const anns = group.resources.filter(r => r.type === 'announcement');
              const mats = group.resources.filter(r => r.type === 'material');
              
              if (anns.length > 0) {
                groupHtml += `<p style="font-size: 11px; font-weight: 600; color: #FBBF24; margin: 10px 0 4px 0;">New Announcements (${anns.length})</p>`;
                anns.forEach(r => {
                  groupHtml += `<div style="font-size: 12px; color: #EEF0F5; padding: 4px 0; border-bottom: 1px solid #2A3140;">• <strong>${escapeHtml(r.title)}</strong></div>`;
                });
              }
              
              if (mats.length > 0) {
                groupHtml += `<p style="font-size: 11px; font-weight: 600; color: #60A5FA; margin: 10px 0 4px 0;">New Course Materials (${mats.length})</p>`;
                mats.forEach(r => {
                  groupHtml += `<div style="font-size: 12px; color: #EEF0F5; padding: 4px 0; border-bottom: 1px solid #2A3140;">• <strong>${escapeHtml(r.title)}</strong></div>`;
                });
              }
            }
            groupHtml += `</div>`;
          });

          const subject = `[Classroom Hub] Detected ${totalNew} new items in classroom`;
          const body = `
            <h2 class="title" style="color: #60A5FA;">New Classroom Activity Detected</h2>
            <p class="desc">
              Detected ${totalNew} new assignment(s), announcement(s), or material(s) uploaded by your instructors.
            </p>
            ${groupHtml}
          `;

          const html = this.wrapHtmlEmail(subject, body);
          await GoogleRepository.sendEmail(accessToken, toEmail, subject, html);
          this.recordEmailSent(toEmail);
          const sentAt = new Date().toISOString();
          this.persistSentRecords(toEmail, [...newAssignments, ...newResources].map(item => ({
            assignmentId: item.id,
            type: NEW_POST_RECORD_TYPE,
            sentAt
          })));
          
          addNotificationHistoryLog({
            title: `Detected and sent new posts email (Total ${totalNew} items)`,
            type: 'new_posts_digest',
            targetPath: newAssignments.length === 1 && newResources.length === 0 ? `/assignments/${newAssignments[0].id}` : '/dashboard',
            read: false
          }, toEmail);
        }
      }
    }

    if (isDiscordReady) {
      const discordNewAssigns = filterCandidates(freshAssignments, cachedAssignmentIds, alreadyAnnouncedDiscord);
      const discordNewResources = filterCandidates(freshResources, cachedResourceIds, alreadyAnnouncedDiscord);
      const totalDiscordNew = discordNewAssigns.length + discordNewResources.length;

      if (totalDiscordNew > 0) {
        try {
          const discordPayload = DiscordService.buildNewPostsPayload(discordNewAssigns, discordNewResources);
          await DiscordService.sendWebhook(alertSettings.discordWebhookUrl, discordPayload);
          const sentAt = new Date().toISOString();
          this.persistSentRecords(toEmail, [...discordNewAssigns, ...discordNewResources].map(item => ({
            assignmentId: item.id,
            type: DISCORD_NEW_POST_RECORD_TYPE,
            sentAt
          })));

          if (!isEmailEnabled) {
            addNotificationHistoryLog({
              title: `Detected and sent new posts to Discord (Total ${totalDiscordNew} items)`,
              type: 'discord_new_posts_digest',
              targetPath: discordNewAssigns.length === 1 && discordNewResources.length === 0 ? `/assignments/${discordNewAssigns[0].id}` : '/dashboard',
              read: false
            }, toEmail);
          }
        } catch (discordErr) {
          logger.warn('[Notify] Discord new-post digest failed:', discordErr);
          if (!isEmailEnabled) throw discordErr;
        }
      }
    }
  }
}
