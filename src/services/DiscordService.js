import { examRepository } from '../repositories/examRepository';
import { parseExamDate } from '../utils/examDate';
import { getMergedExams } from '../utils/examMerger';
import { getCalendarDaysDiff, parseLocalDateInput } from '../utils/dateUtils';
import { sanitizeExternalUrl } from '../utils/sanitize';
import { getHexColor } from '../utils/colors';
import { logger } from '../utils/logger';
import { NotificationLedger } from './notifications/NotificationLedger';

const ALLOWED_DISCORD_HOSTS = new Set([
  'discord.com',
  'discordapp.com',
  'ptb.discord.com',
  'canary.discord.com'
]);

const WEBHOOK_PATH_REGEX = /^\/api(?:\/v\d+)?\/webhooks\/(\d{5,32})\/([A-Za-z0-9._-]{8,256})\/?$/;

export const DISCORD_LIMITS = {
  maxContentLen: 2000,
  maxEmbeds: 10,
  maxTitleLen: 256,
  maxDescLen: 4096,
  maxFields: 25,
  maxFieldNameLen: 256,
  maxFieldValueLen: 1024,
  maxFooterLen: 2048,
  maxTotalEmbedChars: 5800
};

export const DISCORD_COLORS = {
  blurple: 0x5865F2,
  blue: 0x3794FF,
  emerald: 0x4EC9B0,
  amber: 0xCCA700,
  rose: 0xF14C4C,
  purple: 0xC586C0
};

export const DEFAULT_DISCORD_AVATAR_URL =
  'https://raw.githubusercontent.com/kittiponglnwza/classroom_dashbord/master/public/pwa-192x192.png';

export class DiscordService {
  /**
   * Resolves a publicly reachable HTTPS PNG avatar URL for Discord Webhook messages.
   * Uses the live HTTPS deployment origin when available, falling back to the public repository icon on localhost.
   */
  static resolveAvatarUrl(customUrl = '') {
    const explicit = sanitizeExternalUrl(customUrl);
    if (explicit && explicit.startsWith('https://')) {
      return explicit;
    }

    if (
      typeof window !== 'undefined' &&
      window.location?.protocol === 'https:' &&
      window.location?.origin &&
      !/^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname || '')
    ) {
      return `${window.location.origin}/pwa-192x192.png`;
    }

