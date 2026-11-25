import React, { useRef } from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthProvider, useAuth } from '../../src/contexts/AuthContext';
import { SettingsProvider, useSettings } from '../../src/contexts/SettingsContext';
import { ClassroomContext } from '../../src/contexts/ClassroomContext';
import { ClassroomUIContext } from '../../src/contexts/ClassroomUIContext';
import NotificationPopover from '../../src/components/NotificationPopover';
import HeaderBar from '../../src/components/HeaderBar';
import CookieConsentBanner from '../../src/components/CookieConsentBanner';
import App from '../../src/App';
import {
  getCookieConsent, clearCookieConsent, buildConsentCookieAttributes, saveCookieConsent
} from '../../src/utils/cookieConsent';
import { NotificationService } from '../../src/services/NotificationService';
import { GoogleRepository } from '../../src/repositories/GoogleRepository';
import { ClassroomService } from '../../src/services/ClassroomService';
import { examRepository } from '../../src/repositories/examRepository';
import { calendarSyncManager } from '../../src/services/CalendarSyncManager';
import { httpClient } from '../../src/utils/httpClient';
import { syncManager } from '../../src/services/SyncManager';
import {
  setActiveEmail, getActiveEmail, saveToken, saveProfile, saveAssignments,
  getSentNotifications, getNotificationHistory, saveDailyEmailLimit,
  addNotificationHistoryLog, setRememberMe, saveAcademicData, saveAlertSettings
} from '../../src/utils/storage';

vi.mock('../../src/services/googleClassroomClient', () => ({
  initGoogleClient: vi.fn()
}));

import { initGoogleClient } from '../../src/services/googleClassroomClient';

