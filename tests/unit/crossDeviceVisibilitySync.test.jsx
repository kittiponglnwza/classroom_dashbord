import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AuthContext } from '../../src/contexts/AuthContext';
import { SettingsProvider } from '../../src/contexts/SettingsContext';
import { ToastProvider } from '../../src/contexts/ToastContext';
import { ClassroomContext } from '../../src/contexts/ClassroomContext';
import { ClassroomUIProvider, useClassroomUI } from '../../src/contexts/ClassroomUIContext';
import { syncManager } from '../../src/services/SyncManager';
import { clearDriveSyncCache, getLocalSettingsPayload, syncSettingsWithDrive } from '../../src/services/driveSync';
import { STORAGE_CONFIG } from '../../src/config/storage';
import { httpClient } from '../../src/utils/httpClient';
import { setActiveEmail, saveToken, getHiddenCourses, savePinnedItems } from '../../src/utils/storage';

const KEYS = STORAGE_CONFIG.keys;
const EMAIL = 'student@email.kmutnb.ac.th';

function VisibilityProbe({ onToggleId = 'c2' }) {
  const { visibleCourses, hiddenCourseIds, pinnedItemIds, handleToggleCourseVisibility } = useClassroomUI();
  return (
    <div>
      <div data-testid="visible-ids">{visibleCourses.map((c) => c.id).join(',')}</div>
      <div data-testid="hidden-ids">{hiddenCourseIds.join(',')}</div>
      <div data-testid="pinned-ids">{pinnedItemIds.join(',')}</div>
      <button type="button" onClick={() => handleToggleCourseVisibility(onToggleId)}>
        Toggle Hide
      </button>
    </div>
  );
}

