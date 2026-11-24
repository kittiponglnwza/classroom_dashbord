import { useEffect } from 'react';
import { getActiveEmail, getToken } from '../utils/storage';
import { syncManager } from '../services/SyncManager';
import { logger } from '../utils/logger';

export function useBackgroundSync(isLoggedIn, accessToken) {
  useEffect(() => {
    if (!isLoggedIn || !accessToken) return;

    let intervalId = null;
    let isVisible = !document.hidden;

    const runPollSync = () => {
      const email = getActiveEmail();
      const liveToken = getToken() || accessToken;
      if (!email || !liveToken) return;
      syncManager.executeSync(liveToken, email).catch((err) => {
        logger.debug('[Auto-Poll] Background Drive poll failed (non-critical):', err.message);
      });
    };

    const startPolling = () => {
      if (intervalId) return;
      intervalId = setInterval(runPollSync, 60000); // Poll every 60 seconds
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
        runPollSync();
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
