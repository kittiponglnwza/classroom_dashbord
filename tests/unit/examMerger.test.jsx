import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { mergeExamSources, normalizeExamCode, isSameExamSlot } from '../../src/utils/examMerger';
import { syncClassroomDataToCalendar } from '../../src/services/calendarSync';
import { httpClient } from '../../src/utils/httpClient';
import ExamRoom from '../../src/pages/ExamRoom';
import { AuthProvider } from '../../src/contexts/AuthContext';
import { SettingsProvider } from '../../src/contexts/SettingsContext';
import { examRepository } from '../../src/repositories/examRepository';
import { setActiveEmail, saveToken, saveProfile } from '../../src/utils/storage';

describe('Exam Source Reconciliation (Student ID SciBase vs KMUTNB Reg)', () => {
  const email = 's6704062611115@email.kmutnb.ac.th';

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('matches 8-digit SciBase course codes with 9-digit leading-zero Reg course codes on the same date', () => {
    expect(normalizeExamCode({ courseCode: '040613203' })).toBe('40613203');
    expect(normalizeExamCode({ courseCode: '40613203' })).toBe('40613203');
    expect(normalizeExamCode({ courseCode: 'CLASSROOM' })).toBe('');

    const sciEx = {
      id: 'exam-40613203-15_มค_2570-09001200-0',
      courseCode: '40613203',
      courseName: 'STRUCTURED PROGRAMMING',
      date: '15 ม.ค. 2570',
      time: '09:00-12:00',
      room: '78-621 (อาคาร 78, ชั้น 6)',
      seat: 'แถว A ที่นั่ง 12',
    };
    const regEx = {
      id: 'reg-exam-040613203-midterm-2027-01-15',
      courseCode: '040613203',
      courseName: 'Structured Programming (Midterm)',
      date: '15 ม.ค. 2570',
      rawIsoDate: '2027-01-15',
      time: '09:00-12:00',
      room: '',
      seat: '',
      examType: 'midterm',
      isManual: true,
      source: 'kmutnb-reg',
    };

    expect(isSameExamSlot(sciEx, regEx)).toBe(true);

    const { exams, stats } = mergeExamSources([sciEx], [regEx], { todayIso: '2026-11-20' });
    expect(exams).toHaveLength(1);
    expect(stats.mergedSeatingCount).toBe(1);
    expect(stats.ignoredStaleSciBaseCount).toBe(0);
    expect(exams[0]).toMatchObject({
      id: 'reg-exam-040613203-midterm-2027-01-15',
      courseCode: '040613203',
      courseName: 'Structured Programming (Midterm)',
      examType: 'midterm',
      room: '78-621 (อาคาร 78, ชั้น 6)',
      seat: 'แถว A ที่นั่ง 12',
      seatingSynced: true,
    });
  });

  it('ignores stale previous-semester SciBase exams (including retaken courses) when current KMUTNB Reg exams exist', () => {
    const staleSciBase = [
      {
        id: 'exam-040613203-12_ตค_2569-09001200-0',
        courseCode: '040613203',
        courseName: 'STRUCTURED PROGRAMMING (OLD TERM)',
        date: '12 ต.ค. 2569',
        time: '09:00-12:00',
        room: '78-501',
        seat: 'แถว B ที่นั่ง 4',
      },
      {
        id: 'exam-040613105-14_ตค_2569-13001600-1',
        courseCode: '040613105',
        courseName: 'NUMERICAL METHOD',
        date: '14 ต.ค. 2569',
        time: '13:00-16:00',
        room: '78-502',
        seat: 'แถว C ที่นั่ง 8',
      },
    ];

    const currentReg = [
      {
        id: 'reg-exam-040613203-midterm-2027-01-15',
        courseCode: '040613203',
        courseName: 'Structured Programming (Midterm)',
        date: '15 ม.ค. 2570',
        rawIsoDate: '2027-01-15',
        time: '09:00-12:00',
        room: '',
        seat: '',
        examType: 'midterm',
        isManual: true,
        source: 'kmutnb-reg',
      },
      {
        id: 'reg-exam-040613203-final-2027-03-17',
        courseCode: '040613203',
        courseName: 'Structured Programming (Final)',
        date: '17 มี.ค. 2570',
        rawIsoDate: '2027-03-17',
        time: '13:00-16:00',
        room: '',
        seat: '',
        examType: 'final',
        isManual: true,
        source: 'kmutnb-reg',
      },
    ];

    const { exams, stats } = mergeExamSources(staleSciBase, currentReg, { todayIso: '2026-11-20' });
    expect(exams).toHaveLength(2);
    expect(stats.ignoredStaleSciBaseCount).toBe(2);
    expect(exams.map((e) => e.id)).toEqual([
      'reg-exam-040613203-midterm-2027-01-15',
      'reg-exam-040613203-final-2027-03-17',
    ]);

    // Without Reg exams, Student-ID-only users still see their SciBase results normally
    const sciOnly = mergeExamSources(staleSciBase, [], { todayIso: '2026-11-20' });
    expect(sciOnly.exams).toHaveLength(2);
    expect(sciOnly.stats.ignoredStaleSciBaseCount).toBe(0);
  });

  it('prevents duplicate Google Calendar exam events and enriches Reg exam event with SciBase room & seat', async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-11-20T10:00:00+07:00'));
      const postBodies = [];
      vi.spyOn(httpClient, 'request').mockImplementation(async (url, opts = {}) => {
        const method = (opts.method || 'GET').toUpperCase();
        if (method === 'GET') return { items: [] };
        if (method === 'POST') {
          const body = JSON.parse(opts.body);
          postBodies.push(body);
          return { id: `ev-${postBodies.length}` };
        }
        return {};
      });

      await syncClassroomDataToCalendar('token-123', email, {
        schedule: [],
        exams: [
          // Matching SciBase seating for Midterm
          {
            id: 'exam-40613203-15_มค_2570-09001200-0',
            courseCode: '40613203',
            courseName: 'STRUCTURED PROGRAMMING',
            date: '15 ม.ค. 2570',
            time: '09:00-12:00',
            room: '78-621',
            seat: 'Row A, Seat 12',
          },
          // Stale previous-semester SciBase exam
          {
            id: 'exam-old-12_ตค_2569-09001200-1',
            courseCode: '040613105',
            courseName: 'OLD TERM EXAM',
            date: '12 ต.ค. 2569',
            time: '09:00-12:00',
            room: '78-100',
            seat: 'Row Z, Seat 99',
          },
        ],
        manualExams: [
          {
            id: 'reg-exam-040613203-midterm-2027-01-15',
            courseCode: '040613203',
            courseName: 'Structured Programming (Midterm)',
            date: '15 ม.ค. 2570',
            rawIsoDate: '2027-01-15',
            time: '09:00-12:00',
            room: '',
            seat: '',
            examType: 'midterm',
            isManual: true,
            source: 'kmutnb-reg',
          },
        ],
      });

      const examEvents = postBodies.filter((b) => b.extendedProperties?.private?.chType === 'exam');
      expect(examEvents).toHaveLength(1);
      expect(examEvents[0].summary).toBe('Structured Programming (Midterm)');
      expect(examEvents[0].location).toBe('78-621 (Row A, Seat 12)');
      expect(examEvents[0].description).toContain('Seat/Row: Row A, Seat 12');
    } finally {
      vi.useRealTimers();
    }
  });

  it('renders merged Reg + Student ID seating in ExamRoom with zero duplicates and hides stale previous-semester SciBase exams', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-11-20T10:00:00+07:00'));
      localStorage.setItem('classroom_hub_language', 'en');
      setActiveEmail(email);
      saveToken('valid-token', 3600);
      saveProfile({ name: 'TopZ', email }, email);
      sessionStorage.setItem('lastExamSearch', '6704062611115');

      examRepository.saveToCache(
        email,
        [
          {
            id: 'exam-40613203-15_มค_2570-09001200-0',
            courseCode: '40613203',
            courseName: 'STRUCTURED PROGRAMMING',
            date: '15 ม.ค. 2570',
            time: '09:00-12:00',
            room: '78-621 (Bldg. 78)',
            seat: 'Row A, Seat 12',
          },
          {
            id: 'exam-old-12_ตค_2569-09001200-1',
            courseCode: '040613105',
            courseName: 'STALE PREVIOUS SEMESTER EXAM',
            date: '12 ต.ค. 2569',
            time: '09:00-12:00',
            room: '78-100',
            seat: 'Row Z, Seat 99',
          },
        ],
        [
          {
            id: 'reg-exam-040613203-midterm-2027-01-15',
            courseCode: '040613203',
            courseName: 'Structured Programming (Midterm)',
            date: '15 ม.ค. 2570',
            rawIsoDate: '2027-01-15',
            time: '09:00-12:00',
            room: '',
            seat: '',
            examType: 'midterm',
            isManual: true,
            source: 'kmutnb-reg',
          },
        ],
        null
      );

      render(
        <MemoryRouter>
          <AuthProvider>
            <SettingsProvider>
              <ExamRoom />
            </SettingsProvider>
          </AuthProvider>
        </MemoryRouter>
      );

      // Merged into 1 card with room & seat and "Reg + Seat" badge; stale old-term exam hidden!
      expect(screen.getAllByText('Structured Programming (Midterm)')).toHaveLength(1);
      expect(screen.getByText('78-621 (Bldg. 78)')).toBeInTheDocument();
      expect(screen.getByText('Row A, Seat 12')).toBeInTheDocument();
      expect(screen.getByText('Reg + Seat')).toBeInTheDocument();
      expect(screen.getByText(/Merged official room & seating/i)).toBeInTheDocument();
      expect(screen.queryByText('STALE PREVIOUS SEMESTER EXAM')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
