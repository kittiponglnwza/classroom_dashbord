import { syncClassroomDataToCalendar } from './calendarSync';
import { examRepository } from '../repositories/examRepository';
import { getSchedule, getAssignments } from '../utils/storage';
import { logger } from '../utils/logger';

const DEBOUNCE_MS = 4000;

class CalendarSyncManager {
  constructor() {
    this.timer = null;
    this.subscribers = new Set();
    this.state = 'idle'; // idle | queued | syncing | success | failed
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    callback(this.state);
    return () => this.subscribers.delete(callback);
  }

  setState(newState) {
    this.state = newState;
    this.subscribers.forEach(cb => cb(this.state));
  }

  /**
   * Queue a debounced calendar sync. Safe to call from anywhere data changes
   * (schedule edits, new exams, fresh assignments from Classroom, app open).
   */
  queueSync(accessToken, email) {
    if (!accessToken || !email) return;

    this.setState('queued');
    if (this.timer) clearTimeout(this.timer);

    this.timer = setTimeout(() => {
      this.runSync(accessToken, email).catch(err => {
        logger.error('[Calendar Sync] Background sync failed:', err);
      });
    }, DEBOUNCE_MS);
  }

  async runSync(accessToken, email) {
    this.setState('syncing');
    try {
      const lowerEmail = email.toLowerCase().trim();
      const schedule = getSchedule(lowerEmail) || [];
      const assignments = getAssignments(lowerEmail) || [];

      const examResult = examRepository.getCachedExams(lowerEmail);
      const exams = examResult.success ? (examResult.data.exams || []) : [];
      const manualExams = examResult.success ? (examResult.data.manualExams || []) : [];

      await syncClassroomDataToCalendar(accessToken, lowerEmail, { schedule, assignments, exams, manualExams });
      this.setState('success');
      setTimeout(() => { if (this.state === 'success') this.setState('idle'); }, 3000);
    } catch (err) {
      this.setState('failed');
      setTimeout(() => { if (this.state === 'failed') this.setState('idle'); }, 5000);
      throw err;
    }
  }
}

export const calendarSyncManager = new CalendarSyncManager();