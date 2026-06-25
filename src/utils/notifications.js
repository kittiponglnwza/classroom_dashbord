import { 
  getEnableEmailAlerts,
  getAlertSettings,
  getSundayDigestTime,
  getSentNotifications,
  saveSentNotifications,
  getDailyEmailLimit,
  saveDailyEmailLimit,
  addNotificationHistoryLog
} from './storage';
import { sendGmailNotification } from '../services/googleClassroom';
import { parseExamDate } from './examDate';


/**
 * Calculates calendar days difference: dueDate - today
 */
export const getCalendarDaysDifference = (dueDateStr, today) => {
  if (!dueDateStr) return null;
  
  // Clean ISO date strings or datetime strings to date-only
  const d1 = new Date(dueDateStr);
  const d2 = new Date(today);
  
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return null;

  d1.setHours(0, 0, 0, 0);
  d2.setHours(0, 0, 0, 0);
  
  const diffTime = d1.getTime() - d2.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * Returns hex color code based on Tailwind color names
 */
const getHexColor = (color) => {
  switch (color) {
    case 'emerald': return '#10b981';
    case 'blue': return '#3b82f6';
    case 'amber': return '#f59e0b';
    case 'rose': return '#f43f5e';
    case 'purple': return '#a855f7';
    default: return '#6366f1'; // Brand indigo
  }
};

/**
 * Wraps email body in a beautiful, premium dark-slate HTML template
 */
const wrapHtmlEmail = (title, contentHtml) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${title}</title>
      <style>
        body {
          margin: 0;
          padding: 0;
          background-color: #0b0f19;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          color: #e5e7eb;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          padding: 30px 15px;
        }
        .header {
          text-align: center;
          padding-bottom: 20px;
          border-b: 1px solid #1f2937;
        }
        .logo {
          font-size: 24px;
          font-weight: 800;
          color: #ffffff;
          margin: 0;
        }
        .tagline {
          font-size: 8px;
          color: #9ca3af;
          text-transform: uppercase;
          letter-spacing: 2px;
          margin-top: 4px;
        }
        .card {
          background-color: #111827;
          border: 1px solid #1f2937;
          border-radius: 16px;
          padding: 24px;
          margin-top: 25px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        }
        .title {
          font-size: 18px;
          font-weight: 700;
          color: #ffffff;
          margin-top: 0;
          margin-bottom: 12px;
        }
        .desc {
          font-size: 13px;
          color: #9ca3af;
          line-height: 1.6;
          margin-bottom: 20px;
        }
        .task-list {
          margin: 15px 0;
          padding: 0;
          list-style: none;
        }
        .task-item {
          border-left: 4px solid #6366f1;
          background-color: #1f2937;
          border-radius: 8px;
          padding: 12px 15px;
          margin-bottom: 10px;
        }
        .task-title {
          font-weight: 600;
          font-size: 13px;
          color: #ffffff;
          margin: 0;
        }
        .task-meta {
          font-size: 10px;
          color: #9ca3af;
          margin-top: 4px;
        }
        .footer {
          text-align: center;
          padding-top: 30px;
          font-size: 11px;
          color: #6b7280;
        }
        .button {
          display: inline-block;
          background-color: #ffffff;
          color: #111827;
          font-weight: 600;
          font-size: 12px;
          padding: 10px 20px;
          border-radius: 8px;
          text-decoration: none;
          margin-top: 15px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">CH Classroom Hub</div>
          <div class="tagline">Learning • Connection • Community</div>
        </div>
        
        <div class="card">
          ${contentHtml}
        </div>
        
        <div class="footer">
          This email was sent automatically from your browser via Classroom Hub Integration.<br>
          To change your email settings, please visit the Settings page in the web app.
        </div>
      </div>
    </body>
    </html>
  `;
};

/**
 * Checks and increments the daily limit tracker. Max 3 emails per day.
 */
const checkDailyLimitAndIncrement = (email) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const limit = getDailyEmailLimit(email);
  
  if (limit.lastSentDate === todayStr) {
    if (limit.count >= 3) {
      console.warn(`[Classroom Hub] Daily email limit (3) reached for ${email}. Aborting send.`);
      return false;
    }
    limit.count += 1;
  } else {
    limit.lastSentDate = todayStr;
    limit.count = 1;
  }
  saveDailyEmailLimit(limit, email);
  return true;
};

/**
 * Utility to generate a beautifully styled Upcoming Exams HTML table section
 */
export function buildExamsHtml(toEmail, isWeeklyDigest = false) {
  if (!toEmail) return '';
  const emailKey = toEmail.toLowerCase().trim();
  const cacheKey = `classroom_hub_exam_results_${emailKey}`;
  const cachedData = localStorage.getItem(cacheKey);
  if (!cachedData) return '';

  try {
    const parsed = JSON.parse(cachedData);
    const exams = [
      ...(parsed.exams || []),
      ...(parsed.manualExams || [])
    ];
    if (exams.length === 0) return '';

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Filter upcoming exams (must have parseable date, and date >= today)
    const upcomingExams = exams.filter(exam => {
      const parsedDate = parseExamDate(exam.rawIsoDate || exam.date);
      return parsedDate ? parsedDate >= today : false;
    });

    if (upcomingExams.length === 0) return '';

    // Sort upcoming exams chronologically
    upcomingExams.sort((a, b) => {
      const dateA = parseExamDate(a.rawIsoDate || a.date);
      const dateB = parseExamDate(b.rawIsoDate || b.date);
      return dateA - dateB;
    });

    // Extract next exam to highlight as "🔥 Next Exam"
    const nextExam = upcomingExams[0];
    const nextExamDate = parseExamDate(nextExam.rawIsoDate || nextExam.date);
    
    // Remaining days calculation helper
    const getRemainingLabel = (examDate) => {
      const diffTime = examDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays === 0) return 'Today';
      if (diffDays === 1) return 'Tomorrow';
      return `${diffDays} days left`;
    };

    const nextExamRemaining = getRemainingLabel(nextExamDate);

    let highlightHtml = `
      <div style="margin-top: 25px; border: 1px dashed #f59e0b; background-color: rgba(245, 158, 11, 0.05); border-radius: 12px; padding: 15px; margin-bottom: 20px;">
        <span style="font-size: 10px; color: #f59e0b; text-transform: uppercase; font-weight: 800; letter-spacing: 1px;">🔥 Next Exam</span>
        <h4 style="color: #ffffff; margin: 6px 0 2px 0; font-size: 14px;">${nextExam.courseCode} • ${nextExam.courseName}</h4>
        <div style="font-size: 12px; color: #9ca3af; margin-top: 4px; line-height: 1.5;">
          📅 <strong>Date:</strong> ${nextExam.date} (${nextExamRemaining})<br/>
          ⏱️ <strong>Time:</strong> ${nextExam.time || '-'}<br/>
          📍 <strong>Room:</strong> ${nextExam.room || '-'} ${nextExam.seat ? `• 🪑 <strong>Seat:</strong> ${nextExam.seat}` : ''}
        </div>
      </div>
    `;

    // Limit items for Weekly Digest if needed
    const limit = isWeeklyDigest ? 5 : 999;
    const displayExams = upcomingExams.slice(0, limit);
    const hiddenCount = upcomingExams.length - displayExams.length;

    // Generate table rows
    let tableRows = '';
    displayExams.forEach(exam => {
      const examDate = parseExamDate(exam.rawIsoDate || exam.date);
      const remainingLabel = getRemainingLabel(examDate);
      const isManualLabel = exam.isManual ? ' <span style="font-size: 9px; color: #a855f7; background-color: rgba(168, 85, 247, 0.2); padding: 1px 4px; border-radius: 4px;">Manual</span>' : '';
      const seatText = exam.seat || '-';

      tableRows += `
        <tr style="border-bottom: 1px solid #1f2937;">
          <td style="padding: 12px 8px; font-size: 12px; color: #ffffff;">
            <strong>${exam.courseCode || ''}</strong><br/>
            <span style="font-size: 11px; color: #9ca3af;">${exam.courseName || ''}</span>${isManualLabel ? '<br/>' + isManualLabel : ''}
          </td>
          <td style="padding: 12px 8px; font-size: 12px; color: #e5e7eb; white-space: nowrap;">
            ${exam.date || '-'}<br/>
            <span style="font-size: 10px; color: #9ca3af;">${exam.time || ''}</span>
          </td>
          <td style="padding: 12px 8px; font-size: 11px; color: #f59e0b; white-space: nowrap; font-weight: 600;">
            ${remainingLabel}
          </td>
          <td style="padding: 12px 8px; font-size: 12px; color: #e5e7eb; text-align: center;">
            ${exam.room || '-'}
          </td>
          <td style="padding: 12px 8px; font-size: 12px; color: #10b981; font-weight: bold; text-align: center;">
            ${seatText}
          </td>
        </tr>
      `;
    });

    let extraFooterHtml = '';
    if (hiddenCount > 0) {
      extraFooterHtml = `
        <div style="text-align: center; font-size: 12px; color: #a855f7; padding: 10px; font-weight: 600;">
          ➕ And ${hiddenCount} more upcoming exam${hiddenCount > 1 ? 's' : ''}...
        </div>
      `;
    }

    return `
      <div style="margin-top: 25px; border-top: 1px solid #1f2937; padding-top: 20px;">
        <h3 style="color: #ffffff; margin: 0 0 15px 0; font-size: 15px; font-weight: 700; display: flex; align-items: center; gap: 8px;">
          📅 Upcoming Exam Schedule (${upcomingExams.length})
        </h3>
        
        ${highlightHtml}

        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; text-align: left; background-color: #111827;">
            <thead>
              <tr style="border-bottom: 2px solid #1f2937; background-color: #1f2937;">
                <th style="padding: 10px 8px; font-size: 11px; color: #9ca3af; text-transform: uppercase; font-weight: 700;">Subject</th>
                <th style="padding: 10px 8px; font-size: 11px; color: #9ca3af; text-transform: uppercase; font-weight: 700;">Date & Time</th>
                <th style="padding: 10px 8px; font-size: 11px; color: #9ca3af; text-transform: uppercase; font-weight: 700;">Remaining</th>
                <th style="padding: 10px 8px; font-size: 11px; color: #9ca3af; text-transform: uppercase; font-weight: 700; text-align: center;">Room</th>
                <th style="padding: 10px 8px; font-size: 11px; color: #9ca3af; text-transform: uppercase; font-weight: 700; text-align: center;">Seat</th>
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
    console.error('Error generating exams HTML for email digest', err);
    return '';
  }
}

