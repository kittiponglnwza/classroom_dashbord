import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Layout from '../../../src/components/Layout';
import { AuthContext } from '../../../src/contexts/AuthContext';
import { SettingsProvider } from '../../../src/contexts/SettingsContext';
import { ToastProvider } from '../../../src/contexts/ToastContext';
import { ClassroomContext } from '../../../src/contexts/ClassroomContext';
import { ClassroomUIContext } from '../../../src/contexts/ClassroomUIContext';
import { saveToken } from '../../../src/utils/storage';

const mockClassroomValue = {
  assignments: [],
  courses: [],
  resources: [],
  topics: [],
  schedule: [
    {
      id: 's1',
      title: 'Software Engineering',
      courseCode: '010123131',
      day: 'Monday',
      startTime: '13:00',
      endTime: '16:00',
      room: '78-601',
    },
  ],
  isSyncing: false,
  lastSyncTime: null,
  syncClassroom: vi.fn(),
};

const mockUiValue = {
  visibleCourses: [{ id: 'c1', name: 'Software Engineering', code: '010123131' }],
  visibleAssignments: [
    {
      id: 'a1',
      title: 'Sprint 1 Backlog',
      course: 'Software Engineering',
      courseCode: '010123131',
      dueDate: '2026-11-30T23:59:00',
      status: 'todo',
      points: 20,
      description: 'Submit user stories.',
    },
  ],
  visibleResources: [],
  hiddenCourseIds: [],
};

const mockAuthValue = {
  accessToken: 'mock-oauth-token',
  isLoggedIn: true,
  profile: { name: 'Somchai', email: 's6601012610012@email.kmutnb.ac.th' },
  login: vi.fn(),
  logout: vi.fn(),
};

function renderWithLayout(lang = 'th') {
  localStorage.setItem('classroom_hub_language', lang);
  saveToken('mock-oauth-token');

  return render(
    <MemoryRouter initialEntries={['/']}>
      <AuthContext.Provider value={mockAuthValue}>
        <SettingsProvider>
          <ToastProvider>
            <ClassroomContext.Provider value={mockClassroomValue}>
              <ClassroomUIContext.Provider value={mockUiValue}>
                <Layout>
                  <div>Main Workspace</div>
                </Layout>
              </ClassroomUIContext.Provider>
            </ClassroomContext.Provider>
          </ToastProvider>
        </SettingsProvider>
      </AuthContext.Provider>
    </MemoryRouter>
  );
}

describe('Study Assistant Drawer & Gemini Frontend Service', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('opens Study Assistant from floating trigger, sends context to /api/gemini, and preserves previousInteractionId', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            reply: '- **Sprint 1 Backlog** ครบกำหนดวันที่ 30 พ.ย. ควรเริ่มทำก่อน',
            interactionId: 'inter_turn_1',
            model: 'gemini-4-hydrogen',
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            reply: 'แนะนำให้แบ่งเวลาวันจันทร์หลัง 16:00 น. เพื่อเขียน User Stories',
            interactionId: 'inter_turn_2',
            model: 'gemini-4-hydrogen',
          }),
      });
    globalThis.fetch = fetchMock;

    renderWithLayout('th');

    const floatingBtn = screen.getByTestId('floating-assistant-trigger');
    fireEvent.click(floatingBtn);

    const dialog = screen.getByRole('dialog', { name: 'ผู้ช่วยวางแผนการเรียน' });
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveTextContent('งานค้าง 1 · ตารางเรียน 1 · สอบ 0');

    // Click first starter prompt
    fireEvent.click(screen.getByRole('button', { name: /จัดลำดับงานด่วนที่ควรทำก่อน/ }));

    await waitFor(() => {
      expect(screen.getByText(/ครบกำหนดวันที่ 30 พ.ย./)).toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url1, opts1] = fetchMock.mock.calls[0];
    expect(url1).toBe('/api/gemini');
    expect(opts1.headers.Authorization).toBe('Bearer mock-oauth-token');
    const body1 = JSON.parse(opts1.body);
    expect(body1.previousInteractionId).toBeUndefined();
    expect(body1.context.assignments[0].title).toBe('Sprint 1 Backlog');

    // Send follow-up message in the same conversation
    const input = screen.getByPlaceholderText('ถามเกี่ยวกับการบ้าน ตารางเรียน หรือวันสอบ');
    fireEvent.change(input, { target: { value: 'ควรแบ่งเวลาทำวันไหนดี' } });
    fireEvent.click(screen.getByRole('button', { name: 'ส่งข้อความ' }));

    await waitFor(() => {
      expect(screen.getByText(/แนะนำให้แบ่งเวลาวันจันทร์หลัง 16:00 น./)).toBeInTheDocument();
    });

    const [, opts2] = fetchMock.mock.calls[1];
    const body2 = JSON.parse(opts2.body);
    expect(body2.previousInteractionId).toBe('inter_turn_1');
  });

  it('displays a clear setup alert when server returns MISSING_API_KEY (503)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 503,
      text: async () =>
        JSON.stringify({
          error: 'Gemini API key is not configured on the server.',
          code: 'MISSING_API_KEY',
        }),
    });

    renderWithLayout('th');
    fireEvent.click(screen.getByTestId('floating-assistant-trigger'));

    const input = screen.getByPlaceholderText('ถามเกี่ยวกับการบ้าน ตารางเรียน หรือวันสอบ');
    fireEvent.change(input, { target: { value: 'สวัสดี' } });
    fireEvent.click(screen.getByRole('button', { name: 'ส่งข้อความ' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('GEMINI_API_KEY');
    });
  });

  it('ignores Enter while IME composition is active (isComposing / keyCode 229) and submits on plain Enter', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          reply: 'รับทราบครับ',
          interactionId: 'inter_ime_1',
          model: 'gemini-4-hydrogen',
        }),
    });
    globalThis.fetch = fetchMock;

    renderWithLayout('th');
    fireEvent.click(screen.getByTestId('floating-assistant-trigger'));

    const input = screen.getByPlaceholderText('ถามเกี่ยวกับการบ้าน ตารางเรียน หรือวันสอบ');
    fireEvent.change(input, { target: { value: 'ตารางสอบ' } });

    // Simulate IME confirmation Enter — must NOT submit prematurely
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true, keyCode: 229 });
    expect(fetchMock).not.toHaveBeenCalled();

    // Plain Enter after composition finishes — submits normally
    fireEvent.keyDown(input, { key: 'Enter', isComposing: false });
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });
});
