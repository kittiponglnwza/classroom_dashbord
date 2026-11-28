import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Layout from '../../../src/components/Layout';
import Schedule from '../../../src/pages/Schedule';
import { AuthProvider } from '../../../src/contexts/AuthContext';
import { SettingsProvider } from '../../../src/contexts/SettingsContext';
import { ToastProvider } from '../../../src/contexts/ToastContext';
import { ClassroomContext } from '../../../src/contexts/ClassroomContext';
import { ClassroomUIContext } from '../../../src/contexts/ClassroomUIContext';
import { setActiveEmail, saveProfile } from '../../../src/utils/storage';

const mockClassroomValue = {
  assignments: [],
  courses: [],
  resources: [],
  topics: [],
  schedule: [],
  academicData: null,
  extensionStatus: { connected: false },
  isSyncing: false,
  lastSyncTime: null,
  syncClassroom: vi.fn(),
  handleSaveScheduleEntry: vi.fn(),
  handleDeleteScheduleEntry: vi.fn(),
  handleClearSchedule: vi.fn(),
  requestExtensionSync: vi.fn(),
};

const mockUiValue = {
  visibleCourses: [],
  visibleAssignments: [{ id: 'a1', title: 'Task 1', status: 'todo', courseId: 'c1', course: 'Math' }],
  visibleResources: [],
  hiddenCourseIds: [],
};

describe('Mobile Responsive Navigation & Schedule Defaults', () => {
  const originalInnerWidth = window.innerWidth;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('classroom_hub_language', 'en');
    setActiveEmail('student@kmutnb.ac.th');
    saveProfile({ name: 'Somchai', email: 'student@kmutnb.ac.th' }, 'student@kmutnb.ac.th');
  });

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: originalInnerWidth,
    });
  });

  it('renders MobileBottomNav inside Layout and opens the mobile drawer from the More button', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AuthProvider>
          <SettingsProvider>
            <ToastProvider>
              <ClassroomContext.Provider value={mockClassroomValue}>
                <ClassroomUIContext.Provider value={mockUiValue}>
                  <Layout>
                    <div>Page Body</div>
                  </Layout>
                </ClassroomUIContext.Provider>
              </ClassroomContext.Provider>
            </ToastProvider>
          </SettingsProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveAttribute('href', '#main-content');

    const bottomNav = screen.getByRole('navigation', { name: 'Mobile Bottom Navigation' });
    expect(bottomNav).toBeInTheDocument();
    expect(bottomNav).toHaveTextContent('Home');
    expect(bottomNav).toHaveTextContent('Tasks');
    expect(bottomNav).toHaveTextContent('Schedule');
    expect(bottomNav).toHaveTextContent('Courses');

    const moreBtn = screen.getByRole('button', { name: 'More navigation' });
    moreBtn.focus();
    fireEvent.click(moreBtn);
    expect(screen.getByRole('dialog', { name: 'Mobile Navigation' })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Mobile Navigation' })).not.toBeInTheDocument();
    expect(document.activeElement).toBe(moreBtn);
  });

  it('defaults Schedule to mobile-friendly Daily View on phone screens (< 768px) and still allows switching to Week view', () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 390,
    });

    render(
      <MemoryRouter initialEntries={['/schedule']}>
        <AuthProvider>
          <SettingsProvider>
            <ToastProvider>
              <ClassroomContext.Provider value={mockClassroomValue}>
                <ClassroomUIContext.Provider value={mockUiValue}>
                  <Schedule />
                </ClassroomUIContext.Provider>
              </ClassroomContext.Provider>
            </ToastProvider>
          </SettingsProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    // Phone default opens daily card view directly instead of forcing a 740px horizontal grid
    expect(screen.getByRole('button', { name: /Add to this day/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/Monday timetable row/i)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /^Weekly$/i }));
    expect(screen.getByLabelText(/Monday timetable row/i)).toBeInTheDocument();
  });
});
