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
  getLastSync,
  getSchedule,
  getAssignments,
  getResources,
  getDeletedIds
} from '../utils/storage';
import { GoogleRepository } from '../repositories/GoogleRepository';
import { examRepository } from '../repositories/examRepository';
import { parseExamDate } from '../utils/examDate';
import { getMergedExams } from '../utils/examMerger';
import { escapeHtml, sanitizeExternalUrl } from '../utils/sanitize';
import { NOTIFICATION_CONFIG } from '../config/notification';
import { logger } from '../utils/logger';
import { getCalendarDaysDiff, parseLocalDateInput } from '../utils/dateUtils';
import { getHexColor } from '../utils/colors';
import { DiscordService } from './DiscordService';
import {
  buildEventIdentity,
  NotificationLedger
} from './notifications/NotificationLedger';
import {
  buildAcademicSnapshot,
  buildWeeklyDigestData,
  checkDeliveryGate,
  evaluateAssignmentCandidates,
  evaluateExamCandidates,
  evaluateScheduleAndBriefingCandidates,
  filterNewClassroomItems,
  isWeeklyDigestWindowDue
} from './notifications/NotificationEngine';
import { DiscordMessageBuilder } from './notifications/DiscordMessageBuilder';
import { PRIORITY } from './notifications/notificationSchema';
import {
  getZonedDateParts,
  hasTimePassedToday,
  normalizeTimezone
} from './notifications/timeUtils';
import { resolveExamIsoDate } from '../utils/courseEndDate';

const SENT_RECORD_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
const NEW_POST_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_NEW_POST_RECORDS = 500;
const NEW_POST_RECORD_TYPE = 'new_post';
const DISCORD_NEW_POST_RECORD_TYPE = 'discord_new_post';
const isNewPostRecordType = (type) =>
  type === NEW_POST_RECORD_TYPE || type === DISCORD_NEW_POST_RECORD_TYPE;
const inTabLocks = new Map();

