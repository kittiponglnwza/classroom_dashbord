import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  subtractDaysIso,
  resolveCourseEndDate,
  resolveCourseExamInfo,
  resolveMidtermPauseRanges,
  collectPausedDatesForDay,
  isScheduleEntryActiveOnDate,
} from '../../src/utils/courseEndDate';
import { parseKmutnbRegInput } from '../../src/services/parsers/kmutnbRegParser';
import { syncClassroomDataToCalendar } from '../../src/services/calendarSync';
import { httpClient } from '../../src/utils/httpClient';
import Schedule from '../../src/pages/Schedule';
import { useTodayClasses } from '../../src/hooks/useTodayClasses';
import { AuthProvider } from '../../src/contexts/AuthContext';
import { SettingsProvider } from '../../src/contexts/SettingsContext';
import { ClassroomContext } from '../../src/contexts/ClassroomContext';
import { ClassroomUIContext } from '../../src/contexts/ClassroomUIContext';
import { examRepository } from '../../src/repositories/examRepository';
import { setActiveEmail, saveToken, saveProfile } from '../../src/utils/storage';

const REAL_REG_TIMETABLE = `
ปีการศึกษา2569
รหัสวิชา
ตอนเรียน
รายวิชา
หน่วยกิต
อาจารย์ผู้สอน
วันเวลาเรียน
ห้อง
สอบกลางภาค
สอบปลายภาค
หมายเหตุ
040613203
S.1
การโปรแกรมเชิงโครงสร้างStructured Programming
3(2-2-5)
อ.หนึ่ง
S.1 จ.08:30-10:30
78-621
15 ม.ค. 2570เวลา 09:00-12:00
17 มี.ค. 2570เวลา 13:00-16:00
040613203
L.1
การโปรแกรมเชิงโครงสร้างStructured Programming
3(2-2-5)
อ.หนึ่ง
L.1 จ.10:30-12:30
78-621
15 ม.ค. 2570เวลา 09:00-12:00
17 มี.ค. 2570เวลา 13:00-16:00
040613902
S.1
อินเทอร์เน็ตของสรรพสิ่งInternet of Things
3(2-2-5)
อ.สอง
S.1 อ.08:30-10:30
78-618/2
15 ม.ค. 2570เวลา 13:00-16:00
16 มี.ค. 2570เวลา 13:00-16:00
080103034
S.16
การสนทนาภาษาอังกฤษEnglish Conversation
3(3-0-6)
อ.สาม
S.16 ศ.09:00-12:00
78-301
26 มี.ค. 2570เวลา 09:00-11:00
080303515
L.1
การเดิน-วิ่ง เพื่อสุขภาพWalk and Run for Health
1(0-2-1)
อ.สี่
L.1 จ.13:00-15:00
-
`;

