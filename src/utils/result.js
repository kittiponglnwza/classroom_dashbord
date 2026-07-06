/**
 * Result pattern utilities for better error handling without try/catch hell
 */

export const Result = {
  /**
   * Create a successful result
   * @param {*} data - The payload
   * @returns {{success: true, data: *}}
   */
  ok: (data) => ({ success: true, data }),

  /**
   * Create a failed result
   * @param {Error|string} error - The error object or message
   * @returns {{success: false, error: Error}}
   */
  fail: (error) => ({ 
    success: false, 
    error: error instanceof Error ? error : new Error(error) 
  })
};

export class ApiError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NetworkError extends Error {
  constructor(message = 'Network connection failed') {
    super(message);
    this.name = 'NetworkError';
  }
}