describe('Cross-device Hidden Courses & Pinned Items Drive Sync', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    localStorage.clear();
    sessionStorage.clear();
    clearDriveSyncCache();
    syncManager.cancel();
    syncManager.clearDirty(EMAIL);
  });

  afterEach(() => {
    vi.useRealTimers();
    syncManager.cancel();
    syncManager.clearDirty(EMAIL);
  });

  it('includes hiddenCourses and pinnedItems in Drive payloads and restores hidden courses on a fresh phone device', async () => {
    // Device 1 (PC): hides c2 and c3 leaving only c1, and pins a1
    const courses = [
      { id: 'c1', name: 'Only Active Course', code: 'CS101', color: 'blue' },
      { id: 'c2', name: 'Hidden Course 1', code: 'CS102', color: 'emerald' },
      { id: 'c3', name: 'Hidden Course 2', code: 'CS103', color: 'amber' },
    ];
    localStorage.setItem(
      `${KEYS.hiddenCourses}_${EMAIL}`,
      JSON.stringify({ version: 2, timestamp: '2026-11-24T10:00:00.000Z', data: ['c2', 'c3'] })
    );
    savePinnedItems(['a-pinned-1'], EMAIL);

    const pcPayload = getLocalSettingsPayload(EMAIL);
    expect(pcPayload[`${KEYS.hiddenCourses}_${EMAIL}`]).toBeDefined();
    expect(pcPayload[`${KEYS.pinnedItems}_${EMAIL}`]).toBeDefined();

    // Switch to Device 2 (Phone): clean localStorage, login with fresh session
    localStorage.clear();
    sessionStorage.clear();
    clearDriveSyncCache();
    setActiveEmail(EMAIL);
    saveToken('phone-tok', 3600);

    vi.spyOn(httpClient, 'request')
      .mockResolvedValueOnce({ files: [{ id: 'drive-sync-1', modifiedTime: '2026-11-24T10:00:05.000Z' }] })
      .mockResolvedValueOnce({ payload: pcPayload });

    const authValue = {
      accessToken: 'phone-tok',
      isLoggedIn: true,
      profile: { name: 'Student', email: EMAIL },
    };
    const classroomValue = {
      courses,
      assignments: [],
      resources: [],
      syncCourses: vi.fn(),
    };

    render(
      <MemoryRouter>
        <AuthContext.Provider value={authValue}>
          <SettingsProvider>
            <ToastProvider>
              <ClassroomContext.Provider value={classroomValue}>
                <ClassroomUIProvider>
                  <VisibilityProbe />
                </ClassroomUIProvider>
              </ClassroomContext.Provider>
            </ToastProvider>
          </SettingsProvider>
        </AuthContext.Provider>
      </MemoryRouter>
    );

    await act(async () => {
      await syncManager.executeSync('phone-tok', EMAIL);
    });

    expect(getHiddenCourses(EMAIL)).toEqual(['c2', 'c3']);
    expect(screen.getByTestId('hidden-ids').textContent).toBe('c2,c3');
    expect(screen.getByTestId('visible-ids').textContent).toBe('c1');
    expect(screen.getByTestId('pinned-ids').textContent).toBe('a-pinned-1');
  });

  it('flushes hidden course changes immediately when leaving tab/locking phone instead of losing 1s debounce', async () => {
    setActiveEmail(EMAIL);
    saveToken('pc-tok', 3600);

    const reqSpy = vi
      .spyOn(httpClient, 'request')
      .mockResolvedValueOnce({ files: [] })
      .mockResolvedValueOnce({ id: 'created-1', modifiedTime: '2026-11-24T10:05:00.000Z' });

    const courses = [
      { id: 'c1', name: 'Course 1', code: 'CS101', color: 'blue' },
      { id: 'c2', name: 'Course 2', code: 'CS102', color: 'emerald' },
    ];

    render(
      <MemoryRouter>
        <AuthContext.Provider value={{ accessToken: 'pc-tok', isLoggedIn: true, profile: { name: 'Student', email: EMAIL } }}>
          <SettingsProvider>
            <ToastProvider>
              <ClassroomContext.Provider value={{ courses, assignments: [], resources: [], syncCourses: vi.fn() }}>
                <ClassroomUIProvider>
                  <VisibilityProbe onToggleId="c2" />
                </ClassroomUIProvider>
              </ClassroomContext.Provider>
            </ToastProvider>
          </SettingsProvider>
        </AuthContext.Provider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Toggle Hide' }));
    expect(syncManager.isDirty(EMAIL)).toBe(true);
    expect(syncManager.state).toBe('queued');

    // Simulate user immediately closing browser / switching app on iPad/Phone before debounce fires
    await act(async () => {
      await syncManager.flush({ keepalive: true });
    });

    expect(reqSpy).toHaveBeenCalledTimes(2);
    expect(syncManager.isDirty(EMAIL)).toBe(false);
    expect(getHiddenCourses(EMAIL)).toEqual(['c2']);
  });

  it('reconciles duplicate sync files if two devices created separate files concurrently', async () => {
    localStorage.clear();
    const olderDupPayload = {
      [`${KEYS.hiddenCourses}_${EMAIL}`]: JSON.stringify({
        version: 2,
        timestamp: '2026-11-24T11:00:00.000Z',
        data: ['c2', 'c3'],
      }),
    };
    const newerEmptyPayload = {
      [`${KEYS.assignments}_${EMAIL}`]: JSON.stringify({ version: 2, timestamp: '2026-11-24T11:05:00.000Z', data: [] }),
    };

    vi.spyOn(httpClient, 'request')
      .mockResolvedValueOnce({
        files: [
          { id: 'file-newest', modifiedTime: '2026-11-24T11:05:00.000Z' },
          { id: 'file-older', modifiedTime: '2026-11-24T11:00:00.000Z' },
        ],
      })
      .mockResolvedValueOnce({ payload: newerEmptyPayload })
      .mockResolvedValueOnce({ payload: olderDupPayload })
      .mockResolvedValueOnce({ id: 'file-newest', modifiedTime: '2026-11-24T11:06:00.000Z' });

    await syncSettingsWithDrive('tok', EMAIL, (local, remote, em) => syncManager.mergePayloads(local, remote, em));

    expect(getHiddenCourses(EMAIL)).toEqual(['c2', 'c3']);
  });
});