describe('Authentication Persistence & Consent Hints', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('preserves rememberedAccount across browser restarts (when sessionStorage is cleared) and clears it + revokes token + wipes localStorage on explicit logout', () => {
    const email = 'student@kmutnb.ac.th';
    setActiveEmail(email);
    saveProfile({ name: 'Somchai', email }, email);
    const revokeSpy = vi.fn((_tok, cb) => cb && cb());
    window.google = { accounts: { oauth2: { revoke: revokeSpy } } };

    let latestAuth;
    function Probe() {
      latestAuth = useAuth();
      return null;
    }

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );

    expect(latestAuth.isLoggedIn).toBe(false);
    expect(latestAuth.isCachedSession).toBe(true);
    expect(getActiveEmail()).toBe(email);
    expect(latestAuth.rememberedAccount?.email).toBe(email);
    expect(latestAuth.profile?.email).toBe(email);

    saveToken('active-oauth-token', 3600);
    act(() => {
      latestAuth.logout();
    });

    expect(revokeSpy).toHaveBeenCalledWith('active-oauth-token', expect.any(Function));
    expect(getActiveEmail()).toBe('');
    expect(latestAuth.rememberedAccount).toBeNull();
    expect(latestAuth.isCachedSession).toBe(false);
    expect(localStorage.getItem(`classroom_hub_profile_${email}`)).toBeNull();
  });

  it('shows Login screen with remembered account first before entering workspace, then auto-syncs upon sign-in', async () => {
    const email = 's6704062611115@email.kmutnb.ac.th';
    setRememberMe(true);
    setActiveEmail(email);
    saveProfile({ name: 'TopZ', email }, email);
    saveAssignments([
      { id: 'cached-1', title: 'Algorithm Lab 4', course: 'Algorithms', courseColor: 'blue', status: 'todo' }
    ], email);
    addNotificationHistoryLog({ title: 'Cached alert log', type: 'due_today' }, email);

    let capturedOnSuccess;
    const requestAccessToken = vi.fn(() => {
      capturedOnSuccess?.({ access_token: 'fresh-oauth-token', expires_in: 3600 });
    });
    window.google = { accounts: { oauth2: {} } };
    initGoogleClient.mockImplementation((onSuccess) => {
      capturedOnSuccess = onSuccess;
      return { requestAccessToken };
    });

    const fetchProfileSpy = vi.spyOn(ClassroomService, 'fetchProfile').mockResolvedValue({
      name: 'TopZ',
      studentId: '6704062611115',
      email,
      major: '',
      avatarUrl: ''
    });
    const fetchClassroomSpy = vi.spyOn(ClassroomService, 'fetchClassroomData').mockResolvedValue({
      courses: [{ id: 'c1', name: 'Algorithms', code: 'CS302', color: 'blue' }],
      assignments: [{ id: 'fresh-1', title: 'New Synced HW', course: 'Algorithms', courseId: 'c1', status: 'todo' }],
      resources: [],
      topics: [],
      failedCourseIds: [],
      skippedCourseIds: [],
      failedFeeds: {}
    });
    vi.spyOn(syncManager, 'executeSync').mockResolvedValue(false);
    vi.spyOn(syncManager, 'queueSync').mockImplementation(() => {});
    vi.spyOn(calendarSyncManager, 'queueSync').mockImplementation(() => {});
    vi.spyOn(examRepository, 'fetchExams').mockResolvedValue({ success: false, error: new Error('mocked') });

    window.history.pushState({}, '', '/');

    // 1. Opening app with remembered account but expired/missing sessionStorage token shows Sign-In gate FIRST
    const appView = render(<App />);
    expect(screen.getByText('TopZ')).toBeInTheDocument();
    expect(screen.getByText(email)).toBeInTheDocument();
    expect(screen.getByText('Saved')).toBeInTheDocument();
    const continueBtn = screen.getByRole('button', { name: /Continue with Google/i });
    expect(continueBtn).toBeInTheDocument();

    // Clicking signs in with remembered hint and auto-syncs
    await act(async () => {
      fireEvent.click(continueBtn);
      await new Promise((r) => setTimeout(r, 30));
    });

    expect(requestAccessToken).toHaveBeenCalledWith({
      prompt: '',
      login_hint: email
    });
    expect(await screen.findByText('Google Classroom Connected')).toBeInTheDocument();
    expect(fetchProfileSpy).toHaveBeenCalledWith('fresh-oauth-token', expect.any(Object));
    expect(fetchClassroomSpy).toHaveBeenCalledWith('fresh-oauth-token', expect.any(Object));
    appView.unmount();

    // 2. When Remember Me is unchecked across restarts, Sign-In screen forgets the previous account card
    setRememberMe(false);
    sessionStorage.clear();
    const freshView = render(<App />);
    expect(screen.getByRole('button', { name: /Connect Google Classroom/i })).toBeInTheDocument();
    expect(screen.queryByText('Saved')).not.toBeInTheDocument();
    freshView.unmount();
  });

  it('passes login_hint + empty prompt for remembered users and settles silent refresh when error_callback fires', async () => {
    vi.useFakeTimers();
    try {
      setActiveEmail('student@kmutnb.ac.th');
      saveProfile({ name: 'Somchai', email: 'student@kmutnb.ac.th' }, 'student@kmutnb.ac.th');

      let capturedOnError;
      const requestAccessToken = vi.fn();
      window.google = { accounts: { oauth2: {} } };
      initGoogleClient.mockImplementation((_onSuccess, onError) => {
        capturedOnError = onError;
        return { requestAccessToken };
      });

      let latestAuth;
      function Probe() {
        const auth = useAuth();
        latestAuth = auth;
        React.useEffect(() => auth.initClient('en'), [auth]);
        return null;
      }

      render(
        <AuthProvider>
          <Probe />
        </AuthProvider>
      );

      act(() => {
        vi.advanceTimersByTime(500);
      });

      act(() => {
        latestAuth.login();
      });
      expect(requestAccessToken).toHaveBeenCalledWith({
        prompt: '',
        login_hint: 'student@kmutnb.ac.th'
      });

      act(() => {
        latestAuth.login({ selectAccount: true });
      });
      expect(requestAccessToken).toHaveBeenLastCalledWith({
        prompt: 'select_account'
      });

      // Trigger silent refresh and simulate popup blocked via error_callback
      const refreshPromise = latestAuth.handleSilentRefresh();
      act(() => {
        capturedOnError({ error: 'popup_failed_to_open' });
      });
      await expect(refreshPromise).rejects.toThrow(/popup_failed_to_open/);
    } finally {
      vi.useRealTimers();
    }
  });

  it('expireSession drops the token but keeps rememberedAccount for one-click re-login', () => {
    setActiveEmail('student@kmutnb.ac.th');
    saveProfile({ name: 'Somchai', email: 'student@kmutnb.ac.th' }, 'student@kmutnb.ac.th');
    saveToken('live-token', 3600);

    let latestAuth;
    function Probe() {
      latestAuth = useAuth();
      return null;
    }

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );

    expect(latestAuth.isLoggedIn).toBe(true);
    act(() => {
      latestAuth.expireSession();
    });
    expect(latestAuth.isLoggedIn).toBe(false);
    expect(getActiveEmail()).toBe('student@kmutnb.ac.th');
    expect(latestAuth.rememberedAccount?.email).toBe('student@kmutnb.ac.th');
  });

  it('prevents cross-account Drive and Exam contamination when User B signs in while User A was remembered', async () => {
    const userA = 's6704062611115@email.kmutnb.ac.th';
    const userB = 's6704062699999@email.kmutnb.ac.th';
    setRememberMe(true);
    setActiveEmail(userA);
    saveProfile({ name: 'User A', email: userA, studentId: '6704062611115' }, userA);
    saveAssignments([{ id: 'a-1', title: 'User A Secret Task', course: 'CS', status: 'todo' }], userA);

    let capturedOnSuccess;
    const requestAccessToken = vi.fn(() => {
      capturedOnSuccess?.({ access_token: 'token-user-b', expires_in: 3600 });
    });
    window.google = { accounts: { oauth2: {} } };
    initGoogleClient.mockImplementation((onSuccess) => {
      capturedOnSuccess = onSuccess;
      return { requestAccessToken };
    });

    vi.spyOn(ClassroomService, 'fetchProfile').mockResolvedValue({
      name: 'User B',
      studentId: '6704062699999',
      email: userB,
      major: '',
      avatarUrl: ''
    });
    vi.spyOn(ClassroomService, 'fetchClassroomData').mockResolvedValue({
      courses: [],
      assignments: [],
      resources: [],
      topics: [],
      failedCourseIds: [],
      skippedCourseIds: [],
      failedFeeds: {}
    });
    const executeSyncSpy = vi.spyOn(syncManager, 'executeSync').mockResolvedValue(false);
    vi.spyOn(syncManager, 'queueSync').mockImplementation(() => {});
    vi.spyOn(calendarSyncManager, 'queueSync').mockImplementation(() => {});
    const fetchExamsSpy = vi.spyOn(examRepository, 'fetchExams').mockResolvedValue({
      success: false,
      error: new Error('mocked')
    });

    window.history.pushState({}, '', '/');
    const view = render(<App />);

    // User B clicks "Continue with Google" (or picks User B inside Google's chooser!)
    const continueBtn = screen.getByRole('button', { name: /Continue with Google/i });
    await act(async () => {
      fireEvent.click(continueBtn);
      await new Promise((r) => setTimeout(r, 40));
    });

    // CRITICAL: User B's token must NEVER be used to sync User A's Drive or fetch User A's exams
    expect(executeSyncSpy).not.toHaveBeenCalledWith('token-user-b', userA);
    expect(executeSyncSpy).toHaveBeenCalledWith('token-user-b', userB);
    expect(fetchExamsSpy).not.toHaveBeenCalledWith('6704062611115', expect.anything(), expect.anything());
    expect(fetchExamsSpy).toHaveBeenCalledWith('6704062699999', expect.anything(), expect.anything());
    expect(getActiveEmail()).toBe(userB);
    view.unmount();
  });

  it('rolls back unverified interactive sign-in to Sign-In gate if fetchProfile fails while another account was cached', async () => {
    const userA = 's6704062611115@email.kmutnb.ac.th';
    setRememberMe(true);
    setActiveEmail(userA);
    saveProfile({ name: 'User A', email: userA }, userA);

    let capturedOnSuccess;
    window.google = { accounts: { oauth2: {} } };
    initGoogleClient.mockImplementation((onSuccess) => {
      capturedOnSuccess = onSuccess;
      return {
        requestAccessToken: vi.fn(() => {
          capturedOnSuccess?.({ access_token: 'unverified-token', expires_in: 3600 });
        })
      };
    });

    vi.spyOn(ClassroomService, 'fetchProfile').mockRejectedValue(new Error('Network failure'));
    vi.spyOn(ClassroomService, 'fetchClassroomData').mockResolvedValue({
      courses: [], assignments: [], resources: [], topics: []
    });
    const executeSyncSpy = vi.spyOn(syncManager, 'executeSync').mockResolvedValue(false);

    window.history.pushState({}, '', '/');
    const view = render(<App />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Continue with Google/i }));
      await new Promise((r) => setTimeout(r, 40));
    });

    // Must return to Sign-In gate instead of exposing User A's workspace to an unverified token
    expect(screen.getByRole('button', { name: /Continue with Google/i })).toBeInTheDocument();
    expect(executeSyncSpy).not.toHaveBeenCalled();
    view.unmount();
  });

  it('scrubs cached grades, profile, and Discord webhook from localStorage when Remember Me is unchecked', () => {
    const email = 'labpc@email.kmutnb.ac.th';
    setRememberMe(true);
    setActiveEmail(email);
    saveProfile({ name: 'Lab User', email, studentId: '6704062611115' }, email);
    saveAcademicData({ semesters: [{ id: '1/2568', courses: [{ code: 'CS101', grade: 'A' }] }], enrolledCourses: [] }, email);
    saveAlertSettings({ discordWebhookUrl: 'https://discord.com/api/webhooks/123456789012345678/secretTokenAbc123' }, email);

    let latestAuth;
    function Probe() {
      latestAuth = useAuth();
      return null;
    }

    const view = render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );

    expect(localStorage.getItem(`classroom_hub_academic_${email}`)).not.toBeNull();
    expect(localStorage.getItem(`classroom_hub_alert_settings_${email}`)).not.toBeNull();

    act(() => {
      latestAuth.handleRememberMeChange(false);
    });

    expect(getActiveEmail()).toBe('');
    expect(localStorage.getItem(`classroom_hub_academic_${email}`)).toBeNull();
    expect(localStorage.getItem(`classroom_hub_alert_settings_${email}`)).toBeNull();
    expect(localStorage.getItem(`classroom_hub_profile_${email}`)).toBeNull();
    view.unmount();
  });
});

