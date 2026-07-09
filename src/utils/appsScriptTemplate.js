export const APPS_SCRIPT_TEMPLATE = `/**
 * Classroom Hub: Personal Auto Notification Script
 * 
 * Instructions:
 * 1. Open Google Apps Script: https://script.google.com
 * 2. Click "New Project"
 * 3. Replace the Code.gs content with this entire script
 * 4. Click "+" next to Services in the left sidebar, find "Classroom API", and click Add.
 * 5. Save the project and click "Run" (Authorize the permissions)
 * 6. Click the Triggers (alarm clock icon) in the left sidebar, add a trigger:
 *    - Function to run: sendClassroomDigest
 *    - Event source: Time-driven
 *    - Type of time based trigger: Hour timer (or Day timer)
 *    - Select hour interval: Every hour (or select preferred time)
 */

function sendClassroomDigest() {
  try {
    var email = Session.getActiveUser().getEmail();
    if (!email) {
      Logger.log("Could not retrieve active user email.");
      return;
    }

    var response = Classroom.Courses.list({courseStates: ["ACTIVE"]});
    var courses = response.courses || [];
    if (courses.length === 0) {
      Logger.log("No active courses found.");
      return;
    }

    var pendingAssignments = [];
    var now = new Date();

    for (var i = 0; i < courses.length; i++) {
      var course = courses[i];
      var courseWorkResponse;
      try {
        courseWorkResponse = Classroom.Courses.CourseWork.list(course.id);
      } catch (err) {
        // Skip courses where coursework cannot be retrieved (e.g. permission issues)
        continue;
      }
      
      var courseWorks = courseWorkResponse.courseWork || [];

      for (var j = 0; j < courseWorks.length; j++) {
        var work = courseWorks[j];
        
        if (!work.dueDate) continue;

        var dueYear = work.dueDate.year;
        var dueMonth = work.dueDate.month - 1; // 0-indexed
        var dueDay = work.dueDate.day;
        var dueHour = work.dueTime ? work.dueTime.hours : 23;
        var dueMin = work.dueTime ? work.dueTime.minutes : 59;
        
        var dueDate = new Date(dueYear, dueMonth, dueDay, dueHour, dueMin);
        
        // Skip if already past due
        if (dueDate < now) continue;

        var diffTime = dueDate.getTime() - now.getTime();
        var diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays <= 3) {
          var submissionsResponse = Classroom.Courses.CourseWork.StudentSubmissions.list(course.id, work.id, {userId: "me"});
          var submissions = submissionsResponse.studentSubmissions || [];
          var isDone = false;
          
          if (submissions.length > 0) {
            var state = submissions[0].state;
            if (state === "TURNED_IN" || state === "RETURNED") {
              isDone = true;
            }
          }

          if (!isDone) {
            pendingAssignments.push({
              title: work.title,
              courseName: course.name,
              dueDate: dueDate.toLocaleString("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
              daysLeft: diffDays,
              points: work.maxPoints || 100,
              link: work.alternateLink
            });
          }
        }
      }
    }

    if (pendingAssignments.length === 0) {
      Logger.log("No pending assignments due within 3 days.");
      return;
    }

    // Format HTML Email body
    var htmlBody = '<html><head><meta charset="utf-8"></head><body style="background-color: #0b0f19; color: #e2e8f0; font-family: -apple-system, BlinkMacSystemFont, Arial, sans-serif; margin: 0; padding: 20px;">' +
      '<div style="max-width: 600px; margin: 0 auto; background-color: #111827; border: 1px solid #1f2937; border-radius: 16px; padding: 30px; box-shadow: 0 4px 20px rgba(0,0,0,0.3);">' +
      '<div style="text-align: center; border-bottom: 1px solid #1f2937; padding-bottom: 20px; margin-bottom: 20px;">' +
      '<div style="font-size: 16px; font-weight: bold; color: #6366f1; text-transform: uppercase; letter-spacing: 2px;">Classroom Hub</div>' +
      '<div style="font-size: 20px; font-weight: bold; color: #ffffff; margin-top: 10px;">🚨 สรุปงานค้างส่งใกล้วันกำหนดส่ง (เหลือเวลาไม่ถึง 3 วัน)</div>' +
      '</div><div>';

    for (var k = 0; k < pendingAssignments.length; k++) {
      var item = pendingAssignments[k];
      htmlBody += '<div style="background-color: rgba(31, 41, 55, 0.4); border: 1px solid #374151; border-radius: 12px; padding: 15px; margin-bottom: 15px;">' +
        '<div style="display: inline-block; background-color: rgba(99, 102, 241, 0.1); color: #818cf8; font-size: 10px; font-weight: bold; padding: 3px 8px; border-radius: 99px; margin-bottom: 8px;">' + item.courseName + '</div>' +
        '<div style="font-size: 14px; font-weight: bold; color: #ffffff; margin-bottom: 10px;">' + item.title + '</div>' +
        '<div style="font-size: 11px; color: #9ca3af; margin-bottom: 15px;">' +
        '📅 กำหนดส่ง: <strong style="color: #fb923c;">' + item.dueDate + '</strong> (' + item.daysLeft + ' วันที่เหลือ) &nbsp;|&nbsp; 💯 ' + item.points + ' คะแนน' +
        '</div>' +
        '<a href="' + item.link + '" target="_blank" style="display: inline-block; background-color: #4f46e5; color: #ffffff !important; text-decoration: none; padding: 6px 14px; border-radius: 8px; font-size: 11px; font-weight: bold;">เปิดทำการบ้านใน Classroom</a>' +
        '</div>';
    }

    htmlBody += '</div>' +
      '<div style="text-align: center; font-size: 11px; color: #6b7280; margin-top: 30px; border-top: 1px solid #1f2937; padding-top: 15px;">' +
      'ส่งโดยระบบออโต้คลาวด์ Classroom Hub (Personal Apps Script)<br>' +
      'คุณได้รับอีเมลนี้เนื่องจากตั้งค่าแจ้งเตือนงานค้างส่งล่วงหน้าไว้' +
      '</div></div></body></html>';

    MailApp.sendEmail({
      to: email,
      subject: "🚨 สรุปงานค้างส่ง (เหลือเวลาไม่ถึง 3 วัน) - Classroom Hub",
      htmlBody: htmlBody
    });
    Logger.log("Notification email sent successfully to: " + email);

  } catch (error) {
    Logger.log("Error running script: " + error.toString());
  }
}
`;
