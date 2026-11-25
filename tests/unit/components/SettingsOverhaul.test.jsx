import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import Settings from '../../../src/pages/Settings';
import { DiscordService } from '../../../src/services/DiscordService';
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

  it('renders realistic KMUTNB Student ID Card (front + flip to 13-digit back) and switches cleanly across top horizontal tabs', () => {
    localStorage.setItem(`classroom_hub_${EMAIL}_language`, 'th');
    renderSettings('/settings');

    // Account & ID category is active by default and shows official KMUTNB card front
    expect(screen.getByTestId('settings-nav-account')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('มหาวิทยาลัยเทคโนโลยีพระจอมเกล้าพระนครเหนือ')).toBeInTheDocument();
    expect(screen.getByText('67-040626-1111-5')).toBeInTheDocument();

    // Flip card to inspect 13-digit segment breakdown on back
    fireEvent.click(screen.getByTestId('flip-student-card-btn'));
    expect(screen.getByText('โครงสร้างรหัสนักศึกษา 13 หลัก มจพ.')).toBeInTheDocument();
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

    // 24/7 Cloud Script is hidden from main tabs and main Discord view; tucked inside Advanced
    expect(screen.queryByTestId('settings-nav-cloud')).not.toBeInTheDocument();
    expect(screen.queryByTestId('copy-apps-script-btn')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /ขั้นสูง/i }));
    fireEvent.click(screen.getByTestId('toggle-optional-cloud-script'));
    expect(screen.getByTestId('copy-apps-script-btn')).toBeInTheDocument();
  });

  it('deep-links via ?tab=about and renders the GitHub Developer & Repository Showcase', () => {
    localStorage.setItem(`classroom_hub_${EMAIL}_language`, 'en');
    renderSettings('/settings?tab=about');

    expect(screen.getByTestId('settings-nav-about')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('Kittipong Teerasee')).toBeInTheDocument();
    expect(screen.getByText('@kittiponglnwza')).toBeInTheDocument();
    expect(screen.getByText('Classroom-Hub')).toBeInTheDocument();
    expect(screen.getByAltText('Kittipong Teerasee')).toHaveAttribute('src', '/dev-kittipong.jpg');

    const ghLink = screen.getByRole('link', { name: /GitHub Profile/i });
    expect(ghLink).toHaveAttribute('href', 'https://github.com/kittiponglnwza');
    expect(screen.getByTestId('settings-version-badge')).toBeInTheDocument();

    // Verify Discord webhook payload includes HTTPS PNG avatar_url so Discord shows CH icon instead of default Clyde avatar
    const sanitized = DiscordService.sanitizePayload({ content: 'Hello' });
    expect(sanitized.avatar_url).toMatch(/^https:\/\/.+\/pwa-192x192\.png$/);
  });
});
