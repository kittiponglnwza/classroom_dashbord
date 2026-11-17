import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  saveToken, getToken, clearToken, getTokenExpiry,
  getActiveEmail, setActiveEmail,
  getNotificationHistory, addNotificationHistoryLog,
  markNotificationRead, markAllNotificationsRead
} from '../../src/utils/storage';
import { STORAGE_CONFIG } from '../../src/config/storage';

const KEYS = STORAGE_CONFIG.keys;

describe('storage.js Auth Security', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  describe('Token Security (SessionStorage)', () => {
    it('should save token to sessionStorage, not localStorage', () => {
      saveToken('mock-token');
      expect(sessionStorage.getItem(KEYS.accessToken)).toBe('mock-token');
      expect(localStorage.getItem(KEYS.accessToken)).toBeNull();
    });

    it('should retrieve token from sessionStorage', () => {
      sessionStorage.setItem(KEYS.accessToken, 'mock-token');
      expect(getToken()).toBe('mock-token');
    });

    it('should clear token from sessionStorage', () => {
      sessionStorage.setItem(KEYS.accessToken, 'mock-token');
      clearToken();
      expect(sessionStorage.getItem(KEYS.accessToken)).toBeNull();
    });

    it('should track token expiration and evict expired tokens automatically', () => {
      vi.useFakeTimers();
      try {
        saveToken('short-lived-token', 600); // 10 minutes
        expect(getToken()).toBe('short-lived-token');
        expect(getTokenExpiry()).toBeGreaterThan(Date.now());

        // Advance past expiration (with 60s skew)
        vi.advanceTimersByTime(600 * 1000);
        expect(getToken()).toBeNull();
        expect(sessionStorage.getItem(KEYS.accessToken)).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('Email Persistence (LocalStorage)', () => {
    it('should save active email to localStorage in lowercase', () => {
      setActiveEmail(' TEST@Email.com ');
      expect(localStorage.getItem(KEYS.activeEmail)).toBe('test@email.com');
      expect(getActiveEmail()).toBe('test@email.com');
    });
  });

  describe('Notification Read / Unread Persistence', () => {
    it('defaults new logs to unread (read: false) and persists read state across reloads', () => {
      const email = 'student@kmutnb.ac.th';
      addNotificationHistoryLog({ title: 'Due Tomorrow: Lab 1', type: 'due_1_day' }, email);
      addNotificationHistoryLog({ title: 'Due Today: Quiz 2', type: 'due_today' }, email);

      const initial = getNotificationHistory(email);
      expect(initial).toHaveLength(2);
      expect(initial[0].read).toBe(false);
      expect(initial[1].read).toBe(false);

      markNotificationRead(initial[0].id, email, true);
      const afterSingleRead = getNotificationHistory(email);
      expect(afterSingleRead.find(l => l.id === initial[0].id).read).toBe(true);
      expect(afterSingleRead.find(l => l.id === initial[1].id).read).toBe(false);

      markAllNotificationsRead(email);
      const afterAllRead = getNotificationHistory(email);
      expect(afterAllRead.every(l => l.read === true)).toBe(true);
    });

    it('treats legacy logs without a read field as already read', () => {
      const email = 'legacy@kmutnb.ac.th';
      localStorage.setItem(
        `classroom_hub_notification_history_${email}`,
        JSON.stringify({
          version: 2,
          timestamp: new Date().toISOString(),
          data: [{ id: 'old-1', title: 'Old notification', type: 'due_today', sentAt: '2026-01-01T00:00:00Z' }]
        })
      );
      const history = getNotificationHistory(email);
      expect(history).toHaveLength(1);
      expect(history[0].read).toBe(true);
    });
  });
});
