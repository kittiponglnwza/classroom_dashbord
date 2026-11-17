import React, { useRef } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import Home from '../../src/pages/Home';
import Dashboard from '../../src/pages/Dashboard';
import Courses from '../../src/pages/Courses';
import AssignmentDetail from '../../src/pages/AssignmentDetail';
import Schedule from '../../src/pages/Schedule';
import NotificationPopover from '../../src/components/NotificationPopover';
import { AuthProvider } from '../../src/contexts/AuthContext';
import { SettingsProvider } from '../../src/contexts/SettingsContext';
import { ClassroomContext } from '../../src/contexts/ClassroomContext';
import { ClassroomUIContext } from '../../src/contexts/ClassroomUIContext';
import {
  setActiveEmail, saveToken, saveProfile, addNotificationHistoryLog, getNotificationHistory
} from '../../src/utils/storage';

const mockCourses = [
  { id: 'c1', name: 'Math 101', code: 'MA101', instructor: 'Dr. Euler', color: 'blue' },
  { id: 'c2', name: 'Physics 201', code: 'PH201', instructor: 'Dr. Bohr', color: 'emerald' }
];

const mockAssignments = [
  {
    id: 'assign-1',
    title: 'Calculus Problem Set',
    course: 'Math 101',
    courseCode: 'MA101',
    courseId: 'c1',
    dueDate: '2026-11-25T23:59:59',
    status: 'todo',
    points: 100,
    description: 'Solve chapters 1 to 3.',
    attachments: [],
    courseColor: 'blue'
  },
  {
    id: 'assign-2',
    title: 'Quantum Mechanics Lab',
    course: 'Physics 201',
    courseCode: 'PH201',
    courseId: 'c2',
    dueDate: '2026-11-28T23:59:59',
    status: 'doing',
    points: 50,
    description: 'Write lab report.',
    attachments: [],
    courseColor: 'emerald'
  }
];

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="current-location">{`${location.pathname}${location.search}`}</div>;
}

