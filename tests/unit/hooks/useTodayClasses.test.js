import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useTodayClasses } from '../../../src/hooks/useTodayClasses';
import { examRepository } from '../../../src/repositories/examRepository';

vi.mock('../../../src/repositories/examRepository', () => ({
  examRepository: {
    getCachedExams: vi.fn(),
  },
}));

vi.mock('../../../src/constants/dateConstants', () => ({
  JS_DAY_MAP: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
}));

describe('useTodayClasses', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Set system time to a known Monday
    vi.setSystemTime(new Date('2023-10-09T10:00:00Z')); // 2023-10-09 is Monday
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('filters today classes correctly from schedule', () => {
    examRepository.getCachedExams.mockReturnValue({ success: true, data: { exams: [], manualExams: [] } });

    const mockSchedule = [
      { id: 1, title: 'Math', day: 'Monday', startTime: '09:00', endTime: '10:00' },
      { id: 2, title: 'Science', day: 'Tuesday', startTime: '10:00', endTime: '11:00' },
      { id: 3, title: 'History', day: 'Monday', startTime: '11:00', endTime: '12:00' }
    ];

    const profile = { email: 'test@example.com' };

    const { result } = renderHook(() => useTodayClasses(mockSchedule, profile));

    // Should only return Monday classes
    expect(result.current).toHaveLength(2);
    expect(result.current[0].title).toBe('Math');
    expect(result.current[1].title).toBe('History');
  });
});

