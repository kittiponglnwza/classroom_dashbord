import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider } from '../../src/contexts/AuthContext';
import { SettingsProvider } from '../../src/contexts/SettingsContext';
import { ToastProvider } from '../../src/contexts/ToastContext';
import { ClassroomProvider, useClassroom } from '../../src/contexts/ClassroomContext';
import { GoogleRepository } from '../../src/repositories/GoogleRepository';
import { ClassroomService } from '../../src/services/ClassroomService';
import { syncManager } from '../../src/services/SyncManager';
import { NotificationService } from '../../src/services/NotificationService';
import { httpClient } from '../../src/utils/httpClient';
import {
  setActiveEmail, saveToken, saveProfile, saveHiddenCourses,
  saveAssignments, saveResources, saveTopics
} from '../../src/utils/storage';

describe('Sync performance optimizations', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('requests pageSize=100 across GoogleRepository Classroom list endpoints', async () => {
    const reqSpy = vi.spyOn(httpClient, 'request').mockResolvedValue({});

    await GoogleRepository.fetchCourses('tok');
    await GoogleRepository.fetchCoursework('tok', 'c1');
    await GoogleRepository.fetchSubmissions('tok', 'c1');
    await GoogleRepository.fetchAnnouncements('tok', 'c1');
    await GoogleRepository.fetchMaterials('tok', 'c1');
    await GoogleRepository.fetchTopics('tok', 'c1');

    expect(reqSpy).toHaveBeenCalledTimes(6);
    for (const call of reqSpy.mock.calls) {
      expect(call[0]).toContain('pageSize=100');
    }
  });

  it('skips fetching feeds for hidden courses while preserving them in course list and supports onlyCourseIds', async () => {
    vi.spyOn(GoogleRepository, 'fetchCourses').mockResolvedValue([
      { id: 'c-visible', name: 'Algorithms', courseState: 'ACTIVE' },
      { id: 'c-hidden', name: 'Old Term', courseState: 'ACTIVE' },
    ]);
    const cwSpy = vi.spyOn(GoogleRepository, 'fetchCoursework').mockResolvedValue([
      { id: 'cw-1', title: 'HW 1' }
    ]);
    vi.spyOn(GoogleRepository, 'fetchSubmissions').mockResolvedValue([]);
    vi.spyOn(GoogleRepository, 'fetchAnnouncements').mockResolvedValue([]);
    vi.spyOn(GoogleRepository, 'fetchMaterials').mockResolvedValue([]);
    vi.spyOn(GoogleRepository, 'fetchTopics').mockResolvedValue([]);

    const res = await ClassroomService.fetchClassroomData('tok', {
      hiddenCourseIds: ['c-hidden']
    });

    expect(res.courses).toHaveLength(2);
    expect(res.skippedCourseIds).toEqual(['c-hidden']);
    expect(cwSpy).toHaveBeenCalledTimes(1);
    expect(cwSpy).toHaveBeenCalledWith('tok', 'c-visible', expect.any(Object));

    // Fetching only the newly unhidden course using knownCourses avoids extra fetchCourses call
    const coursesSpy = vi.spyOn(GoogleRepository, 'fetchCourses');
    const unhiddenRes = await ClassroomService.fetchClassroomData('tok', {
      onlyCourseIds: ['c-hidden'],
      knownCourses: res.courses
    });
    expect(coursesSpy).toHaveBeenCalledTimes(1); // still 1 total (not called again)
    expect(unhiddenRes.assignments[0].courseId).toBe('c-hidden');
  });

  it('starts profile, Drive, and Classroom in parallel, keeps skipped hidden cache, and does not block isSyncing on post-sync tasks', async () => {
    const email = 'fastsync@kmutnb.ac.th';
    setActiveEmail(email);
    saveToken('tok-fast', 3600);
    saveProfile({ name: 'Fast Student', email }, email);
    saveHiddenCourses(['c-hidden'], email);
    saveAssignments([
      { id: 'cw-hidden', title: 'Cached Hidden Task', course: 'Old Term', courseId: 'c-hidden', status: 'todo' }
    ], email);
    saveResources([
      { id: 'res-hidden', title: 'Old Slide', course: 'Old Term', courseId: 'c-hidden', type: 'material' }
    ], email);
    saveTopics([{ id: 't-hidden', courseId: 'c-hidden', name: 'Week 1' }], email);

    let classroomCalledBeforeDriveFinished = false;
    let resolveDrive;
    vi.spyOn(syncManager, 'executeSync').mockImplementation(
      () => new Promise((resolve) => { resolveDrive = resolve; })
    );
    vi.spyOn(syncManager, 'queueSync').mockImplementation(() => {});
    vi.spyOn(ClassroomService, 'fetchProfile').mockResolvedValue({
      name: 'Fast Student', studentId: '', email, major: '', avatarUrl: ''
    });
    vi.spyOn(ClassroomService, 'fetchClassroomData').mockImplementation(async (_tok, opts) => {
      // Because cachedEmail exists, Classroom fetch starts immediately without waiting for Drive!
      classroomCalledBeforeDriveFinished = true;
      expect(opts.hiddenCourseIds).toEqual(['c-hidden']);
      return {
        courses: [
          { id: 'c-vis', name: 'Algorithms', code: 'ALG', instructor: 'Prof', color: 'blue' },
          { id: 'c-hidden', name: 'Old Term', code: 'OLD', instructor: 'Prof', color: 'amber' }
        ],
        assignments: [{ id: 'cw-vis', title: 'Active HW', course: 'Algorithms', courseId: 'c-vis', status: 'todo' }],
        resources: [],
        topics: [],
        skippedCourseIds: ['c-hidden'],
        failedCourseIds: [],
        failedFeeds: { coursework: [], submissions: [], announcements: [], materials: [], topics: [] }
      };
    });

    // Post-sync NotificationService intentionally hangs forever; isSyncing must still finish!
    vi.spyOn(NotificationService, 'evaluateNotifications').mockReturnValue(new Promise(() => {}));
    vi.spyOn(NotificationService, 'evaluateNewPostDigest').mockReturnValue(new Promise(() => {}));

    function Probe() {
      const { courses, assignments, resources, isSyncing } = useClassroom();
      return (
        <div>
          <span data-testid="fast-syncing">{String(isSyncing)}</span>
          <span data-testid="fast-courses">{courses.length}</span>
          <span data-testid="fast-assigns">{assignments.map(a => a.id).join(',')}</span>
          <span data-testid="fast-res">{resources.map(r => r.id).join(',')}</span>
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
      expect(classroomCalledBeforeDriveFinished).toBe(true);
    });
    resolveDrive(false);

    await waitFor(() => {
      expect(screen.getByTestId('fast-syncing').textContent).toBe('false');
    });

    expect(screen.getByTestId('fast-courses').textContent).toBe('2');
    expect(screen.getByTestId('fast-assigns').textContent).toContain('cw-vis');
    expect(screen.getByTestId('fast-assigns').textContent).toContain('cw-hidden');
    expect(screen.getByTestId('fast-res').textContent).toContain('res-hidden');
  });
});
