import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, afterEach } from 'vitest';
import NextExamWidget from '../../../src/components/NextExamWidget';

const renderWidget = (props) =>
  render(
    <MemoryRouter>
      <NextExamWidget {...props} />
    </MemoryRouter>
  );

describe('NextExamWidget', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders loading skeleton while fetching exams', () => {
    renderWidget({
      allExams: [],
      unlistedInfo: null,
      hasCheckedExams: false,
      isFetchingExams: true,
      seatingLookupEnabled: true,
      lang: 'en',
    });

    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
  });

  it('renders seating check prompt when lookup is enabled and not checked yet', () => {
    renderWidget({
      allExams: [],
      unlistedInfo: null,
      hasCheckedExams: false,
      isFetchingExams: false,
      seatingLookupEnabled: true,
      lang: 'en',
    });

    expect(screen.getByText('Check your Exam Seating & Rooms')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Check Seating now/i })).toHaveAttribute('href', '/exam-room');
  });

  it('renders unavailable notice and manual action when lookup is disabled', () => {
    renderWidget({
      allExams: [],
      unlistedInfo: null,
      hasCheckedExams: false,
      isFetchingExams: false,
      seatingLookupEnabled: false,
      lang: 'en',
    });

    expect(screen.getByText(/Automatic seat lookup is paused/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Add exams manually/i })).toHaveAttribute('href', '/exam-room');
  });

  it('renders the earliest upcoming exam card with room and seat', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-24T10:00:00'));

    renderWidget({
      allExams: [
        {
          id: 'past',
          courseCode: '040613100',
          courseName: 'Past Exam',
          date: '20 Nov 2026',
          rawIsoDate: '2026-11-20',
          time: '09:00-12:00',
          room: '78-101',
          seat: '1',
        },
        {
          id: 'later',
          courseCode: '040613205',
          courseName: 'Later Course',
          date: '30 Nov 2026',
          rawIsoDate: '2026-11-30',
          time: '09:00-12:00',
          room: '78-305',
          seat: '8',
        },
        {
          id: 'next',
          courseCode: '040613203',
          courseName: 'Structured Programming',
          date: '24 Nov 2026',
          rawIsoDate: '2026-11-24',
          time: '13:00-16:00',
          room: '78-621',
          seat: '12',
        },
      ],
      unlistedInfo: null,
      hasCheckedExams: true,
      isFetchingExams: false,
      seatingLookupEnabled: true,
      lang: 'en',
    });

    expect(screen.getByText('Structured Programming')).toBeInTheDocument();
    expect(screen.getByText('040613203')).toBeInTheDocument();
    expect(screen.getByText('78-621')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('renders unlisted alert when no upcoming exams and unlistedInfo is present', () => {
    renderWidget({
      allExams: [],
      unlistedInfo: { message: 'Not listed' },
      hasCheckedExams: true,
      isFetchingExams: false,
      seatingLookupEnabled: true,
      lang: 'en',
    });

    expect(screen.getByText('No Seating Found / Unlisted')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /View Petition Links/i })).toHaveAttribute('href', '/exam-room');
  });

  it('renders empty state when checked and there are no upcoming exams', () => {
    renderWidget({
      allExams: [],
      unlistedInfo: null,
      hasCheckedExams: true,
      isFetchingExams: false,
      seatingLookupEnabled: true,
      lang: 'en',
    });

    expect(screen.getByText('No upcoming exams found')).toBeInTheDocument();
  });
});
