import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import Settings from '../../../src/pages/Settings';
import { AuthProvider } from '../../../src/contexts/AuthContext';
import { SettingsProvider } from '../../../src/contexts/SettingsContext';
import { ClassroomContext } from '../../../src/contexts/ClassroomContext';
import { setActiveEmail, saveToken, saveProfile, saveAlertSettings } from '../../../src/utils/storage';

const EMAIL = 's6704062611115@email.kmutnb.ac.th';
const VALID_WEBHOOK =
  'https://discord.com/api/webhooks/987654321098765432/ZyXwVuTsRqPoNmLkJiHgFeDcBa_0987654321';

function renderSettings(initialEntry = '/settings') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <AuthProvider>
        <SettingsProvider>
          <ClassroomContext.Provider
            value={{
              assignments: [
                {
                  id: 'hw-1',
                  title: 'Distributed Consensus Lab',
                  course: 'Distributed Systems',
                  status: 'todo',
                  points: 30,
                  dueDate: '2026-12-01'
                }
              ],
              schedule: [
                {
                  id: 'cls-1',
                  title: 'Distributed Systems',
                  courseCode: '040613401',
                  day: 'wed',
                  startTime: '09:00',
                  endTime: '12:00',
                  room: '78-618'
                }
              ],
              resources: []
            }}
          >
            <Settings />
          </ClassroomContext.Provider>
        </SettingsProvider>
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('Modular Settings UI Overhaul (Student Pass, Live Discord Preview, Cloud Script & Dev Showcase)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
    setActiveEmail(EMAIL);
    saveToken('tok-settings-ui', 3600);
    saveProfile({ name: 'TopZ', email: EMAIL }, EMAIL);
    saveAlertSettings(
      {
        discordEnabled: true,
        discordWebhookUrl: VALID_WEBHOOK
      },
      EMAIL
    );
  });

  it('renders segmented 13-digit KMUTNB Student Credential card on Account tab and switches cleanly across all 5 categories', () => {
    localStorage.setItem(`classroom_hub_${EMAIL}_language`, 'th');
    renderSettings('/settings');

    // Account & ID category is active by default and shows segmented ID blocks
    expect(screen.getByTestId('settings-nav-account')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('บัตรประจำตัวนักศึกษา · มจพ.')).toBeInTheDocument();
    expect(screen.getByText('67')).toBeInTheDocument();
    expect(screen.getByText('11115')).toBeInTheDocument();

    // Switch to Google Calendar category
    fireEvent.click(screen.getByTestId('settings-nav-calendar'));
    expect(screen.getByTestId('settings-nav-calendar')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('ซิงก์ปฏิทิน Google Calendar')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ซิงก์ตอนนี้/i })).toBeInTheDocument();

    // Switch to Discord Assistant category -> verify live embed preview updates per selected template
    fireEvent.click(screen.getByTestId('settings-nav-discord'));
    const embedCard = screen.getByTestId('discord-live-embed-card');
    expect(embedCard.textContent).toContain('Distributed Systems');

    fireEvent.click(screen.getByTestId('preview-mode-assignment'));
    expect(screen.getByTestId('discord-live-embed-card').textContent).toContain('Distributed Consensus Lab');

    // Jump from Discord Assistant shortcut straight to 24/7 Cloud Script category
    fireEvent.click(screen.getByText(/ต้องการให้แจ้งเตือนทำงาน 24 ชม\./i));
    expect(screen.getByTestId('settings-nav-cloud')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('Code.gs')).toBeInTheDocument();
  });

  it('deep-links via ?tab=about and renders the GitHub Developer & Repository Showcase', () => {
    localStorage.setItem(`classroom_hub_${EMAIL}_language`, 'en');
    renderSettings('/settings?tab=about');

    expect(screen.getByTestId('settings-nav-about')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('Kittipong Teerasee')).toBeInTheDocument();
    expect(screen.getByText('@kittiponglnwza')).toBeInTheDocument();
    expect(screen.getByText('Classroom-Hub')).toBeInTheDocument();

    const ghLink = screen.getByRole('link', { name: /GitHub Profile/i });
    expect(ghLink).toHaveAttribute('href', 'https://github.com/kittiponglnwza');
    expect(screen.getByTestId('settings-version-badge')).toBeInTheDocument();
  });
});
