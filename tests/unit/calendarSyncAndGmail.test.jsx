import { useRef } from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { syncClassroomDataToCalendar, buildCalendarReminders } from '../../src/services/calendarSync';
import { calendarSyncManager } from '../../src/services/CalendarSyncManager';
import { NotificationService } from '../../src/services/NotificationService';
import { GoogleRepository } from '../../src/repositories/GoogleRepository';
import { AuthProvider } from '../../src/contexts/AuthContext';
import { SettingsProvider } from '../../src/contexts/SettingsContext';
import { ClassroomContext } from '../../src/contexts/ClassroomContext';
import NotificationPopover from '../../src/components/NotificationPopover';
import {
  setActiveEmail, saveToken, saveProfile, setEnableEmailAlerts,
  saveAlertSettings, saveDailyEmailLimit
} from '../../src/utils/storage';
import { AppError } from '../../src/utils/errors';
import { httpClient } from '../../src/utils/httpClient';

describe('Google Calendar Sync Deduplication, Reconciliation & Reminders', () => {
  const email = 'student@kmutnb.ac.th';

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
    calendarSyncManager.lastSyncedAt = null;
    calendarSyncManager.lastError = null;
  });

  it('purges 4+ duplicate remote events and deleted/done/hidden items during reconciliation', async () => {
    const deleteCalls = [];
    const postCalls = [];
    const patchCalls = [];

    vi.spyOn(httpClient, 'request').mockImplementation(async (url, opts = {}) => {
      const method = (opts.method || 'GET').toUpperCase();
      if (method === 'GET' && url.includes('privateExtendedProperty=chSource')) {
        return {
          items: [
            // 4 duplicate copies of active schedule 'sched-1'
            { id: 'cal-s1-a', status: 'confirmed', extendedProperties: { private: { chSource: 'classroom-hub', chType: 'schedule', chId: 'sched-1' } } },
            { id: 'cal-s1-b', status: 'confirmed', extendedProperties: { private: { chSource: 'classroom-hub', chType: 'schedule', chId: 'sched-1' } } },
            { id: 'cal-s1-c', status: 'confirmed', extendedProperties: { private: { chSource: 'classroom-hub', chType: 'schedule', chId: 'sched-1' } } },
            { id: 'cal-s1-d', status: 'confirmed', extendedProperties: { private: { chSource: 'classroom-hub', chType: 'schedule', chId: 'sched-1' } } },
            // Ghost deleted schedule item that no longer exists in web schedule
            { id: 'cal-deleted-1', status: 'confirmed', extendedProperties: { private: { chSource: 'classroom-hub', chType: 'schedule', chId: 'sched-deleted' } } },
            { id: 'cal-deleted-2', status: 'confirmed', extendedProperties: { private: { chSource: 'classroom-hub', chType: 'schedule', chId: 'sched-deleted' } } },
            // Completed assignment that should be removed from calendar
            { id: 'cal-done-1', status: 'confirmed', extendedProperties: { private: { chSource: 'classroom-hub', chType: 'assignment', chId: 'a-done' } } },
            // Hidden course assignment that should be removed from calendar
            { id: 'cal-hidden-1', status: 'confirmed', extendedProperties: { private: { chSource: 'classroom-hub', chType: 'assignment', chId: 'a-hidden' } } },
          ]
        };
      }
      if (method === 'DELETE') {
        deleteCalls.push(url.split('/').pop());
        return null;
      }
      if (method === 'PATCH') {
        patchCalls.push({ url, body: JSON.parse(opts.body) });
        return { id: url.split('/').pop() };
      }
      if (method === 'POST') {
        postCalls.push(JSON.parse(opts.body));
        return { id: `created-${postCalls.length}` };
      }
      return {};
    });

    await syncClassroomDataToCalendar('token-123', email, {
      schedule: [
        { id: 'sched-1', title: 'CS101', day: 'mon', startTime: '09:00', endTime: '12:00', room: '81-501' }
      ],
      assignments: [
        { id: 'a-done', title: 'Done Task', courseId: 'c1', dueDate: '2026-12-01', status: 'done' },
        { id: 'a-hidden', title: 'Hidden Task', courseId: 'c-hidden', dueDate: '2026-12-02', status: 'todo' },
        { id: 'a-active', title: 'Active Task', courseId: 'c1', dueDate: '2026-12-03T23:59:00Z', status: 'todo' }
      ],
      hiddenCourses: ['c-hidden']
    });

    // Kept 'cal-s1-a', deleted 3 duplicate copies of sched-1, both copies of deleted schedule, done task, and hidden task!
    expect(deleteCalls.sort()).toEqual([
      'cal-deleted-1',
      'cal-deleted-2',
      'cal-done-1',
      'cal-hidden-1',
      'cal-s1-b',
      'cal-s1-c',
      'cal-s1-d'
    ]);
    // Adopted 'cal-s1-a' and PATCHed it instead of POSTing a duplicate
    expect(patchCalls).toHaveLength(1);
    expect(patchCalls[0].url).toContain('cal-s1-a');
    // Only 'a-active' needed a new POST
    expect(postCalls).toHaveLength(1);
    expect(postCalls[0].summary).toContain('Active Task');
    // UTC dueDate should be formatted cleanly into consistent Bangkok naive ISO + timeZone
    expect(postCalls[0].start.dateTime).toBe('2026-12-04T06:59:00');
    expect(postCalls[0].end.dateTime).toBe('2026-12-04T07:29:00');
  });

  it('does NOT POST duplicate event when PATCH fails with non-404 error, but recreates on 404', async () => {
    localStorage.setItem(
      `classroom_hub_calendar_event_map_${email}`,
      JSON.stringify({ 'schedule:sched-1': { eventId: 'existing-id', sig: 'stale' } })
    );

    const requestSpy = vi.spyOn(httpClient, 'request').mockImplementation(async (url, opts = {}) => {
      const method = (opts.method || 'GET').toUpperCase();
      if (method === 'GET') {
        return {
          items: [
            { id: 'existing-id', status: 'confirmed', extendedProperties: { private: { chSource: 'classroom-hub', chType: 'schedule', chId: 'sched-1' } } }
          ]
        };
      }
      if (method === 'PATCH') {
        throw new AppError('Rate limit exceeded', 403);
      }
      if (method === 'POST') {
        throw new Error('POST must NOT be called on 403!');
      }
      return {};
    });

    await expect(
      syncClassroomDataToCalendar('token', email, {
        schedule: [{ id: 'sched-1', title: 'CS101', day: 'mon', startTime: '09:00', endTime: '12:00' }]
      })
    ).rejects.toThrow(/Rate limit/);

    expect(requestSpy.mock.calls.filter(c => c[1]?.method === 'POST')).toHaveLength(0);

    // Now test 404 -> safely recreates
    requestSpy.mockImplementation(async (url, opts = {}) => {
      const method = (opts.method || 'GET').toUpperCase();
      if (method === 'GET') return { items: [] };
      if (method === 'PATCH') throw new AppError('Not found', 404);
      if (method === 'POST') return { id: 'recreated-id' };
      return {};
    });

    await syncClassroomDataToCalendar('token', email, {
      schedule: [{ id: 'sched-1', title: 'CS101', day: 'mon', startTime: '09:00', endTime: '12:00' }]
    });

    expect(requestSpy.mock.calls.filter(c => c[1]?.method === 'POST')).toHaveLength(1);
    const savedMap = JSON.parse(localStorage.getItem(`classroom_hub_calendar_event_map_${email}`));
    expect(savedMap['schedule:sched-1'].eventId).toBe('recreated-id');
  });

  it('serializes concurrent CalendarSyncManager.runSync calls so they never race to POST duplicates', async () => {
    const activeExecutions = [];
    let maxConcurrency = 0;
    let currentConcurrency = 0;
    let remoteEvents = [];

    vi.spyOn(httpClient, 'request').mockImplementation(async (url, opts = {}) => {
      const method = (opts.method || 'GET').toUpperCase();
      if (method === 'GET') {
        currentConcurrency++;
        maxConcurrency = Math.max(maxConcurrency, currentConcurrency);
        activeExecutions.push('start');
        await new Promise(r => setTimeout(r, 20));
        currentConcurrency--;
        return { items: remoteEvents };
      }
      if (method === 'POST') {
        const body = JSON.parse(opts.body);
        const created = { id: `ev-${remoteEvents.length + 1}`, extendedProperties: body.extendedProperties };
        remoteEvents.push(created);
        return created;
      }
      if (method === 'PATCH') {
        return { id: url.split('/').pop() };
      }
      return null;
    });

    localStorage.setItem(
      `classroom_hub_schedule_${email}`,
      JSON.stringify({
        version: 2,
        timestamp: new Date().toISOString(),
        data: [{ id: 'sched-race', title: 'Math', day: 'tue', startTime: '10:00', endTime: '12:00' }]
      })
    );

    await Promise.all([
      calendarSyncManager.runSync('token', email),
      calendarSyncManager.runSync('token', email),
      calendarSyncManager.runSync('token', email)
    ]);

    expect(maxConcurrency).toBe(1);
    expect(remoteEvents).toHaveLength(1);
  });

  it('supports 0-minute Calendar reminders and clamps values above 40320 minutes (28 days)', () => {
    expect(buildCalendarReminders({
      calendarReminderEnabled: true,
      calendarReminderValue: 0,
      calendarReminderUnit: 'minutes'
    })).toEqual({
      useDefault: false,
      overrides: [{ method: 'popup', minutes: 0 }]
    });

    expect(buildCalendarReminders({
      calendarReminderEnabled: true,
      calendarReminderValue: 999,
      calendarReminderUnit: 'days'
    })).toEqual({
      useDefault: false,
      overrides: [{ method: 'popup', minutes: 40320 }]
    });

    expect(buildCalendarReminders({
      calendarReminderEnabled: false
    })).toEqual({
      useDefault: false,
      overrides: []
    });
  });
});