function TestApp({ initialEntries = ['/'], scheduleEntries = [], onSaveSchedule = vi.fn(), onStatusChange = vi.fn() }) {
  const bellRef = useRef(null);
  const [notifOpen, setNotifOpen] = React.useState(false);

  const classroomValue = {
    assignments: mockAssignments,
    courses: mockCourses,
    resources: [],
    topics: [],
    schedule: scheduleEntries,
    isSyncing: false,
    lastSyncTime: null,
    syncClassroom: vi.fn(),
    handleStatusChange: onStatusChange,
    handleNotesChange: vi.fn(),
    handleDueDateChange: vi.fn(),
    handleAddAssignment: vi.fn(),
    handleTrackAsAssignment: vi.fn(),
    handleUntrackAssignment: vi.fn(),
    handleSaveScheduleEntry: onSaveSchedule,
    handleDeleteScheduleEntry: vi.fn(),
    handleClearSchedule: vi.fn()
  };

  const uiValue = {
    visibleCourses: mockCourses,
    visibleAssignments: mockAssignments,
    visibleResources: [],
    hiddenCourseIds: [],
    handleToggleCourseVisibility: vi.fn(),
    handleToggleBulkCourses: vi.fn()
  };

  return (
    <MemoryRouter initialEntries={initialEntries}>
      <AuthProvider>
        <SettingsProvider>
          <ClassroomContext.Provider value={classroomValue}>
            <ClassroomUIContext.Provider value={uiValue}>
              <button type="button" ref={bellRef} onClick={() => setNotifOpen(v => !v)} data-testid="test-bell-btn">
                Bell
              </button>
              <NotificationPopover
                isNotificationsOpen={notifOpen}
                setIsNotificationsOpen={setNotifOpen}
                bellButtonRef={bellRef}
              />
              <LocationDisplay />
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/courses" element={<Courses />} />
                <Route path="/assignments/:id" element={<AssignmentDetail />} />
                <Route path="/schedule" element={<Schedule />} />
              </Routes>
            </ClassroomUIContext.Provider>
          </ClassroomContext.Provider>
        </SettingsProvider>
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('End-to-End Navigation & User Journey Flows', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    setActiveEmail('student@kmutnb.ac.th');
    saveToken('valid-token', 3600);
    saveProfile({ name: 'Somchai', email: 'student@kmutnb.ac.th' }, 'student@kmutnb.ac.th');
  });

  it('Journey 1: Home -> Assignment -> Back returns to Home (/)', () => {
    render(<TestApp initialEntries={['/']} />);
    expect(screen.getByTestId('current-location').textContent).toBe('/');

    fireEvent.click(screen.getByText('Calculus Problem Set'));
    expect(screen.getByTestId('current-location').textContent).toBe('/assignments/assign-1');
    expect(screen.getByTestId('assignment-back-button').textContent).toContain('Back to Home');

    fireEvent.click(screen.getByTestId('assignment-back-button'));
    expect(screen.getByTestId('current-location').textContent).toBe('/');
  });

  it('Journey 2 & 7: Dashboard (with filter/search URL params) -> Assignment -> Back preserves Dashboard URL state', () => {
    render(<TestApp initialEntries={['/dashboard?q=Calculus&course=Math%20101&view=grid']} />);
    expect(screen.getByTestId('current-location').textContent).toBe('/dashboard?q=Calculus&course=Math%20101&view=grid');

    fireEvent.click(screen.getByText('Calculus Problem Set'));
    expect(screen.getByTestId('current-location').textContent).toBe('/assignments/assign-1');

    fireEvent.click(screen.getByTestId('assignment-back-button'));
    expect(screen.getByTestId('current-location').textContent).toBe('/dashboard?q=Calculus&course=Math%20101&view=grid');
  });

  it('Journey 3: Courses -> Course Details -> Assignments Tab -> Assignment -> Back restores exact Course and Tab', () => {
    render(<TestApp initialEntries={['/courses']} />);
    expect(screen.getByTestId('current-location').textContent).toBe('/courses');

    // Select Math 101
    fireEvent.click(screen.getByText('Math 101'));
    expect(screen.getByTestId('current-location').textContent).toBe('/courses?selected=Math+101');

    // Switch to Assignments tab
    fireEvent.click(screen.getByText(/Assignments/i));
    expect(screen.getByTestId('current-location').textContent).toBe('/courses?selected=Math+101&tab=assignments');

    // Open assignment
    fireEvent.click(screen.getByText('Calculus Problem Set'));
    expect(screen.getByTestId('current-location').textContent).toBe('/assignments/assign-1');
    expect(screen.getByTestId('assignment-back-button').textContent).toContain('Back to Math 101');

    // Click Back -> returns to Math 101 Assignments tab!
    fireEvent.click(screen.getByTestId('assignment-back-button'));
    expect(screen.getByTestId('current-location').textContent).toBe('/courses?selected=Math+101&tab=assignments');
  });

  it('Journey 5 & 6: Direct URL access (/assignments/assign-1) renders detail page and provides fallback Back to /dashboard', () => {
    render(<TestApp initialEntries={['/assignments/assign-1']} />);
    expect(screen.getByTestId('current-location').textContent).toBe('/assignments/assign-1');
    expect(screen.getByText('Calculus Problem Set')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('assignment-back-button'));
    expect(screen.getByTestId('current-location').textContent).toBe('/dashboard');
  });

  it('Journey 8: Schedule -> Edit Event -> Save, and Schedule -> Assignment Block -> Back preserves schedule view', () => {
    const onSaveSchedule = vi.fn();
    const initialSchedule = [
      {
        id: 'sched-1',
        title: 'Math 101',
        courseCode: 'MA101',
        courseId: 'c1',
        day: 'mon',
        date: '',
        startTime: '09:00',
        endTime: '12:00',
        room: 'B-101',
        color: '#0071E3',
        notes: ''
      }
    ];

    render(<TestApp initialEntries={['/schedule?view=daily&day=mon']} scheduleEntries={initialSchedule} onSaveSchedule={onSaveSchedule} />);
    expect(screen.getByTestId('current-location').textContent).toBe('/schedule?view=daily&day=mon');

    // Click the Monday class card to edit
    fireEvent.click(screen.getByText('Math 101'));
    expect(screen.getByText('Edit Class')).toBeInTheDocument();

    // Save changes
    fireEvent.click(screen.getByText('Save'));
    expect(onSaveSchedule).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('current-location').textContent).toBe('/schedule?view=daily&day=mon');
  });

  it('Journey 9: Notification -> Open Related Content -> Marks Read -> Back returns to previous context', () => {
    addNotificationHistoryLog(
      {
        title: "Sent reminder for 'Calculus Problem Set' (Due today!)",
        type: 'due_today',
        assignmentId: 'assign-1',
        targetPath: '/assignments/assign-1',
        read: false
      },
      'student@kmutnb.ac.th'
    );

    render(<TestApp initialEntries={['/courses']} />);
    expect(screen.getByTestId('current-location').textContent).toBe('/courses');

    fireEvent.click(screen.getByTestId('test-bell-btn'));
    fireEvent.click(screen.getByText('Open'));

    // Navigated to the assignment and marked notification as read
    expect(screen.getByTestId('current-location').textContent).toBe('/assignments/assign-1');
    expect(getNotificationHistory('student@kmutnb.ac.th')[0].read).toBe(true);

    // Clicking Back returns to /courses where the notification was opened from
    fireEvent.click(screen.getByTestId('assignment-back-button'));
    expect(screen.getByTestId('current-location').textContent).toBe('/courses');
  });
});
