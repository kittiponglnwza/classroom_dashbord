import { StrictMode } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { StorageRepository } from '../../src/repositories/StorageRepository';
import { STORAGE_CONFIG } from '../../src/config/storage';
import { syncManager } from '../../src/services/SyncManager';
import { calendarSyncManager } from '../../src/services/CalendarSyncManager';
import { GoogleRepository } from '../../src/repositories/GoogleRepository';
import { ClassroomService } from '../../src/services/ClassroomService';
import { httpClient } from '../../src/utils/httpClient';
import { escapeHtml, sanitizeExternalUrl } from '../../src/utils/sanitize';
import { parseExamDate } from '../../src/utils/examDate';
import { getGoogleCalendarUrl } from '../../src/utils/calendarUrl';
import { parseExamHtml } from '../../src/services/parsers/examParser';
import { getCalendarDaysDiff, calculateDueState } from '../../src/utils/dateUtils';
import {
  recordDeletedId, updateAssignmentStatus, syncClassroomAssignments, saveAssignments,
  setActiveEmail, saveProfile, saveToken, setEnableEmailAlerts, saveAlertSettings,
  getSentNotifications, getNotificationHistory, saveHiddenCourses
} from '../../src/utils/storage';
import { DiscordService, DISCORD_LIMITS } from '../../src/services/DiscordService';
import { NotificationService } from '../../src/services/NotificationService';
import { getAppsScriptTemplate } from '../../src/utils/appsScriptTemplate';
import Settings from '../../src/pages/Settings';
import { useExams } from '../../src/hooks/useExams';
import { useExamRoom } from '../../src/features/exams/useExamRoom';
import { examRepository } from '../../src/repositories/examRepository';
import AssignmentCard from '../../src/components/AssignmentCard';
import AssignmentDetail from '../../src/pages/AssignmentDetail';
import Schedule from '../../src/pages/Schedule';
import { AuthProvider } from '../../src/contexts/AuthContext';
import { SettingsProvider } from '../../src/contexts/SettingsContext';
import { ToastProvider } from '../../src/contexts/ToastContext';
import { ClassroomContext, ClassroomProvider, useClassroom } from '../../src/contexts/ClassroomContext';
import { ClassroomUIContext } from '../../src/contexts/ClassroomUIContext';

const KEYS = STORAGE_CONFIG.keys;

