export function getAppsScriptTemplate(hiddenCourseIds = []) {
  const hiddenArrayStr = JSON.stringify(hiddenCourseIds);
  return `/**
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

function sendClassroomDigest() {
  try {
    var email = Session.getActiveUser().getEmail();
    if (!email) {
      Logger.log("Could not retrieve active user email.");
      return;
    }

    var hiddenCourseIds = ${hiddenArrayStr};
    var props = PropertiesService.getScriptProperties();
    var sentTodayKey = 'ch_sent_' + Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd');
    var sentIds = [];
    try {
      sentIds = JSON.parse(props.getProperty(sentTodayKey) || '[]');
    } catch (e) {
      sentIds = [];
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

    if (courses.length === 0) {
      Logger.log("No active courses found.");
      return;
    }

    var pendingAssignments = [];
    var now = new Date();

    for (var i = 0; i < courses.length; i++) {
      var course = courses[i];
      
      // Skip if course is hidden in settings
      if (hiddenCourseIds.indexOf(course.id) !== -1) {
        Logger.log("Skipping hidden course: " + course.name + " (" + course.id + ")");
        continue;
      }

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
        continue;
      }

      for (var j = 0; j < courseWorks.length; j++) {
        var work = courseWorks[j];
        
        if (!work.dueDate || sentIds.indexOf(work.id) !== -1) continue;

        var dueYear = work.dueDate.year;
        var dueMonth = work.dueDate.month - 1; // 0-indexed
        var dueDay = work.dueDate.day;
        var dueDate;
        if (work.dueTime) {
          // Classroom dueTime is always UTC
          dueDate = new Date(Date.UTC(dueYear, dueMonth, dueDay, work.dueTime.hours || 0, work.dueTime.minutes || 0, work.dueTime.seconds || 0));
        } else {
          // Date-only due date: end of Bangkok day (23:59:59+07:00 = 16:59:59Z)
          dueDate = new Date(Date.UTC(dueYear, dueMonth, dueDay, 16, 59, 59));
        }
        
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
              id: work.id,
              title: work.title,
              courseName: course.name,
              dueDate: Utilities.formatDate(dueDate, "Asia/Bangkok", "dd MMM HH:mm"),
              daysLeft: diffDays,
              points: typeof work.maxPoints === 'number' ? String(work.maxPoints) + ' คะแนน' : 'ไม่ระบุคะแนน',
              link: sanitizeSafeUrl(work.alternateLink)
            });
          }
        }
      }
    }

    if (pendingAssignments.length === 0) {
      Logger.log("No new pending assignments due within 3 days.");
      return;
    }

    // Format HTML Email body (VS Code Dark+ palette)
    var htmlBody = '<html><head><meta charset="utf-8"></head><body style="background-color: #1E1E1E; color: #D4D4D4; font-family: -apple-system, BlinkMacSystemFont, Arial, sans-serif; margin: 0; padding: 20px;">' +
      '<div style="max-width: 600px; margin: 0 auto; background-color: #252526; border: 1px solid #3C3C3C; border-radius: 12px; padding: 28px;">' +
      '<div style="text-align: center; border-bottom: 1px solid #3C3C3C; padding-bottom: 18px; margin-bottom: 20px;">' +
      '<div style="font-size: 14px; font-weight: bold; color: #3794FF; text-transform: uppercase; letter-spacing: 2px;">Classroom Hub</div>' +
      '<div style="font-size: 19px; font-weight: bold; color: #FFFFFF; margin-top: 8px;">สรุปงานค้างส่งใกล้วันกำหนดส่ง (เหลือเวลาไม่ถึง 3 วัน)</div>' +
      '</div><div>';

    for (var k = 0; k < pendingAssignments.length; k++) {
      var item = pendingAssignments[k];
      htmlBody += '<div style="background-color: #1E1E1E; border: 1px solid #3C3C3C; border-radius: 8px; padding: 15px; margin-bottom: 14px;">' +
        '<div style="display: inline-block; background-color: #094771; color: #3794FF; font-size: 11px; font-weight: bold; padding: 3px 8px; border-radius: 6px; margin-bottom: 8px;">' + escapeHtmlScript(item.courseName) + '</div>' +
        '<div style="font-size: 14px; font-weight: bold; color: #FFFFFF; margin-bottom: 8px;">' + escapeHtmlScript(item.title) + '</div>' +
        '<div style="font-size: 12px; color: #9D9D9D; margin-bottom: 12px;">' +
        'กำหนดส่ง: <strong style="color: #CCA700;">' + escapeHtmlScript(item.dueDate) + '</strong> (' + escapeHtmlScript(item.daysLeft) + ' วันที่เหลือ) &nbsp;|&nbsp; ' + escapeHtmlScript(item.points) +
        '</div>' +
        (item.link ? '<a href="' + escapeHtmlScript(item.link) + '" target="_blank" rel="noopener noreferrer" style="display: inline-block; background-color: #007ACC; color: #FFFFFF !important; text-decoration: none; padding: 6px 14px; border-radius: 6px; font-size: 12px; font-weight: bold;">เปิดทำการบ้านใน Classroom</a>' : '') +
        '</div>';
    }

    htmlBody += '</div>' +
      '<div style="text-align: center; font-size: 11px; color: #858585; margin-top: 26px; border-top: 1px solid #3C3C3C; padding-top: 15px;">' +
      'ส่งโดยระบบออโต้คลาวด์ Classroom Hub (Personal Apps Script)<br>' +
      'คุณได้รับอีเมลนี้เนื่องจากตั้งค่าแจ้งเตือนงานค้างส่งล่วงหน้าไว้' +
      '</div></div></body></html>';

    MailApp.sendEmail({
      to: email,
      subject: "สรุปงานค้างส่ง (เหลือเวลาไม่ถึง 3 วัน) - Classroom Hub",
      htmlBody: htmlBody
    });

    for (var m = 0; m < pendingAssignments.length; m++) {
      sentIds.push(pendingAssignments[m].id);
    }
    props.setProperty(sentTodayKey, JSON.stringify(sentIds.slice(-200)));
    Logger.log("Notification email sent successfully to: " + email);

  } catch (error) {
    Logger.log("Error running script: " + error.toString());
  }
}
`;
}
