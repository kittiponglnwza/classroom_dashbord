import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Sidebar from '../../../src/components/Sidebar';
import { AuthProvider } from '../../../src/contexts/AuthContext';
import { SettingsProvider } from '../../../src/contexts/SettingsContext';
import { ClassroomContext } from '../../../src/contexts/ClassroomContext';
import { ClassroomUIContext } from '../../../src/contexts/ClassroomUIContext';
import { setActiveEmail, saveProfile } from '../../../src/utils/storage';

const mockMatchMedia = (width) => {
  window.matchMedia = vi.fn().mockImplementation((query) => {
    const minMatch = query.match(/min-width:\s*(\d+)px/);
    const minWidth = minMatch ? Number(minMatch[1]) : 0;
    return {
      matches: width >= minWidth,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    };
  });
};

const renderSidebar = ({ onLinkClick = null, initialEntries = ['/'] } = {}) => {
  const classroomValue = {
    assignments: [],
    courses: [],
    resources: [],
    topics: [],
    schedule: [],
    isSyncing: false,
    lastSyncTime: null,
    syncClassroom: vi.fn(),
  };

  const uiValue = {
    visibleCourses: [{ id: 'c1', name: 'Algorithms', color: 'blue' }],
    visibleAssignments: [
      { id: 'a1', courseId: 'c1', course: 'Algorithms', status: 'todo' },
      { id: 'a2', courseId: 'c1', course: 'Algorithms', status: 'read' },
    ],
    visibleResources: [],
    hiddenCourseIds: [],
  };

  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <AuthProvider>
        <SettingsProvider>
          <ClassroomContext.Provider value={classroomValue}>
            <ClassroomUIContext.Provider value={uiValue}>
              <Sidebar onLinkClick={onLinkClick} />
            </ClassroomUIContext.Provider>
          </ClassroomContext.Provider>
        </SettingsProvider>
      </AuthProvider>
    </MemoryRouter>
  );
};

describe('Sidebar responsive and overflow layout', () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('classroom_hub_language', 'en');
    setActiveEmail('student@kmutnb.ac.th');
    saveProfile({ name: 'Somchai', email: 'student@kmutnb.ac.th' }, 'student@kmutnb.ac.th');
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('uses h-full min-h-0 so the sidebar does not overflow iPad viewports and updates on resize', () => {
    mockMatchMedia(820); // iPad portrait (< 1024px)
    const { container } = renderSidebar();

    const aside = container.querySelector('aside');
    expect(aside).toHaveClass('h-full', 'min-h-0', 'w-18');
    expect(aside).not.toHaveClass('h-screen');
    expect(screen.queryByText('Classroom Hub')).not.toBeInTheDocument();

    act(() => {
      mockMatchMedia(1180); // iPad landscape / desktop (>= 1024px)
      window.dispatchEvent(new Event('resize'));
    });

    expect(aside).toHaveClass('w-60');
    expect(screen.getByText('Classroom Hub')).toBeInTheDocument();
    expect(screen.getByText('Algorithms')).toBeInTheDocument();
    expect(screen.getByText('Exam Seating')).toBeInTheDocument();
  });

  it('keeps the mobile drawer expanded on narrow screens and invokes onLinkClick', () => {
    mockMatchMedia(390); // Mobile viewport
    const onLinkClick = vi.fn();
    const { container } = renderSidebar({ onLinkClick });

    const aside = container.querySelector('aside');
    expect(aside).toHaveClass('w-60');
    expect(screen.getByText('Classroom Hub')).toBeInTheDocument();
    expect(screen.getByText('Home')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Home'));
    expect(onLinkClick).toHaveBeenCalledTimes(1);
  });
});
