import { NetworkError, AuthError, RateLimitError, AppError } from './errors';
import { logger } from './logger';
import { SYNC_CONFIG } from '../config/sync';

class HttpClient {
  constructor() {
    this.silentRefreshCallback = null;
    this.logoutCallback = null;
    this.refreshingPromise = null;
  }

  registerCallbacks(silentRefresh, logout) {
    this.silentRefreshCallback = silentRefresh;
    this.logoutCallback = logout;
  }

  /**
   * Helper to execute fetch with timeout
   */
  async fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(id);
      return response;
    } catch (err) {
      clearTimeout(id);
      if (err.name === 'AbortError') {
        throw new NetworkError('Request timed out.');
      }
      throw new NetworkError(err.message || 'Network request failed.');
    }
  }

  /**
   * Calculate backoff delay with exponential scaling and random jitter
   */
  getBackoffDelay(attempt) {
    const base = SYNC_CONFIG.backoffBaseMs;
    const max = SYNC_CONFIG.backoffMaxMs;
    
    // Exponential calculation: base * 2^attempt
    let delay = base * Math.pow(2, attempt);
    delay = Math.min(delay, max);
    
    if (SYNC_CONFIG.jitterEnabled) {
      // Add random jitter between 0 and 1000ms
      delay = delay + Math.random() * 1000;
    }
    
    return delay;
  }

  /**
   * Generic request wrapper with auto-retry and backoff
   */
  async request(url, options = {}, attempt = 0) {
    try {
      logger.debug(`HTTP Request to ${url} (Attempt ${attempt + 1})`);
      const response = await this.fetchWithTimeout(url, options);

      if (response.ok) {
        return await response.json();
      }

      // Handle HTTP Error Codes
      const status = response.status;
      if (status === 401) {
        // Intercept 401 and try to run silent token refresh
        return await this.handleUnauthorized(url, options, attempt);
      }

      if (status === 429) {
        throw new RateLimitError();
      }

      const errorText = await response.text().catch(() => '');
      throw new AppError(`API Error (${status}): ${errorText}`, status);

    } catch (err) {
      // Check if the error is retryable (Network errors, Rate limiting, 5xx Server errors)
      const isRetryable = err instanceof NetworkError || 
                          err instanceof RateLimitError || 
                          (err instanceof AppError && err.code >= 500);

      if (isRetryable && attempt < SYNC_CONFIG.maxRetryAttempts) {
        const delay = this.getBackoffDelay(attempt);
        logger.warn(`Request failed. Retrying in ${Math.round(delay)}ms... Error: ${err.message}`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.request(url, options, attempt + 1);
      }

      throw err;
    }
  }

  /**
   * Handles 401 Unauthorized errors by attempting a silent token refresh
   */
  async handleUnauthorized(url, options, attempt) {
    logger.warn('Received 401 Unauthorized. Attempting silent token refresh...');

    if (!this.silentRefreshCallback) {
      logger.error('No silent refresh callback registered. Forcing logout.');
      this.triggerLogout();
      throw new AuthError('Session expired and could not be refreshed.');
    }

    try {
      // Prevent multiple concurrent silent refreshes by sharing the active promise
      if (!this.refreshingPromise) {
        this.refreshingPromise = this.silentRefreshCallback();
      }

      const newAccessToken = await this.refreshingPromise;
      this.refreshingPromise = null;

      if (!newAccessToken) {
        throw new AuthError('Silent refresh failed.');
      }

      // Update authorization header with the new token
      const updatedHeaders = {
        ...options.headers,
        'Authorization': `Bearer ${newAccessToken}`
      };

      logger.info('Silent token refresh succeeded. Retrying original request...');
      return await this.request(url, { ...options, headers: updatedHeaders }, attempt);

    } catch (refreshErr) {
      this.refreshingPromise = null;
      logger.error('Silent refresh failed. Forcing logout.', refreshErr);
      this.triggerLogout();
      throw new AuthError('Session expired. Please log in again.');
    }
  }

  triggerLogout() {
    if (this.logoutCallback) {
      this.logoutCallback();
    }
  }
}

export const httpClient = new HttpClient();
