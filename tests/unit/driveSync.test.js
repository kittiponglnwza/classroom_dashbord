import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getLocalSettingsPayload, syncSettingsWithDrive, clearDriveSyncCache } from '../../src/services/driveSync';
import { httpClient } from '../../src/utils/httpClient';
import { STORAGE_CONFIG } from '../../src/config/storage';

const KEYS = STORAGE_CONFIG.keys;

describe('driveSync', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    clearDriveSyncCache();
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

  describe('syncSettingsWithDrive metadata cache', () => {
    it('skips downloading alt=media when remote modifiedTime and local payload are unchanged', async () => {
      const email = 'fast@kmutnb.ac.th';
      const key = `${KEYS.assignments}_${email}`;
      localStorage.setItem(key, JSON.stringify({ data: [] }));

      const remotePayload = { [key]: JSON.stringify({ data: [] }) };
      const reqSpy = vi.spyOn(httpClient, 'request')
        // 1st sync: list -> download
        .mockResolvedValueOnce({ files: [{ id: 'file-1', modifiedTime: '2026-11-24T10:00:00.000Z' }] })
        .mockResolvedValueOnce({ payload: remotePayload })
        // 2nd sync: list only (unchanged modifiedTime + unchanged local)
        .mockResolvedValueOnce({ files: [{ id: 'file-1', modifiedTime: '2026-11-24T10:00:00.000Z' }] })
        // 3rd sync: list with newer modifiedTime -> downloads again
        .mockResolvedValueOnce({ files: [{ id: 'file-1', modifiedTime: '2026-11-24T10:01:00.000Z' }] })
        .mockResolvedValueOnce({ payload: remotePayload });

      const mergeCb = vi.fn((local) => local);

      await syncSettingsWithDrive('tok', email, mergeCb);
      expect(reqSpy).toHaveBeenCalledTimes(2);

      // 2nd sync hits fast path: only 1 metadata list call, no alt=media download
      await syncSettingsWithDrive('tok', email, mergeCb);
      expect(reqSpy).toHaveBeenCalledTimes(3);

      // 3rd sync sees changed modifiedTime -> downloads again
      await syncSettingsWithDrive('tok', email, mergeCb);
      expect(reqSpy).toHaveBeenCalledTimes(5);
    });
  });
});
