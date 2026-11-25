# User Manual

This guide covers day-to-day usage of CH Classroom Hub.

## 1. Signing In

CH Classroom Hub connects directly to your Google account.

1. Click **Connect Google Classroom** (or **Continue with Google** if an account is saved).
2. Choose your university email or personal Gmail account linked to Google Classroom.
3. Review the requested permissions:
   - Read courses, coursework, submissions, announcements, materials, and topics from Google Classroom
   - Store your personal settings, notes, and schedules in your private Google Drive App Data folder
   - Send reminder emails through Gmail when email alerts are enabled
   - Create, update, and clean up synced events in Google Calendar
4. Check **Remember me** if you want the app to remember your account on that device after closing the tab. On shared computers, leave it unchecked and always use **Disconnect** in Settings when finished so local caches are wiped.

## 2. Dashboard and Courses

- **Home**: Shows your active task summary, today's classes, next upcoming exam, and recent announcements.
- **Dashboard**: Lets you filter tasks by subject or status (`To Do`, `In Progress`, `Completed`, `Read (Material)`), search, switch between List, Grid, and Kanban views, create custom tasks, and write private notes inside any task.
- **Courses**: Displays materials, announcements, and assignments grouped by topic. You can pin important items to the top, hide finished courses using the eye icon or bulk selector, and open hidden courses anytime to restore them.

## 3. Schedule and Google Calendar Sync

- Go to **Schedule** to view your weekly or daily timetable.
- You can add classes manually or import your timetable from KMUTNB Reg (either by pasting from `reg.kmutnb.ac.th` or via the companion browser extension).
- The app warns if two classes overlap and automatically pauses recurring class events in Google Calendar during midterm/final exam weeks.
- Use **Settings > Google Calendar Sync** if you ever need to force a sync or wipe and rebuild Classroom Hub events on your calendar.

## 4. Exam Room

- Open **Exam Seating** from the sidebar.
- If automatic seating lookup is enabled, you can check seats by 13-digit Student ID. Note the yellow warning banner: the university's current exam site uses plain HTTP on the upstream connection, so only use automatic lookup if you accept sending your Student ID over an unencrypted upstream leg.
- You can always import exam dates from KMUTNB Reg or add/edit exams manually. When the university exam site still shows an older semester, the app automatically falls back to your current Reg exam dates while letting you toggle to inspect the SciBase data.

## 5. Academic and GPA

- Open **Academic & GPA** to import your grade report and current timetable from KMUTNB Reg.
- Track term GPA, cumulative GPAX, graduation credit categories, and simulate future grades with the **GPA Simulator** and **Target GPAX Calculator**.
- Use the blur toggle in the header if you want to hide grade numbers on screen.

## 6. Notifications (Gmail, Discord, and 24/7 Script)

Because the app runs in your browser without a backend server, in-app notifications are checked whenever you open or sync the app.

- **Gmail Alerts (Bell icon in the top bar)**:
  - Open the bell icon and switch to **Settings**.
  - Toggle reminders for 3 days before due date, 1 day before, due today, 1 day overdue, new posts digest, and Sunday weekly summary.
  - Gmail sends up to 10 emails per day per account. You can test delivery or send a summary immediately from the same menu.
- **Discord Academic Assistant (Settings page or Bell icon)**:
  - Paste your Discord channel webhook URL into the **Discord Academic Assistant** panel and turn on auto-send.
  - Configure granular alerts across four tabs:
    - **Schedule & Briefing**: Daily **07:00 Morning Briefing** (classes, due tasks, upcoming exams) and optional **Before-class reminders** (15–60 min + final 5 min).
    - **Assignments & Activity**: 7-day, 3-day, 1-day, due-today, and overdue catch-up reminders, deadline-change/removal alerts, plus new assignments, announcements, and learning materials.
    - **Exams & Digests**: Automatic **7d / 3d / 1d / Exam Day** countdowns with merged SciBase/Reg/manual seating, plus optional Daily and Weekly Academic Reports.
    - **Advanced**: Automated delivery authority (`Browser workspace sync` vs `24/7 Google Apps Script only` to prevent duplicate alerts), timezone (`Asia/Bangkok`), minimum priority (`P0–P3`), max retries, and **Quiet Hours**.
  - Use the live preview buttons (**Briefing Preview**, **Assignment Preview**, **Exam Preview**, **Weekly Preview**) and the **Delivery Telemetry** strip in Settings to verify formatting and check the last delivery or error status.
- **24/7 Cloud Script (Settings page)**:
  - For alerts while your browser is closed, copy the generated Google Apps Script from Settings into [script.google.com](https://script.google.com).
  - Under **Services (+)**, enable **Google Classroom API** (required) and **Google Calendar API** (recommended so Morning Briefings and Exam Countdowns stay synchronized automatically whenever your calendar syncs).
  - Under **Project Settings > Script Properties**, add `DISCORD_WEBHOOK_URL` with your Discord webhook URL (keeping secrets out of `Code.gs`), set a Time-driven trigger on `sendClassroomDigest` (every hour or every 15 minutes), and switch **Automated delivery authority** in web Settings to **24/7 Google Apps Script only** so browser sync does not duplicate cloud notifications.

## 7. Cloud Sync Across Devices

Preferences, hidden courses, pinned items, task statuses, personal notes, schedules, academic data, and custom exams sync automatically through your hidden Google Drive `appDataFolder`. Sign in with the same Google account on another browser or device to pull your data.