    return DEFAULT_DISCORD_AVATAR_URL;
  }
  /**
   * Validates and normalizes a Discord Webhook URL.
   * Rejects non-HTTPS protocols, non-Discord domains, and malformed webhook paths.
   *
   * @param {string} rawUrl
   * @returns {{ valid: boolean, url: string | null, webhookId?: string, error?: string }}
   */
  static validateWebhookUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') {
      return { valid: false, url: null, error: 'missing_url' };
    }

    const trimmed = rawUrl.trim();
    if (!trimmed) {
      return { valid: false, url: null, error: 'missing_url' };
    }

    let parsed;
    try {
      parsed = new URL(trimmed);
    } catch {
      return { valid: false, url: null, error: 'invalid_url' };
    }

    if (parsed.protocol !== 'https:') {
      return { valid: false, url: null, error: 'invalid_protocol' };
    }

    const host = parsed.hostname.toLowerCase();
    if (!ALLOWED_DISCORD_HOSTS.has(host)) {
      return { valid: false, url: null, error: 'invalid_host' };
    }

    const match = parsed.pathname.match(WEBHOOK_PATH_REGEX);
    if (!match) {
      return { valid: false, url: null, error: 'invalid_path' };
    }

    const [, webhookId, webhookToken] = match;
    let normalizedUrl = `https://${host}/api/webhooks/${webhookId}/${webhookToken}`;

    const threadId = parsed.searchParams.get('thread_id');
    if (threadId && /^\d{5,32}$/.test(threadId.trim())) {
      normalizedUrl += `?thread_id=${threadId.trim()}`;
    }

    return {
      valid: true,
      url: normalizedUrl,
      webhookId
    };
  }

  /**
   * Masks the secret token portion of a Discord Webhook URL for safe UI/log display.
   */
  static maskWebhookUrl(rawUrl) {
    const check = this.validateWebhookUrl(rawUrl);
    if (!check.valid || !check.url) return '';
    return check.url.replace(
      /(\/api\/webhooks\/\d+\/)([A-Za-z0-9._-]{4})[A-Za-z0-9._-]+([A-Za-z0-9._-]{4})/,
      '$1$2••••••••$3'
    );
  }

  /**
   * Truncates a string safely within Discord character limits, never returning empty string when fallback is given.
   */
  static truncate(value, maxLen = 1024, fallback = '-') {
    if (value === null || value === undefined) return fallback;
    const str = String(value).trim();
    if (!str) return fallback;
    if (str.length <= maxLen) return str;
    if (maxLen <= 1) return str.slice(0, maxLen);
    return `${str.slice(0, maxLen - 1)}…`;
  }

  /**
   * Converts a Classroom Hub course color name or #RRGGBB hex string into a Discord integer color.
   */
  static resolveColorInt(colorInput, fallback = DISCORD_COLORS.blue) {
    if (typeof colorInput === 'number' && Number.isFinite(colorInput)) {
      return colorInput;
    }
    const hex = getHexColor(colorInput);
    const cleaned = String(hex || '').replace(/^#/, '');
    const parsed = parseInt(cleaned, 16);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  /**
   * Sanitizes and clamps a Discord webhook payload so it never violates Discord's strict Embed limits.
   */
  static sanitizePayload(payload = {}) {
    const safePayload = {
      username: this.truncate(payload.username || 'Classroom Hub', 80, 'Classroom Hub'),
      avatar_url: this.resolveAvatarUrl(payload.avatar_url)
    };

    if (payload.content) {
      safePayload.content = this.truncate(payload.content, DISCORD_LIMITS.maxContentLen, '');
    }

    if (Array.isArray(payload.embeds) && payload.embeds.length > 0) {
      let runningChars = 0;
      const safeEmbeds = [];

      for (const rawEmbed of payload.embeds.slice(0, DISCORD_LIMITS.maxEmbeds)) {
        if (!rawEmbed || typeof rawEmbed !== 'object') continue;
        const embed = {};

        if (rawEmbed.title) {
          embed.title = this.truncate(rawEmbed.title, DISCORD_LIMITS.maxTitleLen, 'Notification');
          runningChars += embed.title.length;
        }

        if (rawEmbed.description) {
          const remainingBudget = Math.max(120, DISCORD_LIMITS.maxTotalEmbedChars - runningChars);
          const descMax = Math.min(DISCORD_LIMITS.maxDescLen, remainingBudget);
          embed.description = this.truncate(rawEmbed.description, descMax, '');
          runningChars += embed.description.length;
        }

        if (rawEmbed.url) {
          const safeUrl = sanitizeExternalUrl(rawEmbed.url);
          if (safeUrl) embed.url = safeUrl;
        }

        embed.color = typeof rawEmbed.color === 'number' ? rawEmbed.color : DISCORD_COLORS.blue;

        if (Array.isArray(rawEmbed.fields) && rawEmbed.fields.length > 0) {
          const safeFields = [];
          for (const f of rawEmbed.fields.slice(0, DISCORD_LIMITS.maxFields)) {
            if (!f) continue;
            const name = this.truncate(f.name, DISCORD_LIMITS.maxFieldNameLen, 'Item');
            const val = this.truncate(f.value, DISCORD_LIMITS.maxFieldValueLen, '-');
            if (runningChars + name.length + val.length > DISCORD_LIMITS.maxTotalEmbedChars) {
              break;
            }
            runningChars += name.length + val.length;
            safeFields.push({
              name,
              value: val,
              inline: Boolean(f.inline)
            });
          }
          if (safeFields.length > 0) {
            embed.fields = safeFields;
          }
        }

        if (rawEmbed.footer?.text) {
          const footerText = this.truncate(rawEmbed.footer.text, DISCORD_LIMITS.maxFooterLen, '');
          if (footerText) {
            embed.footer = { text: footerText };
            runningChars += footerText.length;
          }
        }

        if (rawEmbed.timestamp) {
          embed.timestamp = rawEmbed.timestamp;
        }

        safeEmbeds.push(embed);
        if (runningChars >= DISCORD_LIMITS.maxTotalEmbedChars) break;
      }

      if (safeEmbeds.length > 0) {
        safePayload.embeds = safeEmbeds;
      }
    }

    return safePayload;
  }

  /**
   * Builds a Discord Embed for upcoming exams from cached examRepository data.
   */
  static buildExamsEmbed(toEmail, isWeeklyDigest = false) {
    if (!toEmail) return null;
    const emailKey = toEmail.toLowerCase().trim();

    try {
      const cachedRes = examRepository.getCachedExams(emailKey);
      if (!cachedRes.success || !cachedRes.data) return null;
      const exams = getMergedExams(
        cachedRes.data.exams || [],
        cachedRes.data.manualExams || []
      );
      if (exams.length === 0) return null;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const upcomingExams = exams.filter(exam => {
        const parsedDate = parseExamDate(exam.rawIsoDate || exam.date);
        return parsedDate ? parsedDate >= today : false;
      });

      if (upcomingExams.length === 0) return null;

      upcomingExams.sort((a, b) => {
        const dateA = parseExamDate(a.rawIsoDate || a.date);
        const dateB = parseExamDate(b.rawIsoDate || b.date);
        return dateA - dateB;
      });

      const getRemainingLabel = (examDate) => {
        const diffDays = getCalendarDaysDiff(examDate, today) ?? 0;
        if (diffDays <= 0) return 'Today';
        if (diffDays === 1) return 'Tomorrow';
        return `${diffDays} days left`;
      };

      const limit = isWeeklyDigest ? 5 : 10;
      const displayExams = upcomingExams.slice(0, limit);
      const hiddenCount = upcomingExams.length - displayExams.length;

      const fields = displayExams.map(exam => {
        const examDate = parseExamDate(exam.rawIsoDate || exam.date);
        const remainingLabel = getRemainingLabel(examDate);
        const tag = exam.isManual ? ' [Custom]' : '';
        const name = `${exam.courseCode || 'EXAM'} • ${exam.courseName || 'Subject'}${tag}`;
        const value = `📅 **${exam.date || '-'}** (${exam.time || '-'}) — *${remainingLabel}*\n🏫 Room: **${exam.room || '-'}** | 💺 Seat: **${exam.seat || '-'}**`;
        return { name, value, inline: false };
      });

      if (hiddenCount > 0) {
        fields.push({
          name: 'More Upcoming Exams',
          value: `+ And ${hiddenCount} more upcoming exam${hiddenCount > 1 ? 's' : ''} in Classroom Hub.`,
          inline: false
        });
      }

      const nextExam = upcomingExams[0];
      const nextExamDate = parseExamDate(nextExam.rawIsoDate || nextExam.date);

      return {
        title: `🎓 Upcoming Exam Schedule (${upcomingExams.length})`,
        description: `**Next Exam:** ${nextExam.courseCode || ''} • ${nextExam.courseName || ''} — **${nextExam.date || '-'}** (${getRemainingLabel(nextExamDate)})`,
        color: DISCORD_COLORS.amber,
        fields,
        footer: { text: 'Classroom Hub • Exam Seating Schedule' },
        timestamp: new Date().toISOString()
      };
    } catch (err) {
      logger.error('Error building exams Discord embed', err);
      return null;
    }
  }

  /**
   * Builds a connection test payload for Discord Webhook verification.
   */
  static buildTestPayload(toEmail, alertSettings = {}, sundayTime = '18:00') {
    const statusText = (flag) => (flag ? '✅ Enabled' : '⚪ Disabled');
    return {
      username: 'Classroom Hub',
      embeds: [
        {
          title: '✅ Discord Webhook Integration Active',
          description: `Classroom Hub is now connected to this Discord channel${toEmail ? ` for **${toEmail}**` : ''}.`,
          color: DISCORD_COLORS.emerald,
          fields: [
            {
              name: '⏰ Deadline Triggers',
              value: [
                `• 3 Days Before Due: **${statusText(alertSettings.due3Days ?? true)}**`,
                `• 1 Day Before Due: **${statusText(alertSettings.due1Day ?? true)}**`,
                `• Due Today: **${statusText(alertSettings.dueToday ?? true)}**`,
                `• 1 Day Overdue: **${statusText(alertSettings.overdue1Day ?? true)}**`
              ].join('\n'),
              inline: false
            },
            {
              name: '📬 Digest & Activity Settings',
              value: [
                `• New Posts Consolidated: **${statusText(alertSettings.newPosts ?? true)}**`,
                `• Sunday Digest: **${alertSettings.sundayDigest ? `Every Sunday at ${sundayTime}` : '⚪ Disabled'}**`,
                `• Include Exam Seating: **${statusText(alertSettings.includeExams ?? true)}**`
              ].join('\n'),
              inline: false
            }
          ],
          footer: { text: 'Classroom Hub • Instant & 24/7 Apps Script Notification System' },
          timestamp: new Date().toISOString()
        }
      ]
    };
  }

  /**
   * Builds a single deadline reminder Discord payload.
   */
  static buildDeadlineReminderPayload(task, triggerType, warningLabel) {
    const isOverdue = String(triggerType).includes('overdue');
    const isUrgent = triggerType === 'due_today' || triggerType === 'due_1_day';
    const color = isOverdue
      ? DISCORD_COLORS.rose
      : isUrgent
        ? DISCORD_COLORS.amber
        : this.resolveColorInt(task.courseColor, DISCORD_COLORS.blue);

    const parsedDue = parseLocalDateInput(task.dueDate);
    const dueStr = parsedDue
      ? parsedDue.toLocaleString('en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      : (task.dueDate || 'No Due Date');

      const safeLink = sanitizeExternalUrl(task.googleLink);
      const pointsLabel = typeof task.points === 'number' ? `${task.points} pts` : 'Ungraded';
      const statusRaw = String(task.submissionState || task.status || 'todo').toLowerCase();
      const submissionStatus = statusRaw === 'done' || statusRaw === 'turned_in' || statusRaw === 'returned'
        ? 'Submitted'
        : isOverdue
          ? 'Missing / Overdue'
          : 'Not Submitted';

      return {
        username: 'Classroom Hub',
        embeds: [
          {
            title: `🔔 ${warningLabel}: ${task.title || 'Assignment'}`,
            url: safeLink || undefined,
            description: this.truncate(task.description || 'No description provided.', 600, 'No description provided.'),
            color,
            fields: [
              {
                name: '📚 Course',
                value: `${task.courseCode ? `${task.courseCode} • ` : ''}${task.course || 'Course'}`,
                inline: true
              },
              {
                name: '⏳ Due Date',
                value: dueStr,
                inline: true
              },
              {
                name: '🏆 Status & Points',
                value: `${submissionStatus} • ${pointsLabel}`,
                inline: true
              }
            ],
            footer: { text: 'Classroom Hub • Deadline Alert' },
            timestamp: new Date().toISOString()
          }
        ]
      };
  }

  /**
   * Builds a consolidated task digest (manual digest or Sunday weekly digest) payload.
   */
  static buildDigestPayload({
    title = '📋 Pending Assignments Digest',
    description = 'Summary of your unfinished coursework in Classroom Hub.',
    tasks = [],
    toEmail = '',
    includeExams = false,
    isWeeklyDigest = false,
    colorInt = DISCORD_COLORS.blurple
  }) {
    const embeds = [];
    const fields = [];

    if (tasks.length > 0) {
      const courseGroups = {};
      tasks.forEach(task => {
        const courseKey = task.course || 'General';
        if (!courseGroups[courseKey]) courseGroups[courseKey] = [];
        courseGroups[courseKey].push(task);
      });

      const courseNames = Object.keys(courseGroups);
      for (const courseName of courseNames.slice(0, DISCORD_LIMITS.maxFields)) {
        const list = courseGroups[courseName];
        const lines = list.slice(0, 8).map(t => {
          const parsedDue = parseLocalDateInput(t.dueDate);
          const dueLabel = parsedDue
            ? parsedDue.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
            : 'No Due Date';
          const safeLink = sanitizeExternalUrl(t.googleLink);
          const itemTitle = this.truncate(t.title, 70, 'Assignment');
          return safeLink
            ? `• [${itemTitle}](${safeLink}) — \`${dueLabel}\``
            : `• **${itemTitle}** — \`${dueLabel}\``;
        });

        if (list.length > 8) {
          lines.push(`*+ ${list.length - 8} more task(s) in this course...*`);
        }

        fields.push({
          name: `📘 ${courseName} (${list.length})`,
          value: lines.join('\n'),
          inline: false
        });
      }
    } else {
      fields.push({
        name: '🎉 Assignments Status',
        value: 'No pending assignments right now.',
        inline: false
      });
    }

    embeds.push({
      title,
      description,
      color: colorInt,
      fields,
      footer: { text: `Classroom Hub • Total ${tasks.length} pending assignment(s)` },
      timestamp: new Date().toISOString()
    });

    if (includeExams && toEmail) {
      const examsEmbed = this.buildExamsEmbed(toEmail, isWeeklyDigest);
      if (examsEmbed) {
        embeds.push(examsEmbed);
      }
    }

    return {
      username: 'Classroom Hub',
      embeds
    };
  }

  /**
   * Builds a consolidated New Posts digest payload for Discord.
   */
  static buildNewPostsPayload(newAssignments = [], newResources = []) {
    const totalNew = newAssignments.length + newResources.length;
    const courseGroups = {};

    newAssignments.forEach(t => {
      const key = t.course || 'Course';
      if (!courseGroups[key]) courseGroups[key] = { assigns: [], resources: [] };
      courseGroups[key].assigns.push(t);
    });
    newResources.forEach(r => {
      const key = r.course || 'Course';
      if (!courseGroups[key]) courseGroups[key] = { assigns: [], resources: [] };
      courseGroups[key].resources.push(r);
    });

    const fields = Object.keys(courseGroups)
      .slice(0, DISCORD_LIMITS.maxFields)
      .map(courseName => {
        const group = courseGroups[courseName];
        const lines = [];

        const formatLinkedItem = (item, fallbackLabel) => {
          const safeTitle = this.truncate(item.title, 80, fallbackLabel);
          const safeLink = sanitizeExternalUrl(item.googleLink);
          return safeLink ? `• [${safeTitle}](${safeLink})` : `• ${safeTitle}`;
        };

        if (group.assigns.length > 0) {
          lines.push(`**📝 New Assignments (${group.assigns.length})**`);
          group.assigns.slice(0, 5).forEach(a => {
            lines.push(formatLinkedItem(a, 'Assignment'));
          });
          if (group.assigns.length > 5) {
            lines.push(`*+${group.assigns.length - 5} more assignment(s)*`);
          }
        }

        const anns = group.resources.filter(r => r.type === 'announcement');
        if (anns.length > 0) {
          lines.push(`**📢 New Announcements (${anns.length})**`);
          anns.slice(0, 5).forEach(r => {
            lines.push(formatLinkedItem(r, 'Announcement'));
          });
          if (anns.length > 5) {
            lines.push(`*+${anns.length - 5} more announcement(s)*`);
          }
        }

        const mats = group.resources.filter(r => r.type === 'material');
        if (mats.length > 0) {
          lines.push(`**📂 New Materials (${mats.length})**`);
          mats.slice(0, 5).forEach(r => {
            lines.push(formatLinkedItem(r, 'Material'));
          });
          if (mats.length > 5) {
            lines.push(`*+${mats.length - 5} more material(s)*`);
          }
        }

        return {
          name: `📘 ${courseName}`,
          value: lines.join('\n') || '-',
          inline: false
        };
      });

    return {
      username: 'Classroom Hub',
      embeds: [
        {
          title: `🆕 Detected ${totalNew} New Classroom Item${totalNew > 1 ? 's' : ''}`,
          description: `Consolidated update of new coursework, announcements, or materials uploaded by your instructors.`,
          color: DISCORD_COLORS.blue,
          fields,
          footer: { text: 'Classroom Hub • Consolidated Anti-Spam Alert' },
          timestamp: new Date().toISOString()
        }
      ]
    };
  }

  /**
   * Scrubs any raw Discord webhook token from an error string before logging or persisting.
   */
  static scrubSecrets(message = '') {
    return String(message || '').replace(
      /https?:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/api(?:\/v\d+)?\/webhooks\/\d+\/[A-Za-z0-9._-]+/gi,
      '[REDACTED_WEBHOOK_URL]'
    );
  }

  /**
   * Extracts Retry-After wait duration in ms from a 429 response (JSON body or Retry-After header).
   */
  static async extractRetryAfterMs(response, defaultMs = 1000) {
    let headerMs = null;
    try {
      const rawHeader = response?.headers?.get?.('Retry-After') ?? response?.headers?.get?.('retry-after');
      if (rawHeader) {
        const asNum = Number(rawHeader);
        if (Number.isFinite(asNum) && asNum > 0) {
          // Discord X-RateLimit / Retry-After header is seconds
          headerMs = Math.ceil(asNum * 1000);
        } else {
          const asDate = Date.parse(rawHeader);
          if (Number.isFinite(asDate) && asDate > Date.now()) {
            headerMs = asDate - Date.now();
          }
        }
      }
    } catch {
      headerMs = null;
    }

    try {
      if (typeof response?.json === 'function') {
        const rateData = await response.json();
        if (typeof rateData?.retry_after === 'number' && rateData.retry_after > 0) {
          return Math.ceil(rateData.retry_after * 1000);
        }
      }
    } catch {
      // Body may be non-JSON or already consumed; fall back to header/default
    }

    return headerMs ?? defaultMs;
  }

  /**
   * Sends a JSON payload to a validated Discord Webhook URL with timeout, HTTP 429 Retry-After,
   * bounded exponential backoff for 5xx/network errors, ambiguous-timeout guard, and telemetry.
   *
   * @param {string} webhookUrl
   * @param {object} payload
   * @param {{
   *   timeoutMs?: number,
   *   maxRetryWaitMs?: number,
   *   maxRetries?: number,
   *   baseBackoffMs?: number,
   *   email?: string,
   *   eventType?: string
   * }} [options={}]
   */
  static async sendWebhook(webhookUrl, payload, options = {}) {
    const validation = this.validateWebhookUrl(webhookUrl);
    if (!validation.valid || !validation.url) {
      throw new Error(
        validation.error === 'missing_url'
          ? 'Discord Webhook URL is required.'
          : 'Invalid Discord Webhook URL. Expected https://discord.com/api/webhooks/<id>/<token>.'
      );
    }

    const timeoutMs = options.timeoutMs ?? 10000;
    const maxRetryWaitMs = options.maxRetryWaitMs ?? 5000;
    const maxRetries = Math.min(Math.max(Number(options.maxRetries ?? 2), 0), 5);
    const baseBackoffMs = Math.max(Number(options.baseBackoffMs ?? 400), 10);
    const safeBody = JSON.stringify(this.sanitizePayload(payload));
    const telemetryEmail = options.email ? String(options.email).toLowerCase().trim() : '';
    const eventType = options.eventType || 'discord_webhook';

    const recordSuccess = (status, attempts) => {
      if (telemetryEmail) {
        const prev = NotificationLedger.getTelemetry(telemetryEmail);
        NotificationLedger.recordTelemetry(telemetryEmail, {
          lastAttemptAt: new Date().toISOString(),
          lastSuccessAt: new Date().toISOString(),
          lastSuccessType: eventType,
          lastStatus: 'delivered',
          lastErrorMessage: null,
          consecutiveFailures: 0,
          totalDelivered: (Number(prev.totalDelivered) || 0) + 1,
          lastAttempts: attempts
        });
      }
      return { ok: true, status, attempts, recordedTelemetry: true };
    };

    const recordFailure = (errMessage, statusLabel = 'failed') => {
      const cleanMsg = this.scrubSecrets(errMessage);
      if (telemetryEmail) {
        const prev = NotificationLedger.getTelemetry(telemetryEmail);
        NotificationLedger.recordTelemetry(telemetryEmail, {
          lastAttemptAt: new Date().toISOString(),
          lastErrorAt: new Date().toISOString(),
          lastErrorMessage: cleanMsg,
          lastStatus: statusLabel,
          consecutiveFailures: (Number(prev.consecutiveFailures) || 0) + 1
        });
      }
    };

    const computeBackoff = (attemptIndex) => {
      const exp = baseBackoffMs * Math.pow(2, attemptIndex);
      const jitter = Math.floor(Math.random() * Math.min(150, baseBackoffMs));
      return Math.min(exp + jitter, maxRetryWaitMs);
    };

    const attemptPost = async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        return await fetch(validation.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: safeBody,
          signal: controller.signal
        });
      } catch (err) {
        if (err?.name === 'AbortError') {
          const timeoutErr = new Error('Discord Webhook request timed out.', { cause: err });
          timeoutErr.ambiguousTimeout = true;
          timeoutErr.retryable = false;
          throw timeoutErr;
        }
        const netErr = new Error(
          `Discord Webhook network error: ${this.scrubSecrets(err?.message || 'Failed to fetch')}`,
          { cause: err }
        );
        netErr.retryable = true;
        throw netErr;
      } finally {
        clearTimeout(timer);
      }
    };

    let lastResponse = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      let response;
      try {
        response = await attemptPost();
      } catch (err) {
        if (err.ambiguousTimeout) {
          // Request left client before abort: Discord may have accepted it. Halt auto-retry.
          recordFailure(err.message, 'ambiguous');
          throw err;
        }
        if (attempt < maxRetries && err.retryable) {
          const waitMs = computeBackoff(attempt);
          logger.warn(`[Discord] Transient network failure (attempt ${attempt + 1}/${maxRetries + 1}). Retrying in ${waitMs}ms...`);
          recordFailure(err.message, 'retrying');
          await new Promise(resolve => setTimeout(resolve, waitMs));
          continue;
        }
        recordFailure(err.message, 'failed');
        throw err;
      }

      lastResponse = response;
      if (response.ok) {
        return recordSuccess(response.status, attempt + 1);
      }

      if (response.status === 429 && attempt < maxRetries) {
        const retryAfterMs = await this.extractRetryAfterMs(response, 1000);
        const boundedWait = Math.min(Math.max(retryAfterMs, 10), maxRetryWaitMs);
        logger.warn(`[Discord] Rate limited (429). Retrying after ${boundedWait}ms (attempt ${attempt + 1}/${maxRetries + 1})...`);
        recordFailure(`HTTP 429 Rate Limited (retrying after ${boundedWait}ms)`, 'retrying');
        await new Promise(resolve => setTimeout(resolve, boundedWait));
        continue;
      }

      if (response.status >= 500 && response.status <= 599 && attempt < maxRetries) {
        const waitMs = computeBackoff(attempt);
        logger.warn(`[Discord] Upstream HTTP ${response.status}. Retrying in ${waitMs}ms (attempt ${attempt + 1}/${maxRetries + 1})...`);
        recordFailure(`HTTP ${response.status} upstream error`, 'retrying');
        await new Promise(resolve => setTimeout(resolve, waitMs));
        continue;
      }

      break;
    }

    let detail = '';
    try {
      if (typeof lastResponse?.text === 'function') {
        const text = await lastResponse.text();
        if (text) {
          try {
            const parsed = JSON.parse(text);
            detail = parsed.message || text;
          } catch {
            detail = text;
          }
        }
      }
    } catch {
      detail = '';
    }

    const status = lastResponse?.status ?? 0;
    const finalMsg = this.scrubSecrets(
      `Discord Webhook Error (${status})${detail ? `: ${this.truncate(detail, 200, '')}` : ''}`
    );
    const httpErr = new Error(finalMsg);
    httpErr.status = status;
    httpErr.retryable = status === 429 || (status >= 500 && status <= 599);
    recordFailure(finalMsg, 'failed');
    throw httpErr;
  }
}
