import { DiscordService } from '../services/DiscordService';
import { sanitizeExternalUrl } from './sanitize';

/**
 * Generates a self-contained, production-ready Google Apps Script for 24/7 background notifications
 * via Discord Webhook (and optionally Gmail), complete with built-in diagnostic/debug functions.
 *
 * @param {string[]} [hiddenCourseIds=[]]
 * @param {{
 *   discordWebhookUrl?: string,
 *   enableDiscord?: boolean,
 *   enableEmail?: boolean,
 *   notifyNewPosts?: boolean,
 *   dashboardUrl?: string
 * }} [options={}]
 * @returns {string}
 */
export function getAppsScriptTemplate(hiddenCourseIds = [], options = {}) {
  const safeHiddenIds = Array.isArray(hiddenCourseIds)
    ? hiddenCourseIds.map(id => String(id).trim()).filter(Boolean)
    : [];
  const hiddenArrayStr = JSON.stringify(safeHiddenIds);

  const webhookCheck = DiscordService.validateWebhookUrl(options?.discordWebhookUrl || '');
  const safeWebhookUrl = webhookCheck.valid && webhookCheck.url
    ? webhookCheck.url
    : 'YOUR_DISCORD_WEBHOOK_URL_HERE';

  const enableDiscord = options?.enableDiscord !== undefined ? Boolean(options.enableDiscord) : true;
  const enableEmail = options?.enableEmail !== undefined ? Boolean(options.enableEmail) : true;
  const notifyNewPosts = options?.notifyNewPosts !== undefined ? Boolean(options.notifyNewPosts) : true;
  const safeDashboardUrl = sanitizeExternalUrl(options?.dashboardUrl) || 'https://classrooms-hub.vercel.app/';

  return `/**
 * ============================================================================
 * Classroom Hub: 24/7 Personal Auto-Notification Script (Discord Webhook + Gmail)
 * ============================================================================
 *
 * วิธีติดตั้งใช้งาน (Quick Setup):
 * 1. เปิด Google Apps Script: https://script.google.com แล้วกด "New Project"
 * 2. ลบโค้ดเดิมใน Code.gs ออกทั้งหมด แล้ววางโค้ดชุดนี้ลงไปแทน
 * 3. เมนูซ้ายมือหัวข้อ "Services" (บริการ) กดปุ่ม "+" -> เลือก "Google Classroom API" -> กด Add
 * 4. ตรวจสอบค่า DISCORD_WEBHOOK_URL ในตัวแปร CONFIG ด้านล่าง (หากก๊อปปี้จากหน้าเว็บหลังใส่ลิงก์ ระบบจะฝังค่ามาให้แล้ว)
 * 5. กด Save (Ctrl+S) จากนั้นทดสอบระบบด้วยฟังก์ชัน Debug ด้านบน:
 *    - เลือก "testDiscordWebhook" แล้วกด Run -> ทดสอบยิงข้อความเข้าห้อง Discord ทันที
 *    - เลือก "debugDryRun" แล้วกด Run -> ดูตารางตรวจเช็กวิชาและงานค้างใน Execution Log โดยไม่ส่งแจ้งเตือนจริง
 *    - เลือก "resetSentHistory" แล้วกด Run -> ล้างประวัติการส่งเพื่อทดสอบส่งซ้ำใหม่
 * 6. ตั้งเวลาทำงานอัตโนมัติ 24 ชม. (Triggers - ไอคอนรูปนาฬิกาปลุกด้านซ้าย):
 *    - กด "+ Add Trigger"
 *    - Function to run: sendClassroomDigest
 *    - Event source: Time-driven
 *    - Type of time based trigger: Hour timer -> Every hour (หรือ Day timer ตามต้องการ)
 */

var CONFIG = {
  DISCORD_WEBHOOK_URL: ${JSON.stringify(safeWebhookUrl)},
  ENABLE_DISCORD: ${JSON.stringify(enableDiscord)},
  ENABLE_EMAIL: ${JSON.stringify(enableEmail)},
  NOTIFY_NEW_POSTS: ${JSON.stringify(notifyNewPosts)},
  HIDDEN_COURSE_IDS: ${hiddenArrayStr},
  DASHBOARD_URL: ${JSON.stringify(safeDashboardUrl)},
  TIMEZONE: 'Asia/Bangkok',
  STORAGE_KEY_V2: 'ch_notified_records_v2',
  MAX_STORED_RECORDS: 250
};

function escapeHtmlScript(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function sanitizeSafeUrl(url) {
  if (!url) return '';
  var s = String(url).trim();
  return /^https?:\\/\\//i.test(s) ? s : '';
}

function truncateText(str, maxLen, fallback) {
  var fb = fallback !== undefined ? fallback : '-';
  if (str === null || str === undefined) return fb;
  var clean = String(str).trim();
  if (!clean) return fb;
  if (clean.length <= maxLen) return clean;
  return clean.substring(0, Math.max(1, maxLen - 1)) + '…';
}

function resolveDiscordWebhookUrl() {
  var fromConfig = String(CONFIG.DISCORD_WEBHOOK_URL || '').trim();
  if (fromConfig && fromConfig !== 'YOUR_DISCORD_WEBHOOK_URL_HERE') {
    return fromConfig;
  }
  try {
    var fromProps = PropertiesService.getScriptProperties().getProperty('DISCORD_WEBHOOK_URL');
    if (fromProps && String(fromProps).trim()) {
      return String(fromProps).trim();
    }
  } catch (e) {}
  return '';
}

function isValidDiscordWebhook(url) {
  if (!url) return false;
  return /^https:\\/\\/(?:ptb\\.|canary\\.)?discord(?:app)?\\.com\\/api(?:\\/v\\d+)?\\/webhooks\\/\\d+\\/[A-Za-z0-9._-]+/i.test(String(url).trim());
}

/**
 * ส่ง Payload เข้า Discord Webhook พร้อมระบบ Auto-Retry เมื่อติด Rate Limit (HTTP 429)
 */
function postDiscordWebhookWithRetry(webhookUrl, payload) {
  if (!isValidDiscordWebhook(webhookUrl)) {
    Logger.log('[Discord][ERROR] Invalid or missing Webhook URL. Check CONFIG.DISCORD_WEBHOOK_URL.');
    return { ok: false, status: 0, error: 'INVALID_WEBHOOK_URL' };
  }

  var options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  for (var attempt = 1; attempt <= 2; attempt++) {
    try {
      var response = UrlFetchApp.fetch(webhookUrl, options);
      var status = response.getResponseCode();
      var bodyText = response.getContentText() || '';

      if (status >= 200 && status < 300) {
        Logger.log('[Discord][OK] Sent webhook successfully (HTTP ' + status + ' on attempt ' + attempt + ').');
        return { ok: true, status: status };
      }

      if (status === 429 && attempt === 1) {
        var sleepMs = 1500;
        try {
          var parsed429 = JSON.parse(bodyText);
          if (parsed429 && typeof parsed429.retry_after === 'number') {
            sleepMs = Math.min(5000, Math.max(500, Math.ceil(parsed429.retry_after * 1000)));
          }
        } catch (e) {}
        Logger.log('[Discord][WARN] Rate limited (HTTP 429). Sleeping ' + sleepMs + 'ms before retry...');
        Utilities.sleep(sleepMs);
        continue;
      }

      Logger.log('[Discord][ERROR] HTTP ' + status + ' Response: ' + bodyText);
      return { ok: false, status: status, error: bodyText };
    } catch (err) {
      Logger.log('[Discord][EXCEPTION] Attempt ' + attempt + ' failed: ' + err.toString());
      if (attempt === 2) {
        return { ok: false, status: -1, error: err.toString() };
      }
      Utilities.sleep(1000);
    }
  }
  return { ok: false, status: -1, error: 'UNKNOWN_FAILURE' };
}

/**
 * [DEBUG 1] ทดสอบยิงข้อความเข้า Discord ทันที เพื่อเช็กว่า Webhook URL ใช้งานได้
 */
function testDiscordWebhook() {
  var webhookUrl = resolveDiscordWebhookUrl();
  Logger.log('=== [Classroom Hub: testDiscordWebhook] ===');
  if (!isValidDiscordWebhook(webhookUrl)) {
    Logger.log('[FAIL] ยังไม่ได้ตั้งค่า CONFIG.DISCORD_WEBHOOK_URL หรือรูปแบบ URL ไม่ถูกต้อง');
    Logger.log('รูปแบบที่ถูกต้อง: https://discord.com/api/webhooks/<ID>/<TOKEN>');
    return;
  }

  var nowStr = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'dd MMM yyyy HH:mm:ss');
  var payload = {
    username: 'Classroom Hub (24/7 Cloud)',
    embeds: [{
      title: '✅ เชื่อมต่อ Google Apps Script + Discord สำเร็จ!',
      description: 'ระบบแจ้งเตือนอัตโนมัติ 24 ชม. ของ **Classroom Hub** พร้อมทำงานแล้ว แม้คุณจะปิดคอมหรือปิดเบราว์เซอร์',
      url: CONFIG.DASHBOARD_URL,
      color: 5163440,
      fields: [
        {
          name: '⚙️ สถานะการตั้งค่า',
          value: '• Discord Alert: **' + (CONFIG.ENABLE_DISCORD ? 'เปิด' : 'ปิด') + '**\\n' +
                 '• Gmail Alert: **' + (CONFIG.ENABLE_EMAIL ? 'เปิด' : 'ปิด') + '**\\n' +
                 '• วิชาที่ซ่อนไว้: **' + CONFIG.HIDDEN_COURSE_IDS.length + ' วิชา**',
          inline: false
        },
        {
          name: '🕒 เวลาทดสอบระบบ',
          value: nowStr + ' (' + CONFIG.TIMEZONE + ')',
          inline: false
        }
      ],
      footer: { text: 'Classroom Hub • Google Apps Script Diagnostic' },
      timestamp: new Date().toISOString()
    }]
  };

  var res = postDiscordWebhookWithRetry(webhookUrl, payload);
  Logger.log('Test Result: ' + JSON.stringify(res));
}

/**
 * [DEBUG 2] โหมดจำลองการตรวจงาน (Dry Run) แสดงผลใน Execution Log โดยไม่ส่งแจ้งเตือนจริง
 */
function debugDryRun() {
  Logger.log('=== [Classroom Hub: debugDryRun (NO MESSAGES WILL BE SENT)] ===');
  var scan = collectClassroomAlerts({ dryRun: true });
  Logger.log('Active Courses Found: ' + scan.activeCourseCount + ' | Hidden Courses Skipped: ' + scan.skippedCourseCount);
  Logger.log('Pending Deadline Items Ready to Notify: ' + scan.pendingAssignments.length);
  for (var i = 0; i < scan.pendingAssignments.length; i++) {
    var a = scan.pendingAssignments[i];
    Logger.log('  [' + a.bucket + '] ' + a.courseName + ' -> ' + a.title + ' | Due: ' + a.dueDate + ' (' + a.daysLeftLabel + ')');
  }
  Logger.log('New Announcements/Posts Ready to Notify: ' + scan.newAnnouncements.length);
  for (var j = 0; j < scan.newAnnouncements.length; j++) {
    var n = scan.newAnnouncements[j];
    Logger.log('  [NEW_POST] ' + n.courseName + ' -> ' + n.title);
  }
  Logger.log('=== [End of Dry Run] ===');
}

/**
 * [DEBUG 3] ล้างประวัติการส่งแจ้งเตือนทั้งหมดใน PropertiesService เพื่อทดสอบส่งใหม่
 */
function resetSentHistory() {
  var props = PropertiesService.getScriptProperties();
  var todayKey = 'ch_sent_' + Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd');
  props.deleteProperty(CONFIG.STORAGE_KEY_V2);
  props.deleteProperty(todayKey);
  Logger.log('[RESET] ล้างประวัติการแจ้งเตือน (' + CONFIG.STORAGE_KEY_V2 + ' และ ' + todayKey + ') เรียบร้อยแล้ว');
}

/**
 * รวบรวมรายการการบ้านใกล้กำหนดส่งและประกาศใหม่จาก Google Classroom
 */
function collectClassroomAlerts(opts) {
  var isDryRun = Boolean(opts && opts.dryRun);
  var hiddenCourseIds = CONFIG.HIDDEN_COURSE_IDS || [];
  var props = PropertiesService.getScriptProperties();
  var sentTodayKey = 'ch_sent_' + Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd');

  var sentLegacyIds = [];
  var sentV2Map = {};
  try {
    sentLegacyIds = JSON.parse(props.getProperty(sentTodayKey) || '[]');
  } catch (e) {
    sentLegacyIds = [];
  }
  try {
    sentV2Map = JSON.parse(props.getProperty(CONFIG.STORAGE_KEY_V2) || '{}');
  } catch (e) {
    sentV2Map = {};
  }

  var courses = [];
  var coursePageToken = null;
  do {
    var listOpts = { courseStates: ["ACTIVE"] };
    if (coursePageToken) listOpts.pageToken = coursePageToken;
    var response = Classroom.Courses.list(listOpts);
    if (response.courses) courses = courses.concat(response.courses);
    coursePageToken = response.nextPageToken;
  } while (coursePageToken);

  var pendingAssignments = [];
  var newAnnouncements = [];
  var activeCourseCount = 0;
  var skippedCourseCount = 0;
  var now = new Date();
  var recentPostCutoffMs = now.getTime() - (24 * 60 * 60 * 1000);

  for (var i = 0; i < courses.length; i++) {
    var course = courses[i];
    if (hiddenCourseIds.indexOf(course.id) !== -1) {
      skippedCourseCount++;
      Logger.log("Skipping hidden course: " + course.name + " (" + course.id + ")");
      continue;
    }
    activeCourseCount++;

    // 1. Scan Coursework Deadlines
    var courseWorks = [];
    var cwPageToken = null;
    try {
      do {
        var cwOpts = cwPageToken ? { pageToken: cwPageToken } : {};
        var cwResponse = Classroom.Courses.CourseWork.list(course.id, cwOpts);
        if (cwResponse.courseWork) courseWorks = courseWorks.concat(cwResponse.courseWork);
        cwPageToken = cwResponse.nextPageToken;
      } while (cwPageToken);
    } catch (err) {
      Logger.log('[WARN] Could not list coursework for ' + course.name + ': ' + err.toString());
      continue;
    }

    for (var j = 0; j < courseWorks.length; j++) {
      var work = courseWorks[j];
      if (!work.dueDate || sentLegacyIds.indexOf(work.id) !== -1) continue;

      var dueYear = work.dueDate.year;
      var dueMonth = work.dueDate.month - 1;
      var dueDay = work.dueDate.day;
      var dueDate;
      if (work.dueTime && (work.dueTime.hours !== undefined || work.dueTime.minutes !== undefined)) {
        dueDate = new Date(Date.UTC(dueYear, dueMonth, dueDay, work.dueTime.hours || 0, work.dueTime.minutes || 0, work.dueTime.seconds || 0));
      } else {
        // Date-only due date: end of Bangkok day (23:59:59+07:00 = 16:59:59Z)
        dueDate = new Date(Date.UTC(dueYear, dueMonth, dueDay, 16, 59, 59));
      }

      var diffTime = dueDate.getTime() - now.getTime();
      var diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // Notify on milestones: 3 days left, 1 day left, due today (0), or 1 day overdue (-1)
      var bucket = null;
      var daysLeftLabel = '';
      if (diffDays === 3 || diffDays === 2) {
        bucket = 'due_3d';
        daysLeftLabel = 'เหลืออีก ' + diffDays + ' วัน';
      } else if (diffDays === 1) {
        bucket = 'due_1d';
        daysLeftLabel = 'ส่งพรุ่งนี้!';
      } else if (diffDays === 0 && diffTime >= 0) {
        bucket = 'due_today';
        daysLeftLabel = 'ครบกำหนดส่งวันนี้!';
      } else if (diffTime < 0 && diffTime >= -(24 * 60 * 60 * 1000)) {
        bucket = 'overdue_1d';
        daysLeftLabel = 'เลยกำหนดส่งแล้ว!';
      }

      if (!bucket) continue;

      var dedupKey = work.id + ':' + bucket;
      if (sentV2Map[dedupKey]) continue;

      var isDone = false;
      try {
        var submissionsResponse = Classroom.Courses.CourseWork.StudentSubmissions.list(course.id, work.id, { userId: "me" });
        var submissions = submissionsResponse.studentSubmissions || [];
        if (submissions.length > 0) {
          var state = submissions[0].state;
          if (state === "TURNED_IN" || state === "RETURNED") {
            isDone = true;
          }
        }
      } catch (subErr) {
        Logger.log('[WARN] Could not check submission state for ' + work.id + ': ' + subErr.toString());
      }

      if (!isDone) {
        pendingAssignments.push({
          id: work.id,
          dedupKey: dedupKey,
          bucket: bucket,
          title: work.title || 'Untitled Assignment',
          courseName: course.name || 'Course',
          dueDate: Utilities.formatDate(dueDate, CONFIG.TIMEZONE, "dd MMM HH:mm"),
          daysLeft: diffDays,
          daysLeftLabel: daysLeftLabel,
          points: typeof work.maxPoints === 'number' ? String(work.maxPoints) + ' คะแนน' : 'ไม่ระบุคะแนน',
          link: sanitizeSafeUrl(work.alternateLink)
        });
      }
    }

    // 2. Scan Recent Announcements (Last 24 hours) if enabled
    if (CONFIG.NOTIFY_NEW_POSTS) {
      try {
        var annRes = Classroom.Courses.Announcements.list(course.id, { pageSize: 10 });
        var anns = annRes.announcements || [];
        for (var aIdx = 0; aIdx < anns.length; aIdx++) {
          var ann = anns[aIdx];
          var annKey = 'ann:' + ann.id;
          if (sentV2Map[annKey]) continue;
          var createdMs = ann.creationTime ? new Date(ann.creationTime).getTime() : 0;
          if (createdMs >= recentPostCutoffMs) {
            newAnnouncements.push({
              id: ann.id,
              dedupKey: annKey,
              courseName: course.name || 'Course',
              title: truncateText(ann.text || 'ประกาศใหม่ในชั้นเรียน', 140, 'ประกาศใหม่'),
              link: sanitizeSafeUrl(ann.alternateLink)
            });
          }
        }
      } catch (annErr) {
        // Ignore if announcements permission/feed is unavailable for a course
      }
    }
  }

  return {
    activeCourseCount: activeCourseCount,
    skippedCourseCount: skippedCourseCount,
    pendingAssignments: pendingAssignments,
    newAnnouncements: newAnnouncements,
    sentTodayKey: sentTodayKey,
    sentLegacyIds: sentLegacyIds,
    sentV2Map: sentV2Map,
    isDryRun: isDryRun
  };
}

/**
 * ฟังก์ชันหลักสำหรับตั้งเวลาทำงานอัตโนมัติ (Time-driven Trigger)
 */
function sendClassroomDigest() {
  try {
    var email = '';
    try {
      email = Session.getActiveUser().getEmail();
    } catch (e) {}

    var scan = collectClassroomAlerts({ dryRun: false });
    var pendingAssignments = scan.pendingAssignments;
    var newAnnouncements = scan.newAnnouncements;

    if (pendingAssignments.length === 0 && newAnnouncements.length === 0) {
      Logger.log("No new pending assignments due within 3 days or new announcements.");
      return;
    }

    var deliveredAny = false;
    var webhookUrl = resolveDiscordWebhookUrl();

    // 1. Deliver via Discord Webhook
    if (CONFIG.ENABLE_DISCORD && isValidDiscordWebhook(webhookUrl)) {
      var embeds = [];

      if (pendingAssignments.length > 0) {
        var hasOverdue = false;
        var hasUrgent = false;
        var fields = [];

        for (var idx = 0; idx < Math.min(pendingAssignments.length, 20); idx++) {
          var item = pendingAssignments[idx];
          if (item.bucket === 'overdue_1d') hasOverdue = true;
          if (item.bucket === 'due_today' || item.bucket === 'due_1d') hasUrgent = true;

          var fieldTitle = truncateText('📘 ' + item.courseName + ' — ' + item.title, 250, 'Assignment');
          var linkPart = item.link ? ' • [เปิดใน Classroom](' + item.link + ')' : '';
          var fieldVal = truncateText(
            '⏰ กำหนดส่ง: **' + item.dueDate + '** (' + item.daysLeftLabel + ') | 🏆 ' + item.points + linkPart,
            1000,
            '-'
          );
          fields.push({ name: fieldTitle, value: fieldVal, inline: false });
        }

        if (pendingAssignments.length > 20) {
          fields.push({
            name: 'รายการเพิ่มเติม',
            value: '+ และอีก ' + (pendingAssignments.length - 20) + ' งานใน Classroom Hub',
            inline: false
          });
        }

        var embedColor = hasOverdue ? 15813708 : (hasUrgent ? 13412096 : 3642623);
        embeds.push({
          title: '🔔 แจ้งเตือนการบ้านใกล้ส่ง / ค้างส่ง (' + pendingAssignments.length + ' รายการ)',
          description: 'ตรวจพบงานที่ต้องส่งจาก Google Classroom • [เปิดแดชบอร์ด Classroom Hub](' + CONFIG.DASHBOARD_URL + ')',
          url: CONFIG.DASHBOARD_URL,
          color: embedColor,
          fields: fields,
          footer: { text: 'Classroom Hub • 24/7 Auto Cloud Alert' },
          timestamp: new Date().toISOString()
        });
      }

      if (newAnnouncements.length > 0) {
        var annFields = [];
        for (var nIdx = 0; nIdx < Math.min(newAnnouncements.length, 15); nIdx++) {
          var annItem = newAnnouncements[nIdx];
          var annLink = annItem.link ? ' ([เปิดดู](' + annItem.link + '))' : '';
          annFields.push({
            name: truncateText('📢 ' + annItem.courseName, 250, 'Course'),
            value: truncateText(annItem.title + annLink, 1000, '-'),
            inline: false
          });
        }
        embeds.push({
          title: '🆕 ประกาศใหม่ในชั้นเรียน (' + newAnnouncements.length + ' รายการ)',
          url: CONFIG.DASHBOARD_URL,
          color: 5793266,
          fields: annFields,
          footer: { text: 'Classroom Hub • New Classroom Activity' },
          timestamp: new Date().toISOString()
        });
      }

      var discordRes = postDiscordWebhookWithRetry(webhookUrl, {
        username: 'Classroom Hub',
        embeds: embeds
      });
      if (discordRes.ok) {
        deliveredAny = true;
      }
    }

    // 2. Deliver via Gmail (if enabled and user email is available)
    if (CONFIG.ENABLE_EMAIL && email && pendingAssignments.length > 0) {
      var htmlBody = '<html><head><meta charset="utf-8"></head><body style="background-color: #11141C; color: #E2E5EE; font-family: -apple-system, BlinkMacSystemFont, Arial, sans-serif; margin: 0; padding: 20px;">' +
        '<div style="max-width: 600px; margin: 0 auto; background-color: #171B24; border: 1px solid #2A3140; border-radius: 12px; padding: 28px;">' +
        '<div style="text-align: center; border-bottom: 1px solid #2A3140; padding-bottom: 18px; margin-bottom: 20px;">' +
        '<div style="font-size: 13px; font-weight: 600; color: #60A5FA;">Classroom Hub</div>' +
        '<div style="font-size: 18px; font-weight: 600; color: #EEF0F5; margin-top: 8px;">สรุปงานค้างส่งใกล้วันกำหนดส่ง (เหลือเวลาไม่ถึง 3 วัน)</div>' +
        '</div><div>';

      for (var k = 0; k < pendingAssignments.length; k++) {
        var mailItem = pendingAssignments[k];
        htmlBody += '<div style="background-color: #11141C; border: 1px solid #2A3140; border-radius: 8px; padding: 15px; margin-bottom: 14px;">' +
          '<div style="display: inline-block; background-color: #1B2942; color: #60A5FA; font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 6px; margin-bottom: 8px;">' + escapeHtmlScript(mailItem.courseName) + '</div>' +
          '<div style="font-size: 14px; font-weight: 600; color: #EEF0F5; margin-bottom: 8px;">' + escapeHtmlScript(mailItem.title) + '</div>' +
          '<div style="font-size: 12px; color: #A1AAB9; margin-bottom: 12px;">' +
          'กำหนดส่ง: <strong style="color: #FBBF24;">' + escapeHtmlScript(mailItem.dueDate) + '</strong> (' + escapeHtmlScript(mailItem.daysLeftLabel) + ') &nbsp;|&nbsp; ' + escapeHtmlScript(mailItem.points) +
          '</div>' +
          (mailItem.link ? '<a href="' + escapeHtmlScript(mailItem.link) + '" target="_blank" rel="noopener noreferrer" style="display: inline-block; background-color: #2563EB; color: #FFFFFF !important; text-decoration: none; padding: 6px 14px; border-radius: 6px; font-size: 12px; font-weight: 500;">เปิดทำการบ้านใน Classroom</a>' : '') +
          '</div>';
      }

      htmlBody += '</div>' +
        '<div style="text-align: center; font-size: 11px; color: #7C8598; margin-top: 26px; border-top: 1px solid #2A3140; padding-top: 15px;">' +
        'ส่งโดยระบบออโต้คลาวด์ Classroom Hub (Personal Apps Script)<br>' +
        'คุณได้รับอีเมลนี้เนื่องจากตั้งค่าแจ้งเตือนงานค้างส่งล่วงหน้าไว้' +
        '</div></div></body></html>';

      MailApp.sendEmail({
        to: email,
        subject: "สรุปงานค้างส่ง (เหลือเวลาไม่ถึง 3 วัน) - Classroom Hub",
        htmlBody: htmlBody
      });
      deliveredAny = true;
      Logger.log("Notification email sent successfully to: " + email);
    }

    // 3. Persist deduplication state only if at least one channel succeeded
    if (deliveredAny) {
      var props = PropertiesService.getScriptProperties();
      var nowIso = new Date().toISOString();
      var sentV2 = scan.sentV2Map || {};
      var sentIds = scan.sentLegacyIds || [];

      for (var m = 0; m < pendingAssignments.length; m++) {
        sentIds.push(pendingAssignments[m].id);
        sentV2[pendingAssignments[m].dedupKey] = nowIso;
      }
      for (var p = 0; p < newAnnouncements.length; p++) {
        sentV2[newAnnouncements[p].dedupKey] = nowIso;
      }

      // Prune v2 map to most recent MAX_STORED_RECORDS entries to stay within 9KB quota
      var allKeys = Object.keys(sentV2);
      if (allKeys.length > CONFIG.MAX_STORED_RECORDS) {
        var trimmed = {};
        var keepKeys = allKeys.slice(allKeys.length - CONFIG.MAX_STORED_RECORDS);
        for (var q = 0; q < keepKeys.length; q++) {
          trimmed[keepKeys[q]] = sentV2[keepKeys[q]];
        }
        sentV2 = trimmed;
      }

      props.setProperty(scan.sentTodayKey, JSON.stringify(sentIds.slice(-200)));
      props.setProperty(CONFIG.STORAGE_KEY_V2, JSON.stringify(sentV2));
    } else {
      Logger.log("[WARN] No notification channel succeeded; deduplication state was not updated so the next run can retry.");
    }

  } catch (error) {
    Logger.log("Error running script: " + error.toString());
  }
}
`;
}
