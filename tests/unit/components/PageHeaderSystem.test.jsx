import { render, screen, within, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BookOpen } from 'lucide-react';
import PageHeader from '../../../src/components/PageHeader';
import SectionHeader from '../../../src/components/SectionHeader';
import Sidebar from '../../../src/components/Sidebar';
import Home from '../../../src/pages/Home';
import Dashboard from '../../../src/pages/Dashboard';
import Schedule from '../../../src/pages/Schedule';
import Courses from '../../../src/pages/Courses';
import ExamRoom from '../../../src/pages/ExamRoom';
import Academic from '../../../src/pages/Academic';
import Settings from '../../../src/pages/Settings';
import AssignmentDetail from '../../../src/pages/AssignmentDetail';
import { Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../../../src/contexts/AuthContext';
import { SettingsProvider } from '../../../src/contexts/SettingsContext';
import { ToastProvider } from '../../../src/contexts/ToastContext';
import { ClassroomContext } from '../../../src/contexts/ClassroomContext';
import { ClassroomUIContext } from '../../../src/contexts/ClassroomUIContext';
import { setActiveEmail, saveProfile } from '../../../src/utils/storage';

const sampleCourses = [
  { id: 'c1', name: 'Algorithms', code: 'CS301', instructor: 'Dr. Ada', color: 'blue' },
];

const sampleAssignments = [
  {
    id: 'a1',
    title: 'Dynamic Programming Homework',
    course: 'Algorithms',
    courseCode: 'CS301',
    courseId: 'c1',
    dueDate: '2026-12-01T23:59:59',
    status: 'todo',
    points: 20,
    attachments: [],
    courseColor: 'blue',
  },
];

function renderWithAppProviders(ui, initialEntries = ['/']) {
  const classroomValue = {
    assignments: sampleAssignments,
    courses: sampleCourses,
    resources: [],
    topics: [],
    schedule: [],
    academicData: null,
    extensionStatus: { connected: false },
    isSyncing: false,
    lastSyncTime: null,
    syncClassroom: vi.fn(),
    handleStatusChange: vi.fn(),
    handleNotesChange: vi.fn(),
    handleDueDateChange: vi.fn(),
    handleAddAssignment: vi.fn(),
    handleTrackAsAssignment: vi.fn(),
    handleUntrackAssignment: vi.fn(),
    handleSaveScheduleEntry: vi.fn(),
    handleDeleteScheduleEntry: vi.fn(),
    handleClearSchedule: vi.fn(),
    handleSaveAcademicImport: vi.fn(),
    handleUpdateManualCredits: vi.fn(),
    handleUpdateTargetCredits: vi.fn(),
    handleClearAcademicData: vi.fn(),
    requestExtensionSync: vi.fn(),
  };

  const uiValue = {
    visibleCourses: sampleCourses,
    visibleAssignments: sampleAssignments,
    visibleResources: [],
    hiddenCourseIds: [],
    handleToggleCourseVisibility: vi.fn(),
    handleToggleBulkCourses: vi.fn(),
    isItemPinned: () => false,
    handleTogglePinItem: vi.fn(),
  };

  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <AuthProvider>
        <SettingsProvider>
          <ToastProvider>
            <ClassroomContext.Provider value={classroomValue}>
              <ClassroomUIContext.Provider value={uiValue}>
                {ui}
              </ClassroomUIContext.Provider>
            </ClassroomContext.Provider>
          </ToastProvider>
        </SettingsProvider>
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('Unified PageHeader & Design System Consistency', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('classroom_hub_language', 'en');
    setActiveEmail('student@kmutnb.ac.th');
    saveProfile({ name: 'Somchai', email: 'student@kmutnb.ac.th' }, 'student@kmutnb.ac.th');
  });

  it('renders PageHeader with breadcrumbs, title, description, meta, and actions', () => {
    const onCrumbClick = vi.fn();
    render(
      <MemoryRouter>
        <PageHeader
          title="Algorithms"
          description="Instructor: Dr. Ada"
          icon={BookOpen}
          breadcrumbs={[
            { label: 'Courses', onClick: onCrumbClick },
            { label: 'CS301' },
          ]}
          meta={<span data-testid="meta-badge">CS301</span>}
          actions={<button type="button">Action</button>}
        />
        <SectionHeader title="Assignments" count={1} />
      </MemoryRouter>
    );

    const header = screen.getByTestId('page-header');
    const heading = within(header).getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('Algorithms');
    expect(screen.getByText('Instructor: Dr. Ada')).toBeInTheDocument();
    expect(screen.getByTestId('meta-badge')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Courses' }));
    expect(onCrumbClick).toHaveBeenCalledTimes(1);

    const sectionHeading = screen.getByRole('heading', { level: 2 });
    expect(sectionHeading).toHaveTextContent('Assignments');
    expect(sectionHeading).toHaveTextContent('(1)');
  });

  it('resolves the Sidebar naming conflict from Dashboard to Assignments linking to /dashboard', () => {
    renderWithAppProviders(<Sidebar />);
    const nav = screen.getByRole('navigation', { name: 'Main Navigation' });
    const assignmentsLink = within(nav).getByRole('link', { name: /Assignments/i });
    expect(assignmentsLink).toHaveAttribute('href', '/dashboard');
    expect(within(nav).queryByText(/^Dashboard$/i)).toBeNull();
  });

  it('renders standardized single-h1 PageHeader identity across all main pages without max-w-4xl narrowing', () => {
    const cases = [
      { name: 'Home', ui: <Home />, path: ['/'], expectedTitle: 'Home' },
      { name: 'Assignments (/dashboard)', ui: <Dashboard />, path: ['/dashboard'], expectedTitle: 'Assignments' },
      { name: 'Schedule', ui: <Schedule />, path: ['/schedule'], expectedTitle: 'Schedule' },
      { name: 'Courses', ui: <Courses />, path: ['/courses'], expectedTitle: 'My Enrolled Courses' },
      { name: 'ExamRoom', ui: <ExamRoom />, path: ['/exam-room'], expectedTitle: 'Exam Seating' },
      { name: 'Academic', ui: <Academic />, path: ['/academic'], expectedTitle: 'Academic & GPA' },
      { name: 'Settings', ui: <Settings />, path: ['/settings'], expectedTitle: 'Profile & Settings' },
    ];

    for (const c of cases) {
      const { unmount, container } = renderWithAppProviders(c.ui, c.path);
      const header = screen.getByTestId('page-header');
      const h1s = screen.getAllByRole('heading', { level: 1 });
      expect(h1s).toHaveLength(1);
      expect(within(header).getByRole('heading', { level: 1 })).toHaveTextContent(c.expectedTitle);
      expect(container.firstChild).not.toHaveClass('max-w-4xl');
      unmount();
    }
  });

  it('keeps Home page identity intact even after dismissing the welcome notice', () => {
    renderWithAppProviders(<Home />, ['/']);
    expect(within(screen.getByTestId('page-header')).getByRole('heading', { level: 1 })).toHaveTextContent('Home');
    expect(screen.getByRole('heading', { level: 2, name: 'Your Progress Overview' })).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Dismiss welcome banner'));
    expect(within(screen.getByTestId('page-header')).getByRole('heading', { level: 1 })).toHaveTextContent('Home');
  });

  it('renders unified PageHeader with breadcrumbs on Course Detail and Assignment Detail subviews', () => {
    const { unmount } = renderWithAppProviders(<Courses />, ['/courses?selected=Algorithms']);
    const courseHeader = screen.getByTestId('page-header');
    expect(within(courseHeader).getByRole('navigation', { name: 'Breadcrumb' })).toBeInTheDocument();
    expect(within(courseHeader).getByRole('heading', { level: 1 })).toHaveTextContent('Algorithms');
    expect(screen.getByTestId('course-back-button')).toBeInTheDocument();
    unmount();

    renderWithAppProviders(
      <Routes>
        <Route path="/assignments/:id" element={<AssignmentDetail />} />
      </Routes>,
      ['/assignments/a1']
    );
    const assignHeader = screen.getByTestId('page-header');
    expect(within(assignHeader).getByRole('navigation', { name: 'Breadcrumb' })).toBeInTheDocument();
    expect(within(assignHeader).getByRole('heading', { level: 1 })).toHaveTextContent('Dynamic Programming Homework');
    expect(screen.getByTestId('assignment-back-button')).toBeInTheDocument();
  });
});
