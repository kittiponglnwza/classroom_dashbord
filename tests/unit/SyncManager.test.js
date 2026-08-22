import { describe, it, expect, vi, beforeEach } from 'vitest';
import { syncManager } from '../../src/services/SyncManager';
import { STORAGE_CONFIG } from '../../src/config/storage';

const KEYS = STORAGE_CONFIG.keys;

describe('SyncManager Merge Logic', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('mergeEntitiesById (LWW Conflict Resolution)', () => {
    it('should return empty array if both lists are empty', () => {
      expect(syncManager.mergeEntitiesById([], [], false)).toEqual([]);
    });

    it('should return local items if remote is empty', () => {
      const local = [{ id: '1', name: 'Task 1' }];
      expect(syncManager.mergeEntitiesById(local, [], false)).toEqual(local);
    });

    it('should return remote items if local is empty and local is NOT newer (simulate clean install)', () => {
      const remote = [{ id: '1', name: 'Task 1' }];
      expect(syncManager.mergeEntitiesById([], remote, false)).toEqual(remote);
    });

    it('should NOT return remote items if local is newer (simulate local deletion)', () => {
      const remote = [{ id: '1', name: 'Task 1' }];
      expect(syncManager.mergeEntitiesById([], remote, true)).toEqual([]);
    });

    it('should overwrite local item with remote item if remote updatedAt is newer', () => {
      const local = [{ id: '1', name: 'Task 1', updatedAt: '2023-01-01T00:00:00Z' }];
      const remote = [{ id: '1', name: 'Task 1 Updated', updatedAt: '2023-01-02T00:00:00Z' }];
      const result = syncManager.mergeEntitiesById(local, remote, false);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Task 1 Updated');
    });

    it('should keep local item if local updatedAt is newer', () => {
      const local = [{ id: '1', name: 'Task 1 Local Updated', updatedAt: '2023-01-02T00:00:00Z' }];
      const remote = [{ id: '1', name: 'Task 1 Remote', updatedAt: '2023-01-01T00:00:00Z' }];
      const result = syncManager.mergeEntitiesById(local, remote, false);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Task 1 Local Updated');
    });

    it('should preserve local "done" status even if remote is newer', () => {
      const local = [{ id: '1', name: 'Task 1', status: 'done', updatedAt: '2023-01-01T00:00:00Z' }];
      const remote = [{ id: '1', name: 'Task 1 Updated', status: 'pending', updatedAt: '2023-01-02T00:00:00Z' }];
      const result = syncManager.mergeEntitiesById(local, remote, false);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Task 1 Updated'); // Merged remote props
      expect(result[0].status).toBe('done'); // Preserved local done status
    });
  });

  describe('mergePayloads', () => {
    it('should merge remote string if local is null', () => {
      const result = syncManager.mergePayloads(null, { 'test_key': 'remoteValue' }, 'test@email.com');
      expect(result['test_key']).toBe('remoteValue');
    });

    it('should merge local string if remote is null', () => {
      const result = syncManager.mergePayloads({ 'test_key': 'localValue' }, null, 'test@email.com');
      expect(result['test_key']).toBe('localValue');
    });

    it('should handle assignments correctly based on timestamp', () => {
      const email = 'test@email.com';
      const key = `${KEYS.assignments}_${email}`;
      const local = { [key]: JSON.stringify({ timestamp: '2023-01-02T00:00:00Z', data: [{ id: '1', updatedAt: '2023-01-02T00:00:00Z' }] }) };
      const remote = { [key]: JSON.stringify({ timestamp: '2023-01-01T00:00:00Z', data: [{ id: '1', updatedAt: '2023-01-01T00:00:00Z', test: true }] }) };
      
      const result = syncManager.mergePayloads(local, remote, email);
      const parsed = JSON.parse(result[key]);
      expect(parsed.data).toHaveLength(1);
      expect(parsed.data[0].test).toBeUndefined(); // Local won, didn't merge older remote fields
    });

    it('should fallback to local if corrupted JSON', () => {
      const email = 'test@email.com';
      const key = `${KEYS.assignments}_${email}`;
      const local = { [key]: '{"timestamp":"2023-01-02T00:00:00Z","data":[]}' };
      const remote = { [key]: 'INVALID_JSON_HERE' };
      
      const result = syncManager.mergePayloads(local, remote, email);
      expect(result[key]).toBe(local[key]);
    });
  });
});