describe('Notification System Deduplication, Quota & Read/Unread UI', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('persists sent records immediately after each email so a mid-loop failure never duplicates earlier emails', async () => {
    const email = 'student@kmutnb.ac.th';
    const todayIso = new Date().toISOString();
    const assignments = [
      { id: 'task-1', title: 'Task 1', course: 'CS101', courseCode: 'CS101', status: 'todo', dueDate: todayIso },
      { id: 'task-2', title: 'Task 2', course: 'CS101', courseCode: 'CS101', status: 'todo', dueDate: todayIso }
    ];

    const sendSpy = vi.spyOn(GoogleRepository, 'sendEmail')
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error('Transient SMTP error'))
      .mockResolvedValue({});

    await expect(
      NotificationService.evaluateNotifications('token', email, assignments, [], [])
    ).rejects.toThrow('Transient SMTP error');

    // Task 1 was already sent and must be recorded durably despite Task 2 throwing
    const sentAfterFirstRun = getSentNotifications(email);
    expect(sentAfterFirstRun.some(r => r.assignmentId === 'task-1' && r.type === 'due_today')).toBe(true);
    expect(sentAfterFirstRun.some(r => r.assignmentId === 'task-2' && r.type === 'due_today')).toBe(false);

    // Second run must only send Task 2 (not Task 1 again)
    await NotificationService.evaluateNotifications('token', email, assignments, [], []);
    expect(sendSpy).toHaveBeenCalledTimes(3); // 1 (task-1) + 1 (failed task-2) + 1 (retried task-2)
  });

  it('enforces the daily email limit without marking suppressed reminders as sent', async () => {
    const email = 'student@kmutnb.ac.th';
    const todayIso = new Date().toISOString();
    const assignments = [
      { id: 'task-quota', title: 'Quota Task', course: 'CS101', courseCode: 'CS101', status: 'todo', dueDate: todayIso }
    ];

    saveDailyEmailLimit({ lastSentDate: NotificationService.localDateStamp(), count: 10 }, email);
    const sendSpy = vi.spyOn(GoogleRepository, 'sendEmail').mockResolvedValue({});

    await NotificationService.evaluateNotifications('token', email, assignments, [], []);
    expect(sendSpy).not.toHaveBeenCalled();
    expect(getSentNotifications(email)).toHaveLength(0);

    // Once quota is available again, the deferred reminder is sent
    saveDailyEmailLimit({ lastSentDate: NotificationService.localDateStamp(), count: 9 }, email);
    await NotificationService.evaluateNotifications('token', email, assignments, [], []);
    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(getSentNotifications(email).some(r => r.assignmentId === 'task-quota')).toBe(true);
  });

  it('serializes concurrent evaluateNewPostDigest calls so identical diffs never send duplicate emails', async () => {
    const email = 'student@kmutnb.ac.th';
    const freshAssignments = [
      { id: 'new-1', title: 'New Assignment', course: 'CS101', courseColor: 'blue' }
    ];
    const sendSpy = vi.spyOn(GoogleRepository, 'sendEmail').mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve({}), 20))
    );

    await Promise.all([
      NotificationService.evaluateNewPostDigest('token', email, freshAssignments, [], [], []),
      NotificationService.evaluateNewPostDigest('token', email, freshAssignments, [], [], [])
    ]);

    expect(sendSpy).toHaveBeenCalledTimes(1);
  });

  it('renders unread count in NotificationPopover and persists Read / Mark-all-as-read state', () => {
    const email = 'student@kmutnb.ac.th';
    setActiveEmail(email);
    saveToken('valid-token', 3600);
    saveProfile({ name: 'Somchai', email }, email);

    addNotificationHistoryLog({ title: 'Reminder A', type: 'due_today' }, email);
    addNotificationHistoryLog({ title: 'Reminder B', type: 'due_1_day' }, email);

    function Harness() {
      const bellRef = useRef(null);
      const { unreadCount } = useSettings();
      return (
        <div>
          <span data-testid="harness-unread">{unreadCount}</span>
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

    expect(screen.getByTestId('harness-unread').textContent).toBe('2');
    expect(screen.getByTestId('notification-unread-counter').textContent).toContain('2');

    // Click first notification to mark it read
    fireEvent.click(screen.getByText('Reminder A'));
    expect(screen.getByTestId('harness-unread').textContent).toBe('1');
    expect(getNotificationHistory(email).filter(l => !l.read)).toHaveLength(1);

    // Click Mark all as read
    fireEvent.click(screen.getByText('Mark all as read'));
    expect(screen.getByTestId('harness-unread').textContent).toBe('0');
    expect(getNotificationHistory(email).every(l => l.read)).toBe(true);
  });
});