describe('Course End Date (Stop 1 Week Before Final Exam)', () => {
  const email = 'student@kmutnb.ac.th';

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('subtracts 7 days accurately across month and leap-year boundaries', () => {
    expect(subtractDaysIso('2027-03-17', 7)).toBe('2027-03-10');
    expect(subtractDaysIso('2027-03-04', 7)).toBe('2027-02-25');
    expect(subtractDaysIso('2028-03-04', 7)).toBe('2028-02-26'); // leap year
    expect(subtractDaysIso('2027-01-03', 7)).toBe('2026-12-27');
    expect(subtractDaysIso('invalid')).toBe('');
  });

  it('resolves course end date from final exam (ignoring midterm), semester fallback for non-exam Reg courses, and user overrides', () => {
    const exams = [
      { id: 'reg-exam-040613203-midterm-2027-01-15', courseCode: '040613203', courseName: 'Structured Programming (Midterm)', rawIsoDate: '2027-01-15', examType: 'midterm' },
      { id: 'reg-exam-040613203-final-2027-03-17', courseCode: '040613203', courseName: 'Structured Programming (Final)', rawIsoDate: '2027-03-17', examType: 'final' },
      { id: 'reg-exam-040613902-final-2027-03-16', courseCode: '040613902', courseName: 'IoT (Final)', rawIsoDate: '2027-03-16', examType: 'final' },
      // Untagged SciBase midterm exam >30 days before finals
      { id: 'scibase-1', subjectCode: '080303515', subjectName: 'Walk and Run', date: '15 ม.ค. 2570' },
    ];

    // Course with both midterm and final -> uses final - 7 days
    const info1 = resolveCourseExamInfo(
      { id: 'reg-040613203-S1-mon-0830', courseCode: '040613203', day: 'mon', source: 'kmutnb-reg' },
      exams
    );
    expect(info1).toEqual({ endDate: '2027-03-10', source: 'course-exam', examDate: '2027-03-17' });

    // Reg course without final exam (and ignoring Jan untagged midterm) -> falls back to earliest final (2027-03-16) - 7d = 2027-03-09
    const infoPe = resolveCourseExamInfo(
      { id: 'reg-080303515-L1-mon-1300', courseCode: '080303515', day: 'mon', source: 'kmutnb-reg' },
      exams
    );
    expect(infoPe).toEqual({ endDate: '2027-03-09', source: 'semester-finals', examDate: '2027-03-16' });

    // Explicit endDate wins
    expect(resolveCourseEndDate({ id: 'reg-1', courseCode: '040613203', day: 'mon', endDate: '2027-03-01' }, exams))
      .toBe('2027-03-01');

    // Explicit opt-out noAutoEndDate disables auto cutoff
    expect(resolveCourseEndDate({ id: 'reg-1', courseCode: '040613203', day: 'mon', noAutoEndDate: true }, exams))
      .toBe('');

    // Manual personal recurring event without matching exam gets no unwanted cutoff
    expect(resolveCourseEndDate({ id: 'sched-custom', title: 'Gym', day: 'fri' }, exams))
      .toBe('');

    // Boundary check: inclusive on endDate, closed starting next day
    const monClass = { id: 'reg-040613203-S1-mon-0830', courseCode: '040613203', day: 'mon', endDate: '2027-03-10' };
    expect(isScheduleEntryActiveOnDate(monClass, '2027-03-08')).toBe(true);
    expect(isScheduleEntryActiveOnDate(monClass, '2027-03-10')).toBe(true);
    expect(isScheduleEntryActiveOnDate(monClass, '2027-03-15')).toBe(false);
  });

  it('populates endDate = finalExam - 7 days automatically during KMUTNB Reg timetable parsing', () => {
    const parsed = parseKmutnbRegInput(REAL_REG_TIMETABLE);
    expect(parsed.success).toBe(true);
    const byId = Object.fromEntries(parsed.timetable.scheduleEntries.map((e) => [e.id, e]));

    expect(byId['reg-040613203-S1-mon-0830'].endDate).toBe('2027-03-10');
    expect(byId['reg-040613203-L1-mon-1030'].endDate).toBe('2027-03-10');
    expect(byId['reg-040613902-S1-tue-0830'].endDate).toBe('2027-03-09');
    expect(byId['reg-080103034-S16-fri-0900'].endDate).toBe('2027-03-19');
    // Course with no listed final exam closes 1 week before earliest final (2027-03-16 -> 2027-03-09)
    expect(byId['reg-080303515-L1-mon-1300'].endDate).toBe('2027-03-09');
  });

  it('pushes RRULE UNTIL to Google Calendar stopping 1 week before exam (explicit and dynamically inferred) and prunes already-ended courses', async () => {
    vi.useFakeTimers();
    try {
      // Today: Friday 2026-11-20 10:00+07:00
      vi.setSystemTime(new Date('2026-11-20T10:00:00+07:00'));

      const postBodies = [];
      vi.spyOn(httpClient, 'request').mockImplementation(async (url, opts = {}) => {
        const method = (opts.method || 'GET').toUpperCase();
        if (method === 'GET') return { items: [] };
        if (method === 'POST') {
          const body = JSON.parse(opts.body);
          postBodies.push(body);
          return { id: `created-${postBodies.length}` };
        }
        return {};
      });

      await syncClassroomDataToCalendar('token-abc', email, {
        schedule: [
          // Explicit endDate
          { id: 'reg-explicit', title: 'IoT', courseCode: '040613902', day: 'tue', startTime: '08:30', endTime: '10:30', endDate: '2027-03-09', source: 'kmutnb-reg' },
          // Legacy saved Reg course WITHOUT endDate -> inferred dynamically from manualExams!
          { id: 'reg-legacy', title: 'Structured Programming', courseCode: '040613203', day: 'mon', startTime: '08:30', endTime: '10:30', source: 'kmutnb-reg' },
          // Already ended course (2026-11-10 < today 2026-11-20) -> must NOT be posted!
          { id: 'reg-ended', title: 'Old Term Course', courseCode: '040610000', day: 'wed', startTime: '09:00', endTime: '12:00', endDate: '2026-11-10' },
        ],
        manualExams: [
          { id: 'reg-exam-040613203-final-2027-03-17', courseCode: '040613203', courseName: 'Structured Programming (Final)', rawIsoDate: '2027-03-17', time: '13:00-16:00', examType: 'final', isManual: true },
        ],
      });

      const schedEvents = postBodies.filter((b) => b.extendedProperties?.private?.chType === 'schedule');
      expect(schedEvents).toHaveLength(2);

      const iotEv = schedEvents.find((e) => e.extendedProperties.private.chId === 'reg-explicit');
      const spEv = schedEvents.find((e) => e.extendedProperties.private.chId === 'reg-legacy');

      // 2027-03-09T23:59:59+07:00 == 2027-03-09T16:59:59Z
      expect(iotEv.recurrence).toEqual(['RRULE:FREQ=WEEKLY;BYDAY=TU;UNTIL=20270309T165959Z']);
      // 2027-03-10T23:59:59+07:00 == 2027-03-10T16:59:59Z (inferred from 2027-03-17 final - 7 days)
      expect(spEv.recurrence).toEqual(['RRULE:FREQ=WEEKLY;BYDAY=MO;UNTIL=20270310T165959Z']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('hides recurring classes in Schedule UI after course endDate while keeping Final Exam visible, and lets user edit endDate in modal', () => {
    vi.useFakeTimers();
    try {
      // Set "today" to Monday 2027-03-08 (last week of class BEFORE endDate 2027-03-10)
      vi.setSystemTime(new Date('2027-03-08T10:00:00+07:00'));

      localStorage.setItem('classroom_hub_language', 'en');
      setActiveEmail(email);
      saveToken('valid-token', 3600);
      saveProfile({ name: 'TopZ', email }, email);

      examRepository.saveToCache(
        email,
        [],
        [
          {
            id: 'reg-exam-040613203-final-2027-03-17',
            courseCode: '040613203',
            courseName: 'Structured Programming (Final)',
            rawIsoDate: '2027-03-17',
            date: '17 มี.ค. 2570',
            time: '13:00-16:00',
            examType: 'final',
            isManual: true,
          },
        ],
        null
      );

      const onSaveSchedule = vi.fn();
      const scheduleEntries = [
        // No saved endDate -> dynamically inferred as 2027-03-10 from final exam 2027-03-17!
        {
          id: 'reg-040613203-S1-mon-0830',
          title: 'Structured Programming (S.1)',
          courseCode: '040613203',
          day: 'mon',
          startTime: '08:30',
          endTime: '10:30',
          room: '78-621',
          source: 'kmutnb-reg',
        },
      ];

      const renderSchedule = (initialUrl = '/schedule') =>
        render(
          <MemoryRouter initialEntries={[initialUrl]}>
            <AuthProvider>
              <SettingsProvider>
                <ClassroomContext.Provider
                  value={{
                    schedule: scheduleEntries,
                    handleSaveScheduleEntry: onSaveSchedule,
                    handleDeleteScheduleEntry: vi.fn(),
                    handleClearSchedule: vi.fn(),
                    extensionStatus: { connected: false },
                    requestExtensionSync: vi.fn(),
                  }}
                >
                  <ClassroomUIContext.Provider value={{ visibleCourses: [], visibleAssignments: [] }}>
                    <Schedule />
                  </ClassroomUIContext.Provider>
                </ClassroomContext.Provider>
              </SettingsProvider>
            </AuthProvider>
          </MemoryRouter>
        );

      // Week 0 (Mon Mar 8, 2027 <= endDate Mar 10): class IS visible!
      const { unmount } = renderSchedule('/schedule');
      expect(screen.getAllByText('Structured Programming (S.1)').length).toBeGreaterThan(0);

      // Click block to inspect modal -> Course End Date prefilled to 2027-03-10
      const blocks = screen.getAllByText('Structured Programming (S.1)');
      fireEvent.click(blocks[blocks.length - 1]);
      const endDateInput = screen.getByLabelText(/Course End Date/i);
      expect(endDateInput.value).toBe('2027-03-10');

      // Clear end date & save -> persists noAutoEndDate: true
      fireEvent.click(screen.getByRole('button', { name: /^Clear$/i }));
      expect(endDateInput.value).toBe('');
      fireEvent.click(screen.getByRole('button', { name: /Save/i }));
      expect(onSaveSchedule).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'reg-040613203-S1-mon-0830',
          endDate: '',
          noAutoEndDate: true,
        })
      );
      unmount();

      // Week +1 (Mon Mar 15 – Sun Mar 21, 2027): Mon Mar 15 > endDate Mar 10 -> recurring class HIDDEN from timetable grid, Final Exam VISIBLE!
      const week1 = renderSchedule('/schedule?week=1');
      const gridBlocks = Array.from(week1.container.querySelectorAll('[data-schedule-block]')).map((el) => el.textContent);
      expect(gridBlocks.some((txt) => txt.includes('Structured Programming (S.1)'))).toBe(false);
      expect(gridBlocks.some((txt) => txt.includes('Structured Programming (Final)'))).toBe(true);
      expect(screen.getByText(/All recurring courses have ended for this week/i)).toBeInTheDocument();
      week1.unmount();

      // When "today" itself is Mon Mar 15 (> endDate Mar 10): absent from BOTH grid and Today summary strip!
      vi.setSystemTime(new Date('2027-03-15T08:00:00+07:00'));
      saveToken('valid-token', 3600);
      renderSchedule('/schedule');
      expect(screen.queryByText('Structured Programming (S.1)')).not.toBeInTheDocument();
      expect(screen.getByText('Structured Programming (Final)')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('excludes ended recurring courses from useTodayClasses after endDate', () => {
    vi.useFakeTimers();
    try {
      setActiveEmail(email);
      examRepository.saveToCache(
        email,
        [],
        [
          {
            id: 'reg-exam-040613203-final-2027-03-17',
            courseCode: '040613203',
            courseName: 'Structured Programming (Final)',
            rawIsoDate: '2027-03-17',
            time: '13:00-16:00',
            examType: 'final',
            isManual: true,
          },
        ],
        null
      );

      const schedule = [
        {
          id: 'reg-040613203-S1-mon-0830',
          title: 'Structured Programming (S.1)',
          courseCode: '040613203',
          day: 'mon',
          startTime: '08:30',
          endTime: '10:30',
          source: 'kmutnb-reg',
        },
      ];

      function Harness() {
        const list = useTodayClasses(schedule, { email });
        return <div data-testid="today-count">{list.length}</div>;
      }

      // Mon 2027-03-08 (<= 2027-03-10): active
      vi.setSystemTime(new Date('2027-03-08T08:00:00+07:00'));
      const first = render(<Harness />);
      expect(screen.getByTestId('today-count').textContent).toBe('1');
      first.unmount();

      // Mon 2027-03-15 (> 2027-03-10): closed
      vi.setSystemTime(new Date('2027-03-15T08:00:00+07:00'));
      render(<Harness />);
      expect(screen.getByTestId('today-count').textContent).toBe('0');
    } finally {
      vi.useRealTimers();
    }
  });

  it('pauses recurring classes during Midterm Exam Week and resumes normally afterward (Schedule UI, Google Calendar EXDATE, and useTodayClasses)', async () => {
    const exams = [
      { id: 'reg-exam-040613304-midterm-2027-01-11', courseCode: '040613304', courseName: 'Project Management (Midterm)', rawIsoDate: '2027-01-11', time: '13:00-16:00', examType: 'midterm', isManual: true },
      { id: 'reg-exam-040613203-midterm-2027-01-15', courseCode: '040613203', courseName: 'Structured Programming (Midterm)', rawIsoDate: '2027-01-15', time: '09:00-12:00', examType: 'midterm', isManual: true },
      { id: 'reg-exam-040613206-midterm-2027-01-17', courseCode: '040613206', courseName: 'Algorithm (Midterm)', rawIsoDate: '2027-01-17', time: '13:00-16:00', examType: 'midterm', isManual: true },
      { id: 'reg-exam-040613203-final-2027-03-17', courseCode: '040613203', courseName: 'Structured Programming (Final)', rawIsoDate: '2027-03-17', time: '13:00-16:00', examType: 'final', isManual: true },
    ];

    // 1. Midterm pause range spans Mon 2027-01-11 .. Sun 2027-01-17
    const ranges = resolveMidtermPauseRanges(exams);
    expect(ranges).toEqual([
      { start: '2027-01-11', end: '2027-01-17', examStart: '2027-01-11', examEnd: '2027-01-17' },
    ]);
    expect(collectPausedDatesForDay('mon', ranges)).toEqual(['2027-01-11']);
    expect(collectPausedDatesForDay('fri', ranges)).toEqual(['2027-01-15']);

    // 2. Entry active before Midterm week, paused during Midterm week, resumed right after Midterm week, closed 1w before Final
    const monCourse = {
      id: 'reg-040613203-S1-mon-0830',
      title: 'Structured Programming (S.1)',
      courseCode: '040613203',
      day: 'mon',
      startTime: '08:30',
      endTime: '10:30',
      source: 'kmutnb-reg',
    };
    const nonExamCourse = {
      id: 'reg-080303515-L1-mon-1300',
      title: 'Walk and Run (L.1)',
      courseCode: '080303515',
      day: 'mon',
      startTime: '13:00',
      endTime: '15:00',
      source: 'kmutnb-reg',
    };

    expect(isScheduleEntryActiveOnDate(monCourse, '2027-01-04', exams)).toBe(true);   // week before midterm
    expect(isScheduleEntryActiveOnDate(monCourse, '2027-01-11', exams)).toBe(false);  // midterm week -> PAUSED
    expect(isScheduleEntryActiveOnDate(monCourse, '2027-01-18', exams)).toBe(true);   // week after midterm -> RESUMED!
    expect(isScheduleEntryActiveOnDate(monCourse, '2027-03-08', exams)).toBe(true);   // last week before finals
    expect(isScheduleEntryActiveOnDate(monCourse, '2027-03-15', exams)).toBe(false);  // closed 1w before final

    // Even non-midterm Reg course pauses during Midterm week and resumes after
    expect(isScheduleEntryActiveOnDate(nonExamCourse, '2027-01-11', exams)).toBe(false);
    expect(isScheduleEntryActiveOnDate(nonExamCourse, '2027-01-18', exams)).toBe(true);

    // 3. Google Calendar Sync emits BOTH RRULE UNTIL and EXDATE for Midterm week!
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
          return { id: `created-${postBodies.length}` };
        }
        return {};
      });

      await syncClassroomDataToCalendar('token-mid', email, {
        schedule: [monCourse],
        manualExams: exams,
      });

      const schedEv = postBodies.find((b) => b.extendedProperties?.private?.chType === 'schedule');
      expect(schedEv.recurrence).toEqual([
        'RRULE:FREQ=WEEKLY;BYDAY=MO;UNTIL=20270310T165959Z',
        'EXDATE;TZID=Asia/Bangkok:20270111T083000',
      ]);

      // 4. If syncing right DURING Midterm week (Mon 2027-01-11), DTSTART advances to Mon 2027-01-18 cleanly!
      vi.setSystemTime(new Date('2027-01-11T07:00:00+07:00'));
      localStorage.clear();
      const midWeekPosts = [];
      vi.spyOn(httpClient, 'request').mockImplementation(async (url, opts = {}) => {
        const method = (opts.method || 'GET').toUpperCase();
        if (method === 'GET') return { items: [] };
        if (method === 'POST') {
          const body = JSON.parse(opts.body);
          midWeekPosts.push(body);
          return { id: `mid-${midWeekPosts.length}` };
        }
        return {};
      });

      await syncClassroomDataToCalendar('token-mid2', email, {
        schedule: [monCourse],
        manualExams: exams,
      });
      const resumedEv = midWeekPosts.find((b) => b.extendedProperties?.private?.chType === 'schedule');
      expect(resumedEv.start.dateTime).toBe('2027-01-18T08:30:00');
      expect(resumedEv.recurrence).toEqual([
        'RRULE:FREQ=WEEKLY;BYDAY=MO;UNTIL=20270310T165959Z',
      ]);

      // 5. Schedule UI during Midterm week (Mon 2027-01-11) pauses regular class, keeps Midterm exams visible, and resumes week +1 (Mon 2027-01-18)!
      localStorage.clear();
      localStorage.setItem('classroom_hub_language', 'en');
      setActiveEmail(email);
      saveToken('valid-token', 3600);
      saveProfile({ name: 'TopZ', email }, email);
      examRepository.saveToCache(email, [], exams, null);

      const renderSched = (url) =>
        render(
          <MemoryRouter initialEntries={[url]}>
            <AuthProvider>
              <SettingsProvider>
                <ClassroomContext.Provider
                  value={{
                    schedule: [monCourse],
                    handleSaveScheduleEntry: vi.fn(),
                    handleDeleteScheduleEntry: vi.fn(),
                    handleClearSchedule: vi.fn(),
                    extensionStatus: { connected: false },
                    requestExtensionSync: vi.fn(),
                  }}
                >
                  <ClassroomUIContext.Provider value={{ visibleCourses: [], visibleAssignments: [] }}>
                    <Schedule />
                  </ClassroomUIContext.Provider>
                </ClassroomContext.Provider>
              </SettingsProvider>
            </AuthProvider>
          </MemoryRouter>
        );

      // Week 0 = Midterm Week (Mon Jan 11 – Sun Jan 17, 2027): regular class paused, Midterm exams visible, pause notice shown!
      const midView = renderSched('/schedule');
      expect(screen.queryByText('Structured Programming (S.1)')).not.toBeInTheDocument();
      expect(screen.getByText('Structured Programming (Midterm)')).toBeInTheDocument();
      expect(screen.getByText(/paused for Midterm week/i)).toBeInTheDocument();
      midView.unmount();

      // Week +1 = Post-Midterm Week (Mon Jan 18 – Sun Jan 24, 2027): regular class RESUMED normally!
      const postMidView = renderSched('/schedule?week=1');
      const postMidBlocks = Array.from(postMidView.container.querySelectorAll('[data-schedule-block]')).map((el) => el.textContent);
      expect(postMidBlocks.some((txt) => txt.includes('Structured Programming (S.1)'))).toBe(true);
      expect(screen.queryByText(/paused for Midterm week/i)).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
