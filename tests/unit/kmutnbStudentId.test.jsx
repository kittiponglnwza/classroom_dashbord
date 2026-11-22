import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { decodeKmutnbStudentId } from '../../src/utils/kmutnbStudentId';
import Settings from '../../src/pages/Settings';
import { AuthProvider } from '../../src/contexts/AuthContext';
import { SettingsProvider } from '../../src/contexts/SettingsContext';
import { ClassroomContext } from '../../src/contexts/ClassroomContext';
import { setActiveEmail, saveToken, saveProfile, getProfile } from '../../src/utils/storage';

function renderSettingsPage() {
  return render(
    <MemoryRouter initialEntries={['/settings']}>
      <AuthProvider>
        <SettingsProvider>
          <ClassroomContext.Provider value={{ assignments: [] }}>
            <Settings />
          </ClassroomContext.Provider>
        </SettingsProvider>
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('KMUTNB 13-digit Student ID Decoder & Settings Profile Card', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('decodes KMUTNB student ID 6704062611115 into entry year, year level, faculty, department, and CS program', () => {
    const decoded = decodeKmutnbStudentId('6704062611115', {
      now: new Date('2026-11-20T00:00:00Z'),
    });

    expect(decoded).not.toBeNull();
    expect(decoded.entryYearBE).toBe(2567);
    expect(decoded.yearLevel).toBe(3);
    expect(decoded.facultyCode).toBe('04');
    expect(decoded.faculty.th).toBe('คณะวิทยาศาสตร์ประยุกต์');
    expect(decoded.faculty.en).toBe('Faculty of Applied Science');
    expect(decoded.departmentCode).toBe('06');
    expect(decoded.department.th).toBe('ภาควิชาวิทยาการคอมพิวเตอร์และสารสนเทศ');
    expect(decoded.department.en).toBe('Department of Computer and Information Science');
    expect(decoded.programCode).toBe('26');
    expect(decoded.program.short).toBe('CS');
    expect(decoded.campusLabel.en).toBe('KMUTNB Bangkok');
    expect(decoded.suggestedMajor.en).toBe('Computer Science (CS)');
    expect(decoded.segments.map((s) => s.value)).toEqual(['67', '04', '06', '26', '11115']);
  });

  it('detects Prachinburi (06) and Rayong (12, 13) campuses and returns null for non-KMUTNB / invalid IDs', () => {
    const prachin = decodeKmutnbStudentId('6706021610001', {
      now: new Date('2026-11-20T00:00:00Z'),
    });
    expect(prachin?.faculty.short).toBe('FITM');
    expect(prachin?.campusLabel.en).toBe('KMUTNB Prachinburi');
    expect(prachin?.campusLabel.th).toBe('มจพ. ปราจีนบุรี');
    expect(prachin?.department?.short).toBe('IT');

    const rayong = decodeKmutnbStudentId('6712011610001', {
      now: new Date('2026-11-20T00:00:00Z'),
    });
    expect(rayong?.faculty.short).toBe('FET');
    expect(rayong?.campusLabel.en).toBe('KMUTNB Rayong');
    expect(rayong?.campusLabel.th).toBe('มจพ. ระยอง');

    // Non-KMUTNB / invalid IDs return null
    expect(decodeKmutnbStudentId('6799062611115')).toBeNull(); // unknown faculty code
    expect(decodeKmutnbStudentId('6704062611')).toBeNull();    // 10 digits (Chula/etc.)
    expect(decodeKmutnbStudentId('')).toBeNull();
    expect(decodeKmutnbStudentId('not-an-id')).toBeNull();
  });

  it('auto-fills Student ID from email and renders decoded KMUTNB faculty & department in Settings profile card (EN & TH)', () => {
    const email = 's6704062611115@email.kmutnb.ac.th';
    setActiveEmail(email);
    saveToken('tok-123', 3600);
    saveProfile({ name: 'TopZ', email }, email);

    // English UI
    localStorage.setItem(`classroom_hub_${email}_language`, 'en');
    const enView = renderSettingsPage();

    const idInputEn = screen.getByLabelText(/Student ID/i);
    expect(idInputEn.value).toBe('6704062611115');
    expect(screen.getByText('KMUTNB Bangkok')).toBeInTheDocument();
    expect(screen.getAllByText(/Faculty of Applied Science/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Computer Science \(CS\)/i).length).toBeGreaterThan(0);
    expect(screen.getByTestId('kmutnb-profile-breakdown')).toBeInTheDocument();

    // Redundant manual Major / Department input & Apply Major button are removed
    expect(screen.queryByLabelText(/Major \/ Department/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Apply Major/i })).not.toBeInTheDocument();

    // Saving profile automatically stores decoded major
    fireEvent.click(screen.getByRole('button', { name: /Save Preferences/i }));
    expect(getProfile(email).major).toBe('Computer Science (CS)');
    enView.unmount();

    // Thai UI
    localStorage.setItem(`classroom_hub_${email}_language`, 'th');
    renderSettingsPage();
    expect(screen.getByLabelText(/รหัสนักศึกษา/i).value).toBe('6704062611115');
    expect(screen.queryByLabelText(/สาขาวิชา \/ คณะ/i)).not.toBeInTheDocument();
    expect(screen.getByText('มจพ. กรุงเทพฯ')).toBeInTheDocument();
    expect(screen.getAllByText(/คณะวิทยาศาสตร์ประยุกต์/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/ภาควิชาวิทยาการคอมพิวเตอร์และสารสนเทศ/).length).toBeGreaterThan(0);
  });

  it('omits KMUTNB breakdown cleanly for non-KMUTNB accounts without valid KMUTNB student ID', () => {
    const email = 'student@otheruni.ac.th';
    setActiveEmail(email);
    saveToken('tok-456', 3600);
    saveProfile({ name: 'Other', email, studentId: '6730012321' }, email);
    localStorage.setItem(`classroom_hub_${email}_language`, 'en');

    renderSettingsPage();
    expect(screen.queryByTestId('kmutnb-profile-breakdown')).not.toBeInTheDocument();
  });
});
