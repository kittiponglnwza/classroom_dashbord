import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import AssignmentCard from '../../../src/components/AssignmentCard';
import * as dateUtils from '../../../src/utils/dateUtils';

vi.mock('../../../src/utils/dateUtils', () => ({
  calculateDueState: vi.fn(),
}));

describe('AssignmentCard', () => {
  const mockAssignment = {
    id: '1',
    title: 'Test Assignment',
    course: 'Math 101',
    dueDate: '2025-10-10T10:00:00Z',
    status: 'todo',
    points: 100,
    courseColor: 'blue'
  };

  const renderComponent = (props = {}) => {
    return render(
      <MemoryRouter>
        <AssignmentCard assignment={{ ...mockAssignment, ...props.assignment }} onStatusChange={props.onStatusChange} lang="en" />
      </MemoryRouter>
    );
  };

  it('renders assignment title, due date status, and course name', () => {
    dateUtils.calculateDueState.mockReturnValue({
      type: 'dueLater',
      diffDays: 5
    });

    renderComponent();

    expect(screen.getByText('Test Assignment')).toBeInTheDocument();
    expect(screen.getByText('Math 101')).toBeInTheDocument();
    // 'daysLeft' for 5 days in English translates to "5 days left" 
    // actually, it might have a clock emoji or something. We can use regex.
    expect(screen.getByText(/5 days/i)).toBeInTheDocument();
  });

  it('calls onStatusChange when status is changed', () => {
    dateUtils.calculateDueState.mockReturnValue({
      type: 'noDate'
    });

    const onStatusChangeMock = vi.fn();
    renderComponent({ onStatusChange: onStatusChangeMock });

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'done' } });

    expect(onStatusChangeMock).toHaveBeenCalledWith('1', 'done');
  });

  it('shows overdue badge for past-due assignments', () => {
    dateUtils.calculateDueState.mockReturnValue({
      type: 'overdue',
      diffDays: 2
    });

    renderComponent();

    const overdueText = screen.getByText(/overdue.*2/i);
    expect(overdueText).toBeInTheDocument();
    expect(overdueText).toHaveClass('text-rose-400');
  });
});
