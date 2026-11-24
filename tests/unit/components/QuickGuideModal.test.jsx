import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import HeaderBar from '../../../src/components/HeaderBar';
import Home from '../../../src/pages/Home';
import RegImportModal from '../../../src/components/RegImportModal';
import { AuthProvider } from '../../../src/contexts/AuthContext';
import { SettingsProvider } from '../../../src/contexts/SettingsContext';
import { ClassroomContext } from '../../../src/contexts/ClassroomContext';
import { ClassroomUIContext } from '../../../src/contexts/ClassroomUIContext';
import { setActiveEmail, saveProfile } from '../../../src/utils/storage';

function renderWithProviders(ui, { schedule = [] } = {}) {
  const classroomValue = {
    assignments: [],
    courses: [],
    resources: [],
    topics: [],
    schedule,
    isSyncing: false,
    lastSyncTime: null,
    syncClassroom: vi.fn(),
    handleStatusChange: vi.fn(),
    handleImportRegData: vi.fn(),
    extensionStatus: { connected: false },
    requestExtensionSync: vi.fn(),
  };

  const uiValue = {
    visibleCourses: [],
    visibleAssignments: [],
    visibleResources: [],
    hiddenCourseIds: [],
  };

  return render(
    <MemoryRouter>
      <AuthProvider>
        <SettingsProvider>
          <ClassroomContext.Provider value={classroomValue}>
            <ClassroomUIContext.Provider value={uiValue}>
              {ui}
            </ClassroomUIContext.Provider>
          </ClassroomContext.Provider>
        </SettingsProvider>
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('Student Onboarding & Quick Guide', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('classroom_hub_language', 'en');
    setActiveEmail('student@kmutnb.ac.th');
    saveProfile({ name: 'Somchai', email: 'student@kmutnb.ac.th' }, 'student@kmutnb.ac.th');
  });

  it('opens QuickGuideModal from HeaderBar help button, switches tabs, exposes extension zip, and closes cleanly', () => {
    renderWithProviders(<HeaderBar setMobileMenuOpen={vi.fn()} />);

    expect(screen.queryByTestId('quick-guide-modal')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Student Quick Guide' }));

    const modal = screen.getByTestId('quick-guide-modal');
    expect(modal).toBeInTheDocument();
    expect(screen.getByText(/1\. Track Assignments & Courses/i)).toBeInTheDocument();

    fireEvent.click(within(modal).getByRole('button', { name: /Reg & Exams/i }));
    const zipLink = within(modal).getByRole('link', { name: /Download Extension \(\.zip\)/i });
    expect(zipLink).toHaveAttribute('href', '/classrooms-reg-extension.zip');

    fireEvent.click(within(modal).getByRole('button', { name: /Notifications/i }));
    expect(screen.getByText(/Discord Channel Webhook Alerts/i)).toBeInTheDocument();

    fireEvent.click(within(modal).getByRole('button', { name: /App & Privacy/i }));
    expect(screen.getByText(/Privacy, Cloud Sync & Shared Computers/i)).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('quick-guide-modal')).toBeNull();
  });

  it('shows Reg import CTA on Home when no timetable exists, and normal empty day text once timetable has entries', () => {
    const { unmount } = renderWithProviders(<Home />, { schedule: [] });
    expect(screen.getByText('No timetable imported yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Go to Schedule & Import Reg/i })).toHaveAttribute('href', '/schedule');
    unmount();

    renderWithProviders(<Home />, {
      schedule: [{ id: 's1', day: 'mon', startTime: '09:00', endTime: '12:00', courseName: 'Algo', classType: 'recurring' }],
    });
    expect(screen.queryByText('No timetable imported yet')).toBeNull();
  });

  it('provides Extension zip download inside RegImportModal Extension tab', () => {
    renderWithProviders(<RegImportModal isOpen={true} onClose={vi.fn()} lang="en" />);
    fireEvent.click(screen.getByRole('button', { name: /Extension \(Auto\)/i }));

    const zipLink = screen.getByRole('link', { name: /Download Extension \(\.zip\)/i });
    expect(zipLink).toHaveAttribute('href', '/classrooms-reg-extension.zip');
  });
});
