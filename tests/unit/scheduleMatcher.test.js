import { describe, it, expect } from 'vitest';
import { matchSchedulesAndExams } from '../../src/utils/scheduleMatcher';

describe('scheduleMatcher', () => {
  it('should return empty array if both inputs are empty', () => {
    expect(matchSchedulesAndExams([], [])).toEqual([]);
  });

  it('should return only regular classes if no exams', () => {
    const regular = [{ startTime: '09:00', endTime: '12:00' }];
    expect(matchSchedulesAndExams(regular, [])).toEqual(regular);
  });

  it('should return only exams if no regular classes', () => {
    const exams = [{ startTime: '13:00', endTime: '16:00' }];
    expect(matchSchedulesAndExams([], exams)).toEqual(exams);
  });

  it('should not filter regular classes if there is no conflict (different time and course)', () => {
    const regular = [{ courseCode: 'CS101', startTime: '09:00', endTime: '12:00' }];
    const exams = [{ courseCode: 'CS102', startTime: '13:00', endTime: '16:00' }];
    const result = matchSchedulesAndExams(regular, exams);
    expect(result).toHaveLength(2);
    expect(result[0].startTime).toBe('09:00'); // Sorted by time
    expect(result[1].startTime).toBe('13:00');
  });

  it('should filter regular class if courseCode matches exam', () => {
    const regular = [{ courseCode: 'CS101', startTime: '09:00', endTime: '12:00' }];
    const exams = [{ courseCode: 'cs101', startTime: '13:00', endTime: '16:00' }];
    const result = matchSchedulesAndExams(regular, exams);
    expect(result).toHaveLength(1);
    expect(result[0].courseCode).toBe('cs101'); // Only exam remains
  });

  it('should filter regular class if title matches exam', () => {
    const regular = [{ title: 'Math 1', startTime: '09:00', endTime: '12:00' }];
    const exams = [{ title: 'MATH 1', startTime: '13:00', endTime: '16:00' }];
    const result = matchSchedulesAndExams(regular, exams);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('MATH 1');
  });

  it('should filter regular class if time overlaps with exam', () => {
    const regular = [{ courseCode: 'CS101', startTime: '09:00', endTime: '12:00' }];
    const exams = [{ courseCode: 'CS102', startTime: '11:00', endTime: '14:00' }];
    const result = matchSchedulesAndExams(regular, exams);
    expect(result).toHaveLength(1); // Regular class is filtered out due to overlap
    expect(result[0].courseCode).toBe('CS102');
  });

  it('should filter regular class if exam is completely within regular class time', () => {
    const regular = [{ courseCode: 'CS101', startTime: '08:00', endTime: '15:00' }];
    const exams = [{ courseCode: 'CS102', startTime: '10:00', endTime: '12:00' }];
    const result = matchSchedulesAndExams(regular, exams);
    expect(result).toHaveLength(1);
    expect(result[0].courseCode).toBe('CS102');
  });

  it('should filter regular class if regular class is completely within exam time', () => {
    const regular = [{ courseCode: 'CS101', startTime: '10:00', endTime: '12:00' }];
    const exams = [{ courseCode: 'CS102', startTime: '08:00', endTime: '15:00' }];
    const result = matchSchedulesAndExams(regular, exams);
    expect(result).toHaveLength(1);
    expect(result[0].courseCode).toBe('CS102');
  });

  it('should not filter if time touches exactly but does not overlap', () => {
    const regular = [{ courseCode: 'CS101', startTime: '09:00', endTime: '12:00' }];
    const exams = [{ courseCode: 'CS102', startTime: '12:00', endTime: '15:00' }];
    const result = matchSchedulesAndExams(regular, exams);
    expect(result).toHaveLength(2); // Both remain
  });

  it('should sort the resulting array by startTime', () => {
    const regular = [{ courseCode: 'CS101', startTime: '14:00', endTime: '16:00' }];
    const exams = [{ courseCode: 'CS102', startTime: '09:00', endTime: '11:00' }];
    const result = matchSchedulesAndExams(regular, exams);
    expect(result[0].courseCode).toBe('CS102');
    expect(result[1].courseCode).toBe('CS101');
  });
});
