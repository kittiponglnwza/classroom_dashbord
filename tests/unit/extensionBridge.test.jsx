import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Academic from '../../src/pages/Academic';
import { AuthProvider } from '../../src/contexts/AuthContext';
import { SettingsProvider } from '../../src/contexts/SettingsContext';
import { ToastProvider } from '../../src/contexts/ToastContext';
import { ClassroomProvider } from '../../src/contexts/ClassroomContext';
import { setActiveEmail, saveToken, getSchedule, getAcademicData } from '../../src/utils/storage';
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

const TIMETABLE_SNAPSHOT = `
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
040613304
S.1
การบริหารโครงการProject Management
3(3-0-6)
อาจารย์ทดสอบ
S.1 พ.09:00-12:00
75-604
11 ม.ค. 2570เวลา 13:00-16:00
18 มี.ค. 2570เวลา 09:00-12:00
`;

const GRADE_SNAPSHOT = `
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
3
3
3
12
4.00
3
3
3
12
4.00
`;

function renderAcademicApp() {
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

describe('Chrome Extension Auto-Sync Bridge', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('classroom_hub_language', 'th');
    setActiveEmail('extuser@email.kmutnb.ac.th');
    saveToken('test-token', 3600);
  });

  it('auto-imports sanitized KMUTNB Reg snapshots from trusted extension bridge and sends ACK', async () => {
    const postMessageSpy = vi.spyOn(window, 'postMessage');
    renderAcademicApp();

    // Simulate extension/bridge.js announcing readiness + delivering snapshots
    window.dispatchEvent(
      new MessageEvent('message', {
        source: window,
        origin: window.location.origin,
        data: {
          channel: 'CH_EXTENSION_BRIDGE',
          source: 'extension',
          type: 'REG_SNAPSHOT_DATA',
          status: { connected: true, version: '1.0.0', timetableCount: 1, gradeCount: 1 },
          payload: {
            timetable: { text: TIMETABLE_SNAPSHOT, hash: 'tt-hash-1', count: 1 },
            grade: { text: GRADE_SNAPSHOT, hash: 'gr-hash-1', count: 1 },
          },
        },
      })
    );

    // Extension connected pill appears and GPAX 4.00 renders automatically
    expect(await screen.findByText('Extension Sync')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getAllByText('4.00').length).toBeGreaterThan(0);
    });

    // Schedule, ExamRoom, and Academic data were automatically persisted
    expect(getSchedule('extuser@email.kmutnb.ac.th')).toHaveLength(1);
    expect(getAcademicData('extuser@email.kmutnb.ac.th').semesters).toHaveLength(1);
    const cachedExams = examRepository.getCachedExams('extuser@email.kmutnb.ac.th');
    expect(cachedExams.data.manualExams).toHaveLength(2);

    // Verify ACK_SYNC_COMPLETE sent back with exact hashes
    expect(postMessageSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'CH_EXTENSION_BRIDGE',
        source: 'app',
        type: 'ACK_SYNC_COMPLETE',
        timetableHash: 'tt-hash-1',
        gradeHash: 'gr-hash-1',
      }),
      window.location.origin
    );
  });

  it('strictly ignores bridge messages from untrusted origins', async () => {
    renderAcademicApp();

    window.dispatchEvent(
      new MessageEvent('message', {
        source: window,
        origin: 'https://evil.example.com',
        data: {
          channel: 'CH_EXTENSION_BRIDGE',
          source: 'extension',
          type: 'REG_SNAPSHOT_DATA',
          status: { connected: true },
          payload: {
            timetable: { text: TIMETABLE_SNAPSHOT, hash: 'bad-hash', count: 1 },
          },
        },
      })
    );

    // Wait briefly and confirm nothing was imported
    await new Promise((r) => setTimeout(r, 50));
    expect(getSchedule('extuser@email.kmutnb.ac.th')).toHaveLength(0);
    expect(screen.queryByText('Extension Sync')).not.toBeInTheDocument();
  });
});