describe('Gauntlet Regression Protections', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    StorageRepository.clearMemoryCache();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    syncManager.cancel();
    calendarSyncManager.cancel();
    vi.useRealTimers();
  });

  describe('Foundation: StorageRepository TTL & QuotaEviction & Utils', () => {
    it('enforces TTL expiration on full storage keys (e.g. STORAGE_CONFIG.keys.exams)', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-11-18T10:00:00Z'));

      StorageRepository.set(KEYS.exams, { exams: [{ id: 'ex-1' }], manualExams: [], unlisted: null }, 'a@b.com');
      expect(StorageRepository.get(KEYS.exams, 'a@b.com', false)?.exams).toHaveLength(1);

      // Advance 11 minutes (> 10 minute TTL)
      vi.advanceTimersByTime(11 * 60 * 1000);
      expect(StorageRepository.get(KEYS.exams, 'a@b.com', false)).toBeNull();
      // Manual recovery ignoring TTL still succeeds
      expect(StorageRepository.get(KEYS.exams, 'a@b.com', true)?.exams).toHaveLength(1);
    });

    it('preserves 0 in escapeHtml and blocks unsafe URL schemes in sanitizeExternalUrl', () => {
      expect(escapeHtml(0)).toBe('0');
      expect(escapeHtml(null)).toBe('');
      expect(sanitizeExternalUrl('javascript:alert(1)')).toBeNull();
      expect(sanitizeExternalUrl('data:text/html,<script>1</script>')).toBeNull();
      expect(sanitizeExternalUrl('https://classroom.google.com/c/123')).toBe('https://classroom.google.com/c/123');
    });

    it('fixes 9:00 calendar time formatting (090000 not 900000) and returns null for missing date', () => {
      const url = getGoogleCalendarUrl({
        courseCode: 'CS101',
        courseName: 'Algorithms',
        rawIsoDate: '2026-12-01',
        time: '9:00 - 11:30',
        room: '78-216'
      });
      expect(url).toContain('dates=20261201T090000/20261201T113000');
      expect(getGoogleCalendarUrl({ courseName: 'No Date' })).toBeNull();
    });

    it('parses Thai digits, YYYY/MM/DD, strips time digits, and rejects rollover dates in examDate', () => {
      const d1 = parseExamDate('๑๒ พ.ค. ๒๕๖๙ เวลา 09:00-12:00');
      expect(d1?.getFullYear()).toBe(2026);
      expect(d1?.getMonth()).toBe(4);
      expect(d1?.getDate()).toBe(12);

      const d2 = parseExamDate('2026/11/05');
      expect(d2?.getFullYear()).toBe(2026);
      expect(d2?.getMonth()).toBe(10);
      expect(d2?.getDate()).toBe(5);

      expect(parseExamDate('30 ก.พ. 2569')).toBeNull();
    });

    it('parses YYYY-MM-DD as local calendar dates without UTC shift', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 10, 18, 12, 0, 0));
      expect(getCalendarDaysDiff('2026-11-18', new Date())).toBe(0);
      expect(calculateDueState('2026-11-18', 'todo').type).toBe('dueToday');
      expect(getCalendarDaysDiff('not-a-date', new Date())).toBeNull();
    });

    it('resets per-table column indexes in examParser and rejects lookalike Drive domains', () => {
      const html = `
        <table><tr><td>Header Notice</td></tr></table>
        <table>
          <tr><th>วันสอบ</th><th>เวลา</th><th>รหัสวิชา</th><th>วิชา</th><th>ห้อง</th></tr>
          <tr><td>18 พ.ย. 69</td><td>09:00-12:00</td><td>CS101</td><td>Networks</td><td>B401</td></tr>
        </table>
      `;
      const okRes = parseExamHtml(html, 'en');
      expect(okRes.success).toBe(true);
      expect(okRes.data.exams).toHaveLength(1);
      expect(okRes.data.exams[0].courseCode).toBe('CS101');
      // Deterministic ID (no random/Date.now jitter)
      const okRes2 = parseExamHtml(html, 'en');
      expect(okRes.data.exams[0].id).toBe(okRes2.data.exams[0].id);

      const unlistedHtml = `<a href="https://evil.com/?q=drive.google.com">Fake</a>`;
      const unlistedRes = parseExamHtml(unlistedHtml, 'en');
      expect(unlistedRes.data.unlisted.pdfLink).not.toContain('evil.com');
    });
  });

  describe('Sync, HTTP, and Classroom Service Fixes', () => {
    it('does not invent a fresh timestamp when local and remote collection data already match', () => {
      const email = 'sync@test.com';
      const wrapper = JSON.stringify({
        version: 2,
        timestamp: '2026-11-01T00:00:00.000Z',
        data: [{ id: 'a1', title: 'Task 1', status: 'todo', updatedAt: '2026-11-01T00:00:00.000Z' }]
      });
      const key = `${KEYS.assignments}_${email}`;
      const merged = syncManager.mergePayloads({ [key]: wrapper }, { [key]: wrapper }, email);
      expect(merged[key]).toBe(wrapper);
    });

    it('propagates manual unmark done -> todo across devices via statusUpdatedAt and respects deleted tombstones', () => {
      const email = 'sync@test.com';
      saveAssignments([
        { id: 'a1', title: 'T1', status: 'done', updatedAt: '2026-11-10T00:00:00.000Z', statusUpdatedAt: '2026-11-10T00:00:00.000Z' },
        { id: 'a2', title: 'Delete Me', status: 'todo', updatedAt: '2026-11-10T00:00:00.000Z' }
      ], email);
      updateAssignmentStatus('a1', 'todo', email);
      recordDeletedId('assignments', 'a2', email);

      const deletedMap = new Map([['a2', Date.now() + 10000]]);
      const remoteList = [
        { id: 'a1', title: 'T1', status: 'done', updatedAt: '2026-11-10T00:00:00.000Z', statusUpdatedAt: '2026-11-10T00:00:00.000Z' },
        { id: 'a2', title: 'Delete Me', status: 'todo', updatedAt: '2026-11-10T00:00:00.000Z' }
      ];
      const localList = JSON.parse(localStorage.getItem(`${KEYS.assignments}_${email}`)).data;
      const mergedRemoteOlder = syncManager.mergeEntitiesById(localList, remoteList, false, deletedMap);
      expect(mergedRemoteOlder.find(x => x.id === 'a1').status).toBe('todo');
      expect(mergedRemoteOlder.some(x => x.id === 'a2')).toBe(false);
    });

    it('paginates GoogleRepository.fetchAllPages and converts UTC Classroom dueTime + preserves 0 maxPoints', async () => {
      const fetchSpy = vi.spyOn(httpClient, 'request')
        .mockResolvedValueOnce({ courses: [{ id: 'c1', name: 'Math', courseState: 'ACTIVE' }], nextPageToken: 'p2' })
        .mockResolvedValueOnce({ courses: [{ id: 'c2', name: 'Phys', courseState: 'ACTIVE' }] });

      const courses = await GoogleRepository.fetchCourses('tok');
      expect(courses).toHaveLength(2);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(fetchSpy.mock.calls[1][0]).toContain('pageToken=p2');

      vi.spyOn(GoogleRepository, 'fetchCourses').mockResolvedValueOnce([{ id: 'c1', name: 'Math', courseState: 'ACTIVE' }]);
      vi.spyOn(GoogleRepository, 'fetchCoursework').mockResolvedValueOnce([
        { id: 'cw1', title: 'Zero Pts', maxPoints: 0, dueDate: { year: 2026, month: 11, day: 18 }, dueTime: { hours: 10, minutes: 0 } },
        { id: 'cw2', title: 'Ungraded', dueDate: { year: 2026, month: 11, day: 19 }, materials: [{ driveFile: {} }] }
      ]);
      vi.spyOn(GoogleRepository, 'fetchSubmissions').mockRejectedValueOnce(new Error('503 temporary'));
      vi.spyOn(GoogleRepository, 'fetchAnnouncements').mockResolvedValueOnce([]);
      vi.spyOn(GoogleRepository, 'fetchMaterials').mockResolvedValueOnce([]);
      vi.spyOn(GoogleRepository, 'fetchTopics').mockResolvedValueOnce([]);

      const result = await ClassroomService.fetchClassroomData('tok');
      expect(result.failedCourseIds).toContain('c1');
      expect(result.assignments[0].points).toBe(0);
      expect(result.assignments[0].dueDate).toBe('2026-11-18T10:00:00.000Z');
      expect(result.assignments[1].points).toBeNull();
      expect(result.assignments[1].dueDate).toBe('2026-11-19');

      // Preserves prior done status if submissions fetch failed (status === null)
      saveAssignments([{ id: 'cw1', title: 'Zero Pts', status: 'done' }], 'stud@test.com');
      const synced = syncClassroomAssignments(result.assignments, 'stud@test.com');
      expect(synced.find(a => a.id === 'cw1').status).toBe('done');
    });

    it('aborts caller-cancelled httpClient requests immediately without retrying', async () => {
      const abortController = new AbortController();
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
        abortController.abort();
        return Promise.reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
      });

      await expect(
        httpClient.request('https://example.com/api', { signal: abortController.signal })
      ).rejects.toMatchObject({ name: 'AbortError' });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('Hooks & UI Reliability under React StrictMode and Real Interactions', () => {
    it('completes useExams fetch cleanly under React StrictMode and accepts studentIdHint', async () => {
      vi.spyOn(examRepository, 'getCachedExams').mockReturnValue({ success: false });
      vi.spyOn(examRepository, 'fetchExams').mockResolvedValue({
        success: true,
        data: { exams: [{ id: 'ex-99', courseCode: 'CS', courseName: 'OS', date: '20 Nov 2026' }], unlisted: null }
      });

      function StrictProbe() {
        const state = useExams('normal@kmutnb.ac.th', 'en', [], '6401012345678');
        return (
          <div>
            <span data-testid="strict-loading">{String(state.isFetching)}</span>
            <span data-testid="strict-count">{state.allExams.length}</span>
          </div>
        );
      }

      render(
        <StrictMode>
          <StrictProbe />
        </StrictMode>
      );

      await waitFor(() => {
        expect(screen.getByTestId('strict-loading').textContent).toBe('false');
      });
      expect(screen.getByTestId('strict-count').textContent).toBe('1');
    });

    it('renders ungraded points cleanly and sanitizes javascript: googleLink in AssignmentCard', () => {
      render(
        <MemoryRouter>
          <AssignmentCard
            assignment={{
              id: 'a1',
              title: 'Ungraded Task',
              course: 'Math 101',
              status: 'todo',
              points: null,
              dueDate: '',
              attachments: [],
              googleLink: 'javascript:alert(1)'
            }}
            onStatusChange={() => {}}
            lang="en"
            viewMode="grid"
          />
        </MemoryRouter>
      );

      expect(screen.getByText('Ungraded')).toBeInTheDocument();
      expect(screen.queryByText('Classroom')).not.toBeInTheDocument();
    });

    it('protects unsaved AssignmentDetail notes from being clobbered by background sync updates', () => {
      setActiveEmail('student@kmutnb.ac.th');
      saveProfile({ name: 'Student', email: 'student@kmutnb.ac.th' }, 'student@kmutnb.ac.th');

      const handleNotesChange = vi.fn();
      const baseClassroom = {
        assignments: [{
          id: 'assign-1', title: 'Draft Essay', course: 'ENG101', courseCode: 'ENG101',
          status: 'todo', points: 100, dueDate: '2026-12-01', notes: 'Initial synced note',
          attachments: [], description: 'Desc'
        }],
        courses: [{ id: 'c1', name: 'ENG101', code: 'ENG101', color: 'blue' }],
        resources: [], schedule: [], topics: [], isSyncing: false,
        handleStatusChange: vi.fn(), handleNotesChange, handleDueDateChange: vi.fn(),
        handleUpdateAssignment: vi.fn(), handleDeleteAssignment: vi.fn()
      };

      const { rerender } = render(
        <MemoryRouter initialEntries={['/assignments/assign-1']}>
          <AuthProvider>
            <SettingsProvider>
              <ClassroomContext.Provider value={baseClassroom}>
                <ClassroomUIContext.Provider value={{ visibleCourses: baseClassroom.courses, visibleAssignments: baseClassroom.assignments, visibleResources: [], hiddenCourseIds: [] }}>
                  <Routes>
                    <Route path="/assignments/:id" element={<AssignmentDetail />} />
                  </Routes>
                </ClassroomUIContext.Provider>
              </ClassroomContext.Provider>
            </SettingsProvider>
          </AuthProvider>
        </MemoryRouter>
      );

      const textarea = screen.getByLabelText(/Personal Notes/i);
      fireEvent.change(textarea, { target: { value: 'Unsaved user draft typing' } });

      // Simulate background sync arriving with older server notes while user is typing
      const updatedClassroom = {
        ...baseClassroom,
        assignments: [{ ...baseClassroom.assignments[0], notes: 'Stale server note from 60s poll' }]
      };
      rerender(
        <MemoryRouter initialEntries={['/assignments/assign-1']}>
          <AuthProvider>
            <SettingsProvider>
              <ClassroomContext.Provider value={updatedClassroom}>
                <ClassroomUIContext.Provider value={{ visibleCourses: updatedClassroom.courses, visibleAssignments: updatedClassroom.assignments, visibleResources: [], hiddenCourseIds: [] }}>
                  <Routes>
                    <Route path="/assignments/:id" element={<AssignmentDetail />} />
                  </Routes>
                </ClassroomUIContext.Provider>
              </ClassroomContext.Provider>
            </SettingsProvider>
          </AuthProvider>
        </MemoryRouter>
      );

      expect(screen.getByLabelText(/Personal Notes/i).value).toBe('Unsaved user draft typing');
    });

    it('opens Schedule modal with 09:00-10:00 (not NaN:NaN) via keyboard Enter and rejects endTime <= startTime', () => {
      setActiveEmail('student@kmutnb.ac.th');
      saveProfile({ name: 'Student', email: 'student@kmutnb.ac.th' }, 'student@kmutnb.ac.th');

      const onSaveSchedule = vi.fn();
      const classroomVal = {
        assignments: [], courses: [], resources: [], schedule: [], topics: [],
        handleSaveScheduleEntry: onSaveSchedule,
        handleDeleteScheduleEntry: vi.fn(),
        handleClearSchedule: vi.fn()
      };

      render(
        <MemoryRouter initialEntries={['/schedule']}>
          <AuthProvider>
            <SettingsProvider>
              <ClassroomContext.Provider value={classroomVal}>
                <ClassroomUIContext.Provider value={{ visibleCourses: [], visibleAssignments: [], visibleResources: [], hiddenCourseIds: [] }}>
                  <Schedule />
                </ClassroomUIContext.Provider>
              </ClassroomContext.Provider>
            </SettingsProvider>
          </AuthProvider>
        </MemoryRouter>
      );

      const monRow = screen.getByLabelText(/Monday timetable row/i);
      fireEvent.keyDown(monRow, { key: 'Enter' });

      expect(screen.getByDisplayValue('09:00')).toBeInTheDocument();
      expect(screen.getByDisplayValue('10:00')).toBeInTheDocument();

      fireEvent.change(screen.getByLabelText(/Start Time/i), { target: { value: '14:00' } });
      fireEvent.change(screen.getByLabelText(/End Time/i), { target: { value: '12:00' } });
      const titleInput = screen.getAllByRole('textbox')[0];
      fireEvent.change(titleInput, { target: { value: 'Algorithms' } });
      fireEvent.click(screen.getByText('Save'));

      expect(screen.getByRole('alert').textContent).toContain('End time must be after start time');
      expect(onSaveSchedule).not.toHaveBeenCalled();
    });

    it('completes ClassroomProvider auto-sync under React StrictMode and language switch without self-aborting', async () => {
      const email = 'strict@kmutnb.ac.th';
      setActiveEmail(email);
      saveToken('live-tok', 3600);
      saveProfile({ name: 'Strict Student', email }, email);
      localStorage.setItem(`classroom_hub_${email}_language`, 'th');

      vi.spyOn(syncManager, 'executeSync').mockResolvedValue(false);
      vi.spyOn(ClassroomService, 'fetchProfile').mockResolvedValue({
        name: 'Strict Student', studentId: '', email, major: '', avatarUrl: ''
      });
      const fetchClassroomSpy = vi.spyOn(ClassroomService, 'fetchClassroomData').mockResolvedValue({
        courses: [{ id: 'c1', name: 'Strict Course', code: 'SC1', instructor: 'Prof', color: 'blue' }],
        assignments: [{ id: 'a-strict', title: 'Strict Task', course: 'Strict Course', courseId: 'c1', status: 'todo' }],
        resources: [],
        topics: [],
        failedCourseIds: [],
        failedFeeds: { coursework: [], announcements: [], materials: [], topics: [] }
      });

      function ClassroomProbe() {
        const { courses, assignments, isSyncing } = useClassroom();
        return (
          <div>
            <span data-testid="ctx-syncing">{String(isSyncing)}</span>
            <span data-testid="ctx-courses">{courses.length}</span>
            <span data-testid="ctx-assigns">{assignments.length}</span>
          </div>
        );
      }

      render(
        <StrictMode>
          <AuthProvider>
            <SettingsProvider>
              <ToastProvider>
                <ClassroomProvider>
                  <ClassroomProbe />
                </ClassroomProvider>
              </ToastProvider>
            </SettingsProvider>
          </AuthProvider>
        </StrictMode>
      );

      await waitFor(() => {
        expect(screen.getByTestId('ctx-courses').textContent).toBe('1');
        expect(screen.getByTestId('ctx-syncing').textContent).toBe('false');
      });
      expect(screen.getByTestId('ctx-assigns').textContent).toBe('1');
      expect(fetchClassroomSpy).toHaveBeenCalled();
    });

    it('completes useExamRoom auto-fetch under React StrictMode without sticking in loading', async () => {
      const email = '6401012345678@email.kmutnb.ac.th';
      vi.spyOn(examRepository, 'getCachedExams').mockReturnValue({ success: false });
      vi.spyOn(examRepository, 'fetchExams').mockImplementation((_id, _lang, signal) => {
        return new Promise((resolve, reject) => {
          if (signal?.aborted) {
            return reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
          }
          signal?.addEventListener('abort', () => {
            reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
          });
          setTimeout(() => {
            resolve({
              success: true,
              data: { exams: [{ id: 'ex-1', courseCode: 'CS101', courseName: 'Network', date: '25 Nov 2026' }], unlisted: null }
            });
          }, 15);
        });
      });

      function ExamRoomProbe() {
        const { status, sortedExams } = useExamRoom(email, 'en', '6401012345678');
        return (
          <div>
            <span data-testid="er-status">{status}</span>
            <span data-testid="er-count">{sortedExams.length}</span>
          </div>
        );
      }

      render(
        <StrictMode>
          <ExamRoomProbe />
        </StrictMode>
      );

      await waitFor(() => {
        expect(screen.getByTestId('er-status').textContent).toBe('success');
      });
      expect(screen.getByTestId('er-count').textContent).toBe('1');
    });

    it('preserves statusUpdatedAt unmarking even when local edit updatedAt is newer than remote', () => {
      const localList = [{
        id: 't1',
        title: 'Lab',
        status: 'done',
        notes: 'Local edited note',
        updatedAt: '2026-11-18T12:00:00.000Z',
        statusUpdatedAt: '2026-11-18T08:00:00.000Z'
      }];
      const remoteList = [{
        id: 't1',
        title: 'Lab',
        status: 'todo',
        updatedAt: '2026-11-18T10:00:00.000Z',
        statusUpdatedAt: '2026-11-18T10:00:00.000Z'
      }];

      const merged = syncManager.mergeEntitiesById(localList, remoteList, false);
      expect(merged[0].status).toBe('todo');
      expect(merged[0].notes).toBe('Local edited note');
    });

    it('tracks granular announcement/topic feed failures in ClassroomService', async () => {
      vi.spyOn(GoogleRepository, 'fetchCourses').mockResolvedValueOnce([{ id: 'c1', name: 'Math', courseState: 'ACTIVE' }]);
      vi.spyOn(GoogleRepository, 'fetchCoursework').mockResolvedValueOnce([]);
      vi.spyOn(GoogleRepository, 'fetchSubmissions').mockResolvedValueOnce([]);
      vi.spyOn(GoogleRepository, 'fetchAnnouncements').mockRejectedValueOnce(new Error('500 fail'));
      vi.spyOn(GoogleRepository, 'fetchMaterials').mockResolvedValueOnce([{ id: 'm1', title: 'Slide 1' }]);
      vi.spyOn(GoogleRepository, 'fetchTopics').mockRejectedValueOnce(new Error('500 topics'));

      const res = await ClassroomService.fetchClassroomData('tok');
      expect(res.failedFeeds.announcements).toContain('c1');
      expect(res.failedFeeds.topics).toContain('c1');
      expect(res.failedFeeds.materials).toEqual([]);
      expect(res.resources).toHaveLength(1);
    });

    it('handles invalid ?day= param in Schedule daily view without crashing', () => {
      setActiveEmail('student@kmutnb.ac.th');
      saveProfile({ name: 'Student', email: 'student@kmutnb.ac.th' }, 'student@kmutnb.ac.th');

      const classroomVal = {
        assignments: [], courses: [], resources: [], schedule: [], topics: [],
        handleSaveScheduleEntry: vi.fn(),
        handleDeleteScheduleEntry: vi.fn(),
        handleClearSchedule: vi.fn()
      };

      expect(() => {
        render(
          <MemoryRouter initialEntries={['/schedule?view=daily&day=invalidday']}>
            <AuthProvider>
              <SettingsProvider>
                <ClassroomContext.Provider value={classroomVal}>
                  <ClassroomUIContext.Provider value={{ visibleCourses: [], visibleAssignments: [], visibleResources: [], hiddenCourseIds: [] }}>
                    <Schedule />
                  </ClassroomUIContext.Provider>
                </ClassroomContext.Provider>
              </SettingsProvider>
            </AuthProvider>
          </MemoryRouter>
        );
      }).not.toThrow();
    });

    it('never duplicates local manual/tracked assign-* tasks when coursework feed fails repeatedly', async () => {
      const email = 'nodup@kmutnb.ac.th';
      setActiveEmail(email);
      saveToken('tok-nodup', 3600);
      saveProfile({ name: 'No Dup', email }, email);
      saveAssignments([
        { id: 'assign-1700000001', title: 'Manual Lab', course: 'Math', courseId: 'c1', status: 'todo' },
        { id: 'cw-1', title: 'API Task', course: 'Math', courseId: 'c1', status: 'todo' }
      ], email);

      // Direct syncClassroomAssignments call must also deduplicate assign-* items
      const manualTask = { id: 'assign-1700000001', title: 'Manual Lab', course: 'Math', courseId: 'c1', status: 'todo' };
      const afterDirect = syncClassroomAssignments([manualTask, { id: 'cw-1', title: 'API Task', courseId: 'c1', status: 'todo' }], email);
      expect(afterDirect.filter(a => a.id === 'assign-1700000001')).toHaveLength(1);

      vi.spyOn(syncManager, 'executeSync').mockResolvedValue(false);
      vi.spyOn(ClassroomService, 'fetchProfile').mockResolvedValue({
        name: 'No Dup', studentId: '', email, major: '', avatarUrl: ''
      });
      vi.spyOn(ClassroomService, 'fetchClassroomData').mockResolvedValue({
        courses: [{ id: 'c1', name: 'Math', code: 'M1', instructor: 'Prof', color: 'blue' }],
        assignments: [],
        resources: [],
        topics: [],
        failedCourseIds: ['c1'],
        failedFeeds: { coursework: ['c1'], submissions: [], announcements: [], materials: [], topics: [] }
      });

      function Probe() {
        const { assignments, isSyncing } = useClassroom();
        return (
          <div>
            <span data-testid="nodup-syncing">{String(isSyncing)}</span>
            <span data-testid="nodup-manual">{assignments.filter(a => a.id === 'assign-1700000001').length}</span>
            <span data-testid="nodup-total">{assignments.length}</span>
          </div>
        );
      }

      render(
        <AuthProvider>
          <SettingsProvider>
            <ToastProvider>
              <ClassroomProvider>
                <Probe />
              </ClassroomProvider>
            </ToastProvider>
          </SettingsProvider>
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('nodup-syncing').textContent).toBe('false');
      });
      expect(screen.getByTestId('nodup-manual').textContent).toBe('1');
      expect(screen.getByTestId('nodup-total').textContent).toBe('2');
    });

    it('auto-fetches exams with real empty/expired examRepository cache while preserving manualExams', async () => {
      const email = '6401012345678@email.kmutnb.ac.th';
      setActiveEmail(email);
      localStorage.setItem(
        `${KEYS.exams}_${email}`,
        JSON.stringify({
          version: 2,
          timestamp: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
          data: {
            exams: [{ id: 'stale-ex', courseCode: 'OLD', courseName: 'Old Exam', date: '10 Nov 2026' }],
            manualExams: [{ id: 'man-1', courseCode: 'MAN1', courseName: 'Manual Exam', date: '28 Nov 2026', isManual: true }],
            unlisted: null
          }
        })
      );

      const fetchSpy = vi.spyOn(examRepository, 'fetchExams').mockResolvedValue({
        success: true,
        data: { exams: [{ id: 'fresh-ex', courseCode: 'CS202', courseName: 'Fresh Exam', date: '30 Nov 2026' }], unlisted: null }
      });

      function UseExamsProbe() {
        const { allExams, hasCheckedExams, isFetching } = useExams(email, 'en', []);
        return (
          <div>
            <span data-testid="ue-fetching">{String(isFetching)}</span>
            <span data-testid="ue-checked">{String(hasCheckedExams)}</span>
            <span data-testid="ue-ids">{allExams.map(e => e.id).join(',')}</span>
          </div>
        );
      }

      render(<UseExamsProbe />);

      await waitFor(() => {
        expect(screen.getByTestId('ue-fetching').textContent).toBe('false');
        expect(screen.getByTestId('ue-checked').textContent).toBe('true');
      });
      expect(fetchSpy).toHaveBeenCalledWith('6401012345678', 'en', expect.any(AbortSignal));
      expect(screen.getByTestId('ue-ids').textContent).toContain('fresh-ex');
      expect(screen.getByTestId('ue-ids').textContent).toContain('man-1');
      expect(screen.getByTestId('ue-ids').textContent).not.toContain('stale-ex');
    });

    it('defaults WeeklyGrid row click to 09:00-10:00 instead of NaN:NaN when rect width is 0', () => {
      setActiveEmail('student@kmutnb.ac.th');
      saveProfile({ name: 'Student', email: 'student@kmutnb.ac.th' }, 'student@kmutnb.ac.th');
      localStorage.setItem('classroom_hub_student@kmutnb.ac.th_language', 'en');

      const classroomVal = {
        assignments: [], courses: [], resources: [], schedule: [], topics: [],
        handleSaveScheduleEntry: vi.fn(),
        handleDeleteScheduleEntry: vi.fn(),
        handleClearSchedule: vi.fn()
      };

      render(
        <MemoryRouter initialEntries={['/schedule?view=weekly']}>
          <AuthProvider>
            <SettingsProvider>
              <ClassroomContext.Provider value={classroomVal}>
                <ClassroomUIContext.Provider value={{ visibleCourses: [], visibleAssignments: [], visibleResources: [], hiddenCourseIds: [] }}>
                  <Schedule />
                </ClassroomUIContext.Provider>
              </ClassroomContext.Provider>
            </SettingsProvider>
          </AuthProvider>
        </MemoryRouter>
      );

      const mondayRow = screen.getByLabelText(/Monday timetable row/i);
      fireEvent.click(mondayRow);

      expect(screen.getByLabelText('Start Time').value).toBe('09:00');
      expect(screen.getByLabelText('End Time').value).toBe('10:00');
    });
  });

  describe('Discord Webhook & 24/7 Google Apps Script Gauntlet Suite', () => {
    const validWebhook = 'https://discord.com/api/webhooks/123456789012345678/AbCdEfGhIjKlMnOpQrStUvWxYz_1234567890';

    it('strictly validates Discord Webhook URLs, strips untrusted query params, and masks tokens', () => {
      expect(DiscordService.validateWebhookUrl('').valid).toBe(false);
      expect(DiscordService.validateWebhookUrl('http://discord.com/api/webhooks/123456/abcdef123456').valid).toBe(false);
      expect(DiscordService.validateWebhookUrl('https://evil.com/api/webhooks/123456/abcdef123456').valid).toBe(false);
      expect(DiscordService.validateWebhookUrl('javascript:alert(1)').valid).toBe(false);
      expect(DiscordService.validateWebhookUrl('https://discord.com/channels/123/456').valid).toBe(false);

      const withThread = DiscordService.validateWebhookUrl(
        `${validWebhook}/?thread_id=9988776655&evil_param=inject`
      );
      expect(withThread.valid).toBe(true);
      expect(withThread.url).toBe(`${validWebhook}?thread_id=9988776655`);

      const masked = DiscordService.maskWebhookUrl(validWebhook);
      expect(masked).toContain('••••••••');
      expect(masked).not.toContain('AbCdEfGhIjKlMnOpQrStUvWxYz_1234567890');
    });

    it('clamps oversized Discord embeds and fields within strict API limits and strips unsafe URLs', () => {
      const hugeTitle = 'T'.repeat(500);
      const hugeDesc = 'D'.repeat(5000);
      const manyFields = Array.from({ length: 30 }, (_, i) => ({
        name: i === 0 ? '' : `Field ${i} ${'N'.repeat(300)}`,
        value: i === 0 ? '   ' : `Val ${i} ${'V'.repeat(1200)}`,
        inline: false
      }));

      const sanitized = DiscordService.sanitizePayload({
        username: 'U'.repeat(120),
        embeds: [{
          title: hugeTitle,
          description: hugeDesc,
          url: 'javascript:alert(1)',
          fields: manyFields
        }]
      });

      const embed = sanitized.embeds[0];
      expect(sanitized.username.length).toBeLessThanOrEqual(80);
      expect(embed.title.length).toBeLessThanOrEqual(DISCORD_LIMITS.maxTitleLen);
      expect(embed.description.length).toBeLessThanOrEqual(DISCORD_LIMITS.maxDescLen);
      expect(embed.url).toBeUndefined();
      expect(embed.fields[0].name).toBe('Item');
      expect(embed.fields[0].value).toBe('-');
      expect(embed.fields.length).toBeLessThanOrEqual(DISCORD_LIMITS.maxFields);
    });

    it('retries DiscordService.sendWebhook on HTTP 429 rate limit and surfaces clear errors on 400', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          json: async () => ({ retry_after: 0.01 })
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 204
        });

      const res = await DiscordService.sendWebhook(validWebhook, { content: 'Hello' }, { maxRetryWaitMs: 20 });
      expect(res.ok).toBe(true);
      expect(fetchSpy).toHaveBeenCalledTimes(2);

      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => JSON.stringify({ message: 'Invalid Form Body' })
      });

      await expect(
        DiscordService.sendWebhook(validWebhook, { content: 'Bad' })
      ).rejects.toThrow(/Discord Webhook Error \(400\): Invalid Form Body/);
    });

    it('delivers Discord-only deadline reminders and new-post digests when Gmail alerts are disabled, with deduplication', async () => {
      const email = 'discordonly@kmutnb.ac.th';
      const todayIso = new Date().toISOString();
      setEnableEmailAlerts(false, email);
      saveAlertSettings({
        discordEnabled: true,
        discordWebhookUrl: validWebhook,
        dueToday: true,
        newPosts: true
      }, email);

      const emailSpy = vi.spyOn(GoogleRepository, 'sendEmail').mockResolvedValue({});
      const webhookSpy = vi.spyOn(DiscordService, 'sendWebhook').mockResolvedValue({ ok: true, status: 204 });

      const assignments = [
        { id: 'hw-1', title: 'Discord Lab', course: 'OS', courseCode: 'CS301', status: 'todo', dueDate: todayIso }
      ];

      await NotificationService.evaluateNotifications('tok', email, assignments, [], []);
      expect(emailSpy).not.toHaveBeenCalled();
      expect(webhookSpy).toHaveBeenCalledTimes(1);
      expect(getSentNotifications(email).some(r => r.assignmentId === 'hw-1' && r.type === 'discord:due_today')).toBe(true);

      // Second run must NOT re-send the same Discord reminder
      await NotificationService.evaluateNotifications('tok', email, assignments, [], []);
      expect(webhookSpy).toHaveBeenCalledTimes(1);

      // Evaluate new posts for Discord-only mode
      await NotificationService.evaluateNewPostDigest(
        'tok',
        email,
        [{ id: 'post-1', title: 'New HW', course: 'OS' }],
        [{ id: 'ann-1', title: 'Exam Announcement', course: 'OS', type: 'announcement' }],
        [],
        []
      );
      expect(webhookSpy).toHaveBeenCalledTimes(2);

      // Re-running with identical diff must be deduplicated
      await NotificationService.evaluateNewPostDigest(
        'tok',
        email,
        [{ id: 'post-1', title: 'New HW', course: 'OS' }],
        [{ id: 'ann-1', title: 'Exam Announcement', course: 'OS', type: 'announcement' }],
        [],
        []
      );
      expect(webhookSpy).toHaveBeenCalledTimes(2);
    });

    it('executes generated Google Apps Script (testDiscordWebhook, debugDryRun, sendClassroomDigest, resetSentHistory) cleanly in a simulated GAS runtime', () => {
      const scriptCode = getAppsScriptTemplate(['course-hidden'], {
        discordWebhookUrl: validWebhook,
        enableDiscord: true,
        enableEmail: false,
        notifyNewPosts: true
      });

      const logs = [];
      const propStore = {};
      const fetchCalls = [];
      const emailCalls = [];
      let sleepCalls = 0;

      const dueSoon = new Date(Date.now() + 20 * 60 * 60 * 1000); // ~20 hours ahead (due_1d)
      const recentIso = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

      const mockEnv = {
        Logger: { log: (msg) => logs.push(String(msg)) },
        Session: { getActiveUser: () => ({ getEmail: () => 'student@kmutnb.ac.th' }) },
        PropertiesService: {
          getScriptProperties: () => ({
            getProperty: (k) => propStore[k] || null,
            setProperty: (k, v) => { propStore[k] = String(v); },
            deleteProperty: (k) => { delete propStore[k]; }
          })
        },
        Utilities: {
          formatDate: () => '19 Nov 14:00',
          sleep: () => { sleepCalls++; }
        },
        UrlFetchApp: {
          fetch: (url, opts) => {
            fetchCalls.push({ url, opts: { ...opts, payload: JSON.parse(opts.payload) } });
            // Simulate 429 on very first call to verify retry inside GAS
            if (fetchCalls.length === 1) {
              return {
                getResponseCode: () => 429,
                getContentText: () => JSON.stringify({ retry_after: 0.5 })
              };
            }
            return {
              getResponseCode: () => 204,
              getContentText: () => ''
            };
          }
        },
        MailApp: {
          sendEmail: (payload) => emailCalls.push(payload)
        },
        Classroom: {
          Courses: {
            list: () => ({
              courses: [
                { id: 'course-hidden', name: 'Hidden Course' },
                { id: 'course-active', name: 'Software Engineering' }
              ]
            }),
            CourseWork: {
              list: () => ({
                courseWork: [
                  {
                    id: 'cw-due',
                    title: 'Sprint Report',
                    maxPoints: 50,
                    alternateLink: 'https://classroom.google.com/c/1/a/2',
                    dueDate: {
                      year: dueSoon.getUTCFullYear(),
                      month: dueSoon.getUTCMonth() + 1,
                      day: dueSoon.getUTCDate()
                    },
                    dueTime: {
                      hours: dueSoon.getUTCHours(),
                      minutes: dueSoon.getUTCMinutes(),
                      seconds: 0
                    }
                  },
                  {
                    id: 'cw-done',
                    title: 'Already Turned In',
                    dueDate: {
                      year: dueSoon.getUTCFullYear(),
                      month: dueSoon.getUTCMonth() + 1,
                      day: dueSoon.getUTCDate()
                    },
                    dueTime: {
                      hours: dueSoon.getUTCHours(),
                      minutes: dueSoon.getUTCMinutes(),
                      seconds: 0
                    }
                  }
                ]
              }),
              StudentSubmissions: {
                list: (_cid, cwId) => ({
                  studentSubmissions: [{ state: cwId === 'cw-done' ? 'TURNED_IN' : 'CREATED' }]
                })
              }
            },
            Announcements: {
              list: () => ({
                announcements: [
                  { id: 'ann-99', text: 'Quiz on Friday!', creationTime: recentIso, alternateLink: 'https://classroom.google.com/c/1' }
                ]
              })
            }
          }
        }
      };

      const runner = new Function(
        'Logger', 'Session', 'PropertiesService', 'Utilities', 'UrlFetchApp', 'MailApp', 'Classroom',
        `${scriptCode}\nreturn { testDiscordWebhook, debugDryRun, sendClassroomDigest, resetSentHistory, CONFIG };`
      )(
        mockEnv.Logger,
        mockEnv.Session,
        mockEnv.PropertiesService,
        mockEnv.Utilities,
        mockEnv.UrlFetchApp,
        mockEnv.MailApp,
        mockEnv.Classroom
      );

      // 1. Dry Run must NOT send any webhook or mutate properties
      runner.debugDryRun();
      expect(fetchCalls).toHaveLength(0);
      expect(Object.keys(propStore)).toHaveLength(0);
      expect(logs.some(l => l.includes('Sprint Report'))).toBe(true);

      // 2. testDiscordWebhook retries on first 429 and succeeds on 2nd attempt
      runner.testDiscordWebhook();
      expect(fetchCalls).toHaveLength(2);
      expect(sleepCalls).toBe(1);
      expect(fetchCalls[1].url).toBe(validWebhook);

      // 3. sendClassroomDigest posts pending assignment + new announcement to Discord and records dedup state
      runner.sendClassroomDigest();
      expect(fetchCalls).toHaveLength(3);
      expect(emailCalls).toHaveLength(0); // enableEmail was false
      const digestPayload = fetchCalls[2].opts.payload;
      expect(digestPayload.embeds).toHaveLength(2); // 1 deadline embed + 1 announcement embed
      expect(JSON.stringify(digestPayload)).toContain('Sprint Report');
      expect(JSON.stringify(digestPayload)).not.toContain('Already Turned In');
      expect(JSON.stringify(digestPayload)).not.toContain('Hidden Course');

      // 4. Running sendClassroomDigest again immediately is deduplicated (no new webhook call)
      runner.sendClassroomDigest();
      expect(fetchCalls).toHaveLength(3);

      // 5. resetSentHistory clears dedup state so next run sends again
      runner.resetSentHistory();
      runner.sendClassroomDigest();
      expect(fetchCalls).toHaveLength(4);
    });

    it('renders Discord Webhook & Apps Script generator in Settings page, validates URLs live, and tests webhook', async () => {
      const email = 'student@kmutnb.ac.th';
      setActiveEmail(email);
      saveToken('tok-123', 3600);
      saveProfile({ name: 'Somchai', email }, email);
      saveHiddenCourses(['hidden-c1'], email);

      const webhookSpy = vi.spyOn(DiscordService, 'sendWebhook').mockResolvedValue({ ok: true, status: 204 });

      render(
        <MemoryRouter initialEntries={['/settings']}>
          <AuthProvider>
            <SettingsProvider>
              <ClassroomContext.Provider value={{ assignments: [{ id: 'a1', title: 'HW 1', course: 'Math', status: 'todo' }] }}>
                <Settings />
              </ClassroomContext.Provider>
            </SettingsProvider>
          </AuthProvider>
        </MemoryRouter>
      );

      expect(screen.getByTestId('discord-webhook-status').textContent).toMatch(/Not Configured|ยังไม่ตั้งค่า/);

      const webhookInput = screen.getByPlaceholderText(/https:\/\/discord\.com\/api\/webhooks/i);
      fireEvent.change(webhookInput, { target: { value: 'https://not-discord.com/webhook' } });
      expect(screen.getByTestId('discord-webhook-status').textContent).toMatch(/Invalid|ไม่ถูกต้อง/);

      fireEvent.change(webhookInput, { target: { value: validWebhook } });
      expect(screen.getByTestId('discord-webhook-status').textContent).toMatch(/Ready|พร้อมใช้งาน/);

      // Click Test Discord Webhook button
      const testBtn = screen.getByText(/Test Discord Webhook|ยิงข้อความทดสอบเข้า Discord/i);
      await act(async () => {
        fireEvent.click(testBtn);
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(screen.getByText(/Test message delivered to Discord successfully|ส่งข้อความทดสอบเข้า Discord สำเร็จแล้ว/i)).toBeInTheDocument();
      expect(webhookSpy).toHaveBeenCalledTimes(1);
      expect(webhookSpy.mock.calls[0][0]).toBe(validWebhook);
      expect(getNotificationHistory(email).some(h => h.type === 'test_discord')).toBe(true);

      // Open Code & Debug Guide preview
      const previewBtn = screen.getByText(/View Code & Debug Guide|ดูโค้ดและวิธีตั้งค่า/i);
      fireEvent.click(previewBtn);

      const codeArea = screen.getByLabelText(/Generated Google Apps Script Code|โค้ด Google Apps Script/i);
      // Security hardening: by default, webhook token stays out of generated Code.gs source (uses Script Properties)
      expect(codeArea.value).not.toContain(validWebhook);
      expect(codeArea.value).toContain('DISCORD_WEBHOOK_URL');
      expect(codeArea.value).toContain('"hidden-c1"');
      expect(codeArea.value).toContain('function testDiscordWebhook()');
      expect(codeArea.value).toContain('function debugDryRun()');
      expect(codeArea.value).toContain('function resetSentHistory()');

      // Opt-in toggle explicitly embeds the webhook URL when requested
      fireEvent.click(screen.getByTestId('embed-webhook-in-script-toggle'));
      expect(screen.getByLabelText(/Generated Google Apps Script Code|โค้ด Google Apps Script/i).value).toContain(validWebhook);
    });
  });
});
