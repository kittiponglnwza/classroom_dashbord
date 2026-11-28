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
      attachments: [{ name: 'Sprint1_Template.pdf', size: 'Google Drive File' }],
    },
  ],
  visibleResources: [
    {
      id: 'r1',
      title: 'Scrum Guide',
      course: 'Software Engineering',
      courseCode: '010123131',
      type: 'material',
      attachments: [{ name: 'Scrum_2026.pdf', size: 'Google Drive File' }],
    },
  ],
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

  it('minimizes into a Messenger-style bottom chat bar and restores active conversation', () => {
    renderWithLayout('th');
    fireEvent.click(screen.getByTestId('floating-assistant-trigger'));

    expect(screen.getByRole('dialog', { name: 'ผู้ช่วยวางแผนการเรียน' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'ย่อหน้าต่างแชท' }));
    expect(screen.queryByRole('dialog', { name: 'ผู้ช่วยวางแผนการเรียน' })).not.toBeInTheDocument();

    const minimizedBar = screen.getByRole('region', { name: 'แชทผู้ช่วยการเรียนที่ย่อไว้' });
    expect(minimizedBar).toBeInTheDocument();

    // Click minimized tab to restore full chat popup
    fireEvent.click(minimizedBar.querySelector('button'));
    expect(screen.getByRole('dialog', { name: 'ผู้ช่วยวางแผนการเรียน' })).toBeInTheDocument();
  });

  it('attaches a PDF file in the chat composer and sends Classroom attachment metadata + base64 file payload', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          reply: 'อ่านไฟล์ Lab_Instruction.pdf เรียบร้อยแล้วครับ',
          interactionId: 'inter_pdf_1',
          model: 'gemini-3.5-flash-lite',
        }),
    });
    globalThis.fetch = fetchMock;

    renderWithLayout('th');
    fireEvent.click(screen.getByTestId('floating-assistant-trigger'));

    const fileInput = screen.getByTestId('assistant-file-input');
    const pdfFile = new File(['%PDF-1.4 sample'], 'Lab_Instruction.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [pdfFile] } });

    await waitFor(() => {
      expect(screen.getByTestId('pending-attachments-tray')).toHaveTextContent('Lab_Instruction.pdf');
    });

    fireEvent.click(screen.getByRole('button', { name: 'ส่งข้อความ' }));

    await waitFor(() => {
      expect(screen.getByText(/อ่านไฟล์ Lab_Instruction.pdf เรียบร้อยแล้วครับ/)).toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, opts] = fetchMock.mock.calls[0];
    const sentBody = JSON.parse(opts.body);
    expect(sentBody.files).toHaveLength(1);
    expect(sentBody.files[0].name).toBe('Lab_Instruction.pdf');
    expect(sentBody.files[0].mimeType).toBe('application/pdf');
    expect(sentBody.context.assignments[0].attachments[0].name).toBe('Sprint1_Template.pdf');
    expect(sentBody.context.resources[0].attachments[0].name).toBe('Scrum_2026.pdf');
  });
});
