import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TaskFilters from '../../../src/components/TaskFilters';

describe('TaskFilters', () => {
  const defaultProps = {
    searchQuery: '',
    setSearchQuery: vi.fn(),
    selectedCourse: 'all',
    setSelectedCourse: vi.fn(),
    selectedStatus: 'all',
    setSelectedStatus: vi.fn(),
    sortBy: 'due-asc',
    setSortBy: vi.fn(),
    viewType: 'grid',
    setViewType: vi.fn(),
    visibleCourses: [{ id: '1', name: 'Math' }],
    lang: 'en'
  };

  it('calls setSearchQuery on search input change', async () => {
    const mockSetSearchQuery = vi.fn();
    const Wrapper = () => {
      const [q, setQ] = React.useState('');
      return <TaskFilters {...defaultProps} searchQuery={q} setSearchQuery={(v) => { setQ(v); mockSetSearchQuery(v); }} />;
    };
    render(<Wrapper />);
    
    const searchInput = screen.getByRole('textbox');
    
    // Simulate typing
    fireEvent.change(searchInput, { target: { value: 'Homework' } });
    
    const { waitFor } = await import('@testing-library/react');
    await waitFor(() => {
      expect(mockSetSearchQuery).toHaveBeenCalledWith('Homework');
    });
  });

  it('toggles filter buttons (view types) correctly', () => {
    render(<TaskFilters {...defaultProps} />);
    
    const listBtn = screen.getByTitle('List View');
    const gridBtn = screen.getByTitle('Grid View');
    const kanbanBtn = screen.getByTitle('Kanban Board');
    
    fireEvent.click(listBtn);
    expect(defaultProps.setViewType).toHaveBeenCalledWith('list');

    fireEvent.click(gridBtn);
    expect(defaultProps.setViewType).toHaveBeenCalledWith('grid');

    fireEvent.click(kanbanBtn);
    expect(defaultProps.setViewType).toHaveBeenCalledWith('kanban');
  });
});
