import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotificationService } from '../../src/services/NotificationService';
import { DiscordService } from '../../src/services/DiscordService';
import { GoogleRepository } from '../../src/repositories/GoogleRepository';
import { examRepository } from '../../src/repositories/examRepository';
import { syncManager } from '../../src/services/SyncManager';
import { getAppsScriptTemplate } from '../../src/utils/appsScriptTemplate';
import {
  setActiveEmail,
  saveToken,
  saveProfile,
  setEnableEmailAlerts,
  getAlertSettings,
  saveAlertSettings,
  setSundayDigestTime,
  saveHiddenCourses,
  saveSchedule,
  saveAssignments,
  getNotificationHistory
} from '../../src/utils/storage';
import {
  LEDGER_STATUS,
  NotificationLedger
} from '../../src/services/notifications/NotificationLedger';
import { AuthProvider } from '../../src/contexts/AuthContext';
import { SettingsProvider } from '../../src/contexts/SettingsContext';
import { ClassroomContext } from '../../src/contexts/ClassroomContext';
import Settings from '../../src/pages/Settings';

const VALID_WEBHOOK =
  'https://discord.com/api/webhooks/987654321098765432/ZyXwVuTsRqPoNmLkJiHgFeDcBa_0987654321';

describe('Classroom Hub — Personal Academic Assistant Notification Overhaul (28 QA Scenarios)', () => {
  const email = 's6704062611115@email.kmutnb.ac.th';

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
    setEnableEmailAlerts(false, email);
    saveAlertSettings(
      {
        discordEnabled: true,
        discordWebhookUrl: VALID_WEBHOOK
      },
      email
    );
  });

  // ── 1, 2, 3, 4: Morning Briefing (Classes, No-Class Days, Cancelled Classes, Midterm Pause) ──
  describe('Morning Briefing & Class Schedule Handling', () => {
    it('generates consolidated 07:00 Morning Briefing, excludes cancelled classes, and respects exam overrides', async () => {
      const webhookSpy = vi.spyOn(DiscordService, 'sendWebhook').mockResolvedValue({ ok: true, status: 204 });

      // Wednesday 2026-11-25 07:05 Asia/Bangkok
      const morningNow = new Date('2026-11-25T07:05:00+07:00');
      const schedule = [
        { id: 'c-active', title: 'Operating Systems', courseCode: '040613205', day: 'wed', startTime: '09:00', endTime: '12:00', room: '78-618' },
        { id: 'c-cancelled', title: 'Cancelled Lab', courseCode: '040613299', day: 'wed', startTime: '13:00', endTime: '16:00', room: '78-601', deletedAt: '2026-11-20' }
      ];
      const assignments = [
        { id: 'a-today', title: 'Kernel Lab', course: 'Operating Systems', courseCode: '040613205', status: 'todo', dueDate: '2026-11-25T23:59:00+07:00', googleLink: 'https://classroom.google.com/c/1/a/1' },
        { id: 'a-upcoming', title: 'Memory Essay', course: 'Operating Systems', courseCode: '040613205', status: 'todo', dueDate: '2026-11-29' }
      ];
      const resources = [
        { id: 'ann-fresh', type: 'announcement', course: 'Operating Systems', title: 'Bring laptop to lab', creationTime: '2026-11-25T06:00:00+07:00', googleLink: 'https://classroom.google.com/c/1' }
      ];
      examRepository.saveToCache(
        email,
        [{ id: 'ex-1', courseCode: '040613205', courseName: 'Operating Systems', date: '2026-12-02', rawIsoDate: '2026-12-02', time: '09:00-12:00', room: '78-301', seat: 'A12' }],
        [],
        null
      );

      saveSchedule(schedule, email);
      await NotificationService.evaluateScheduleTick(email, {
        now: morningNow,
        schedule,
        assignments,
        resources
      });

      expect(webhookSpy).toHaveBeenCalledTimes(1);
      const sentPayload = webhookSpy.mock.calls[0][1];
      const embed = sentPayload.embeds[0];
      expect(embed.title).toContain('Morning Briefing');
      expect(embed.description).toContain('**1** class today');
      expect(embed.description).toContain('**2** pending tasks');
      expect(embed.description).toContain('**1** upcoming exam');

      const allText = JSON.stringify(embed);
      expect(allText).toContain('Operating Systems');
      expect(allText).toContain('78-618');
      expect(allText).not.toContain('Cancelled Lab');
      expect(allText).toContain('Kernel Lab');
      expect(allText).toContain('Bring laptop to lab');

      // Second tick on same morning must be deduplicated
      await NotificationService.evaluateScheduleTick(email, {
        now: new Date('2026-11-25T08:15:00+07:00'),
        schedule,
        assignments,
        resources
      });
      expect(webhookSpy).toHaveBeenCalledTimes(1);
    });

    it('handles no-class days gracefully and skips empty free-day briefings when disabled', async () => {
      const webhookSpy = vi.spyOn(DiscordService, 'sendWebhook').mockResolvedValue({ ok: true, status: 204 });
      const sundayMorning = new Date('2026-11-29T07:30:00+07:00');

      // When morningBriefingSendOnFreeDays is false and no classes exist -> skipped
      saveAlertSettings(
        {
          discordEnabled: true,
          discordWebhookUrl: VALID_WEBHOOK,
          morningBriefingEnabled: true,
          morningBriefingSendOnFreeDays: false
        },
        email
      );
      await NotificationService.evaluateScheduleTick(email, {
        now: sundayMorning,
        schedule: [],
        assignments: [{ id: 't1', title: 'HW', course: 'Math', status: 'todo', dueDate: '2026-12-03' }],
        resources: []
      });
      expect(webhookSpy).not.toHaveBeenCalled();

      // When morningBriefingSendOnFreeDays is true -> sends calm free-day schedule note without empty sections
      saveAlertSettings(
        {
          discordEnabled: true,
          discordWebhookUrl: VALID_WEBHOOK,
          morningBriefingEnabled: true,
          morningBriefingSendOnFreeDays: true
        },
        email
      );
      await NotificationService.evaluateScheduleTick(email, {
        now: sundayMorning,
        schedule: [],
        assignments: [{ id: 't1', title: 'HW', course: 'Math', status: 'todo', dueDate: '2026-12-03' }],
        resources: []
      });
      expect(webhookSpy).toHaveBeenCalledTimes(1);
      const fields = webhookSpy.mock.calls[0][1].embeds[0].fields;
      expect(fields.find((f) => f.name === "Today's Schedule").value).toContain('No scheduled classes today');
      expect(fields.some((f) => f.name.startsWith('Due Today'))).toBe(false);
    });

    it('pauses recurring KMUTNB Reg classes during Midterm exam week in Morning Briefing', async () => {
      const webhookSpy = vi.spyOn(DiscordService, 'sendWebhook').mockResolvedValue({ ok: true, status: 204 });

      // Midterm exam on Thu 2026-12-10 pauses the Mon-Sun week (2026-12-07..2026-12-13) for Reg classes
      const schedule = [
        { id: 'reg-algo', source: 'kmutnb-reg', title: 'Algorithms', courseCode: '040613203', day: 'tue', startTime: '09:00', endTime: '12:00', room: '78-621' }
      ];
      const midtermExams = [
        { id: 'reg-exam-040613203-midterm', source: 'kmutnb-reg', isManual: true, examType: 'midterm', courseCode: '040613203', courseName: 'Algorithms', date: '2026-12-10', rawIsoDate: '2026-12-10', time: '09:00-12:00' }
      ];

      await NotificationService.evaluateScheduleTick(email, {
        now: new Date('2026-12-08T07:10:00+07:00'), // Tuesday during Midterm week
        schedule,
        assignments: [],
        resources: [],
        exams: [],
        manualExams: midtermExams
      });

      expect(webhookSpy).toHaveBeenCalledTimes(1);
      const embed = webhookSpy.mock.calls[0][1].embeds[0];
      expect(embed.description).toContain('**0** classes today');
      expect(JSON.stringify(embed.fields)).toContain('paused for Midterm examination week');
    });
  });

  // ── 5, 6, 7, 8, 9, 10, 11, 12: Assignment Reminders & Full Lifecycle ──
  describe('Assignment Reminders (7d/3d/1d/Today/Overdue) & Lifecycle Alerts', () => {
    it('fires 7d, 3d, 1d, due-today, and multi-day missed overdue reminders while excluding hidden, done, and read tasks', async () => {
      const webhookSpy = vi.spyOn(DiscordService, 'sendWebhook').mockResolvedValue({ ok: true, status: 204 });
      saveHiddenCourses(['course-hidden'], email);

      const refNow = new Date('2026-11-25T10:00:00+07:00');
      const assignments = [
        { id: 'a-7d', title: '7D Project', course: 'SE', courseCode: 'CS401', courseId: 'c1', status: 'todo', points: 100, dueDate: '2026-12-02', googleLink: 'https://classroom.google.com/c/1/a/7' },
        { id: 'a-3d', title: '3D Quiz', course: 'SE', courseCode: 'CS401', courseId: 'c1', status: 'todo', points: 20, dueDate: '2026-11-28' },
        { id: 'a-1d', title: '1D Lab', course: 'SE', courseCode: 'CS401', courseId: 'c1', status: 'todo', points: 10, dueDate: '2026-11-26' },
        { id: 'a-0d', title: 'Today Essay', course: 'SE', courseCode: 'CS401', courseId: 'c1', status: 'todo', points: 50, dueDate: '2026-11-25T23:00:00+07:00' },
        // User missed opening app for 4 days -> overdue recovery must still catch this once!
        { id: 'a-over4', title: 'Missed 4 Days Ago', course: 'SE', courseCode: 'CS401', courseId: 'c1', status: 'todo', dueDate: '2026-11-21' },
        // Excluded items:
        { id: 'a-done', title: 'Submitted HW', course: 'SE', courseId: 'c1', status: 'done', dueDate: '2026-11-25' },
        { id: 'a-read', title: 'Read Lecture', course: 'SE', courseId: 'c1', status: 'read', dueDate: '2026-11-25' },
        { id: 'a-turned-in', title: 'Classroom Turned In', course: 'SE', courseId: 'c1', status: 'todo', submissionState: 'TURNED_IN', dueDate: '2026-11-25' },
        { id: 'a-hidden', title: 'Hidden HW', course: 'Hidden', courseId: 'course-hidden', status: 'todo', dueDate: '2026-11-25' },
        { id: 'a-nodue', title: 'Open Ended Reading', course: 'SE', courseId: 'c1', status: 'todo', dueDate: '' }
      ];

      await NotificationService.evaluateNotifications('tok', email, assignments, [], [], { now: refNow });
      expect(webhookSpy).toHaveBeenCalledTimes(5);

      const titles = webhookSpy.mock.calls.map((c) => c[1].embeds[0].title);
      expect(titles.some((t) => t.includes('7D Project'))).toBe(true);
      expect(titles.some((t) => t.includes('3D Quiz'))).toBe(true);
      expect(titles.some((t) => t.includes('1D Lab'))).toBe(true);
      expect(titles.some((t) => t.includes('Today Essay'))).toBe(true);
      expect(titles.some((t) => t.includes('Missed 4 Days Ago') && t.includes('Overdue by 4 days'))).toBe(true);

      // Verify submission status & score fields appear
      const dueTodayEmbed = webhookSpy.mock.calls.find((c) => c[1].embeds[0].title.includes('Today Essay'))[1].embeds[0];
      expect(JSON.stringify(dueTodayEmbed.fields)).toContain('Not Submitted • 50 pts');

      // Re-running on next day (-5 days overdue) must NOT resend the overdue reminder for the same deadline
      await NotificationService.evaluateNotifications('tok', email, assignments, [], [], {
        now: new Date('2026-11-26T10:00:00+07:00')
      });
      const secondRunTitles = webhookSpy.mock.calls.slice(5).map((c) => c[1].embeds[0].title);
      expect(secondRunTitles.some((t) => t.includes('Missed 4 Days Ago'))).toBe(false);
    });

    it('detects deadline extensions, re-arms reminders for the new deadline, stops on submission, and alerts on authoritative deletion', async () => {
      const webhookSpy = vi.spyOn(DiscordService, 'sendWebhook').mockResolvedValue({ ok: true, status: 204 });

      // Step 1: Initial sync on Nov 25 with task due Nov 28 (3d away) -> sends 3d reminder & seeds snapshot
      const t1 = new Date('2026-11-25T09:00:00+07:00');
      await NotificationService.evaluateNotifications(
        'tok',
        email,
        [
          { id: 'hw-ext', courseId: 'c1', course: 'DB', title: 'SQL Project', status: 'todo', dueDate: '2026-11-28' },
          { id: 'hw-del', courseId: 'c1', course: 'DB', title: 'Cancelled Worksheet', status: 'todo', dueDate: '2026-12-10' }
        ],
        [],
        [],
        { now: t1, authoritativeSync: true }
      );
      expect(webhookSpy).toHaveBeenCalledTimes(1); // Only hw-ext 3d reminder (no false initial-sync change alerts)

      // Step 2: Instructor extends SQL Project to Dec 05 AND deletes Cancelled Worksheet
      const t2 = new Date('2026-11-25T14:00:00+07:00');
      await NotificationService.evaluateNotifications(
        'tok',
        email,
        [{ id: 'hw-ext', courseId: 'c1', course: 'DB', title: 'SQL Project', status: 'todo', dueDate: '2026-12-05' }],
        [],
        [],
        { now: t2, authoritativeSync: true }
      );
      expect(webhookSpy).toHaveBeenCalledTimes(3);
      const step2Titles = webhookSpy.mock.calls.slice(1).map((c) => c[1].embeds[0].title);
      expect(step2Titles.some((t) => t.includes('[Deadline Updated]') && t.includes('SQL Project'))).toBe(true);
      expect(step2Titles.some((t) => t.includes('[Assignment Removed]') && t.includes('Cancelled Worksheet'))).toBe(true);

      // Step 3: Fast-forward to Dec 02 (3 days before the NEW Dec 05 deadline) -> 3d reminder re-arms cleanly!
      await NotificationService.evaluateNotifications(
        'tok',
        email,
        [{ id: 'hw-ext', courseId: 'c1', course: 'DB', title: 'SQL Project', status: 'todo', dueDate: '2026-12-05' }],
        [],
        [],
        { now: new Date('2026-12-02T09:00:00+07:00'), authoritativeSync: true }
      );
      expect(webhookSpy).toHaveBeenCalledTimes(4);
      expect(webhookSpy.mock.calls[3][1].embeds[0].title).toContain('Due in 3 days');

      // Step 4: Student submits SQL Project before Dec 04 -> 1-day reminder on Dec 04 is suppressed!
      await NotificationService.evaluateNotifications(
        'tok',
        email,
        [{ id: 'hw-ext', courseId: 'c1', course: 'DB', title: 'SQL Project', status: 'done', dueDate: '2026-12-05' }],
        [],
        [],
        { now: new Date('2026-12-04T09:00:00+07:00'), authoritativeSync: true }
      );
      expect(webhookSpy).toHaveBeenCalledTimes(4);
    });

    it('never falsely flags assignments as deleted when their Classroom course feed temporarily failed', async () => {
      const webhookSpy = vi.spyOn(DiscordService, 'sendWebhook').mockResolvedValue({ ok: true, status: 204 });

      await NotificationService.evaluateNotifications(
        'tok',
        email,
        [{ id: 'hw-net', courseId: 'c-flaky', course: 'Networks', title: 'Packet Lab', status: 'todo', dueDate: '2026-12-15' }],
        [],
        [],
        { now: new Date('2026-11-25T10:00:00+07:00'), authoritativeSync: true }
      );
      expect(webhookSpy).toHaveBeenCalledTimes(0);

      // Course c-flaky failed on next sync
      await NotificationService.evaluateNotifications('tok', email, [], [], [], {
        now: new Date('2026-11-25T11:00:00+07:00'),
        authoritativeSync: true,
        failedCourseIds: ['c-flaky']
      });
      expect(webhookSpy).toHaveBeenCalledTimes(0);
    });
  });

  // ── 13, 14, 15, 16, 17: Exam Countdown, Merged Sources, Reschedule & Cancellation ──
  describe('Examination Countdown & Merged Official/Reg/Manual Records', () => {
    it('deduplicates merged SciBase + KMUTNB Reg exams, handles missing room/seat gracefully, ignores past exams, and fires 7d/3d/1d/0d stages', async () => {
      const webhookSpy = vi.spyOn(DiscordService, 'sendWebhook').mockResolvedValue({ ok: true, status: 204 });
      const now = new Date('2026-11-25T08:00:00+07:00');

      // SciBase official Midterm for 40613203 on Nov 28 (3d) + Reg duplicate for 040613203 on Nov 28 + Manual quiz today (missing room/seat) + Past exam
      const sciExams = [
        { id: 'sci-1', courseCode: '40613203', courseName: 'Algorithms', examType: 'midterm', date: '28 พ.ย. 2569', rawIsoDate: '2026-11-28', time: '09:00-12:00', room: '78-621', seat: 'Row B, Seat 09' },
        { id: 'sci-past', courseCode: '40613100', courseName: 'Old Exam', date: '2026-11-10', rawIsoDate: '2026-11-10', time: '09:00-12:00', room: '78-301', seat: 'A1' }
      ];
      const manualExams = [
        { id: 'reg-exam-040613203-midterm', source: 'kmutnb-reg', isManual: true, examType: 'midterm', courseCode: '040613203', courseName: 'Algorithms (Midterm)', date: '2026-11-28', rawIsoDate: '2026-11-28', time: '09:00-12:00', room: '', seat: '' },
        { id: 'man-today', isManual: true, courseCode: 'GEN101', courseName: 'English Oral', date: '2026-11-25', rawIsoDate: '2026-11-25', time: '13:00-15:00', room: '', seat: '' },
        { id: 'man-7d', isManual: true, courseCode: 'MTH201', courseName: 'Linear Algebra', date: '2026-12-02', rawIsoDate: '2026-12-02', time: '09:00-12:00', room: '81-402', seat: 'C4' },
        { id: 'man-1d', isManual: true, courseCode: 'PHY101', courseName: 'Physics Lab Exam', date: '2026-11-26', rawIsoDate: '2026-11-26', time: '13:00-16:00', room: '88-201', seat: '15' }
      ];

      examRepository.saveToCache(email, sciExams, manualExams, null);

      // Verify DiscordService.buildExamsEmbed & NotificationService.buildExamsHtml also deduplicate merged exams!
      const digestEmbed = DiscordService.buildExamsEmbed(email, false);
      expect(digestEmbed.fields.filter((f) => f.name.includes('Algorithms'))).toHaveLength(1);
      const emailHtml = NotificationService.buildExamsHtml(email, false);
      expect((emailHtml.match(/Algorithms/g) || []).length).toBeGreaterThanOrEqual(1);

      await NotificationService.evaluateNotifications('tok', email, [], [], [], {
        now,
        exams: sciExams,
        manualExams,
        explicitExamSync: true
      });

      // Exactly 4 embeds: 3d (Algorithms once!), 0d (English Oral), 7d (Linear Algebra), 1d (Physics). Past exam skipped!
      expect(webhookSpy).toHaveBeenCalledTimes(4);
      const titles = webhookSpy.mock.calls.map((c) => c[1].embeds[0].title);
      expect(titles.filter((t) => t.includes('Algorithms'))).toHaveLength(1);

      const examTodayEmbed = webhookSpy.mock.calls.find((c) => c[1].embeds[0].title.includes('EXAM TODAY'))[1].embeds[0];
      const todayFieldsStr = JSON.stringify(examTodayEmbed.fields);
      expect(todayFieldsStr).toContain('TBA');
      expect(todayFieldsStr).toContain('Not assigned yet');
      expect(todayFieldsStr).toContain('Before You Leave');
    });

    it('detects exam rescheduling and cancellations while ignoring transient SciBase cache expiry', async () => {
      const webhookSpy = vi.spyOn(DiscordService, 'sendWebhook').mockResolvedValue({ ok: true, status: 204 });
      const t1 = new Date('2026-11-25T09:00:00+07:00');

      const initialSci = [
        { id: 'sci-iot', courseCode: '40613301', courseName: 'IoT Systems', examType: 'final', date: '2026-12-12', rawIsoDate: '2026-12-12', time: '09:00-12:00', room: '78-618', seat: 'A5' }
      ];
      const initialMan = [
        { id: 'man-cancel', isManual: true, courseCode: 'ELC102', courseName: 'Pop Quiz', date: '2026-12-10', rawIsoDate: '2026-12-10', time: '10:00-11:00', room: '75-201', seat: '' }
      ];

      // Seed snapshot
      await NotificationService.evaluateNotifications('tok', email, [], [], [], {
        now: t1,
        exams: initialSci,
        manualExams: initialMan,
        explicitExamSync: true
      });
      expect(webhookSpy).toHaveBeenCalledTimes(0);

      // Transient SciBase TTL flush (exams: [], explicitExamSync: false) must NOT trigger false cancellation!
      await NotificationService.evaluateNotifications('tok', email, [], [], [], {
        now: new Date('2026-11-25T09:20:00+07:00'),
        exams: [],
        manualExams: initialMan,
        explicitExamSync: false
      });
      expect(webhookSpy).toHaveBeenCalledTimes(0);

      // Real reschedule of IoT Systems (moved to Dec 14, Room 78-701) + cancellation of manual Pop Quiz
      const updatedSci = [
        { id: 'sci-iot', courseCode: '40613301', courseName: 'IoT Systems', examType: 'final', date: '2026-12-14', rawIsoDate: '2026-12-14', time: '13:00-16:00', room: '78-701', seat: 'B2' }
      ];
      await NotificationService.evaluateNotifications('tok', email, [], [], [], {
        now: new Date('2026-11-25T10:00:00+07:00'),
        exams: updatedSci,
        manualExams: [],
        explicitExamSync: true
      });

      expect(webhookSpy).toHaveBeenCalledTimes(2);
      const changeTitles = webhookSpy.mock.calls.map((c) => c[1].embeds[0].title);
      expect(changeTitles.some((t) => t.includes('[Exam Updated]') && t.includes('IoT Systems'))).toBe(true);
      expect(changeTitles.some((t) => t.includes('[Exam Removed]') && t.includes('Pop Quiz'))).toBe(true);
    });
  });

  // ── 18, 19, 20: Classroom Activity (Announcements, Materials, Initial Sync Safety) ──
  describe('Classroom Activity Grouping & Granular Filters', () => {
    it('groups new announcements and learning materials with direct links, respects granular toggles, and ignores old edited posts', async () => {
      const webhookSpy = vi.spyOn(DiscordService, 'sendWebhook').mockResolvedValue({ ok: true, status: 204 });
      const now = new Date('2026-11-25T12:00:00+07:00');

      // Disable newAnnouncements while keeping newMaterials & newAssignments enabled
      saveAlertSettings(
        {
          discordEnabled: true,
          discordWebhookUrl: VALID_WEBHOOK,
          newPosts: true,
          newAssignments: true,
          newAnnouncements: false,
          newMaterials: true
        },
        email
      );

      await NotificationService.evaluateNewPostDigest(
        'tok',
        email,
        [
          { id: 'cw-new', courseId: 'c1', course: 'AI', title: 'Prompt Lab', creationTime: '2026-11-25T10:00:00+07:00', googleLink: 'https://classroom.google.com/c/1/a/10' },
          // Old post created 30 days ago that was merely edited today -> must NOT fire as new!
          { id: 'cw-old-edited', courseId: 'c1', course: 'AI', title: 'Syllabus', creationTime: '2026-10-01T10:00:00+07:00', updateTime: '2026-11-25T11:55:00+07:00' }
        ],
        [
          { id: 'ann-muted', courseId: 'c1', course: 'AI', type: 'announcement', title: 'Muted Announcement', creationTime: '2026-11-25T11:00:00+07:00' },
          { id: 'mat-new', courseId: 'c1', course: 'AI', type: 'material', title: 'Transformer Slides PDF', creationTime: '2026-11-25T11:30:00+07:00', googleLink: 'https://classroom.google.com/c/1/m/20' }
        ],
        [],
        [],
        { now }
      );

      expect(webhookSpy).toHaveBeenCalledTimes(1);
      const bodyStr = JSON.stringify(webhookSpy.mock.calls[0][1]);
      expect(bodyStr).toContain('Prompt Lab');
      expect(bodyStr).toContain('Transformer Slides PDF');
      expect(bodyStr).toContain('https://classroom.google.com/c/1/m/20');
      expect(bodyStr).not.toContain('Muted Announcement');
      expect(bodyStr).not.toContain('Syllabus');
    });

    it('detects CourseWorkMaterials and enforces LockService in generated Google Apps Script', () => {
      const script = getAppsScriptTemplate([], {
        discordWebhookUrl: VALID_WEBHOOK,
        embedWebhook: false,
        notifyNewPosts: true,
        notifyNewMaterials: true,
        examCountdownEnabled: true,
        mergedExams: [
          { id: 'ex-cloud', courseCode: 'CS500', courseName: 'Cloud Security', date: '2026-11-28', rawIsoDate: '2026-11-28', time: '09:00-12:00', room: '81-505', seat: 'S9' }
        ]
      });

      // Webhook secret is NOT embedded in source when embedWebhook is false
      expect(script).not.toContain(VALID_WEBHOOK);

      const propStore = { DISCORD_WEBHOOK_URL: VALID_WEBHOOK };
      const fetchCalls = [];
      let lockReleased = false;
      const nowIso = new Date().toISOString();

      const runner = new Function(
        'Logger',
        'Session',
        'PropertiesService',
        'Utilities',
        'UrlFetchApp',
        'MailApp',
        'Classroom',
        'LockService',
        `${script}\nreturn { sendClassroomDigest };`
      )(
        { log: () => {} },
        { getActiveUser: () => ({ getEmail: () => email }) },
        {
          getScriptProperties: () => ({
            getProperty: (k) => propStore[k] || null,
            setProperty: (k, v) => { propStore[k] = String(v); },
            deleteProperty: (k) => { delete propStore[k]; }
          })
        },
        {
          formatDate: (d, _tz, pat) => {
            if (pat === 'yyyy-MM-dd') return new Date(d.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10);
            return '25 Nov 12:00';
          },
          sleep: () => {}
        },
        {
          fetch: (url, opts) => {
            fetchCalls.push({ url, payload: JSON.parse(opts.payload) });
            return { getResponseCode: () => 204, getContentText: () => '' };
          }
        },
        { sendEmail: () => {} },
        {
          Courses: {
            list: () => ({ courses: [{ id: 'c1', name: 'Cloud Security' }] }),
            CourseWork: {
              list: () => ({ courseWork: [] }),
              StudentSubmissions: { list: () => ({ studentSubmissions: [] }) }
            },
            Announcements: { list: () => ({ announcements: [] }) },
            CourseWorkMaterials: {
              list: () => ({
                courseWorkMaterial: [
                  { id: 'mat-77', title: 'Zero Trust Lecture Notes', creationTime: nowIso, alternateLink: 'https://classroom.google.com/c/1/m/77' }
                ]
              })
            }
          }
        },
        {
          getScriptLock: () => ({
            tryLock: () => true,
            releaseLock: () => { lockReleased = true; }
          })
        }
      );

      runner.sendClassroomDigest();
      expect(lockReleased).toBe(true);
      expect(fetchCalls).toHaveLength(1);
      expect(fetchCalls[0].url).toBe(VALID_WEBHOOK);
      expect(JSON.stringify(fetchCalls[0].payload)).toContain('Zero Trust Lecture Notes');
    });
  });

  // ── 21, 22, 23, 24, 25: Concurrency, Authority Dedup, 429 Header, 5xx Backoff & Ambiguous Timeout ──
  describe('Delivery Reliability, Concurrency, 429/5xx Backoff & Ambiguous Timeouts', () => {
    it('prevents duplicate sends under concurrent dispatcher calls and pauses browser auto-send when authority is apps_script', async () => {
      let calls = 0;
      vi.spyOn(DiscordService, 'sendWebhook').mockImplementation(async () => {
        await new Promise((r) => setTimeout(r, 25));
        calls++;
        return { ok: true, status: 204 };
      });

      const tasks = [{ id: 'race-1', title: 'Concurrent Task', course: 'OS', status: 'todo', dueDate: '2026-11-25' }];
      const now = new Date('2026-11-25T10:00:00+07:00');

      await Promise.all([
        NotificationService.evaluateNotifications('tok', email, tasks, [], [], { now }),
        NotificationService.evaluateNotifications('tok', email, tasks, [], [], { now }),
        NotificationService.evaluateNotifications('tok', email, tasks, [], [], { now })
      ]);
      expect(calls).toBe(1);

      // Switching authority to 'apps_script' suppresses automated browser sends while keeping manual preview working
      saveAlertSettings(
        {
          discordEnabled: true,
          discordWebhookUrl: VALID_WEBHOOK,
          deliveryAuthority: 'apps_script'
        },
        email
      );
      const tasks2 = [{ id: 'cloud-only', title: 'Cloud Task', course: 'OS', status: 'todo', dueDate: '2026-11-25' }];
      await NotificationService.evaluateNotifications('tok', email, tasks2, [], [], { now });
      expect(calls).toBe(1);

      // SyncManager ledger merge preserves DELIVERED precedence across devices
      const mergedLedger = syncManager.mergeNotificationLedger(
        { 'assignment:race-1:due_today:2026-11-25': { status: LEDGER_STATUS.CLAIMED, attemptCount: 1 } },
        { 'assignment:race-1:due_today:2026-11-25': { status: LEDGER_STATUS.DELIVERED, attemptCount: 2 } }
      );
      expect(mergedLedger['assignment:race-1:due_today:2026-11-25'].status).toBe(LEDGER_STATUS.DELIVERED);
      expect(mergedLedger['assignment:race-1:due_today:2026-11-25'].attemptCount).toBe(2);
    });

    it('retries HTTP 429 via Retry-After header and HTTP 503 with exponential backoff', async () => {
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          headers: { get: (h) => (h.toLowerCase() === 'retry-after' ? '0.01' : null) },
          json: async () => { throw new Error('non-json'); }
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          text: async () => 'Service Unavailable'
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 204
        });

      const res = await DiscordService.sendWebhook(
        VALID_WEBHOOK,
        { content: 'Resilient' },
        { maxRetries: 2, baseBackoffMs: 10, maxRetryWaitMs: 30, email }
      );
      expect(res.ok).toBe(true);
      expect(res.attempts).toBe(3);
      expect(fetchSpy).toHaveBeenCalledTimes(3);
      expect(NotificationLedger.getTelemetry(email).lastStatus).toBe('delivered');
    });

    it('halts auto-resending on AbortError network timeout (AMBIGUOUS_TIMEOUT) to prevent duplicate spam and scrubs secrets', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        const abortErr = new Error('The operation was aborted');
        abortErr.name = 'AbortError';
        throw abortErr;
      });

      const tasks = [{ id: 'timeout-1', title: 'Timeout Task', course: 'Net', status: 'todo', dueDate: '2026-11-25' }];
      const now = new Date('2026-11-25T10:00:00+07:00');

      await expect(
        NotificationService.evaluateNotifications('tok', email, tasks, [], [], { now })
      ).rejects.toThrow(/timed out/i);

      const ledger = NotificationLedger.getAll(email);
      const entry = ledger['assignment:timeout-1:due_today:2026-11-25'];
      expect(entry.status).toBe(LEDGER_STATUS.AMBIGUOUS_TIMEOUT);
      expect(NotificationLedger.getTelemetry(email).lastStatus).toBe('ambiguous');
      expect(JSON.stringify(ledger)).not.toContain('ZyXwVuTsRqPoNmLkJiHgFeDcBa');

      // Subsequent sync must NOT auto-resend an ambiguous timed-out message
      const postTimeoutSpy = vi.spyOn(DiscordService, 'sendWebhook').mockResolvedValue({ ok: true, status: 204 });
      await NotificationService.evaluateNotifications('tok', email, tasks, [], [], { now });
      expect(postTimeoutSpy).not.toHaveBeenCalled();
    });
  });

  // ── 26, 27, 28: Dual Gmail+Discord History, Legacy Migration, Timezone & Quiet Hours + Settings UI ──
  describe('Dual-Channel History, Settings Migration, Timezone Boundaries & Settings Previews', () => {
    it('records BOTH Gmail and Discord notification history entries when both channels are enabled', async () => {
      setEnableEmailAlerts(true, email);
      vi.spyOn(GoogleRepository, 'sendEmail').mockResolvedValue({});
      vi.spyOn(DiscordService, 'sendWebhook').mockResolvedValue({ ok: true, status: 204 });

      const todayIso = new Date().toISOString();
      await NotificationService.evaluateNotifications(
        'tok',
        email,
        [{ id: 'dual-1', title: 'Dual Channel HW', course: 'SE', courseCode: 'CS101', status: 'todo', dueDate: todayIso }],
        [],
        []
      );

      const logs = getNotificationHistory(email);
      expect(logs.some((l) => l.channel === 'email' && l.title.includes('Dual Channel HW'))).toBe(true);
      expect(logs.some((l) => l.channel === 'discord' && l.title.includes('Dual Channel HW'))).toBe(true);
    });

    it('migrates legacy v2 alert settings without resetting user preferences', () => {
      setSundayDigestTime('19:30', email);
      localStorage.setItem(
        `classroom_hub_alert_settings_${email}`,
        JSON.stringify({
          version: 2,
          timestamp: new Date().toISOString(),
          data: {
            due3Days: false,
            due1Day: true,
            newPosts: false,
            sundayDigest: true,
            discordEnabled: true,
            discordWebhookUrl: VALID_WEBHOOK
          }
        })
      );

      const migrated = getAlertSettings(email);
      expect(migrated.due3Days).toBe(false);
      expect(migrated.due1Day).toBe(true);
      expect(migrated.newPosts).toBe(false);
      expect(migrated.newAssignments).toBe(false);
      expect(migrated.newAnnouncements).toBe(false);
      expect(migrated.newMaterials).toBe(false);
      expect(migrated.weeklyDigestTime).toBe('19:30');
      expect(migrated.timezone).toBe('Asia/Bangkok');
    });

    it('evaluates late-night UTC timestamps in Asia/Bangkok date boundaries and enforces overnight Quiet Hours with P0 critical bypass', async () => {
      const webhookSpy = vi.spyOn(DiscordService, 'sendWebhook').mockResolvedValue({ ok: true, status: 204 });

      // 2026-11-27T17:30:00Z === 2026-11-28 00:30:00 Asia/Bangkok (inside 22:00-06:30 Quiet Hours!)
      const lateNightUtc = new Date('2026-11-27T17:30:00Z');
      saveAlertSettings(
        {
          discordEnabled: true,
          discordWebhookUrl: VALID_WEBHOOK,
          quietHoursEnabled: true,
          quietHoursStart: '22:00',
          quietHoursEnd: '06:30',
          quietHoursAllowCritical: true
        },
        email
      );

      const tasks = [
        // Due 2026-11-28 in Bangkok -> diffDays === 0 (P0 Critical -> bypasses Quiet Hours!)
        { id: 'tz-p0', title: 'Midnight Critical Due Today', course: 'OS', status: 'todo', dueDate: '2026-11-28' },
        // Due 2026-12-05 in Bangkok -> diffDays === 7 (P2 Normal -> deferred by Quiet Hours!)
        { id: 'tz-p2', title: '7D Normal Task', course: 'OS', status: 'todo', dueDate: '2026-12-05' }
      ];

      await NotificationService.evaluateNotifications('tok', email, tasks, [], [], { now: lateNightUtc });
      expect(webhookSpy).toHaveBeenCalledTimes(1);
      expect(webhookSpy.mock.calls[0][1].embeds[0].title).toContain('Midnight Critical Due Today');

      // Once Quiet Hours end at 08:00 Asia/Bangkok (2026-11-28T01:00:00Z), the deferred 7D task delivers cleanly!
      await NotificationService.evaluateNotifications('tok', email, tasks, [], [], {
        now: new Date('2026-11-28T01:00:00Z')
      });
      expect(webhookSpy).toHaveBeenCalledTimes(2);
      expect(webhookSpy.mock.calls[1][1].embeds[0].title).toContain('7D Normal Task');
    });

    it('triggers live Morning Briefing, Assignment, Exam, and Weekly Report previews from Settings UI', async () => {
      setActiveEmail(email);
      saveToken('tok-preview', 3600);
      saveProfile({ name: 'TopZ', email }, email);
      saveAssignments(
        [{ id: 'p-hw', title: 'Preview Lab', course: 'Compilers', status: 'todo', dueDate: '2026-11-30' }],
        email
      );
      examRepository.saveToCache(
        email,
        [{ id: 'p-ex', courseCode: 'CS409', courseName: 'Compilers', date: '2026-12-10', rawIsoDate: '2026-12-10', time: '09:00-12:00', room: '78-501', seat: 'C1' }],
        [],
        null
      );

      const webhookSpy = vi.spyOn(DiscordService, 'sendWebhook').mockResolvedValue({ ok: true, status: 204 });

      render(
        <MemoryRouter initialEntries={['/settings']}>
          <AuthProvider>
            <SettingsProvider>
              <ClassroomContext.Provider
                value={{
                  assignments: [{ id: 'p-hw', title: 'Preview Lab', course: 'Compilers', status: 'todo', dueDate: '2026-11-30' }],
                  schedule: [{ id: 's1', title: 'Compilers', day: 'wed', startTime: '09:00', endTime: '12:00', room: '78-501' }],
                  resources: []
                }}
              >
                <Settings />
              </ClassroomContext.Provider>
            </SettingsProvider>
          </AuthProvider>
        </MemoryRouter>
      );

      // Open Discord Assistant category
      fireEvent.click(screen.getByTestId('settings-nav-discord'));
      expect(screen.getByTestId('discord-live-embed-card')).toBeInTheDocument();

      for (const modeTestId of [
        'preview-mode-morning',
        'preview-mode-assignment',
        'preview-mode-exam',
        'preview-mode-weekly'
      ]) {
        fireEvent.click(screen.getByTestId(modeTestId));
        await act(async () => {
          fireEvent.click(screen.getByTestId('send-selected-preview-btn'));
          await new Promise((r) => setTimeout(r, 0));
        });
      }

      expect(webhookSpy).toHaveBeenCalledTimes(4);
      expect(screen.getByTestId('discord-delivery-telemetry')).toHaveTextContent(/Healthy|ส่งสำเร็จปกติ/);
    });

    it('sends enhanced Weekly Academic Report once per reporting week and triggers 30m / 5m pre-class reminders', async () => {
      const webhookSpy = vi.spyOn(DiscordService, 'sendWebhook').mockResolvedValue({ ok: true, status: 204 });

      // 1. Sunday 18:10 Asia/Bangkok -> sends Weekly Academic Report once
      const sundayEvening = new Date('2026-11-29T18:10:00+07:00');
      const schedule = [
        { id: 'mon-cls', title: 'Software Architecture', courseCode: 'CS402', day: 'mon', startTime: '09:00', endTime: '12:00', room: '78-621' }
      ];
      const tasks = [
        { id: 'w-over', title: 'Overdue Task', course: 'CS402', status: 'todo', dueDate: '2026-11-20' },
        { id: 'w-open', title: 'Term Paper', course: 'CS402', status: 'todo', dueDate: '' }
      ];
      const resources = [
        { id: 'm-wk', type: 'material', course: 'CS402', title: 'Week 12 Slides', creationTime: '2026-11-28T10:00:00+07:00' }
      ];

      saveAlertSettings(
        {
          discordEnabled: true,
          discordWebhookUrl: VALID_WEBHOOK,
          morningBriefingEnabled: false,
          overdue1Day: false, // Isolate weekly digest & pre-class checks
          sundayDigest: true,
          weeklyDigestDay: 'sun',
          weeklyDigestTime: '18:00',
          classReminderEnabled: true,
          classReminderLeadMinutes: 30,
          classReminderFinal5m: true
        },
        email
      );

      await NotificationService.evaluateNotifications('tok', email, tasks, [], resources, {
        now: sundayEvening,
        schedule
      });
      expect(webhookSpy).toHaveBeenCalledTimes(1);
      const weeklyEmbed = webhookSpy.mock.calls[0][1].embeds[0];
      expect(weeklyEmbed.title).toBe('Weekly Academic Report');
      expect(JSON.stringify(weeklyEmbed)).toContain('Software Architecture');
      expect(JSON.stringify(weeklyEmbed)).toContain('Term Paper');

      // Re-running same Sunday does NOT duplicate Weekly Academic Report
      await NotificationService.evaluateNotifications('tok', email, tasks, [], resources, {
        now: new Date('2026-11-29T20:00:00+07:00'),
        schedule
      });
      expect(webhookSpy).toHaveBeenCalledTimes(1);

      // 2. Monday 08:35 Asia/Bangkok (25 min before 09:00 class) -> fires 30m pre-class reminder
      await NotificationService.evaluateScheduleTick(email, {
        now: new Date('2026-11-30T08:35:00+07:00'),
        schedule,
        assignments: [],
        resources: []
      });
      expect(webhookSpy).toHaveBeenCalledTimes(2);
      expect(webhookSpy.mock.calls[1][1].embeds[0].title).toContain('Class in 25 min');

      // 3. Monday 08:56 Asia/Bangkok (4 min before 09:00 class) -> fires final 5m critical reminder
      await NotificationService.evaluateScheduleTick(email, {
        now: new Date('2026-11-30T08:56:00+07:00'),
        schedule,
        assignments: [],
        resources: []
      });
      expect(webhookSpy).toHaveBeenCalledTimes(3);
      expect(webhookSpy.mock.calls[2][1].embeds[0].title).toContain('Class in 4 min');
    });

    it('delivers midnight deadline rollovers, exam countdowns, and weekly digests via background schedule ticks', async () => {
      const webhookSpy = vi.spyOn(DiscordService, 'sendWebhook').mockResolvedValue({ ok: true, status: 204 });

      saveAlertSettings(
        {
          discordEnabled: true,
          discordWebhookUrl: VALID_WEBHOOK,
          morningBriefingEnabled: false,
          dueToday: true,
          examCountdownEnabled: true,
          examToday: true,
          sundayDigest: true,
          weeklyDigestDay: 'sun',
          weeklyDigestTime: '18:00'
        },
        email
      );

      examRepository.saveToCache(
        email,
        [{ id: 'ex-roll', courseCode: 'CS900', courseName: 'Distributed Cloud', date: '2026-11-29', rawIsoDate: '2026-11-29', time: '13:00-16:00', room: '78-401', seat: 'B4' }],
        [],
        null
      );

      await NotificationService.evaluateScheduleTick(email, {
        now: new Date('2026-11-29T18:05:00+07:00'),
        includeDeadlinesAndWeekly: true,
        schedule: [],
        assignments: [
          { id: 'hw-roll', title: 'Sunday Midnight Homework', course: 'Distributed Cloud', status: 'todo', dueDate: '2026-11-29' }
        ],
        resources: []
      });

      // Fires Due Today reminder + Exam Today countdown + Weekly Academic Report without needing a full Classroom reload
      expect(webhookSpy).toHaveBeenCalledTimes(3);
      const titles = webhookSpy.mock.calls.map((c) => c[1].embeds[0].title);
      expect(titles.some((t) => t.includes('Sunday Midnight Homework'))).toBe(true);
      expect(titles.some((t) => t.includes('Distributed Cloud'))).toBe(true);
      expect(titles.some((t) => t.includes('Weekly Academic Report'))).toBe(true);
    });

    it('installs 15m trigger via install24x7Trigger and delivers pre-class, daily, and weekly alerts in Apps Script even when Calendar has 0 synced events', () => {
      const script = getAppsScriptTemplate([], {
        discordWebhookUrl: VALID_WEBHOOK,
        embedWebhook: true,
        morningBriefingEnabled: true,
        morningBriefingTime: '07:00',
        classReminderEnabled: true,
        classReminderLeadMinutes: 30,
        dailyDigestEnabled: true,
        dailyDigestTime: '18:00',
        sundayDigest: true,
        weeklyDigestDay: 'sun',
        weeklyDigestTime: '18:00',
        schedule: [
          { id: 'sun-cls', title: 'Cloud Systems', courseCode: 'CS777', day: 'sun', startTime: '19:00', endTime: '21:00', room: '81-601' }
        ],
        mergedExams: [
          { id: 'ex-snap', courseCode: 'CS777', courseName: 'Cloud Systems', date: '2026-12-05', rawIsoDate: '2026-12-05', time: '09:00-12:00', room: '81-601', seat: 'A1' }
        ]
      });

      const propStore = {};
      const fetchCalls = [];
      let deletedTriggers = 0;
      let createdEveryMins = null;

      const runner = new Function(
        'Logger',
        'Session',
        'PropertiesService',
        'Utilities',
        'UrlFetchApp',
        'MailApp',
        'Classroom',
        'Calendar',
        'ScriptApp',
        `${script}\nreturn { install24x7Trigger, uninstall24x7Trigger };`
      )(
        { log: () => {} },
        { getActiveUser: () => ({ getEmail: () => email }) },
        {
          getScriptProperties: () => ({
            getProperty: (k) => propStore[k] || null,
            setProperty: (k, v) => { propStore[k] = String(v); },
            deleteProperty: (k) => { delete propStore[k]; }
          })
        },
        {
          formatDate: (_d, _tz, pat) => {
            if (pat === 'yyyy-MM-dd') return '2026-11-29';
            if (pat === 'HH:mm') return '18:35'; // 25m before 19:00 class, and past 07:00 & 18:00!
            if (pat === 'EEE') return 'Sun';
            return '29 Nov 18:35';
          },
          sleep: () => {}
        },
        {
          fetch: (url, opts) => {
            fetchCalls.push({ url, payload: JSON.parse(opts.payload) });
            return { getResponseCode: () => 204, getContentText: () => '' };
          }
        },
        { sendEmail: () => {} },
        {
          Courses: {
            list: () => ({ courses: [{ id: 'c1', name: 'Cloud Systems' }] }),
            CourseWork: {
              list: () => ({
                courseWork: [
                  { id: 'cw-open', title: ' Raft Project', alternateLink: 'https://classroom.google.com/c/1/a/9' }
                ]
              }),
              StudentSubmissions: {
                list: () => ({
                  studentSubmissions: [{ courseWorkId: 'cw-open', state: 'CREATED' }]
                })
              }
            },
            Announcements: { list: () => ({ announcements: [] }) }
          }
        },
        // Calendar service enabled in GAS, but 0 events synced yet -> must fallback to FALLBACK_SNAPSHOT!
        {
          Events: {
            list: () => ({ items: [] })
          }
        },
        {
          getProjectTriggers: () => [
            { getHandlerFunction: () => 'sendClassroomDigest' }
          ],
          deleteTrigger: () => { deletedTriggers++; },
          newTrigger: () => ({
            timeBased: () => ({
              everyMinutes: (mins) => ({
                create: () => { createdEveryMins = mins; }
              })
            })
          })
        }
      );

      expect(runner.install24x7Trigger()).toBe(true);
      expect(deletedTriggers).toBe(1);
      expect(createdEveryMins).toBe(15);
      // 1 activation confirmation call + 1 initial digest call
      expect(fetchCalls.length).toBeGreaterThanOrEqual(2);
      const allPayloads = JSON.stringify(fetchCalls.map((f) => f.payload));
      expect(allPayloads).toContain('24/7 Cloud Assistant Activated');
      expect(allPayloads).toContain('Morning Briefing');
      expect(allPayloads).toContain('Class in 25 min');
      expect(allPayloads).toContain('Daily Academic Summary');
      expect(allPayloads).toContain('Weekly Academic Report');
      expect(allPayloads).toContain('Cloud Systems');

      expect(runner.uninstall24x7Trigger()).toBe(1);
    });

    it('lets users jump directly to 24/7 Cloud setup and switch delivery authority in one click', () => {
      setActiveEmail(email);
      saveToken('tok-jump', 3600);
      saveProfile({ name: 'TopZ', email }, email);

      render(
        <MemoryRouter initialEntries={['/settings?tab=discord']}>
          <AuthProvider>
            <SettingsProvider>
              <ClassroomContext.Provider value={{ assignments: [], schedule: [], resources: [] }}>
                <Settings />
              </ClassroomContext.Provider>
            </SettingsProvider>
          </AuthProvider>
        </MemoryRouter>
      );

      fireEvent.click(screen.getByTestId('jump-to-24x7-cloud-btn'));
      expect(screen.getByTestId('copy-apps-script-btn')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('quick-switch-cloud-authority-btn'));
      expect(getAlertSettings(email).deliveryAuthority).toBe('apps_script');
    });
  });
});
