import { describe, it, expect, beforeEach } from 'vitest';
import { saveToken, getToken, clearToken, getActiveEmail, setActiveEmail } from '../../src/utils/storage';
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
  });

  describe('Email Persistence (LocalStorage)', () => {
    it('should save active email to localStorage in lowercase', () => {
      setActiveEmail(' TEST@Email.com ');
      expect(localStorage.getItem(KEYS.activeEmail)).toBe('test@email.com');
      expect(getActiveEmail()).toBe('test@email.com');
    });
  });
});
