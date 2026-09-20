/**
 * Result pattern utilities for better error handling without try/catch hell
 */

export type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E };

export const Result = {
  /**
   * Create a successful result
   * @param data - The payload
   */
  ok: <T>(data: T): Result<T, never> => ({ success: true, data }),

  /**
   * Create a failed result
   * @param error - The error object or message
   */
  fail: <E extends Error = Error>(error: E | string): Result<never, E> => ({ 
    success: false, 
    error: (error instanceof Error ? error : new Error(error)) as E
  })
};

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
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
