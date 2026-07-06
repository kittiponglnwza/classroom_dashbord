import { Result, ApiError, NetworkError } from '../../utils/result';

/**
 * Fetches raw HTML from the KMUTNB exam proxy.
 * Implements AbortController to cancel previous requests.
 * 
 * @param {string} studentId - 13 digit student ID
 * @param {AbortSignal} signal - AbortSignal for cancelling requests
 * @returns {Promise<{success: boolean, data?: string, error?: Error}>} Result pattern
 */
export const fetchExamHtml = async (studentId, signal) => {
  try {
    const response = await fetch(`/api/exam-room?IDcard=${studentId}`, { signal });
    
    if (!response.ok) {
      return Result.fail(new ApiError(`Server returned status: ${response.status}`, response.status));
    }
    
    const htmlText = await response.text();
    return Result.ok(htmlText);
  } catch (error) {
    if (error.name === 'AbortError') {
      // Abort is a special case, we still fail but it's handled differently
      return Result.fail(error);
    }
    return Result.fail(new NetworkError('Could not connect to the database. Please try again later.'));
  }
};
