import { useState, useEffect, useCallback } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { CONSENT_CHANGE_EVENT, hasAnalyticsConsent } from '../utils/cookieConsent';

/**
 * Mounts Vercel Web Analytics only when optional analytics consent is granted,
 * and drops events in beforeSend if consent is later revoked in-session.
 */
export default function ConsentAwareAnalytics() {
  const [enabled, setEnabled] = useState(() => hasAnalyticsConsent());

  useEffect(() => {
    const syncConsent = () => setEnabled(hasAnalyticsConsent());
    window.addEventListener(CONSENT_CHANGE_EVENT, syncConsent);
    window.addEventListener('storage', syncConsent);
    return () => {
      window.removeEventListener(CONSENT_CHANGE_EVENT, syncConsent);
      window.removeEventListener('storage', syncConsent);
    };
  }, []);

  const handleBeforeSend = useCallback(
    (event) => (hasAnalyticsConsent() ? event : null),
    []
  );

  if (!enabled) {
    return null;
  }

  return <Analytics beforeSend={handleBeforeSend} />;
}
