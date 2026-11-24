import { Result, ApiError, NetworkError } from '../../utils/result';
import { EXAM_CONFIG } from '../../config/exam';

/**
 * Fetches raw HTML from the KMUTNB exam proxy.
 * Implements timeout and external AbortSignal cancellation.
 * 
 * @param {string} studentId - 13 digit student ID
 * @param {AbortSignal} signal - AbortSignal for cancelling requests
 * @returns {Promise<{success: boolean, data?: string, error?: Error}>} Result pattern
 */
export const fetchExamHtml = async (studentId, signal) => {
  if (!EXAM_CONFIG.seatingLookupEnabled) {
    return Result.fail(new ApiError('Automatic exam seating lookup is paused until an HTTPS endpoint is available.', 503));
  }

  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 15000);

  const onExternalAbort = () => controller.abort(signal?.reason);
  if (signal) {
    if (signal.aborted) {
      clearTimeout(timeoutId);
      const cancelErr = new Error('Aborted');
      cancelErr.name = 'AbortError';
      return Result.fail(cancelErr);
    }
    signal.addEventListener('abort', onExternalAbort, { once: true });
  }

  try {
    const endpoint = EXAM_CONFIG.proxyEndpoint || '/api/exam-room';
    const response = await fetch(`${endpoint}?IDcard=${encodeURIComponent(studentId)}`, {
      signal: controller.signal
    });
    
    if (!response.ok) {
      return Result.fail(new ApiError(`Server returned status: ${response.status}`, response.status));
    }
    
    const htmlText = await response.text();
    if (htmlText && htmlText.includes('<div id="root">')) {
      return Result.fail(new ApiError('Exam proxy returned application shell instead of exam database HTML.', 502));
    }

    return Result.ok(htmlText);
  } catch (error) {
    if (error?.name === 'AbortError' && !timedOut) {
      return Result.fail(error);
    }
    if (timedOut) {
      return Result.fail(new NetworkError('Exam database request timed out. Please try again.'));
    }
    return Result.fail(new NetworkError('Could not connect to the database. Please try again later.'));
  } finally {
    clearTimeout(timeoutId);
    if (signal) {
      signal.removeEventListener('abort', onExternalAbort);
    }
  }
};