/**
 * Sends a high-fidelity Test Success Email
 */
export async function triggerTestEmail(accessToken, toEmail) {

  if (!checkDailyLimitAndIncrement(toEmail)) {
    alert('Failed to send test email: You have reached the daily limit of 3 emails.');
    return;
  }

  const alertSettings = getAlertSettings(toEmail);
  const time = getSundayDigestTime(toEmail);

  const body = `
    <h2 class="title" style="color: #10b981;">🎉 Gmail Integration Success</h2>
    <p class="desc">
      The connection between Classroom Hub and your Gmail account has been successfully established! Going forward, you will receive notifications based on your settings.
    </p>
    <div style="border-top: 1px solid #1f2937; padding-top: 15px; margin-top: 15px;">
      <h3 style="font-size: 13px; color: #ffffff; margin-top: 0;">Active Trigger Summary:</h3>
      <ul style="font-size: 12px; color: #9ca3af; padding-left: 20px; line-height: 1.8;">
        <li>3 Days Before Due: <strong>${alertSettings.due3Days ? '✓ Enabled' : '✗ Disabled'}</strong></li>
        <li>1 Day Before Due: <strong>${alertSettings.due1Day ? '✓ Enabled' : '✗ Disabled'}</strong></li>
        <li>Due Today: <strong>${alertSettings.dueToday ? '✓ Enabled' : '✗ Disabled'}</strong></li>
        <li>1 Day Overdue (Once): <strong>${alertSettings.overdue1Day ? '✓ Enabled' : '✗ Disabled'}</strong></li>
        <li>New Posts (Consolidated): <strong>${alertSettings.newPosts ? '✓ Enabled' : '✗ Disabled'}</strong></li>
        <li>Sunday Digest (No Due Date): <strong>${alertSettings.sundayDigest ? `✓ Every Sunday at ${time}` : '✗ Disabled'}</strong></li>
      </ul>
    </div>
  `;

  const html = wrapHtmlEmail('Classroom Hub: Gmail Integration Success', body);
  
  await sendGmailNotification(accessToken, toEmail, '🎉 Classroom Hub: Gmail Integration Success', html);
  addNotificationHistoryLog({
    title: 'Sent connection test email successfully',
    type: 'test_email'
  }, toEmail);
}

