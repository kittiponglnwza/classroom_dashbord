import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getLocalSettingsPayload } from '../../src/services/driveSync';
import { STORAGE_CONFIG } from '../../src/config/storage';

const KEYS = STORAGE_CONFIG.keys;

describe('driveSync', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
  });

  describe('getLocalSettingsPayload', () => {
    it('should return empty object if no local data exists', () => {
      const result = getLocalSettingsPayload('test@email.com');
      expect(result).toEqual({});
    });

    it('should collect only keys scoped to the provided email', () => {
      localStorage.setItem(`${KEYS.assignments}_test@email.com`, 'data1');
      localStorage.setItem(`${KEYS.assignments}_other@email.com`, 'data2');
      localStorage.setItem(`classroom_hub_test@email.com_language`, 'th');
      localStorage.setItem(`classroom_hub_other@email.com_language`, 'en');

      const result = getLocalSettingsPayload('test@email.com');
      
      expect(result).toEqual({
        [`${KEYS.assignments}_test@email.com`]: 'data1',
        [`classroom_hub_test@email.com_language`]: 'th'
      });
    });

    it('should properly lower-case and trim the email before generating keys', () => {
      localStorage.setItem(`${KEYS.assignments}_test@email.com`, 'data1');
      const result = getLocalSettingsPayload(' TEST@email.com  ');
      expect(result).toEqual({
        [`${KEYS.assignments}_test@email.com`]: 'data1'
      });
    });
  });
});
