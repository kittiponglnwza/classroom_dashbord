import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Academic from '../../src/pages/Academic';
import { AuthProvider } from '../../src/contexts/AuthContext';
import { SettingsProvider } from '../../src/contexts/SettingsContext';
import { ToastProvider } from '../../src/contexts/ToastContext';
import { ClassroomProvider } from '../../src/contexts/ClassroomContext';
import {
  setActiveEmail,
  saveToken,
  saveAcademicData,
  getAcademicData,
  clearAcademicLocalData,
  getSchedule
} from '../../src/utils/storage';
import { examRepository } from '../../src/repositories/examRepository';

vi.mock('../../src/services/SyncManager', () => ({
  syncManager: {
    subscribe: vi.fn(() => () => {}),
    queueSync: vi.fn(),
    executeSync: vi.fn().mockResolvedValue(false),
    cancel: vi.fn()
  }
}));

vi.mock('../../src/services/CalendarSyncManager', () => ({
  calendarSyncManager: {
    subscribe: vi.fn(() => () => {}),
    queueSync: vi.fn(),
    cancel: vi.fn()
  }
}));

const MINI_COMBINED_REG_PASTE = `
ตารางเรียน/สอบ
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
อ.ทดสอบ
S.1 จ.08:30-10:30
78-621
15 ม.ค. 2570เวลา 09:00-12:00
17 มี.ค. 2570เวลา 13:00-16:00
080103034
S.16
การสนทนาภาษาอังกฤษEnglish Conversation
3(3-0-6)
อ.ทดสอบสอง
S.16 ศ.09:00-12:00
78-301
26 มี.ค. 2570เวลา 09:00-11:00
@ 2026 Visionnet
ผลการศึกษา
ปีการศึกษา 1/2567
รหัสวิชา
ชื่อวิชา
ตอนเรียน
หน่วยกิต
เกรด
040613100
FUND OF COMP SCI
1
3
A
040613203
STRUCTURED PROGRAMMING
1
3
F
080103001
ENGLISH I
1
3
B
ผลการศึกษา : ปกติ
THIS SEMESTER
CUMULATIVE TO THIS SEMESTER
CA
CS
CG
GP
GPA
CA
CS
CG
GP
GPAX
9
6
9
21
2.33
9
6
9
21
2.33
`;

function renderAcademic() {
  return render(
    <MemoryRouter initialEntries={['/academic']}>
      <AuthProvider>
        <SettingsProvider>
          <ToastProvider>
            <ClassroomProvider>
              <Academic />
            </ClassroomProvider>
          </ToastProvider>
        </SettingsProvider>
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('Academic & Graduation Page + RegImportModal', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    window.history.replaceState(null, '', '/academic');
    localStorage.setItem('classroom_hub_language', 'th');
    setActiveEmail('student@email.kmutnb.ac.th');
    saveToken('test-token', 3600);
  });

  it('imports combined KMUTNB timetable & grades into Academic, Schedule, and ExamRoom', async () => {
    renderAcademic();

    // Open import modal from empty state
    const openBtn = screen.getByRole('button', { name: /นำเข้าจาก Reg มจพ\./i });
    fireEvent.click(openBtn);

    const textarea = await screen.findByPlaceholderText(/วางข้อความจากหน้า ตารางเรียน\/สอบ/i);
    fireEvent.change(textarea, { target: { value: MINI_COMBINED_REG_PASTE } });

    // Live preview detects both timetable and grades
    expect(await screen.findByText(/ตรวจพบข้อมูลพร้อมนำเข้า/i)).toBeInTheDocument();
    expect(screen.getAllByText(/2 คาบ/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/3 รอบสอบ/i).length).toBeGreaterThan(0);

    const confirmBtn = screen.getByRole('button', { name: /ยืนยันนำเข้าข้อมูล/i });
    fireEvent.click(confirmBtn);

    // KPI cards render computed GPAX (2.33) and passed credits (6)
    await waitFor(() => {
      expect(screen.getAllByText('2.33').length).toBeGreaterThan(0);
    });

    // Schedule and ExamRoom caches were populated
    const savedSchedule = getSchedule('student@email.kmutnb.ac.th');
    expect(savedSchedule).toHaveLength(2);
    expect(savedSchedule[0].courseCode).toBe('040613203');

    const cachedExams = examRepository.getCachedExams('student@email.kmutnb.ac.th');
    expect(cachedExams.success).toBe(true);
    expect(cachedExams.data.manualExams).toHaveLength(3);

    // Retaking course 040613203 is detected (got F in 1/2567 and enrolled now)
    expect(screen.getAllByText(/กำลังลงรีเกรดเทอมนี้/i).length).toBeGreaterThan(0);
  });

  it('toggles Privacy Blur and persists setting', async () => {
    saveAcademicData(
      {
        semesters: [
          {
            semesterId: '1/2567',
            status: 'ปกติ',
            courses: [{ courseCode: '040613100', courseName: 'CS FUND', section: '1', credits: 3, grade: 'A' }],
          },
        ],
        enrolledCourses: [],
        privacyBlur: false,
      },
      'student@email.kmutnb.ac.th'
    );

    renderAcademic();

    const blurBtn = await screen.findByRole('button', { name: /ซ่อนเกรด/i });
    fireEvent.click(blurBtn);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /แสดงเกรด/i })).toBeInTheDocument();
    });
    expect(getAcademicData('student@email.kmutnb.ac.th').privacyBlur).toBe(true);
  });

  it('scrubs local academic data via clearAcademicLocalData for shared-PC logout safety', () => {
    const email = 'student@email.kmutnb.ac.th';
    saveAcademicData(
      {
        semesters: [
          {
            semesterId: '1/2567',
            status: 'ปกติ',
            courses: [{ courseCode: '040613100', courseName: 'CS FUND', section: '1', credits: 3, grade: 'A' }],
          },
        ],
      },
      email
    );
    expect(getAcademicData(email).semesters).toHaveLength(1);

    clearAcademicLocalData(email);
    expect(getAcademicData(email).semesters).toHaveLength(0);
    expect(localStorage.getItem(`classroom_hub_academic_${email}`)).toBeNull();
  });

  it('decodes #reg-import= bookmarklet hash and immediately scrubs it from window.location.hash', async () => {
    const bytes = new TextEncoder().encode(MINI_COMBINED_REG_PASTE);
    let bin = '';
    bytes.forEach((b) => { bin += String.fromCharCode(b); });
    const encoded = btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    window.history.replaceState(null, '', `/academic#reg-import=${encoded}`);

    renderAcademic();

    // Modal auto-opens with parsed preview AND URL hash is immediately scrubbed
    expect(await screen.findByText(/ตรวจพบข้อมูลพร้อมนำเข้า/i)).toBeInTheDocument();
    expect(window.location.hash).toBe('');
  });
});