/**
 * Triggers a manual overall task digest immediately
 */
export async function triggerManualDigest(accessToken, toEmail, assignments) {
  if (!checkDailyLimitAndIncrement(toEmail)) {
    alert('Failed to send task digest: You have reached the daily limit of 3 emails.');
    return;
  }

  const alertSettings = getAlertSettings(toEmail);
  const todoTasks = assignments.filter(a => a.status !== 'done');

  // Check if we have upcoming exams cached
  const emailKey = toEmail.toLowerCase().trim();
  const cacheKey = `classroom_hub_exam_results_${emailKey}`;
  const cachedData = localStorage.getItem(cacheKey);
  let hasUpcomingExams = false;

  if (alertSettings.includeExams && cachedData) {
    try {
      const parsed = JSON.parse(cachedData);
      const exams = [
        ...(parsed.exams || []),
        ...(parsed.manualExams || [])
      ];
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      hasUpcomingExams = exams.some(exam => {
        const parsedDate = parseExamDate(exam.rawIsoDate || exam.date);
        return parsedDate ? parsedDate >= today : false;
      });
    } catch (e) {}
  }

  if (todoTasks.length === 0 && !hasUpcomingExams) {
    alert('You have no pending assignments or upcoming exams to digest at the moment!');
    return;
  }

  // Group tasks by course
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
        <div style="margin-top: 15px; border-left: 4px solid ${borderHex}; background-color: #1f2937; border-radius: 8px; padding: 12px 15px;">
          <h4 style="color: #ffffff; margin: 0 0 8px 0; font-size: 13px;">📚 ${courseName}</h4>
          <div style="font-size: 12px; color: #d1d5db; line-height: 1.6;">
      `;
      
      list.forEach(t => {
        const dueLabel = t.dueDate ? new Date(t.dueDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short' }) : 'No Due Date';
        tasksHtml += `
          <div style="padding: 6px 0; border-bottom: 1px solid #374151;">
            <strong>• ${t.title}</strong> <span style="font-size: 10px; color: #9ca3af; margin-left: 8px;">(Due: ${dueLabel})</span>
          </div>
        `;
      });
      
      tasksHtml += `</div></div>`;
    });
  } else {
    tasksHtml = `<p style="font-size: 12px; color: #9ca3af; font-style: italic; margin-top: 15px;">No pending assignments.</p>`;
  }

  const examsHtml = alertSettings.includeExams ? buildExamsHtml(toEmail, false) : '';
  const body = `
    <h2 class="title">Pending Assignments Digest</h2>
    <p class="desc">
      Here is a summary of all your currently unfinished coursework in Classroom Hub.
    </p>
    ${tasksHtml}
    ${examsHtml}
  `;

  const html = wrapHtmlEmail('Pending Assignments Digest', body);
  await sendGmailNotification(accessToken, toEmail, '📝 Pending Assignments Digest - Classroom Hub', html);
  
  addNotificationHistoryLog({
    title: `Sent pending assignments digest (Total ${todoTasks.length} items)`,
    type: 'manual_digest'
  }, toEmail);
  
  alert('Sent pending assignments summary to your Gmail successfully!');
}

/**
 * Main evaluator. Scans assignments, rules, caches, and sends emails if appropriate.
 */
export async function evaluateNotifications(accessToken, toEmail, assignments, courses, resources) {
  const isEnabled = getEnableEmailAlerts(toEmail);
  if (!isEnabled) return;

  const alertSettings = getAlertSettings(toEmail);
  const sentRecords = getSentNotifications(toEmail);
  const now = new Date();
  
  // Track new records to append to the log
  const newSentRecords = [...sentRecords];
  let emailSentThisSession = false;

  const checkAndRecordSent = (assignmentId, type) => {
    const isSent = sentRecords.some(r => r.assignmentId === assignmentId && r.type === type);
    if (isSent) return false;
    newSentRecords.push({
      assignmentId,
      type,
      sentAt: now.toISOString()
    });
    return true;
  };

  const activeTodoAssignments = assignments.filter(a => a.status !== 'done');

  // ==========================================
  // Milestone 1 / V1: Due date Reminders
  // ==========================================
  for (const task of activeTodoAssignments) {
    if (!task.dueDate) continue;

    const diffDays = getCalendarDaysDifference(task.dueDate, now);
    if (diffDays === null) continue;

    let triggerType = null;
    let subject = '';
    let emoji = '';
    let warningLabel = '';

    if (diffDays === 3 && alertSettings.due3Days) {
      triggerType = 'due_3_days';
      subject = `[Classroom Hub] ⚠️ Reminder: 3 Days Before Due: ${task.title}`;
      emoji = '⚠️';
      warningLabel = 'Due in 3 days';
    } else if (diffDays === 1 && alertSettings.due1Day) {
      triggerType = 'due_1_day';
      subject = `[Classroom Hub] 🚨 Urgent: Due Tomorrow: ${task.title}`;
      emoji = '🚨';
      warningLabel = 'Due tomorrow';
    } else if (diffDays === 0 && alertSettings.dueToday) {
      triggerType = 'due_today';
      subject = `[Classroom Hub] ⏱️ Due Today: ${task.title}`;
      emoji = '⏱️';
      warningLabel = 'Due today!';
    } else if (diffDays === -1 && alertSettings.overdue1Day) {
      triggerType = 'overdue_1_day';
      subject = `[Classroom Hub] 🔴 Overdue: ${task.title}`;
      emoji = '🔴';
      warningLabel = 'Overdue by 1 day! Action required';
    }

    if (triggerType && checkAndRecordSent(task.id, triggerType)) {
      if (checkDailyLimitAndIncrement(toEmail)) {
        const body = `
          <h2 class="title" style="color: ${triggerType.includes('overdue') ? '#f43f5e' : '#f59e0b'};">
            ${emoji} ${warningLabel}
          </h2>
          <div style="border-left: 4px solid ${getHexColor(task.courseColor)}; background-color: #1f2937; border-radius: 8px; padding: 15px; margin-top: 15px;">
            <span style="font-size: 9px; color: #9ca3af; text-transform: uppercase; font-weight: 700;">${task.courseCode} • ${task.course}</span>
            <h3 style="color: #ffffff; margin: 4px 0 10px 0; font-size: 15px;">${task.title}</h3>
            <p style="font-size: 12px; color: #d1d5db; line-height: 1.6; margin: 0;">${task.description || 'No description provided.'}</p>
          </div>
          ${task.googleLink ? `<a href="${task.googleLink}" target="_blank" class="button">View on Google Classroom</a>` : ''}
        `;
        const html = wrapHtmlEmail(subject, body);
        await sendGmailNotification(accessToken, toEmail, subject, html);
        
        addNotificationHistoryLog({
          title: `Sent reminder for '${task.title}' (${warningLabel})`,
          type: triggerType
        }, toEmail);
        
        emailSentThisSession = true;
      }
    }
  }

  // ==========================================
  // Milestone 3 / V2: Sunday Digest (No Due Date Tasks)
  // ==========================================
  if (alertSettings.sundayDigest) {
    const isSunday = now.getDay() === 0;
    const digestTimeStr = getSundayDigestTime(toEmail);
    const [targetHour, targetMinute] = digestTimeStr.split(':').map(Number);
    
    // Check if current time has passed target time today
    const currentHour = now.getHours();
    const currentMin = now.getMinutes();
    const timePassedTarget = (currentHour > targetHour) || (currentHour === targetHour && currentMin >= targetMinute);
    
    // We identify weeks by Sunday date stamp YYYY-MM-DD
    const sundayDate = new Date(now);
    sundayDate.setDate(now.getDate() - now.getDay()); // Go to this week's Sunday
    const sundayStamp = sundayDate.toISOString().split('T')[0];
    const digestRecordType = `sunday_digest_${sundayStamp}`;

    const alreadySentThisWeek = sentRecords.some(r => r.type === digestRecordType);

    if (((isSunday && timePassedTarget) || !isSunday) && !alreadySentThisWeek) {
      // Find assignments with NO due date
      const noDueDateTasks = activeTodoAssignments.filter(a => !a.dueDate);

      // Check if we have upcoming exams cached
      const emailKey = toEmail.toLowerCase().trim();
      const cacheKey = `classroom_hub_exam_results_${emailKey}`;
      const cachedData = localStorage.getItem(cacheKey);
      let hasUpcomingExams = false;

      if (alertSettings.includeExams && cachedData) {
        try {
          const parsed = JSON.parse(cachedData);
          const exams = [
            ...(parsed.exams || []),
            ...(parsed.manualExams || [])
          ];
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          hasUpcomingExams = exams.some(exam => {
            const parsedDate = parseExamDate(exam.rawIsoDate || exam.date);
            return parsedDate ? parsedDate >= today : false;
          });
        } catch (e) {}
      }

      if (noDueDateTasks.length > 0 || hasUpcomingExams) {
        if (checkDailyLimitAndIncrement(toEmail)) {
          let itemsHtml = '';
          if (noDueDateTasks.length > 0) {
            // Group by course
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
                <div style="margin-top: 15px; border-left: 4px solid ${borderHex}; background-color: #1f2937; border-radius: 8px; padding: 12px 15px;">
                  <h4 style="color: #ffffff; margin: 0 0 8px 0; font-size: 13px;">📚 ${courseName}</h4>
                  <div style="font-size: 12px; color: #d1d5db;">
              `;
              list.forEach(t => {
                itemsHtml += `<div style="padding: 4px 0; border-bottom: 1px solid #374151;">• ${t.title}</div>`;
              });
              itemsHtml += `</div></div>`;
            });
          } else {
            itemsHtml = `<p style="font-size: 12px; color: #9ca3af; font-style: italic; margin-top: 15px;">No pending assignments with no due date.</p>`;
          }

          const examsHtml = alertSettings.includeExams ? buildExamsHtml(toEmail, true) : '';

          const body = `
            <h2 class="title" style="color: #6366f1;">📅 Sunday Digest: Weekly Summary</h2>
            <p class="desc">
              Here is your weekly summary of pending tasks and upcoming exams.
            </p>
            ${itemsHtml}
            ${examsHtml}
          `;

          const digestSubject = `[Classroom Hub] 📅 Sunday Digest: Weekly summary`;
          const html = wrapHtmlEmail(digestSubject, body);
          await sendGmailNotification(accessToken, toEmail, digestSubject, html);
          
          newSentRecords.push({
            assignmentId: 'sunday_digest_overall',
            type: digestRecordType,
            sentAt: now.toISOString()
          });
          
          addNotificationHistoryLog({
            title: `Sent Sunday Digest email (Total ${noDueDateTasks.length} tasks, exams included: ${hasUpcomingExams})`,
            type: 'sunday_digest'
          }, toEmail);
          
          emailSentThisSession = true;
        }
      }
    }
  }

  // Save updated send logs
  if (newSentRecords.length !== sentRecords.length) {
    saveSentNotifications(newSentRecords, toEmail);
  }
}