describe('Gmail Notification Guards & Independent Calendar Settings UI', () => {
  const email = 'student@kmutnb.ac.th';

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('does NOT send evaluateNewPostDigest emails when Gmail Alerts toggle is disabled', async () => {
    setEnableEmailAlerts(false, email);
    const sendSpy = vi.spyOn(GoogleRepository, 'sendEmail').mockResolvedValue({});

    await NotificationService.evaluateNewPostDigest(
      'token',
      email,
      [{ id: 'a-new', title: 'New HW', course: 'CS101', courseColor: 'blue' }],
      [],
      [],
      []
    );

    expect(sendSpy).not.toHaveBeenCalled();
  });

  it('does NOT send Sunday Digest on a weekday for a brand-new user with no missed prior Sunday sync', async () => {
    vi.useFakeTimers();
    try {
      // Wednesday 2026-11-18 10:00:00+07:00
      vi.setSystemTime(new Date('2026-11-18T10:00:00+07:00'));
      setEnableEmailAlerts(true, email);
      saveAlertSettings({ sundayDigest: true, due3Days: false, due1Day: false, dueToday: false, overdue1Day: false }, email);

      const sendSpy = vi.spyOn(GoogleRepository, 'sendEmail').mockResolvedValue({});
      await NotificationService.evaluateNotifications(
        'token',
        email,
        [{ id: 'no-due', title: 'Floating Task', course: 'CS101', status: 'todo', dueDate: '' }],
        [],
        [],
        { prevLastSync: null }
      );
      expect(sendSpy).not.toHaveBeenCalled();

      // If user last synced Friday BEFORE Sunday 18:00 (e.g. 2026-11-13), opening on Wednesday triggers the missed Sunday digest once
      await NotificationService.evaluateNotifications(
        'token',
        email,
        [{ id: 'no-due', title: 'Floating Task', course: 'CS101', status: 'todo', dueDate: '' }],
        [],
        [],
        { prevLastSync: '2026-11-13T10:00:00+07:00' }
      );
      expect(sendSpy).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps Google Calendar Reminder settings accessible when Gmail Alerts is OFF, resets stale daily quota display, and triggers Calendar sync', () => {
    setActiveEmail(email);
    saveToken('valid-token', 3600);
    saveProfile({ name: 'Somchai', email }, email);
    setEnableEmailAlerts(false, email);
    // Yesterday's count of 7 should render as 0 / 10 today
    saveDailyEmailLimit({ lastSentDate: '2000-01-01', count: 7 }, email);

    const queueSpy = vi.spyOn(calendarSyncManager, 'queueSync').mockImplementation(() => {});

    function Harness() {
      const bellRef = useRef(null);
      return (
        <div>
          <button ref={bellRef}>Bell</button>
          <NotificationPopover
            isNotificationsOpen={true}
            setIsNotificationsOpen={() => {}}
            bellButtonRef={bellRef}
          />
        </div>
      );
    }

    render(
      <AuthProvider>
        <SettingsProvider>
          <ClassroomContext.Provider value={{ assignments: [] }}>
            <Harness />
          </ClassroomContext.Provider>
        </SettingsProvider>
      </AuthProvider>
    );

    // Logs tab shows 0 / 10 today instead of yesterday's stale 7
    expect(screen.getByText(/0 \/ 10 emails/i)).toBeInTheDocument();

    // Switch to Settings tab
    fireEvent.click(screen.getByText('Settings'));
    expect(screen.getByText('Gmail Notification System is disabled.')).toBeInTheDocument();

    // Google Calendar Event Alerts section is STILL visible and interactive!
    const calCheckbox = screen.getByLabelText(/Google Calendar Event Alerts/i);
    expect(calCheckbox).toBeInTheDocument();
    expect(calCheckbox).toBeChecked();

    const minutesInput = screen.getByDisplayValue('10');
    act(() => {
      fireEvent.change(minutesInput, { target: { value: '0' } });
    });
    expect(queueSpy).toHaveBeenCalledWith('valid-token', email);
    expect(screen.getByDisplayValue('0')).toBeInTheDocument();
  });
});
