import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useExams } from '../../src/hooks/useExams';
import { examRepository } from '../../src/repositories/examRepository';
import { syncManager } from '../../src/services/SyncManager';
import { calendarSyncManager } from '../../src/services/CalendarSyncManager';
import { getToken } from '../../src/utils/storage';

vi.mock('../../src/repositories/examRepository');
vi.mock('../../src/services/SyncManager');
vi.mock('../../src/services/CalendarSyncManager');
vi.mock('../../src/utils/storage');

describe('useExams', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    sessionStorage.clear();
  });

  it('should initialize with empty cache and set isFetching to true if implicit ID exists', () => {
    examRepository.getCachedExams.mockReturnValue({ success: false });
    examRepository.fetchExams.mockReturnValue(new Promise(() => {})); // pending promise
    
    const { result } = renderHook(() => useExams('6401012345678@email.com', 'th', []));
    
    expect(result.current.allExams).toEqual([]);
    expect(result.current.hasCheckedExams).toBe(false);
    expect(result.current.isFetching).toBe(true);
  });

  it('should initialize with cached exams if they exist', () => {
    examRepository.getCachedExams.mockReturnValue({
      success: true,
      data: { exams: [{ id: '1' }], manualExams: [{ id: '2' }], unlisted: null }
    });
    
    const { result } = renderHook(() => useExams('6401012345678@email.com', 'th', []));
    
    expect(result.current.allExams).toEqual([{ id: '1' }, { id: '2' }]);
    expect(result.current.hasCheckedExams).toBe(true);
    expect(result.current.isFetching).toBe(false);
  });

  it('should fetch exams if implicit ID exists and not cached, and queue sync on success', async () => {
    examRepository.getCachedExams.mockReturnValue({ success: false });
    examRepository.fetchExams.mockResolvedValue({
      success: true,
      data: { exams: [{ id: 'new' }], unlisted: 'info' }
    });
    getToken.mockReturnValue('mock-token');

    const { result } = renderHook(() => useExams('6401012345678@email.com', 'th', []));

    // Initially fetching
    expect(result.current.isFetching).toBe(true);

    await waitFor(() => {
      expect(result.current.isFetching).toBe(false);
    });

    expect(examRepository.fetchExams).toHaveBeenCalledWith('6401012345678', 'th');
    expect(examRepository.saveToCache).toHaveBeenCalled();
    expect(syncManager.queueSync).toHaveBeenCalledWith('mock-token', '6401012345678@email.com');
    expect(calendarSyncManager.queueSync).toHaveBeenCalledWith('mock-token', '6401012345678@email.com');
    
    expect(result.current.allExams).toEqual([{ id: 'new' }]);
    expect(result.current.hasCheckedExams).toBe(true);
    expect(result.current.unlistedInfo).toBe('info');
    expect(sessionStorage.getItem('lastExamSearch')).toBe('6401012345678');
  });

  it('should handle fetch failure gracefully', async () => {
    examRepository.getCachedExams.mockReturnValue({ success: false });
    examRepository.fetchExams.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useExams('6401012345678@email.com', 'th', []));

    await waitFor(() => {
      expect(result.current.isFetching).toBe(false);
    });

    expect(result.current.hasCheckedExams).toBe(true); // Marked as checked to prevent infinite loops
    expect(result.current.allExams).toEqual([]);
  });

  it('should prevent duplicate fetch requests if fetchAttempted is true', () => {
    examRepository.getCachedExams.mockReturnValue({ success: false });
    examRepository.fetchExams.mockReturnValue(new Promise(() => {})); // pending promise
    
    const { rerender } = renderHook(() => useExams('6401012345678@email.com', 'th', []));
    
    // Rerender to simulate multiple mounting or state updates during fetch
    rerender();
    rerender();
    
    expect(examRepository.fetchExams).toHaveBeenCalledTimes(1); // Should only be called once
  });
});
