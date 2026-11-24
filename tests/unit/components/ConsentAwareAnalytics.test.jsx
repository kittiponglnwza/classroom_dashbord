import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import ConsentAwareAnalytics from '../../../src/components/ConsentAwareAnalytics';
import CookieConsentBanner from '../../../src/components/CookieConsentBanner';
import { SettingsProvider } from '../../../src/contexts/SettingsContext';
import { AuthProvider } from '../../../src/contexts/AuthContext';
import {
  clearCookieConsent,
  hasAnalyticsConsent,
  saveCookieConsent,
} from '../../../src/utils/cookieConsent';

const analyticsCalls = [];

vi.mock('@vercel/analytics/react', () => ({
  Analytics: (props) => {
    analyticsCalls.push(props);
    return <div data-testid="vercel-analytics-mounted" />;
  },
}));

function renderWithConsentBanner() {
  return render(
    <AuthProvider>
      <SettingsProvider>
        <CookieConsentBanner />
        <ConsentAwareAnalytics />
      </SettingsProvider>
    </AuthProvider>
  );
}

describe('ConsentAwareAnalytics', () => {
  beforeEach(() => {
    clearCookieConsent();
    sessionStorage.clear();
    localStorage.clear();
    analyticsCalls.length = 0;
  });

  it('does not mount Analytics before consent or after Reject Optional', () => {
    renderWithConsentBanner();
    expect(hasAnalyticsConsent()).toBe(false);
    expect(screen.queryByTestId('vercel-analytics-mounted')).toBeNull();
    expect(analyticsCalls).toHaveLength(0);

    fireEvent.click(screen.getByText('Reject Optional'));
    expect(hasAnalyticsConsent()).toBe(false);
    expect(screen.queryByTestId('vercel-analytics-mounted')).toBeNull();
    expect(analyticsCalls).toHaveLength(0);
  });

  it('mounts Analytics immediately on Accept All and filters events via beforeSend when consent is revoked', () => {
    renderWithConsentBanner();
    expect(screen.queryByTestId('vercel-analytics-mounted')).toBeNull();

    fireEvent.click(screen.getByText('Accept All'));
    expect(hasAnalyticsConsent()).toBe(true);
    expect(screen.getByTestId('vercel-analytics-mounted')).toBeInTheDocument();
    expect(analyticsCalls).toHaveLength(1);

    const beforeSend = analyticsCalls[0].beforeSend;
    const sampleEvent = { type: 'pageview', url: 'https://classrooms-hub.vercel.app/' };
    expect(beforeSend(sampleEvent)).toEqual(sampleEvent);

    // Revoking consent mid-session immediately disables beforeSend and unmounts Analytics
    clearCookieConsent();
    expect(beforeSend(sampleEvent)).toBeNull();
  });

  it('respects Customize opt-in checkbox for Optional Analytics and persisted opt-in on reload', () => {
    const { unmount } = renderWithConsentBanner();
    fireEvent.click(screen.getByText('Customize'));

    const analyticsCheckbox = screen
      .getByText('Optional Analytics')
      .closest('label')
      ?.querySelector('input[type="checkbox"]');
    expect(analyticsCheckbox).toBeTruthy();

    fireEvent.click(analyticsCheckbox);
    fireEvent.click(screen.getByText('Save Preferences'));

    expect(hasAnalyticsConsent()).toBe(true);
    expect(screen.getByTestId('vercel-analytics-mounted')).toBeInTheDocument();

    unmount();
    analyticsCalls.length = 0;

    // Simulate reload with persisted consent
    saveCookieConsent({ preferences: true, analytics: true, status: 'accepted_all' });
    render(<ConsentAwareAnalytics />);
    expect(screen.getByTestId('vercel-analytics-mounted')).toBeInTheDocument();
  });
});
