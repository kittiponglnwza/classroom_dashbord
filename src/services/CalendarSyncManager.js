import { syncClassroomDataToCalendar, resetCalendarEvents } from './calendarSync';
import { examRepository } from '../repositories/examRepository';
import { getSchedule, getAssignments, getHiddenCourses } from '../utils/storage';
import { logger } from '../utils/logger';

const DEBOUNCE_MS = 1200;

class CalendarSyncManager {
  constructor() {
    this.timer = null;
    this.stateResetTimer = null;
    this.subscribers = new Set();
    this.state = 'idle'; // idle | queued | syncing | success | failed
    this.lastSyncedAt = null;
    this.lastError = null;
    this.syncChain = Promise.resolve();
    this.queuedArgs = null;
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    callback(this.state);
    return () => this.subscribers.delete(callback);
  }

  setState(newState) {
    if (this.state !== newState) {
      this.state = newState;
      this.subscribers.forEach(cb => cb(this.state));
    }
  }

  clearResetTimer() {
    if (this.stateResetTimer) {
      clearTimeout(this.stateResetTimer);
      this.stateResetTimer = null;
    }
  }

  cancel() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.clearResetTimer();
    this.queuedArgs = null;
    this.setState('idle');
  }

  /**
   * Queue a debounced calendar sync. Safe to call from anywhere data changes.
   */
  queueSync(accessToken, email) {
    if (!accessToken || !email) return;

    this.clearResetTimer();
    this.queuedArgs = { accessToken, email };
    this.setState('queued');
    if (this.timer) clearTimeout(this.timer);

    this.timer = setTimeout(() => {
      const args = this.queuedArgs;
      this.queuedArgs = null;
      this.timer = null;
      if (args) {
        this.runSync(args.accessToken, args.email).catch(err => {
          logger.error('[Calendar Sync] Background sync failed:', err);
        });
      }
    }, DEBOUNCE_MS);
  }

  /**
   * Serializes Calendar sync operations so two sync runs can never race and
   * create duplicate events on Google Calendar.
   */
  enqueue(taskFn) {
    const next = this.syncChain.catch(() => {}).then(taskFn);
    this.syncChain = next.catch(() => {});
    return next;
  }

  async runSync(accessToken, email) {
    if (!accessToken || !email) return;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
      this.queuedArgs = null;
    }
    this.clearResetTimer();

    return this.enqueue(async () => {
      this.lastError = null;
      this.setState('syncing');
      try {
        const lowerEmail = email.toLowerCase().trim();
        const schedule = getSchedule(lowerEmail) || [];
        const assignments = getAssignments(lowerEmail) || [];
        const hiddenCourses = getHiddenCourses(lowerEmail) || [];

        const examResult = examRepository.getCachedExams(lowerEmail);
        const exams = examResult.success ? (examResult.data.exams || []) : [];
        const manualExams = examResult.success ? (examResult.data.manualExams || []) : [];

        await syncClassroomDataToCalendar(accessToken, lowerEmail, {
          schedule,
          assignments,
          exams,
          manualExams,
          hiddenCourses
        });
        this.lastSyncedAt = new Date().toISOString();
        this.setState('success');
        this.clearResetTimer();
        this.stateResetTimer = setTimeout(() => {
          this.stateResetTimer = null;
          if (this.state === 'success') this.setState('idle');
        }, 3000);
      } catch (err) {
        this.lastError = err?.message || 'Calendar sync failed';
        this.setState('failed');
        this.clearResetTimer();
        this.stateResetTimer = setTimeout(() => {
          this.stateResetTimer = null;
          if (this.state === 'failed') this.setState('idle');
        }, 5000);
        throw err;
      }
    });
  }

  /**
   * Resets all synced calendar events (deletes them from the user's calendar),
   * and then triggers a fresh sync.
   */
  async resetAndSync(accessToken, email) {
    if (!accessToken || !email) return;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
      this.queuedArgs = null;
    }
    this.clearResetTimer();

    return this.enqueue(async () => {
      this.lastError = null;
      this.setState('syncing');
      try {
        const lowerEmail = email.toLowerCase().trim();
        await resetCalendarEvents(accessToken, lowerEmail);

        const schedule = getSchedule(lowerEmail) || [];
        const assignments = getAssignments(lowerEmail) || [];
        const hiddenCourses = getHiddenCourses(lowerEmail) || [];
        const examResult = examRepository.getCachedExams(lowerEmail);
        const exams = examResult.success ? (examResult.data.exams || []) : [];
        const manualExams = examResult.success ? (examResult.data.manualExams || []) : [];

        await syncClassroomDataToCalendar(accessToken, lowerEmail, {
          schedule,
          assignments,
          exams,
          manualExams,
          hiddenCourses
        });
        this.lastSyncedAt = new Date().toISOString();
        this.setState('success');
        this.clearResetTimer();
        this.stateResetTimer = setTimeout(() => {
          this.stateResetTimer = null;
          if (this.state === 'success') this.setState('idle');
        }, 3000);
      } catch (err) {
        this.lastError = err?.message || 'Calendar reset failed';
        this.setState('failed');
        this.clearResetTimer();
        this.stateResetTimer = setTimeout(() => {
          this.stateResetTimer = null;
          if (this.state === 'failed') this.setState('idle');
        }, 5000);
        throw err;
      }
    });
  }
}

export const calendarSyncManager = new CalendarSyncManager();