describe('Cookie Consent Banner & Consent Management', () => {
  beforeEach(() => {
    clearCookieConsent();
    sessionStorage.clear();
    localStorage.clear();
  });

  it('persists Accept All in both Cookie and Storage and does not re-render banner after refresh or browser restart', () => {
    const { unmount } = render(<CookieConsentBanner />);
    expect(screen.getByTestId('cookie-consent-banner')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Accept All'));
    expect(screen.queryByTestId('cookie-consent-banner')).toBeNull();

    const stored = getCookieConsent();
    expect(stored?.status).toBe('accepted_all');
    expect(stored?.necessary).toBe(true);
    expect(stored?.preferences).toBe(true);
    expect(stored?.analytics).toBe(true);

    // Simulate page refresh / browser restart
    unmount();
    render(<CookieConsentBanner />);
    expect(screen.queryByTestId('cookie-consent-banner')).toBeNull();
  });

  it('supports Reject Optional (purging non-essential cookies) and Customize Preferences', () => {
    document.cookie = '_ga_test=12345; Path=/';
    const { unmount } = render(<CookieConsentBanner />);

    fireEvent.click(screen.getByText('Reject Optional'));
    expect(screen.queryByTestId('cookie-consent-banner')).toBeNull();
    expect(getCookieConsent()?.status).toBe('rejected_optional');
    expect(getCookieConsent()?.analytics).toBe(false);
    expect(document.cookie.includes('_ga_test=12345')).toBe(false);

    unmount();
    clearCookieConsent();

    render(<CookieConsentBanner />);
    fireEvent.click(screen.getByText('Customize'));
    expect(screen.getByTestId('cookie-customize-panel')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Save Preferences'));
    expect(getCookieConsent()?.status).toBe('custom');
    expect(screen.queryByTestId('cookie-consent-banner')).toBeNull();
  });

  it('includes Path=/, Max-Age, Expires, SameSite=Lax, and Secure on HTTPS', () => {
    const httpAttrs = buildConsentCookieAttributes(3600, 'http:');
    expect(httpAttrs).toContain('Path=/');
    expect(httpAttrs).toContain('Max-Age=3600');
    expect(httpAttrs).toContain('SameSite=Lax');
    expect(httpAttrs).not.toContain('Secure');

    const httpsAttrs = buildConsentCookieAttributes(3600, 'https:');
    expect(httpsAttrs).toContain('Secure');
  });

  it('re-synchronizes consent when one store is cleared and blocks language persistence when preferences=false', () => {
    saveCookieConsent({ preferences: false, analytics: false, status: 'rejected_optional' });
    // Clear localStorage only; cookie should restore it
    localStorage.removeItem('classroom_hub_cookie_consent');
    const restored = getCookieConsent();
    expect(restored?.status).toBe('rejected_optional');
    expect(localStorage.getItem('classroom_hub_cookie_consent')).not.toBeNull();

    let latestSettings;
    function SettingsProbe() {
      latestSettings = useSettings();
      return null;
    }
    render(
      <AuthProvider>
        <SettingsProvider>
          <SettingsProbe />
        </SettingsProvider>
      </AuthProvider>
    );
    act(() => {
      latestSettings.toggleLang();
    });
    expect(localStorage.getItem('classroom_hub_language')).toBeNull();
  });
});

describe('HttpClient 401 Silent Refresh, HeaderBar Badge & Digest Services', () => {
  beforeEach(() => {
    clearCookieConsent();
    sessionStorage.clear();
    localStorage.clear();
    setRememberMe(true);
    vi.restoreAllMocks();
  });

  it('retries 401 request after silentRefresh succeeds and triggers expire callback when silentRefresh fails', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({ ok: false, status: 401, text: async () => 'Unauthorized' })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ success: true }) });

    const refreshFn = vi.fn().mockResolvedValue('refreshed-token');
    const logoutFn = vi.fn();
    httpClient.registerCallbacks(refreshFn, logoutFn);

    const res = await httpClient.request('https://classroom.googleapis.com/v1/courses', {
      headers: { Authorization: 'Bearer expired-token' }
    });
    expect(res).toEqual({ success: true });
    expect(refreshFn).toHaveBeenCalledTimes(1);
    expect(logoutFn).not.toHaveBeenCalled();
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    // Now test when silent refresh fails
    fetchSpy.mockResolvedValueOnce({ ok: false, status: 401, text: async () => 'Unauthorized' });
    refreshFn.mockRejectedValueOnce(new Error('Refresh failed'));
    await expect(
      httpClient.request('https://classroom.googleapis.com/v1/courses', {})
    ).rejects.toThrow(/Session expired/);
    expect(logoutFn).toHaveBeenCalledTimes(1);
  });

  it('does not retain rememberedAccount on expireSession when Remember Me is unchecked', () => {
    setRememberMe(false);
    setActiveEmail('ephemeral@kmutnb.ac.th');
    saveToken('temp-token', 3600);

    let latestAuth;
    function Probe() {
      latestAuth = useAuth();
      return null;
    }

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );

    expect(latestAuth.isLoggedIn).toBe(true);
    act(() => {
      latestAuth.expireSession();
    });
    expect(latestAuth.isLoggedIn).toBe(false);
    expect(latestAuth.rememberedAccount).toBeNull();
    expect(getActiveEmail()).toBe('');
  });

  it('renders HeaderBar unread badge matching unread notifications and executes manual/test digests', async () => {
    const email = 'student@kmutnb.ac.th';
    setActiveEmail(email);
    saveToken('valid-token', 3600);
    saveProfile({ name: 'Somchai', email }, email);
    addNotificationHistoryLog({ title: 'Unread 1', type: 'due_today' }, email);

    render(
      <AuthProvider>
        <SettingsProvider>
          <ClassroomContext.Provider value={{ isSyncing: false, lastSyncTime: null, syncClassroom: vi.fn(), assignments: [] }}>
            <ClassroomUIContext.Provider value={{ visibleAssignments: [{ id: '1', status: 'todo', dueDate: '2020-01-01T00:00:00Z' }] }}>
              <HeaderBar setMobileMenuOpen={vi.fn()} />
            </ClassroomUIContext.Provider>
          </ClassroomContext.Provider>
        </SettingsProvider>
      </AuthProvider>
    );

    expect(screen.getByTestId('notification-unread-badge').textContent).toBe('1');

    const sendSpy = vi.spyOn(GoogleRepository, 'sendEmail').mockResolvedValue({});
    await act(async () => {
      await NotificationService.triggerTestEmail('valid-token', email);
      await NotificationService.triggerManualDigest('valid-token', email, [
        { id: 't-1', title: 'Lab', course: 'CS101', courseColor: 'blue', status: 'todo', dueDate: '2026-12-01' }
      ]);
    });
    expect(sendSpy).toHaveBeenCalledTimes(2);

    // Verify SyncManager merges daily email limits using max count on same date
    const mergedSameDay = syncManager.mergeDailyEmailLimit(
      { lastSentDate: '2026-11-17', count: 2 },
      { lastSentDate: '2026-11-17', count: 5 }
    );
    expect(mergedSameDay).toEqual({ lastSentDate: '2026-11-17', count: 5 });
  });
});


