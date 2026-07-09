/**
 * Base Application Error
 */
export class AppError extends Error {
  constructor(message, code = null) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Network / Connection Failures
 */
export class NetworkError extends AppError {
  constructor(message = 'Network connection failed. Please check your internet connection.', code = null) {
    super(message, code);
  }
}

/**
 * Authentication & Token Expirations
 */
export class AuthError extends AppError {
  constructor(message = 'Authentication failed or session expired.', code = 401) {
    super(message, code);
  }
}

/**
 * Rate Limiting (Too Many Requests - 429)
 */
export class RateLimitError extends AppError {
  constructor(message = 'Too many requests. Please slow down and try again later.', code = 429) {
    super(message, code);
  }
}

/**
 * Validation & Input Failures
 */
export class ValidationError extends AppError {
  constructor(message, code = null) {
    super(message, code);
  }
}

/**
 * Storage & Cache Failures
 */
export class StorageError extends AppError {
  constructor(message = 'Failed to write or read from local storage.', code = null) {
    super(message, code);
  }
}

/**
 * HTML/PDF Parsing Failures
 */
export class ParserError extends AppError {
  constructor(message = 'Failed to parse raw data source.', code = null) {
    super(message, code);
  }
}