export class NotificationService {
  /**
   * Wraps email body in a clean dark HTML email template
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

  static localDateStamp(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  static hasDailyQuota(email) {
    const limit = getDailyEmailLimit(email);
    const sentToday = limit.lastSentDate === this.localDateStamp() ? Number(limit.count) || 0 : 0;
    return sentToday < NOTIFICATION_CONFIG.maxDailyEmails;
  }

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

  static persistSentRecord(email, record) {
    this.persistSentRecords(email, [record]);
  }

  static persistSentRecords(email, records) {
    const current = getSentNotifications(email);
    const isKnown = (rec, list) =>
      list.some((r) => r.assignmentId === rec.assignmentId && r.type === rec.type);
    const additions = [];
    records.forEach((rec) => {
      if (!isKnown(rec, current) && !isKnown(rec, additions)) additions.push(rec);
    });
    if (additions.length === 0) return;
    const cutoff = Date.now() - SENT_RECORD_RETENTION_MS;
    const newPostRecords = current.filter((r) => isNewPostRecordType(r.type));
    const otherPruned = current.filter((r) => {
      if (isNewPostRecordType(r.type)) return false;
      const t = new Date(r.sentAt).getTime();
      return Number.isNaN(t) || t >= cutoff;
    });
    const combinedNewPosts = [
      ...newPostRecords,
      ...additions.filter((r) => isNewPostRecordType(r.type))
    ].slice(-MAX_NEW_POST_RECORDS);
    const combinedOthers = [
      ...otherPruned,
      ...additions.filter((r) => !isNewPostRecordType(r.type))
    ];
    saveSentNotifications([...combinedNewPosts, ...combinedOthers], email);
  }

  /**
   * Serializes notification evaluation per user across tabs (Web Locks API) and within a tab
   * (promise chain fallback) so two concurrent runs cannot send duplicate notifications.
   */
  static async withNotificationLock(email, fn) {
    const lockName = `classroom_hub_notify_${(email || '').toLowerCase().trim()}`;
    if (
      typeof navigator !== 'undefined' &&
      navigator.locks &&
      typeof navigator.locks.request === 'function'
    ) {
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
   * Generates Upcoming Exams HTML table for Gmail digests using canonical `getMergedExams()`.
   */
  static buildExamsHtml(toEmail, isWeeklyDigest = false) {
    if (!toEmail) return '';
    const emailKey = toEmail.toLowerCase().trim();

    try {
      const cachedRes = examRepository.getCachedExams(emailKey);
      if (!cachedRes.success || !cachedRes.data) return '';
      const exams = getMergedExams(
        cachedRes.data.exams || [],
        cachedRes.data.manualExams || []
      );
      if (exams.length === 0) return '';

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const upcomingExams = exams.filter((exam) => {
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
      const nextName = nextExam.courseName || nextExam.subjectName || '';
      const nextCode = nextExam.courseCode || nextExam.subjectCode || '';

      const highlightHtml = `
        <div style="margin-top: 25px; border: 1px dashed #FBBF24; background-color: #11141C; border-radius: 10px; padding: 15px; margin-bottom: 20px;">
          <span style="font-size: 11px; color: #FBBF24; font-weight: 600;">Next Exam</span>
          <h4 style="color: #EEF0F5; margin: 6px 0 2px 0; font-size: 14px;">${escapeHtml(nextCode)} • ${escapeHtml(nextName)}</h4>
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
      displayExams.forEach((exam) => {
        const examDate = parseExamDate(exam.rawIsoDate || exam.date);
        const remainingLabel = getRemainingLabel(examDate);
        const isManualLabel = exam.isManual
          ? ' <span style="font-size: 11px; color: #A78BFA; background-color: #1F2532; padding: 1px 5px; border-radius: 4px;">Manual</span>'
          : '';
        const seatText = exam.seat || '-';

        tableRows += `
        <tr style="border-bottom: 1px solid #2A3140;">
          <td style="padding: 12px 8px; font-size: 12px; color: #EEF0F5;">
            <strong>${escapeHtml(exam.courseCode || exam.subjectCode || '')}</strong><br/>
            <span style="font-size: 11px; color: #A1AAB9;">${escapeHtml(exam.courseName || exam.subjectName || '')}</span>${isManualLabel ? '<br/>' + isManualLabel : ''}
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

      const extraFooterHtml = hiddenCount > 0
        ? `<div style="text-align: center; font-size: 12px; color: #A78BFA; padding: 10px; font-weight: 600;">+ And ${hiddenCount} more upcoming exam${hiddenCount > 1 ? 's' : ''}...</div>`
        : '';

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

  static async sendDiscordAndTrack(targetUrl, payload, options = {}) {
    const res = await DiscordService.sendWebhook(targetUrl, payload, options);
    if (options.email && !res?.recordedTelemetry) {
      const emailKey = String(options.email).toLowerCase().trim();
      const prev = NotificationLedger.getTelemetry(emailKey);
      NotificationLedger.recordTelemetry(emailKey, {
        lastAttemptAt: new Date().toISOString(),
        lastSuccessAt: new Date().toISOString(),
        lastSuccessType: options.eventType || 'discord_webhook',
        lastStatus: 'delivered',
        lastErrorMessage: null,
        consecutiveFailures: 0,
        totalDelivered: (Number(prev.totalDelivered) || 0) + 1
      });
    }
    return res;
  }

  /**
   * Internal unified Discord event dispatcher with Ledger claiming, backoff, quiet hours,
   * independent notification history logging (even when Gmail is active!), and error telemetry.
   */
  static async dispatchDiscordCandidate(
    toEmail,
    webhookUrl,
    candidate,
    alertSettings,
    now = new Date(),
    { rethrowOnFailure = false } = {}
  ) {
    const nowMs = new Date(now).getTime();

    // 1. Priority & Quiet Hours check
    const gate = checkDeliveryGate(candidate.priority, alertSettings, now);
    if (!gate.allowed) {
      return { sent: false, deferred: gate.reason === 'quiet_hours_deferred', reason: gate.reason };
    }

    // 2. Shared Ledger & Legacy deduplication check
    const legacyCheck = candidate.legacyDiscordType
      ? { assignmentId: candidate.sourceId, type: candidate.legacyDiscordType }
      : null;

    const eligibility = NotificationLedger.evaluateEligibility(toEmail, candidate.eventKey, {
      nowMs,
      legacyCheck,
      stage: candidate.stage,
      maxRetries: alertSettings.maxRetries ?? 3
    });

    if (!eligibility.eligible) {
      return { sent: false, deferred: false, reason: eligibility.reason };
    }

    // 3. Claim event atomically under Web Lock before HTTP transmission
    NotificationLedger.claim(
      toEmail,
      {
        eventKey: candidate.eventKey,
        eventType: candidate.eventType,
        sourceId: candidate.sourceId,
        stage: candidate.stage,
        priority: candidate.priority,
        channel: 'discord'
      },
      nowMs
    );

    try {
      await this.sendDiscordAndTrack(webhookUrl, candidate.payload, {
        email: toEmail,
        eventType: `${candidate.eventType}:${candidate.stage}`,
        maxRetries: Math.min(Number(alertSettings.maxRetries ?? 2), 3)
      });

      const legacyRecord = candidate.legacyDiscordType
        ? { assignmentId: candidate.sourceId, type: candidate.legacyDiscordType }
        : null;

      NotificationLedger.markDelivered(toEmail, candidate.eventKey, {
        legacyRecord,
        legacyRecords: candidate.legacyRecords || null,
        nowMs
      });

      // Always record Discord history independently (fixes muted-history bug when Gmail is also enabled)
      addNotificationHistoryLog(
        {
          title: candidate.historyTitle,
          type: candidate.legacyDiscordType || `discord:${candidate.eventType}:${candidate.stage}`,
          channel: 'discord',
          priority: candidate.priority,
          status: 'delivered',
          assignmentId: candidate.task?.id || undefined,
          targetPath: candidate.targetPath || '/dashboard',
          read: false
        },
        toEmail
      );

      return { sent: true, reason: 'delivered' };
    } catch (discordErr) {
      const retryable = Boolean(discordErr?.retryable);
      const ambiguousTimeout = Boolean(discordErr?.ambiguousTimeout);

      NotificationLedger.markFailed(toEmail, candidate.eventKey, {
        errorMessage: DiscordService.scrubSecrets(discordErr?.message || 'Discord delivery failed'),
        retryable,
        ambiguousTimeout,
        maxRetries: alertSettings.maxRetries ?? 3,
        nowMs
      });

      if (!retryable || ambiguousTimeout) {
        addNotificationHistoryLog(
          {
            title: ambiguousTimeout
              ? `Discord timeout (delivery uncertain): ${candidate.historyTitle}`
              : `Discord delivery failed: ${candidate.historyTitle}`,
            type: 'discord_error',
            channel: 'discord',
            priority: candidate.priority,
            status: ambiguousTimeout ? 'ambiguous' : 'failed',
            targetPath: '/settings',
            read: false
          },
          toEmail
        );
      }

      logger.warn(`[Notify] Discord dispatch failed for ${candidate.eventKey}:`, DiscordService.scrubSecrets(discordErr?.message));
      if (rethrowOnFailure) throw discordErr;
      return { sent: false, failed: true, retryable, reason: 'delivery_error' };
    }
  }

  static async triggerTestEmail(accessToken, toEmail) {
    return this.withNotificationLock(toEmail, async () => {
      if (!this.hasDailyQuota(toEmail)) {
        throw new Error(
          `Failed to send test email: Daily email limit (${NOTIFICATION_CONFIG.maxDailyEmails}) reached.`
        );
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
            <li>7 Days Before Due: <strong>${alertSettings.due7Days ? 'Enabled' : 'Disabled'}</strong></li>
            <li>3 Days Before Due: <strong>${alertSettings.due3Days ? 'Enabled' : 'Disabled'}</strong></li>
            <li>1 Day Before Due: <strong>${alertSettings.due1Day ? 'Enabled' : 'Disabled'}</strong></li>
            <li>Due Today: <strong>${alertSettings.dueToday ? 'Enabled' : 'Disabled'}</strong></li>
            <li>Overdue Catch-Up: <strong>${alertSettings.overdue1Day ? 'Enabled' : 'Disabled'}</strong></li>
            <li>New Posts (Consolidated): <strong>${alertSettings.newPosts ? 'Enabled' : 'Disabled'}</strong></li>
            <li>Sunday Digest: <strong>${alertSettings.sundayDigest ? `Every Sunday at ${escapeHtml(time)}` : 'Disabled'}</strong></li>
          </ul>
        </div>
      `;

      const html = this.wrapHtmlEmail('Classroom Hub: Gmail Integration Success', body);
      await GoogleRepository.sendEmail(accessToken, toEmail, 'Classroom Hub: Gmail Integration Success', html);
      this.recordEmailSent(toEmail);

      addNotificationHistoryLog(
        {
          title: 'Sent connection test email successfully',
          type: 'test_email',
          channel: 'email',
          targetPath: '/settings'
        },
        toEmail
      );
    });
  }

  static async triggerTestDiscord(toEmail, webhookUrlOverride = '') {
    return this.withNotificationLock(toEmail || 'default', async () => {
      const alertSettings = getAlertSettings(toEmail);
      const sundayTime = alertSettings.weeklyDigestTime || getSundayDigestTime(toEmail);
      const targetUrl = (webhookUrlOverride || alertSettings.discordWebhookUrl || '').trim();

      const payload = DiscordService.buildTestPayload(toEmail, alertSettings, sundayTime);
      await this.sendDiscordAndTrack(targetUrl, payload, {
        email: toEmail,
        eventType: 'test_discord'
      });

      if (toEmail) {
        addNotificationHistoryLog(
          {
            title: 'Sent connection test message to Discord successfully',
            type: 'test_discord',
            channel: 'discord',
            status: 'delivered',
            targetPath: '/settings'
          },
          toEmail
        );
      }
    });
  }

  static async triggerManualDiscordDigest(toEmail, assignments = [], webhookUrlOverride = '') {
    return this.withNotificationLock(toEmail || 'default', async () => {
      const alertSettings = getAlertSettings(toEmail);
      const hiddenCourseIds = getHiddenCourses(toEmail);
      const targetUrl = (webhookUrlOverride || alertSettings.discordWebhookUrl || '').trim();

      const todoTasks = (Array.isArray(assignments) ? assignments : []).filter((a) => {
        if (a.status === 'done' || a.status === 'read') return false;
        if (a.courseId && hiddenCourseIds.includes(a.courseId)) return false;
        return true;
      });

      const hasUpcomingExams = Boolean(
        alertSettings.includeExams && DiscordService.buildExamsEmbed(toEmail, false)
      );
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

      await this.sendDiscordAndTrack(targetUrl, payload, {
        email: toEmail,
        eventType: 'manual_discord_digest'
      });

      if (toEmail) {
        addNotificationHistoryLog(
          {
            title: `Sent pending assignments digest to Discord (Total ${todoTasks.length} items)`,
            type: 'discord_digest',
            channel: 'discord',
            status: 'delivered',
            targetPath: '/dashboard'
          },
          toEmail
        );
      }
    });
  }

  /**
   * Sends a live Morning Briefing preview to Discord using the user's real schedule, tasks, and exams
   * without consuming the daily automated Morning Briefing deduplication key.
   */
  static async triggerMorningBriefingPreview(toEmail, contextOverrides = {}, webhookUrlOverride = '') {
    return this.withNotificationLock(toEmail || 'default', async () => {
      const alertSettings = getAlertSettings(toEmail);
      const targetUrl = (webhookUrlOverride || alertSettings.discordWebhookUrl || '').trim();
      const hiddenCourseIds = getHiddenCourses(toEmail);
      const cachedExamsRes = examRepository.getCachedExams(toEmail);
      const examData = cachedExamsRes.success && cachedExamsRes.data ? cachedExamsRes.data : {};

      const { briefingCandidate } = evaluateScheduleAndBriefingCandidates({
        schedule: contextOverrides.schedule ?? getSchedule(toEmail),
        assignments: contextOverrides.assignments ?? getAssignments(toEmail),
        resources: contextOverrides.resources ?? getResources(toEmail),
        exams: contextOverrides.exams ?? examData.exams ?? [],
        manualExams: contextOverrides.manualExams ?? examData.manualExams ?? [],
        hiddenCourseIds,
        alertSettings,
        now: contextOverrides.now || new Date(),
        forcePreview: true
      });

      if (!briefingCandidate) {
        throw new Error('Unable to generate Morning Briefing preview.');
      }

      await this.sendDiscordAndTrack(targetUrl, briefingCandidate.payload, {
        email: toEmail,
        eventType: 'preview_morning_briefing'
      });

      if (toEmail) {
        addNotificationHistoryLog(
          {
            title: 'Sent Morning Briefing preview to Discord',
            type: 'discord_morning_preview',
            channel: 'discord',
            status: 'delivered',
            targetPath: '/schedule'
          },
          toEmail
        );
      }
    });
  }

  /**
   * Sends a live Assignment Reminder preview using the nearest real pending assignment.
   */
  static async triggerAssignmentReminderPreview(toEmail, assignmentsInput = null, webhookUrlOverride = '') {
    return this.withNotificationLock(toEmail || 'default', async () => {
      const alertSettings = getAlertSettings(toEmail);
      const targetUrl = (webhookUrlOverride || alertSettings.discordWebhookUrl || '').trim();
      const hiddenCourseIds = getHiddenCourses(toEmail);
      const rawTasks = Array.isArray(assignmentsInput) ? assignmentsInput : getAssignments(toEmail);

      const pending = (rawTasks || []).filter((a) => {
        if (!a || a.status === 'done' || a.status === 'read') return false;
        if (a.courseId && hiddenCourseIds.includes(a.courseId)) return false;
        return true;
      });

      if (pending.length === 0) {
        throw new Error('No pending assignments available to preview.');
      }

      const withDue = pending
        .filter((a) => Boolean(a.dueDate))
        .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
      const sampleTask = withDue[0] || pending[0];

      const payload = DiscordMessageBuilder.buildAssignmentReminder(sampleTask, 'due_3_days', {
        timeZone: alertSettings.timezone,
        warningLabel: sampleTask.dueDate ? 'Assignment Preview' : 'No Due Date Preview'
      });

      await this.sendDiscordAndTrack(targetUrl, payload, {
        email: toEmail,
        eventType: 'preview_assignment_reminder'
      });

      if (toEmail) {
        addNotificationHistoryLog(
          {
            title: `Sent Assignment Reminder preview ('${sampleTask.title}')`,
            type: 'discord_assignment_preview',
            channel: 'discord',
            status: 'delivered',
            assignmentId: sampleTask.id,
            targetPath: `/assignments/${sampleTask.id}`
          },
          toEmail
        );
      }
    });
  }

  /**
   * Sends a live Exam Countdown preview using the next upcoming merged exam.
   */
  static async triggerExamCountdownPreview(toEmail, webhookUrlOverride = '') {
    return this.withNotificationLock(toEmail || 'default', async () => {
      const alertSettings = getAlertSettings(toEmail);
      const targetUrl = (webhookUrlOverride || alertSettings.discordWebhookUrl || '').trim();
      const timeZone = normalizeTimezone(alertSettings.timezone);
      const nowParts = getZonedDateParts(new Date(), timeZone);
      const cachedRes = examRepository.getCachedExams(toEmail);
      const examData = cachedRes.success && cachedRes.data ? cachedRes.data : {};
      const merged = getMergedExams(examData.exams || [], examData.manualExams || [], {
        todayIso: nowParts?.dateStr
      });

      const upcoming = merged
        .filter((ex) => {
          const iso = resolveExamIsoDate(ex);
          return iso && (!nowParts || iso >= nowParts.dateStr);
        })
        .sort((a, b) => (resolveExamIsoDate(a) > resolveExamIsoDate(b) ? 1 : -1));

      if (upcoming.length === 0) {
        throw new Error('No upcoming examinations found in your schedule to preview.');
      }

      const nextExam = upcoming[0];
      const payload = DiscordMessageBuilder.buildExamCountdown(nextExam, 'exam_3d', {
        daysLeft: 3,
        timeZone
      });

      await this.sendDiscordAndTrack(targetUrl, payload, {
        email: toEmail,
        eventType: 'preview_exam_countdown'
      });

      if (toEmail) {
        addNotificationHistoryLog(
          {
            title: `Sent Exam Countdown preview ('${nextExam.subjectName || nextExam.courseName || nextExam.courseCode}')`,
            type: 'discord_exam_preview',
            channel: 'discord',
            status: 'delivered',
            targetPath: '/exams'
          },
          toEmail
        );
      }
    });
  }

  /**
   * Sends a live Weekly Academic Report preview to Discord.
   */
  static async triggerWeeklyDigestPreview(toEmail, contextOverrides = {}, webhookUrlOverride = '') {
    return this.withNotificationLock(toEmail || 'default', async () => {
      const alertSettings = getAlertSettings(toEmail);
      const targetUrl = (webhookUrlOverride || alertSettings.discordWebhookUrl || '').trim();
      const hiddenCourseIds = getHiddenCourses(toEmail);
      const cachedExamsRes = examRepository.getCachedExams(toEmail);
      const examData = cachedExamsRes.success && cachedExamsRes.data ? cachedExamsRes.data : {};

      const weekly = buildWeeklyDigestData({
        assignments: contextOverrides.assignments ?? getAssignments(toEmail),
        resources: contextOverrides.resources ?? getResources(toEmail),
        schedule: contextOverrides.schedule ?? getSchedule(toEmail),
        exams: contextOverrides.exams ?? examData.exams ?? [],
        manualExams: contextOverrides.manualExams ?? examData.manualExams ?? [],
        hiddenCourseIds,
        alertSettings,
        now: contextOverrides.now || new Date()
      });

      await this.sendDiscordAndTrack(targetUrl, weekly.payload, {
        email: toEmail,
        eventType: 'preview_weekly_digest'
      });

      if (toEmail) {
        addNotificationHistoryLog(
          {
            title: 'Sent Weekly Academic Report preview to Discord',
            type: 'discord_weekly_preview',
            channel: 'discord',
            status: 'delivered',
            targetPath: '/dashboard'
          },
          toEmail
        );
      }
    });
  }

  static async triggerManualDigest(accessToken, toEmail, assignments) {
    return this.withNotificationLock(toEmail, async () => {
      if (!this.hasDailyQuota(toEmail)) {
        throw new Error(
          `Failed to send task digest: Daily email limit (${NOTIFICATION_CONFIG.maxDailyEmails}) reached.`
        );
      }

      const alertSettings = getAlertSettings(toEmail);
      const hiddenCourseIds = getHiddenCourses(toEmail);

      const todoTasks = assignments.filter((a) => {
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
        todoTasks.forEach((task) => {
          if (!courseGroups[task.course]) courseGroups[task.course] = [];
          courseGroups[task.course].push(task);
        });

        Object.keys(courseGroups).forEach((courseName) => {
          const list = courseGroups[courseName];
          const borderHex = getHexColor(list[0].courseColor);

          tasksHtml += `
            <div style="margin-top: 16px; border: 1px solid #2A3140; border-left: 4px solid ${borderHex}; background-color: #11141C; border-radius: 10px; padding: 16px;">
              <h4 style="color: #EEF0F5; margin: 0 0 12px 0; font-size: 14px; font-weight: 600;">${escapeHtml(courseName)}</h4>
              <div style="font-size: 13px; color: #E2E5EE; line-height: 1.6; margin-top: 8px;">
          `;

          list.forEach((t) => {
            const parsedDue = parseLocalDateInput(t.dueDate);
            const dueLabel = parsedDue
              ? parsedDue.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
              : 'No Due Date';
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
        <p class="desc">Here is a summary of all your currently unfinished coursework in Classroom Hub.</p>
        ${tasksHtml}
        ${examsHtml}
      `;

      const html = this.wrapHtmlEmail('Pending Assignments Digest', body);
      await GoogleRepository.sendEmail(accessToken, toEmail, 'Pending Assignments Digest - Classroom Hub', html);
      this.recordEmailSent(toEmail);

      addNotificationHistoryLog(
        {
          title: `Sent pending assignments digest (Total ${todoTasks.length} items)`,
          type: 'manual_digest',
          channel: 'email',
          targetPath: '/dashboard'
        },
        toEmail
      );
    });
  }

  /**
   * Evaluates time-sensitive schedule notifications (07:00 Morning Briefing, 30m/5m Pre-Class alerts,
   * and optional Daily Digest) when the workspace is active.
   */
  static async evaluateScheduleTick(toEmail, context = {}) {
    if (!toEmail) return;
    return this.withNotificationLock(toEmail, async () => {
      const alertSettings = getAlertSettings(toEmail);
      const isDiscordReady = Boolean(
        alertSettings.discordEnabled &&
          alertSettings.deliveryAuthority !== 'apps_script' &&
          DiscordService.validateWebhookUrl(alertSettings.discordWebhookUrl).valid
      );
      if (!isDiscordReady) return;

      const now = context.now ? new Date(context.now) : new Date();
      const hiddenCourseIds = getHiddenCourses(toEmail);
      const cachedExamsRes = examRepository.getCachedExams(toEmail);
      const examData = cachedExamsRes.success && cachedExamsRes.data ? cachedExamsRes.data : {};

      const assignments = context.assignments ?? getAssignments(toEmail);
      const resources = context.resources ?? getResources(toEmail);
      const schedule = context.schedule ?? getSchedule(toEmail);
      const exams = context.exams ?? examData.exams ?? [];
      const manualExams = context.manualExams ?? examData.manualExams ?? [];

      const { briefingCandidate, classCandidates } = evaluateScheduleAndBriefingCandidates({
        schedule,
        assignments,
        resources,
        exams,
        manualExams,
        hiddenCourseIds,
        alertSettings,
        now
      });

      if (briefingCandidate) {
        await this.dispatchDiscordCandidate(
          toEmail,
          alertSettings.discordWebhookUrl,
          briefingCandidate,
          alertSettings,
          now
        );
      }

      for (const clsCand of classCandidates) {
        await this.dispatchDiscordCandidate(
          toEmail,
          alertSettings.discordWebhookUrl,
          clsCand,
          alertSettings,
          now
        );
      }

      // Optional Daily Digest (e.g. 20:00 summary)
      const timeZone = normalizeTimezone(alertSettings.timezone);
      const nowParts = getZonedDateParts(now, timeZone);
      if (
        alertSettings.dailyDigestEnabled &&
        nowParts &&
        hasTimePassedToday(now, alertSettings.dailyDigestTime || '20:00', timeZone)
      ) {
        const dailyData = buildWeeklyDigestData({
          assignments,
          resources,
          schedule,
          exams,
          manualExams,
          hiddenCourseIds,
          alertSettings,
          now
        });
        if (dailyData.hasContent) {
          const dailyPayload = {
            ...dailyData.payload,
            embeds: dailyData.payload.embeds.map((e) => ({
              ...e,
              title: `Daily Academic Summary — ${nowParts.dateStr}`,
              footer: { text: `Classroom Hub • Daily Digest • ${timeZone}` }
            }))
          };
          await this.dispatchDiscordCandidate(
            toEmail,
            alertSettings.discordWebhookUrl,
            {
              eventKey: buildEventIdentity('digest', 'daily', 'summary', nowParts.dateStr),
              eventType: 'digest',
              sourceId: 'daily',
              stage: 'summary',
              priority: PRIORITY.P3_DIGEST,
              payload: dailyPayload,
              historyTitle: `Sent Daily Academic Digest (${dailyData.pendingTasks.length} pending tasks)`,
              targetPath: '/dashboard'
            },
            alertSettings,
            now
          );
        }
      }

      // Optional background rollover evaluation (midnight assignment deadlines, exam countdowns, and weekly digest)
      if (context.includeDeadlinesAndWeekly) {
        const deletedTaskIds = (getDeletedIds(toEmail) || [])
          .filter((d) => d.entityType === 'assignments')
          .map((d) => d.id);

        const assignCandidates = evaluateAssignmentCandidates({
          assignments,
          hiddenCourseIds,
          deletedTaskIds,
          alertSettings,
          prevSnapshot: null,
          authoritativeSync: false,
          now
        });
        for (const cand of assignCandidates) {
          await this.dispatchDiscordCandidate(
            toEmail,
            alertSettings.discordWebhookUrl,
            cand,
            alertSettings,
            now
          );
        }

        const { candidates: examCandidates } = evaluateExamCandidates({
          exams,
          manualExams,
          alertSettings,
          prevSnapshot: null,
          explicitExamSync: false,
          now
        });
        for (const examCand of examCandidates) {
          await this.dispatchDiscordCandidate(
            toEmail,
            alertSettings.discordWebhookUrl,
            examCand,
            alertSettings,
            now
          );
        }

        if (alertSettings.sundayDigest) {
          const targetTimeStr = alertSettings.weeklyDigestTime || getSundayDigestTime(toEmail);
          const windowState = isWeeklyDigestWindowDue({
            now,
            targetDayKey: alertSettings.weeklyDigestDay || 'sun',
            targetTimeStr,
            timeZone: alertSettings.timezone,
            prevLastSync: null
          });
          if (windowState.due && windowState.anchorDateStr) {
            const anchorStamp = windowState.anchorDateStr;
            const weeklyData = buildWeeklyDigestData({
              assignments,
              resources,
              schedule,
              exams,
              manualExams,
              hiddenCourseIds,
              alertSettings,
              now
            });
            if (weeklyData.hasContent) {
              await this.dispatchDiscordCandidate(
                toEmail,
                alertSettings.discordWebhookUrl,
                {
                  eventKey: buildEventIdentity('digest', 'weekly', 'summary', anchorStamp),
                  eventType: 'digest',
                  sourceId: 'sunday_digest_overall',
                  stage: 'weekly',
                  legacyDiscordType: `discord_sunday_digest_${anchorStamp}`,
                  priority: PRIORITY.P3_DIGEST,
                  payload: weeklyData.payload,
                  historyTitle: `Sent Weekly Academic Report to Discord (${weeklyData.pendingTasks.length} pending, ${weeklyData.upcomingExams.length} exams)`,
                  targetPath: '/dashboard'
                },
                alertSettings,
                now
              );
            }
          }
        }
      }
    });
  }

  /**
   * Main evaluator to scan deadlines, exam countdowns, lifecycle changes, and weekly digests.
   */
  static async evaluateNotifications(accessToken, toEmail, assignments, courses, resources, options = {}) {
    return this.withNotificationLock(toEmail, () =>
      this.evaluateNotificationsLocked(accessToken, toEmail, assignments, courses, resources, options)
    );
  }

  static async evaluateNotificationsLocked(
    accessToken,
    toEmail,
    assignments = [],
    courses = [],
    resources = [],
    options = {}
  ) {
    void courses;
    const isEmailEnabled = getEnableEmailAlerts(toEmail);
    const alertSettings = getAlertSettings(toEmail);
    const isDiscordValid = DiscordService.validateWebhookUrl(alertSettings.discordWebhookUrl).valid;
    const isDiscordAutomatedHere = Boolean(
      alertSettings.discordEnabled &&
        isDiscordValid &&
        alertSettings.deliveryAuthority !== 'apps_script'
    );

    const now = options.now ? new Date(options.now) : new Date();
    const hiddenCourseIds = getHiddenCourses(toEmail);
    const cachedExamsRes = examRepository.getCachedExams(toEmail);
    const examData = cachedExamsRes.success && cachedExamsRes.data ? cachedExamsRes.data : {};
    const rawSciExams = options.exams ?? examData.exams ?? [];
    const rawManualExams = options.manualExams ?? examData.manualExams ?? [];
    const prevSnapshot = NotificationLedger.getSnapshot(toEmail);

    // Keep academic snapshot warm even if automated Discord authority is delegated to Apps Script
    const mergedForSnapshot = getMergedExams(rawSciExams, rawManualExams);
    const nextSnapshot = buildAcademicSnapshot({
      assignments,
      mergedExams: mergedForSnapshot,
      hiddenCourseIds,
      timeZone: alertSettings.timezone,
      prevSnapshot,
      failedCourseIds: options.failedCourseIds || [],
      preserveSciBaseSnapshot: rawSciExams.length === 0 && !options.explicitExamSync
    });

    if (!isEmailEnabled && !isDiscordAutomatedHere) {
      NotificationLedger.saveSnapshot(toEmail, nextSnapshot);
      return;
    }

    const sentRecords = getSentNotifications(toEmail);
    const wasSentEmail = (assignmentId, type) =>
      sentRecords.some((r) => r.assignmentId === assignmentId && r.type === type);
    const markSentEmail = (assignmentId, type) => {
      const record = { assignmentId, type, sentAt: new Date().toISOString() };
      sentRecords.push(record);
      this.persistSentRecord(toEmail, record);
    };

    const activeTodoAssignments = (Array.isArray(assignments) ? assignments : []).filter((a) => {
      if (!a || a.status === 'done' || a.status === 'read') return false;
      if (a.courseId && hiddenCourseIds.includes(a.courseId)) return false;
      return true;
    });

    // ── CHANNEL 1: Gmail Notifications (preserved 100% compatible) ──
    if (isEmailEnabled) {
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

        if (!triggerType || wasSentEmail(task.id, triggerType)) continue;

        if (!this.hasDailyQuota(toEmail)) {
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
          markSentEmail(task.id, triggerType);

          addNotificationHistoryLog(
            {
              title: `Sent reminder for '${task.title}' (${warningLabel})`,
              type: triggerType,
              channel: 'email',
              assignmentId: task.id,
              targetPath: `/assignments/${task.id}`,
              read: false
            },
            toEmail
          );
        }
      }
    }

    // ── CHANNEL 2: Discord Personal Academic Assistant ──
    let hadRetryableDiffFailure = false;

    if (isDiscordAutomatedHere) {
      const deletedTaskIds = (getDeletedIds(toEmail) || [])
        .filter((d) => d.entityType === 'assignments')
        .map((d) => d.id);

      // 2a. Assignment Reminders (7d / 3d / 1d / Today / Overdue catch-up) & Lifecycle Diffs
      const assignCandidates = evaluateAssignmentCandidates({
        assignments,
        hiddenCourseIds,
        deletedTaskIds,
        alertSettings,
        prevSnapshot,
        failedCourseIds: options.failedCourseIds || [],
        authoritativeSync: Boolean(options.authoritativeSync),
        now
      });

      for (const cand of assignCandidates) {
        const res = await this.dispatchDiscordCandidate(
          toEmail,
          alertSettings.discordWebhookUrl,
          cand,
          alertSettings,
          now,
          { rethrowOnFailure: !isEmailEnabled }
        );
        if (
          res.failed &&
          res.retryable &&
          (cand.stage === 'deadline_changed' || cand.stage === 'deleted' || cand.stage === 'status_changed')
        ) {
          hadRetryableDiffFailure = true;
        }
      }

      // 2b. Examination Countdown (7d / 3d / 1d / Exam Day) & Reschedule/Cancellation Alerts
      const { candidates: examCandidates } = evaluateExamCandidates({
        exams: rawSciExams,
        manualExams: rawManualExams,
        alertSettings,
        prevSnapshot,
        explicitExamSync: Boolean(options.explicitExamSync),
        now
      });

      for (const examCand of examCandidates) {
        const res = await this.dispatchDiscordCandidate(
          toEmail,
          alertSettings.discordWebhookUrl,
          examCand,
          alertSettings,
          now,
          { rethrowOnFailure: !isEmailEnabled }
        );
        if (res.failed && res.retryable && (examCand.stage === 'exam_changed' || examCand.stage === 'exam_cancelled')) {
          hadRetryableDiffFailure = true;
        }
      }

      // 2c. Morning Briefing & Class Reminders (when triggered from full workspace sync/tick)
      if (options.allowMorningBriefing || options.allowScheduleAlerts) {
        const schedule = options.schedule ?? getSchedule(toEmail);
        const { briefingCandidate, classCandidates } = evaluateScheduleAndBriefingCandidates({
          schedule,
          assignments,
          resources,
          exams: rawSciExams,
          manualExams: rawManualExams,
          hiddenCourseIds,
          alertSettings,
          now
        });

        if (options.allowMorningBriefing && briefingCandidate) {
          await this.dispatchDiscordCandidate(
            toEmail,
            alertSettings.discordWebhookUrl,
            briefingCandidate,
            alertSettings,
            now
          );
        }
        if (options.allowScheduleAlerts) {
          for (const clsCand of classCandidates) {
            await this.dispatchDiscordCandidate(
              toEmail,
              alertSettings.discordWebhookUrl,
              clsCand,
              alertSettings,
              now
            );
          }
        }
      }
    }

    // ── 3. Weekly Sunday Digest (Email + Enhanced Discord Academic Report) ──
    if (alertSettings.sundayDigest) {
      const targetTimeStr = alertSettings.weeklyDigestTime || getSundayDigestTime(toEmail);
      const prevSyncIso = options?.prevLastSync !== undefined ? options.prevLastSync : getLastSync(toEmail);

      const windowState = isWeeklyDigestWindowDue({
        now,
        targetDayKey: alertSettings.weeklyDigestDay || 'sun',
        targetTimeStr,
        timeZone: alertSettings.timezone,
        prevLastSync: prevSyncIso
      });

      if (windowState.due && windowState.anchorDateStr) {
        const anchorStamp = windowState.anchorDateStr;
        const emailDigestRecordType = `sunday_digest_${anchorStamp}`;
        const discordDigestRecordType = `discord_sunday_digest_${anchorStamp}`;

        const noDueDateTasks = activeTodoAssignments.filter((a) => !a.dueDate);
        const hasUpcomingExams = alertSettings.includeExams && this.buildExamsHtml(toEmail, true) !== '';

        // 3a. Gmail Sunday Digest
        if (
          isEmailEnabled &&
          (noDueDateTasks.length > 0 || hasUpcomingExams) &&
          !wasSentEmail('sunday_digest_overall', emailDigestRecordType) &&
          this.hasDailyQuota(toEmail)
        ) {
          let itemsHtml = '';
          if (noDueDateTasks.length > 0) {
            const courseGroups = {};
            noDueDateTasks.forEach((task) => {
              if (!courseGroups[task.course]) courseGroups[task.course] = [];
              courseGroups[task.course].push(task);
            });

            Object.keys(courseGroups).forEach((courseName) => {
              const list = courseGroups[courseName];
              const borderHex = getHexColor(list[0].courseColor);
              itemsHtml += `
                <div style="margin-top: 16px; border: 1px solid #2A3140; border-left: 4px solid ${borderHex}; background-color: #11141C; border-radius: 10px; padding: 16px;">
                  <h4 style="color: #EEF0F5; margin: 0 0 12px 0; font-size: 14px; font-weight: 600;">${escapeHtml(courseName)}</h4>
                  <div style="font-size: 13px; color: #E2E5EE; line-height: 1.6; margin-top: 8px;">
              `;
              list.forEach((t) => {
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
            <p class="desc">Here is your weekly summary of pending tasks and upcoming exams.</p>
            ${itemsHtml}
            ${examsHtml}
          `;
          const digestSubject = `[Classroom Hub] Sunday Digest: Weekly summary`;
          const html = this.wrapHtmlEmail(digestSubject, body);
          await GoogleRepository.sendEmail(accessToken, toEmail, digestSubject, html);
          this.recordEmailSent(toEmail);
          markSentEmail('sunday_digest_overall', emailDigestRecordType);

          addNotificationHistoryLog(
            {
              title: `Sent Sunday Digest email (Total ${noDueDateTasks.length} tasks)`,
              type: 'sunday_digest',
              channel: 'email',
              targetPath: '/dashboard',
              read: false
            },
            toEmail
          );
        }

        // 3b. Enhanced Discord Weekly Academic Report
        if (isDiscordAutomatedHere) {
          const schedule = options.schedule ?? getSchedule(toEmail);
          const weeklyData = buildWeeklyDigestData({
            assignments,
            resources,
            schedule,
            exams: rawSciExams,
            manualExams: rawManualExams,
            hiddenCourseIds,
            alertSettings,
            now
          });

          if (weeklyData.hasContent) {
            await this.dispatchDiscordCandidate(
              toEmail,
              alertSettings.discordWebhookUrl,
              {
                eventKey: buildEventIdentity('digest', 'weekly', 'summary', anchorStamp),
                eventType: 'digest',
                sourceId: 'sunday_digest_overall',
                stage: 'weekly',
                legacyDiscordType: discordDigestRecordType,
                priority: PRIORITY.P3_DIGEST,
                payload: weeklyData.payload,
                historyTitle: `Sent Weekly Academic Report to Discord (${weeklyData.pendingTasks.length} pending, ${weeklyData.upcomingExams.length} exams)`,
                targetPath: '/dashboard'
              },
              alertSettings,
              now,
              { rethrowOnFailure: !isEmailEnabled }
            );
          }
        }
      }
    }

    if (!hadRetryableDiffFailure) {
      NotificationLedger.saveSnapshot(toEmail, nextSnapshot);
    }
  }

  /**
   * Evaluates and groups genuinely new Classroom coursework, announcements, and materials.
   */
  static async evaluateNewPostDigest(
    accessToken,
    toEmail,
    freshAssignments,
    freshResources,
    cachedAssignmentIds,
    cachedResourceIds,
    options = {}
  ) {
    return this.withNotificationLock(toEmail, () =>
      this.evaluateNewPostDigestLocked(
        accessToken,
        toEmail,
        freshAssignments,
        freshResources,
        cachedAssignmentIds,
        cachedResourceIds,
        options
      )
    );
  }

  static async evaluateNewPostDigestLocked(
    accessToken,
    toEmail,
    freshAssignments = [],
    freshResources = [],
    cachedAssignmentIds = [],
    cachedResourceIds = [],
    options = {}
  ) {
    const isEmailEnabled = getEnableEmailAlerts(toEmail);
    const alertSettings = getAlertSettings(toEmail);
    const isDiscordAutomatedHere = Boolean(
      alertSettings.discordEnabled &&
        alertSettings.deliveryAuthority !== 'apps_script' &&
        DiscordService.validateWebhookUrl(alertSettings.discordWebhookUrl).valid
    );

    if ((!isEmailEnabled && !isDiscordAutomatedHere) || !alertSettings.newPosts) return;

    const now = options.now ? new Date(options.now) : new Date();
    const nowMs = now.getTime();
    const sentRecords = getSentNotifications(toEmail);
    const hiddenCourseIds = getHiddenCourses(toEmail);
    const cutoffRecentMs = nowMs - NEW_POST_MAX_AGE_MS;

    // 1. Gmail New-Post Digest
    if (isEmailEnabled) {
      const alreadyAnnouncedEmail = (id) =>
        sentRecords.some((r) => r.assignmentId === id && r.type === NEW_POST_RECORD_TYPE);

      const isRecentEnough = (item) => {
        if (!item?.creationTime) return true;
        const t = new Date(item.creationTime).getTime();
        return Number.isNaN(t) || t >= cutoffRecentMs;
      };

      const filterEmailCandidates = (items, cachedIds, typeFilter = null) =>
        (Array.isArray(items) ? items : []).filter((item) => {
          if (!item?.id || cachedIds.includes(item.id)) return false;
          if (item.courseId && hiddenCourseIds.includes(item.courseId)) return false;
          if (typeFilter && !typeFilter(item)) return false;
          if (alreadyAnnouncedEmail(item.id)) return false;
          if (!isRecentEnough(item)) return false;
          return true;
        });

      const newAssignments = alertSettings.newAssignments === false
        ? []
        : filterEmailCandidates(freshAssignments, cachedAssignmentIds);
      const newResources = filterEmailCandidates(
        freshResources,
        cachedResourceIds,
        (r) =>
          (r.type !== 'announcement' || alertSettings.newAnnouncements !== false) &&
          (r.type !== 'material' || alertSettings.newMaterials !== false)
      );
      const totalNew = newAssignments.length + newResources.length;

      if (totalNew > 0) {
        if (!this.hasDailyQuota(toEmail)) {
          logger.info('[Notify] Daily email quota reached; skipping new-post digest.');
        } else {
          const courseGroups = {};
          newAssignments.forEach((t) => {
            if (!courseGroups[t.course]) {
              courseGroups[t.course] = { color: t.courseColor, assigns: [], resources: [] };
            }
            courseGroups[t.course].assigns.push(t);
          });
          newResources.forEach((r) => {
            if (!courseGroups[r.course]) {
              courseGroups[r.course] = { color: r.courseColor, assigns: [], resources: [] };
            }
            courseGroups[r.course].resources.push(r);
          });

          let groupHtml = '';
          Object.keys(courseGroups).forEach((courseName) => {
            const group = courseGroups[courseName];
            const borderHex = getHexColor(group.color);

            groupHtml += `
              <div style="margin-top: 15px; border: 1px solid #2A3140; border-left: 4px solid ${borderHex}; background-color: #11141C; border-radius: 8px; padding: 12px 15px;">
                <h4 style="color: #EEF0F5; margin: 0 0 8px 0; font-size: 13px;">${escapeHtml(courseName)}</h4>
            `;

            if (group.assigns.length > 0) {
              groupHtml += `<p style="font-size: 11px; font-weight: 600; color: #A78BFA; margin: 8px 0 4px 0;">New Assignments (${group.assigns.length})</p>`;
              group.assigns.forEach((t) => {
                groupHtml += `<div style="font-size: 12px; color: #EEF0F5; padding: 4px 0; border-bottom: 1px solid #2A3140;">• <strong>${escapeHtml(t.title)}</strong></div>`;
              });
            }

            if (group.resources.length > 0) {
              const anns = group.resources.filter((r) => r.type === 'announcement');
              const mats = group.resources.filter((r) => r.type === 'material');

              if (anns.length > 0) {
                groupHtml += `<p style="font-size: 11px; font-weight: 600; color: #FBBF24; margin: 10px 0 4px 0;">New Announcements (${anns.length})</p>`;
                anns.forEach((r) => {
                  groupHtml += `<div style="font-size: 12px; color: #EEF0F5; padding: 4px 0; border-bottom: 1px solid #2A3140;">• <strong>${escapeHtml(r.title)}</strong></div>`;
                });
              }

              if (mats.length > 0) {
                groupHtml += `<p style="font-size: 11px; font-weight: 600; color: #60A5FA; margin: 10px 0 4px 0;">New Course Materials (${mats.length})</p>`;
                mats.forEach((r) => {
                  groupHtml += `<div style="font-size: 12px; color: #EEF0F5; padding: 4px 0; border-bottom: 1px solid #2A3140;">• <strong>${escapeHtml(r.title)}</strong></div>`;
                });
              }
            }
            groupHtml += `</div>`;
          });

          const subject = `[Classroom Hub] Detected ${totalNew} new items in classroom`;
          const body = `
            <h2 class="title" style="color: #60A5FA;">New Classroom Activity Detected</h2>
            <p class="desc">Detected ${totalNew} new assignment(s), announcement(s), or material(s) uploaded by your instructors.</p>
            ${groupHtml}
          `;

          const html = this.wrapHtmlEmail(subject, body);
          await GoogleRepository.sendEmail(accessToken, toEmail, subject, html);
          this.recordEmailSent(toEmail);
          const sentAt = new Date().toISOString();
          this.persistSentRecords(
            toEmail,
            [...newAssignments, ...newResources].map((item) => ({
              assignmentId: item.id,
              type: NEW_POST_RECORD_TYPE,
              sentAt
            }))
          );

          addNotificationHistoryLog(
            {
              title: `Detected and sent new posts email (Total ${totalNew} items)`,
              type: 'new_posts_digest',
              channel: 'email',
              targetPath:
                newAssignments.length === 1 && newResources.length === 0
                  ? `/assignments/${newAssignments[0].id}`
                  : '/dashboard',
              read: false
            },
            toEmail
          );
        }
      }
    }

    // 2. Discord Grouped Classroom Activity Digest
    if (isDiscordAutomatedHere) {
      const gate = checkDeliveryGate(PRIORITY.P2_NORMAL, alertSettings, now);
      if (!gate.allowed) return;

      const isItemAlreadyNotified = (evtType, idStr) => {
        const key = buildEventIdentity(evtType, idStr, 'new');
        const check = NotificationLedger.evaluateEligibility(toEmail, key, {
          nowMs,
          legacyCheck: { assignmentId: idStr, type: DISCORD_NEW_POST_RECORD_TYPE },
          maxRetries: alertSettings.maxRetries ?? 3
        });
        return !check.eligible;
      };

      const { newAssignments: discordNewAssigns, newResources: discordNewResources } =
        filterNewClassroomItems({
          freshAssignments,
          freshResources,
          cachedAssignmentIds,
          cachedResourceIds,
          hiddenCourseIds,
          alertSettings,
          isAlreadyNotified: isItemAlreadyNotified,
          now
        });

      const totalDiscordNew = discordNewAssigns.length + discordNewResources.length;

      if (totalDiscordNew > 0) {
        const itemKeys = [
          ...discordNewAssigns.map((a) => ({
            key: buildEventIdentity('assignment', a.id, 'new'),
            type: 'assignment',
            id: String(a.id)
          })),
          ...discordNewResources.map((r) => ({
            key: buildEventIdentity(r.type === 'material' ? 'material' : 'announcement', r.id, 'new'),
            type: r.type === 'material' ? 'material' : 'announcement',
            id: String(r.id)
          }))
        ];

        for (const item of itemKeys) {
          NotificationLedger.claim(
            toEmail,
            {
              eventKey: item.key,
              eventType: item.type,
              sourceId: item.id,
              stage: 'new',
              priority: PRIORITY.P2_NORMAL,
              channel: 'discord'
            },
            nowMs
          );
        }

        try {
          const discordPayload = DiscordService.buildNewPostsPayload(
            discordNewAssigns,
            discordNewResources
          );
          await DiscordService.sendWebhook(alertSettings.discordWebhookUrl, discordPayload, {
            email: toEmail,
            eventType: 'classroom_activity_digest',
            maxRetries: Math.min(Number(alertSettings.maxRetries ?? 2), 3)
          });

          const legacyRecords = [...discordNewAssigns, ...discordNewResources].map((item) => ({
            assignmentId: item.id,
            type: DISCORD_NEW_POST_RECORD_TYPE
          }));

          itemKeys.forEach((item, idx) => {
            NotificationLedger.markDelivered(toEmail, item.key, {
              legacyRecords: idx === 0 ? legacyRecords : null,
              nowMs
            });
          });

          // Always log Discord activity digest independently of Gmail state
          addNotificationHistoryLog(
            {
              title: `Detected and sent new posts to Discord (Total ${totalDiscordNew} items)`,
              type: 'discord_new_posts_digest',
              channel: 'discord',
              priority: PRIORITY.P2_NORMAL,
              status: 'delivered',
              targetPath:
                discordNewAssigns.length === 1 && discordNewResources.length === 0
                  ? `/assignments/${discordNewAssigns[0].id}`
                  : '/dashboard',
              read: false
            },
            toEmail
          );
        } catch (discordErr) {
          const retryable = Boolean(discordErr?.retryable);
          const ambiguousTimeout = Boolean(discordErr?.ambiguousTimeout);
          for (const item of itemKeys) {
            NotificationLedger.markFailed(toEmail, item.key, {
              errorMessage: DiscordService.scrubSecrets(discordErr?.message || 'Activity digest failed'),
              retryable,
              ambiguousTimeout,
              maxRetries: alertSettings.maxRetries ?? 3,
              nowMs
            });
          }
          logger.warn('[Notify] Discord new-post digest failed:', DiscordService.scrubSecrets(discordErr?.message));
          if (!isEmailEnabled) throw discordErr;
        }
      }
    }
  }
}
