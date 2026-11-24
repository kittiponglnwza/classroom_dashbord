import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import ExamRoom from '../../src/pages/ExamRoom';
import { AuthProvider } from '../../src/contexts/AuthContext';
import { SettingsProvider } from '../../src/contexts/SettingsContext';
import { EXAM_CONFIG } from '../../src/config/exam';
import { useExamRoom } from '../../src/features/exams/useExamRoom';
import { setActiveEmail, saveProfile } from '../../src/utils/storage';

const renderExamRoom = () =>
  render(
    <MemoryRouter>
      <AuthProvider>
        <SettingsProvider>
          <ExamRoom />
        </SettingsProvider>
      </AuthProvider>
    </MemoryRouter>
  );

describe('ExamRoom transport warning and disabled lookup guard', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('classroom_hub_language', 'en');
    setActiveEmail('student@kmutnb.ac.th');
    saveProfile({ name: 'Somchai', email: 'student@kmutnb.ac.th' }, 'student@kmutnb.ac.th');
  });

  afterEach(() => {
    EXAM_CONFIG.seatingLookupEnabled = true;
    EXAM_CONFIG.seatingLookupUsesHttp = true;
    vi.restoreAllMocks();
  });

  it('displays the unencrypted HTTP transport warning before the lookup form', () => {
    renderExamRoom();

    const banner = screen.getByRole('status');
    expect(banner).toHaveTextContent(/HTTP connection that is not encrypted/i);
    expect(screen.getByPlaceholderText(/Student ID \(13 digits\)/i)).toBeInTheDocument();
  });

  it('hides lookup controls and shows the paused notice when lookup is disabled', () => {
    EXAM_CONFIG.seatingLookupEnabled = false;
    renderExamRoom();

    const banner = screen.getByRole('status');
    expect(banner).toHaveTextContent(/Automatic seat lookup is paused/i);
    expect(screen.queryByPlaceholderText(/Student ID \(13 digits\)/i)).not.toBeInTheDocument();
  });

  it('keeps useExamRoom status idle on scope change when seating lookup is disabled', () => {
    EXAM_CONFIG.seatingLookupEnabled = false;

    function Probe({ email, studentId }) {
      const { status } = useExamRoom(email, 'en', studentId);
      return <span data-testid="probe-status">{status}</span>;
    }

    const { rerender } = render(<Probe email="a@kmutnb.ac.th" studentId="" />);
    expect(screen.getByTestId('probe-status')).toHaveTextContent('idle');

    rerender(<Probe email="a@kmutnb.ac.th" studentId="6401012345678" />);
    expect(screen.getByTestId('probe-status')).toHaveTextContent('idle');
  });
});
