import { NetworkError, AuthError, RateLimitError, AppError } from './errors';
import { logger } from './logger';
import { SYNC_CONFIG } from '../config/sync';

class HttpClient {
  constructor() {
    this.silentRefreshCallback = null;
    this.logoutCallback = null;
    this.refreshingPromise = null;
  }

  /**
   * @param {(() => Promise<string>)|null} silentRefresh
   * @param {(() => void)|null} logout
   */
  registerCallbacks(silentRefresh, logout) {
    this.silentRefreshCallback = silentRefresh;
    this.logoutCallback = logout;
  }

  /**
   * Helper to execute fetch with timeout
   * @param {string} url
   * @param {RequestInit} [options={}]
   * @param {number} [timeoutMs=10000]
   * @returns {Promise<Response>}
   */
  async fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
    const controller = new AbortController();
    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);

    const externalSignal = options.signal;
    const onExternalAbort = () => controller.abort(externalSignal?.reason);

    if (externalSignal) {
      if (externalSignal.aborted) {
        clearTimeout(timeoutId);
        const cancelErr = new Error('Request aborted');
        cancelErr.name = 'AbortError';
        throw cancelErr;
      }
      externalSignal.addEventListener('abort', onExternalAbort, { once: true });
    }

    const fetchOptions = { ...options };
    delete fetchOptions._retried401;

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal
      });
      return response;
    } catch (err) {
      if (externalSignal?.aborted && !timedOut) {
        const cancelErr = new Error(err?.message || 'Request aborted');
        cancelErr.name = 'AbortError';
        throw cancelErr;
      }
      if (err?.name === 'AbortError' || timedOut) {
        throw new NetworkError('Request timed out.');
      }
      throw new NetworkError(err?.message || 'Network request failed.');
    } finally {
      clearTimeout(timeoutId);
      if (externalSignal) {
        externalSignal.removeEventListener('abort', onExternalAbort);
      }
    }
  }

  /**
   * Calculate backoff delay with exponential scaling and random jitter
   * @param {number} attempt
   * @returns {number}
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
   * @param {string} url
   * @param {RequestInit} [options={}]
   * @param {number} [attempt=0]
   * @returns {Promise<any>}
   */
  async request(url, options = {}, attempt = 0) {
    try {
      logger.debug(`HTTP Request to ${url} (Attempt ${attempt + 1})`);
      const response = await this.fetchWithTimeout(url, options);

      if (response.ok) {
        if (response.status === 204) return null;
        if (typeof response.text === 'function') {
          const text = await response.text().catch(() => '');
          return text ? JSON.parse(text) : null;
        }
        return await response.json();
      }

      // Handle HTTP Error Codes
      const status = response.status;
      if (status === 401) {
        if (options._retried401) {
          this.triggerLogout();
          throw new AuthError('Session expired after token refresh.');
        }
        // Intercept 401 and try to run silent token refresh
        return await this.handleUnauthorized(url, options, attempt);
      }

      if (status === 429) {
        throw new RateLimitError();
      }

      const errorText = await response.text().catch(() => '');
      if (
        status === 403 &&
        /rateLimitExceeded|userRateLimitExceeded|quotaExceeded|rate limit/i.test(errorText)
      ) {
        throw new RateLimitError(`Rate limited (403): ${errorText}`, 403);
      }

      throw new AppError(`API Error (${status}): ${errorText}`, status);

    } catch (err) {
      if (err?.name === 'AbortError') {
        throw err;
      }
      // Check if the error is retryable (Network errors, Rate limiting, 5xx Server errors)
      const isRetryable = err instanceof NetworkError || 
                          err instanceof RateLimitError || 
                          (err instanceof AppError && err.code >= 500);

      if (isRetryable && attempt < SYNC_CONFIG.maxRetryAttempts && !options.signal?.aborted) {
        const delay = this.getBackoffDelay(attempt);
        logger.warn(`Request failed. Retrying in ${Math.round(delay)}ms... Error: ${err.message}`);
        await new Promise(resolve => setTimeout(resolve, delay));
        if (options.signal?.aborted) {
          const cancelErr = new Error('Request aborted');
          cancelErr.name = 'AbortError';
          throw cancelErr;
        }
        return this.request(url, options, attempt + 1);
      }

      throw err;
    }
  }

  /**
   * Refreshes the Google OAuth access token via the registered silent refresh callback,
   * deduplicating concurrent refresh attempts.
   * @returns {Promise<string|null>}
   */
  async refreshAccessToken() {
    if (!this.silentRefreshCallback) {
      return null;
    }
    try {
      if (!this.refreshingPromise) {
        this.refreshingPromise = Promise.resolve().then(() => this.silentRefreshCallback());
      }
      const newAccessToken = await this.refreshingPromise;
      return newAccessToken || null;
    } finally {
      this.refreshingPromise = null;
    }
  }

  /**
   * Handles 401 Unauthorized errors by attempting a silent token refresh
   * @param {string} url
   * @param {RequestInit} options
   * @param {number} attempt
   * @returns {Promise<any>}
   */
  async handleUnauthorized(url, options, attempt) {
    logger.warn('Received 401 Unauthorized. Attempting silent token refresh...');

    if (!this.silentRefreshCallback) {
      logger.error('No silent refresh callback registered. Forcing logout.');
      this.triggerLogout();
      throw new AuthError('Session expired and could not be refreshed.');
    }

    try {
      const newAccessToken = await this.refreshAccessToken();

      if (!newAccessToken) {
        throw new AuthError('Silent refresh failed.');
      }

      // Update authorization header with the new token
      const updatedHeaders = {
        ...options.headers,
        'Authorization': `Bearer ${newAccessToken}`
      };

      logger.info('Silent token refresh succeeded. Retrying original request...');
      return await this.request(url, { ...options, headers: updatedHeaders, _retried401: true }, attempt);

    } catch (refreshErr) {
      logger.error('Silent refresh failed. Forcing logout.', refreshErr);
      this.triggerLogout();
      throw new AuthError('Session expired. Please log in again.');
    }
  }

  /**
   * Triggers the logout callback
   */
  triggerLogout() {
    if (this.logoutCallback) {
      this.logoutCallback();
    }
  }
}

export const httpClient = new HttpClient();
