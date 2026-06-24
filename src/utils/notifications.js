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
          อีเมลนี้ถูกส่งอัตโนมัติจากเบราว์เซอร์ของคุณผ่านระบบ Classroom Hub Integration<br>
          หากต้องการเปลี่ยนแปลงการตั้งค่า โปรดไปที่หน้าตั้งค่าระบบในเว็บไซต์
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
 * Sends a high-fidelity Test Success Email
 */
export async function triggerTestEmail(accessToken, toEmail) {
  if (!checkDailyLimitAndIncrement(toEmail)) {
    alert('ส่งอีเมลทดสอบล้มเหลว: คุณส่งอีเมลเกินขีดจำกัด 3 ฉบับต่อวันแล้ว');
    return;
  }

  const alertSettings = getAlertSettings(toEmail);
  const time = getSundayDigestTime(toEmail);

  const body = `
    <h2 class="title" style="color: #10b981;">🎉 Gmail Integration Success</h2>
    <p class="desc">
      ระบบเชื่อมต่อการแจ้งเตือนของ Classroom Hub กับบัญชี Gmail ของคุณเสร็จสมบูรณ์แล้ว! ต่อจากนี้คุณจะได้รับอีเมลแจ้งเตือนตามกฎที่คุณตั้งค่าไว้
    </p>
    <div style="border-top: 1px solid #1f2937; padding-top: 15px; margin-top: 15px;">
      <h3 style="font-size: 13px; color: #ffffff; margin-top: 0;">สรุปการเปิดใช้งานกฎแจ้งเตือน:</h3>
      <ul style="font-size: 12px; color: #9ca3af; padding-left: 20px; line-height: 1.8;">
        <li>ก่อนกำหนดส่ง 3 วัน: <strong>${alertSettings.due3Days ? '✓ เปิดใช้งาน' : '✗ ปิดใช้งาน'}</strong></li>
        <li>ก่อนกำหนดส่ง 1 วัน: <strong>${alertSettings.due1Day ? '✓ เปิดใช้งาน' : '✗ ปิดใช้งาน'}</strong></li>
        <li>วันกำหนดส่ง: <strong>${alertSettings.dueToday ? '✓ เปิดใช้งาน' : '✗ ปิดใช้งาน'}</strong></li>
        <li>หลังเลยกำหนด 1 วัน (ครั้งเดียว): <strong>${alertSettings.overdue1Day ? '✓ เปิดใช้งาน' : '✗ ปิดใช้งาน'}</strong></li>
        <li>งานโพสต์ใหม่ (ประกาศ/การบ้าน): <strong>${alertSettings.newPosts ? '✓ เปิดใช้งาน (รวมเล่ม)' : '✗ ปิดใช้งาน'}</strong></li>
        <li>งานไม่มีกำหนดส่ง: <strong>${alertSettings.sundayDigest ? `✓ ทุกวันอาทิตย์ (เวลา ${time} น.)` : '✗ ปิดใช้งาน'}</strong></li>
      </ul>
    </div>
  `;

  const html = wrapHtmlEmail('Classroom Hub: Gmail Integration Success', body);
  
  await sendGmailNotification(accessToken, toEmail, '🎉 Classroom Hub: Gmail Integration Success', html);
  addNotificationHistoryLog({
    title: 'ส่งอีเมลทดสอบการเชื่อมต่อระบบสำเร็จ',
    type: 'test_email'
  }, toEmail);
}

/**
 * Triggers a manual overall task digest immediately
 */