/**
 * V2 Feature: Evaluates and groups new posts into a single digest email on sync.
 */
export async function evaluateNewPostDigest(accessToken, toEmail, freshAssignments, freshResources, cachedAssignmentIds, cachedResourceIds) {
  const alertSettings = getAlertSettings(toEmail);
  if (!alertSettings.newPosts) return;

  const newAssignments = freshAssignments.filter(a => !cachedAssignmentIds.includes(a.id));
  // Filter new resources that are announcements or materials
  const newResources = freshResources.filter(r => !cachedResourceIds.includes(r.id));

  const totalNew = newAssignments.length + newResources.length;
  if (totalNew === 0) return;

  if (!checkDailyLimitAndIncrement(toEmail)) return;

  // Group items by Course
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
      <div style="margin-top: 15px; border-left: 4px solid ${borderHex}; background-color: #1f2937; border-radius: 8px; padding: 12px 15px;">
        <h4 style="color: #ffffff; margin: 0 0 8px 0; font-size: 13px;">📚 ${courseName}</h4>
    `;
    
    if (group.assigns.length > 0) {
      groupHtml += `<p style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #a855f7; margin: 8px 0 4px 0;">📝 New Assignments (${group.assigns.length})</p>`;
      group.assigns.forEach(t => {
        groupHtml += `<div style="font-size: 12px; color: #ffffff; padding: 4px 0; border-bottom: 1px solid #374151;">• <strong>${t.title}</strong></div>`;
      });
    }
    
    if (group.resources.length > 0) {
      const anns = group.resources.filter(r => r.type === 'announcement');
      const mats = group.resources.filter(r => r.type === 'material');
      
      if (anns.length > 0) {
        groupHtml += `<p style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #f59e0b; margin: 10px 0 4px 0;">📢 New Announcements (${anns.length})</p>`;
        anns.forEach(r => {
          groupHtml += `<div style="font-size: 12px; color: #ffffff; padding: 4px 0; border-bottom: 1px solid #374151;">• <strong>${r.title}</strong></div>`;
        });
      }
      
      if (mats.length > 0) {
        groupHtml += `<p style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #3b82f6; margin: 10px 0 4px 0;">📖 New Course Materials (${mats.length})</p>`;
        mats.forEach(r => {
          groupHtml += `<div style="font-size: 12px; color: #ffffff; padding: 4px 0; border-bottom: 1px solid #374151;">• <strong>${r.title}</strong></div>`;
        });
      }
    }
    
    groupHtml += `</div>`;
  });

  const subject = `[Classroom Hub] 🆕 Detected ${totalNew} new items in classroom`;
  const body = `
    <h2 class="title" style="color: #6366f1;">🆕 New Classroom Activity Detected</h2>
    <p class="desc">
      Detected ${totalNew} new assignment(s), announcement(s), or material(s) uploaded by your instructors.
    </p>
    ${groupHtml}
  `;

  const html = wrapHtmlEmail(subject, body);
  await sendGmailNotification(accessToken, toEmail, subject, html);
  
  addNotificationHistoryLog({
    title: `Detected and sent new posts email (Total ${totalNew} items)`,
    type: 'new_posts_digest'
  }, toEmail);
}
