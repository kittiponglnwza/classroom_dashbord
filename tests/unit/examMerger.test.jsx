import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { mergeExamSources, normalizeExamCode, isSameExamSlot } from '../../src/utils/examMerger';
import { syncClassroomDataToCalendar } from '../../src/services/calendarSync';
import { httpClient } from '../../src/utils/httpClient';
import ExamRoom from '../../src/pages/ExamRoom';
import { AuthProvider } from '../../src/contexts/AuthContext';
import { SettingsProvider } from '../../src/contexts/SettingsContext';
import { examRepository } from '../../src/repositories/examRepository';
import { setActiveEmail, saveToken, saveProfile } from '../../src/utils/storage';

describe('Exam Source Reconciliation (SciBase Primary + Reg Fallback + Midterm/Final Tabs)', () => {
  const email = 's6704062611115@email.kmutnb.ac.th';

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('uses fresh SciBase seating as the sole primary source for the covered round while preserving unpublished Reg rounds', () => {
    expect(normalizeExamCode({ courseCode: '040613203' })).toBe('40613203');
    expect(normalizeExamCode({ courseCode: '40613203' })).toBe('40613203');
    expect(normalizeExamCode({ courseCode: 'CLASSROOM' })).toBe('');

    const sciMidterm = [
      {
        id: 'exam-40613203-15_มค_2570-09001200-0',
        courseCode: '40613203',
        courseName: 'STRUCTURED PROGRAMMING',
        date: '15 ม.ค. 2570',
        time: '09:00-12:00',
        room: '78-621 (อาคาร 78, ชั้น 6)',
        seat: 'แถว A ที่นั่ง 12',
      },
    ];
    const regExams = [
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
        id: 'reg-exam-040613304-midterm-2027-01-11',
        courseCode: '040613304',
        courseName: 'Project Management (Midterm)',
        date: '11 ม.ค. 2570',
        rawIsoDate: '2027-01-11',
        time: '13:00-16:00',
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

    expect(isSameExamSlot(sciMidterm[0], regExams[0])).toBe(true);

    const { exams, stats } = mergeExamSources(sciMidterm, regExams, { todayIso: '2027-01-05' });
    expect(stats.mode).toBe('scibase-primary');
    expect(stats.coveredRounds).toEqual(['midterm']);
    expect(stats.fallbackRegRounds).toEqual(['final']);
    expect(stats.replacedRegCount).toBe(2);

    // Midterm round comes SOLELY from SciBase (with room & seat & inferred examType='midterm'),
    // while unpublished Final round stays from Reg!
    expect(exams).toHaveLength(2);
    expect(exams[0]).toMatchObject({
      id: 'exam-40613203-15_มค_2570-09001200-0',
      courseCode: '40613203',
      room: '78-621 (อาคาร 78, ชั้น 6)',
      seat: 'แถว A ที่นั่ง 12',
      examType: 'midterm',
      source: 'scibase',
    });
    expect(exams[1].id).toBe('reg-exam-040613203-final-2027-03-17');
  });

  it('ignores stale previous-semester SciBase exams and falls back to current KMUTNB Reg exams', () => {
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
    expect(stats.mode).toBe('reg-fallback');
    expect(stats.ignoredStaleSciBaseCount).toBe(1);
    expect(exams).toHaveLength(2);
    expect(exams.map((e) => e.id)).toEqual([
      'reg-exam-040613203-midterm-2027-01-15',
      'reg-exam-040613203-final-2027-03-17',
    ]);

    // Without Reg exams, Student-ID-only users still see their SciBase results normally
    const sciOnly = mergeExamSources(staleSciBase, [], { todayIso: '2026-11-20' });
    expect(sciOnly.stats.mode).toBe('scibase-only');
    expect(sciOnly.exams).toHaveLength(1);
  });

  it('pushes official SciBase event (not duplicate Reg Midterm) to Google Calendar with room & seat', async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2027-01-05T10:00:00+07:00'));
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
          {
            id: 'exam-40613203-15_มค_2570-09001200-0',
            courseCode: '40613203',
            courseName: 'STRUCTURED PROGRAMMING',
            date: '15 ม.ค. 2570',
            time: '09:00-12:00',
            room: '78-621',
            seat: 'Row A, Seat 12',
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
        ],
      });

      const examEvents = postBodies.filter((b) => b.extendedProperties?.private?.chType === 'exam');
      // 1 SciBase Midterm + 1 Reg Final (zero duplicates!)
      expect(examEvents).toHaveLength(2);
      const midEv = examEvents.find((e) => e.start.dateTime.startsWith('2027-01-15'));
      expect(midEv.summary).toBe('STRUCTURED PROGRAMMING');
      expect(midEv.location).toBe('78-621 (Row A, Seat 12)');
      expect(midEv.description).toContain('Seat/Row: Row A, Seat 12');
    } finally {
      vi.useRealTimers();
    }
  });

  it('queries SciBase FIRST before showing Reg fallback, uses SciBase as primary, and separates Midterm vs Final tabs', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      vi.setSystemTime(new Date('2027-01-05T10:00:00+07:00'));
      localStorage.setItem('classroom_hub_language', 'en');
      setActiveEmail(email);
      saveToken('valid-token', 3600);
      saveProfile({ name: 'TopZ', email }, email);

      // Only Reg exams exist in cache (no SciBase cache yet!)
      examRepository.saveToCache(
        email,
        [],
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
        ],
        null
      );

      let resolveFetch;
      const fetchSpy = vi.spyOn(examRepository, 'fetchExams').mockImplementation(
        () => new Promise((resolve) => { resolveFetch = resolve; })
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

      // 1. Queries SciBase FIRST before rendering Reg cards!
      expect(fetchSpy).toHaveBeenCalledWith('6704062611115', 'en', expect.any(AbortSignal));
      expect(screen.getByText(/Checking official exam seating database/i)).toBeInTheDocument();
      expect(screen.queryByText('Structured Programming (Midterm)')).not.toBeInTheDocument();

      // 2. SciBase resolves with official Midterm seating -> SciBase is primary on Midterm tab!
      resolveFetch({
        success: true,
        data: {
          exams: [
            {
              id: 'exam-40613203-15_มค_2570-09001200-0',
              courseCode: '40613203',
              courseName: 'STRUCTURED PROGRAMMING',
              date: '15 ม.ค. 2570',
              time: '09:00-12:00',
              room: '78-621 (Bldg. 78)',
              seat: 'Row A, Seat 12',
            },
          ],
          unlisted: null,
        },
      });

      // Default tab = Midterm (upcoming!) showing ONLY SciBase primary card (NOT Final!)
      await waitFor(() => {
        expect(screen.getByText('STRUCTURED PROGRAMMING')).toBeInTheDocument();
      });
      expect(screen.getByText('78-621 (Bldg. 78)')).toBeInTheDocument();
      expect(screen.getByText('Official Seat')).toBeInTheDocument();
      expect(screen.queryByText('Structured Programming (Final)')).not.toBeInTheDocument();

      // 3. Switch to Final tab -> shows Reg Final card (with Room TBA badge), hides Midterm card!
      fireEvent.click(screen.getByRole('tab', { name: /Final/i }));
      expect(screen.getByText('Structured Programming (Final)')).toBeInTheDocument();
      expect(screen.getByText('Reg · Room TBA')).toBeInTheDocument();
      expect(screen.queryByText('STRUCTURED PROGRAMMING')).not.toBeInTheDocument();

      // 4. Switch to All tab -> shows both!
      fireEvent.click(screen.getByRole('tab', { name: /All/i }));
      expect(screen.getByText('STRUCTURED PROGRAMMING')).toBeInTheDocument();
      expect(screen.getByText('Structured Programming (Final)')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