export async function triggerManualDigest(accessToken, toEmail, assignments) {
  if (!checkDailyLimitAndIncrement(toEmail)) {
    alert('ส่งสรุปงานค้างล้มเหลว: คุณส่งอีเมลเกินขีดจำกัด 3 ฉบับต่อวันแล้ว');
    return;
  }

  const todoTasks = assignments.filter(a => a.status !== 'done');
  if (todoTasks.length === 0) {
    alert('คุณไม่มีงานค้างอยู่ในระบบขณะนี้!');
    return;
  }

  // Group tasks by course
  const courseGroups = {};
  todoTasks.forEach(task => {
    if (!courseGroups[task.course]) {
      courseGroups[task.course] = [];
    }
    courseGroups[task.course].push(task);
  });

  let tasksHtml = '';
  Object.keys(courseGroups).forEach(courseName => {
    const list = courseGroups[courseName];
    const borderHex = getHexColor(list[0].courseColor);
    
    tasksHtml += `
      <div style="margin-top: 15px; border-left: 4px solid ${borderHex}; background-color: #1f2937; border-radius: 8px; padding: 12px 15px;">
        <h4 style="color: #ffffff; margin: 0 0 8px 0; font-size: 13px;">📚 ${courseName}</h4>
        <div style="font-size: 12px; color: #d1d5db; line-height: 1.6;">
    `;
    
    list.forEach(t => {
      const dueLabel = t.dueDate ? new Date(t.dueDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) : 'ไม่มีกำหนดส่ง';
      tasksHtml += `
        <div style="padding: 6px 0; border-bottom: 1px solid #374151;">
          <strong>• ${t.title}</strong> <span style="font-size: 10px; color: #9ca3af; margin-left: 8px;">(ส่ง: ${dueLabel})</span>
        </div>
      `;
    });
    
    tasksHtml += `</div></div>`;
  });

  const body = `
    <h2 class="title">สรุปภารกิจและงานค้างทั้งหมด</h2>
    <p class="desc">
      สรุปรายการงานค้างที่ยังไม่เสร็จสิ้นทั้งหมดของคุณในระบบ Classroom Hub ณ ปัจจุบัน
    </p>
    ${tasksHtml}
  `;

  const html = wrapHtmlEmail('สรุปภารกิจการบ้านสะสม', body);
  await sendGmailNotification(accessToken, toEmail, '📝 สรุปรายการงานค้างทั้งหมด - Classroom Hub', html);
  
  addNotificationHistoryLog({
    title: `ส่งสรุปงานค้างสำเร็จ (รวม ${todoTasks.length} รายการ)`,
    type: 'manual_digest'
  }, toEmail);
  
  alert('ส่งอีเมลสรุปงานค้างทั้งหมดเข้า Gmail เรียบร้อยแล้ว!');
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
      subject = `[Classroom Hub] ⚠️ แจ้งเตือน: 3 วันก่อนส่งการบ้าน: ${task.title}`;
      emoji = '⚠️';
      warningLabel = 'มีกำหนดส่งอีก 3 วันข้างหน้า';
    } else if (diffDays === 1 && alertSettings.due1Day) {
      triggerType = 'due_1_day';
      subject = `[Classroom Hub] 🚨 ด่วนที่สุด: พรุ่งนี้ครบกำหนดส่ง: ${task.title}`;
      emoji = '🚨';
      warningLabel = 'ต้องส่งภายในวันพรุ่งนี้';
    } else if (diffDays === 0 && alertSettings.dueToday) {
      triggerType = 'due_today';
      subject = `[Classroom Hub] ⏱️ ครบกำหนดวันนี้: ${task.title}`;
      emoji = '⏱️';
      warningLabel = 'กำหนดส่งวันนี้แล้ว!';
    } else if (diffDays === -1 && alertSettings.overdue1Day) {
      triggerType = 'overdue_1_day';
      subject = `[Classroom Hub] 🔴 งานเลยกำหนดส่ง: ${task.title}`;
      emoji = '🔴';
      warningLabel = 'เลยกำหนดส่งมาแล้ว 1 วัน! รีบดำเนินการด่วน';
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
            <p style="font-size: 12px; color: #d1d5db; line-height: 1.6; margin: 0;">${task.description || 'ไม่มีรายละเอียดเพิ่มเติม'}</p>
          </div>
          ${task.googleLink ? `<a href="${task.googleLink}" target="_blank" class="button">ดูรายละเอียดบน Google Classroom</a>` : ''}
        `;
        const html = wrapHtmlEmail(subject, body);
        await sendGmailNotification(accessToken, toEmail, subject, html);
        
        addNotificationHistoryLog({
          title: `ส่งเมลเตือน '${task.title}' (${warningLabel})`,
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
      
      if (noDueDateTasks.length > 0) {
        if (checkDailyLimitAndIncrement(toEmail)) {
          // Group by course
          const courseGroups = {};
          noDueDateTasks.forEach(task => {
            if (!courseGroups[task.course]) {
              courseGroups[task.course] = [];
            }
            courseGroups[task.course].push(task);
          });

          let itemsHtml = '';
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

          const body = `
            <h2 class="title" style="color: #6366f1;">📅 Sunday Digest: งานสะสมไม่มีกำหนดส่ง</h2>
            <p class="desc">
              สรุปรายการการบ้านและงานที่อาจารย์ไม่ได้ระบุกำหนดส่ง เพื่อป้องกันคุณตกหล่นภารกิจเรียนในรายวิชาต่างๆ
            </p>
            ${itemsHtml}
          `;

          const digestSubject = `[Classroom Hub] 📅 Sunday Digest: สรุปงานไม่มีกำหนดส่งประจำสัปดาห์`;
          const html = wrapHtmlEmail(digestSubject, body);
          await sendGmailNotification(accessToken, toEmail, digestSubject, html);
          
          newSentRecords.push({
            assignmentId: 'sunday_digest_overall',
            type: digestRecordType,
            sentAt: now.toISOString()
          });
          
          addNotificationHistoryLog({
            title: `ส่งเมลสรุป Sunday Digest (รวม ${noDueDateTasks.length} รายการ)`,
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
      groupHtml += `<p style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #a855f7; margin: 8px 0 4px 0;">📝 งานใหม่ (${group.assigns.length})</p>`;
      group.assigns.forEach(t => {
        groupHtml += `<div style="font-size: 12px; color: #ffffff; padding: 4px 0; border-bottom: 1px solid #374151;">• <strong>${t.title}</strong></div>`;
      });
    }
    
    if (group.resources.length > 0) {
      const anns = group.resources.filter(r => r.type === 'announcement');
      const mats = group.resources.filter(r => r.type === 'material');
      
      if (anns.length > 0) {
        groupHtml += `<p style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #f59e0b; margin: 10px 0 4px 0;">📢 ประกาศใหม่ (${anns.length})</p>`;
        anns.forEach(r => {
          groupHtml += `<div style="font-size: 12px; color: #ffffff; padding: 4px 0; border-bottom: 1px solid #374151;">• <strong>${r.title}</strong></div>`;
        });
      }
      
      if (mats.length > 0) {
        groupHtml += `<p style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #3b82f6; margin: 10px 0 4px 0;">📖 เอกสารเรียนใหม่ (${mats.length})</p>`;
        mats.forEach(r => {
          groupHtml += `<div style="font-size: 12px; color: #ffffff; padding: 4px 0; border-bottom: 1px solid #374151;">• <strong>${r.title}</strong></div>`;
        });
      }
    }
    
    groupHtml += `</div>`;
  });

  const subject = `[Classroom Hub] 🆕 พบ ${totalNew} รายการใหม่ในห้องเรียน`;
  const body = `
    <h2 class="title" style="color: #6366f1;">🆕 ตรวจพบความเคลื่อนไหวในห้องเรียน</h2>
    <p class="desc">
      พบงาน ประกาศ หรือเอกสารประกอบการเรียนที่อาจารย์อัปโหลดลงบน Classroom ใหม่จำนวน ${totalNew} รายการ
    </p>
    ${groupHtml}
  `;

  const html = wrapHtmlEmail(subject, body);
  await sendGmailNotification(accessToken, toEmail, subject, html);
  
  addNotificationHistoryLog({
    title: `ตรวจพบและส่งเมลโพสต์ใหม่ (รวม ${totalNew} รายการ)`,
    type: 'new_posts_digest'
  }, toEmail);
}
