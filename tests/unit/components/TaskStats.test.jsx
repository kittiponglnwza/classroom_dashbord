import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import TaskStats from '../../../src/components/TaskStats';

describe('TaskStats', () => {
  const mockAssignments = [
    { id: '1', status: 'todo' },
    { id: '2', status: 'done' },
    { id: '3', status: 'doing' },
    { id: '4', status: 'done' }
  ];

  it('displays correct counts for total, completed, and todo', () => {
    // In English, the labels from t() would typically be 'All Assignments', 'To Do', 'Completed'
    render(<TaskStats assignments={mockAssignments} lang="en" exams={[]} />);

    // Total = 4
    // Todo = 1
    // Done = 2
    // The component displays the values inside elements.
    
    // Check that we have elements with text "4", "1", "2"
    expect(screen.getByText('4')).toBeInTheDocument(); // Total
    expect(screen.getByText('1')).toBeInTheDocument(); // Todo
    expect(screen.getByText('2')).toBeInTheDocument(); // Done

    // The percentage of done/total: (2/4) * 100 = 50%
    expect(screen.getByText(/50%/)).toBeInTheDocument();
  });
});

