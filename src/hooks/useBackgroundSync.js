import { useEffect } from 'react';
import { getActiveEmail } from '../utils/storage';
import { syncManager } from '../services/SyncManager';
import { logger } from '../utils/logger';

export function useBackgroundSync(isLoggedIn, accessToken) {
  useEffect(() => {
    if (!isLoggedIn || !accessToken) return;

    let intervalId = null;
    let isVisible = !document.hidden;

    const startPolling = () => {
      if (intervalId) return;
      intervalId = setInterval(async () => {
        const email = getActiveEmail();
        if (!email || !accessToken) return;
        try {
          await syncManager.executeSync(accessToken, email);
        } catch (err) {
          logger.debug('[Auto-Poll] Background Drive poll failed (non-critical):', err.message);
        }
      }, 60000); // Poll every 60 seconds
    };

    const stopPolling = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const handleVisibility = () => {
      isVisible = !document.hidden;
      if (isVisible) {
        // When tab becomes visible again, do an immediate sync + restart polling
        const email = getActiveEmail();
        if (email && accessToken) {
          syncManager.executeSync(accessToken, email).catch(() => {});
        }
        startPolling();
      } else {
        stopPolling();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    if (isVisible) startPolling();

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isLoggedIn, accessToken]);
}
