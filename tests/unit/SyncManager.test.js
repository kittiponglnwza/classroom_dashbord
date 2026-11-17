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

    it('unions sent_notifications across devices so neither device drops dedup records', () => {
      const email = 'test@email.com';
      const key = `classroom_hub_sent_notifications_${email}`;
      const local = {
        [key]: JSON.stringify({
          timestamp: '2026-01-02T00:00:00Z',
          data: [{ assignmentId: 'a-1', type: 'due_today', sentAt: '2026-01-02T00:00:00Z' }]
        })
      };
      const remote = {
        [key]: JSON.stringify({
          timestamp: '2026-01-01T00:00:00Z',
          data: [{ assignmentId: 'a-2', type: 'due_1_day', sentAt: '2026-01-01T00:00:00Z' }]
        })
      };

      const result = syncManager.mergePayloads(local, remote, email);
      const parsed = JSON.parse(result[key]);
      expect(parsed.data).toHaveLength(2);
      expect(parsed.data.map(r => r.assignmentId).sort()).toEqual(['a-1', 'a-2']);
    });

    it('unions notification_history by id and preserves read status across devices', () => {
      const email = 'test@email.com';
      const key = `classroom_hub_notification_history_${email}`;
      const local = {
        [key]: JSON.stringify({
          timestamp: '2026-01-01T00:00:00Z',
          data: [
            { id: 'log-1', title: 'Alert 1', sentAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', read: false },
            { id: 'log-2', title: 'Alert 2', sentAt: '2026-01-01T01:00:00Z', updatedAt: '2026-01-01T01:00:00Z', read: false }
          ]
        })
      };
      const remote = {
        [key]: JSON.stringify({
          timestamp: '2026-01-02T00:00:00Z',
          data: [
            { id: 'log-1', title: 'Alert 1', sentAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-02T00:00:00Z', read: true },
            { id: 'log-3', title: 'Alert 3', sentAt: '2026-01-02T00:00:00Z', updatedAt: '2026-01-02T00:00:00Z', read: false }
          ]
        })
      };

      const result = syncManager.mergePayloads(local, remote, email);
      const parsed = JSON.parse(result[key]);
      expect(parsed.data).toHaveLength(3);
      expect(parsed.data.find(l => l.id === 'log-1').read).toBe(true);
    });
  });
});
