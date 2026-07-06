import { describe, it, expect } from 'vitest';
import { Result, ApiError, ValidationError, NetworkError } from '../../src/utils/result';

describe('Result utility', () => {
  it('should create an ok result', () => {
    const data = { test: 123 };
    const res = Result.ok(data);
    expect(res.success).toBe(true);
    expect(res.data).toBe(data);
  });

  it('should create a fail result from an Error object', () => {
    const err = new Error('Something went wrong');
    const res = Result.fail(err);
    expect(res.success).toBe(false);
    expect(res.error).toBe(err);
  });

  it('should create a fail result from a string message', () => {
    const res = Result.fail('String error');
    expect(res.success).toBe(false);
    expect(res.error).toBeInstanceOf(Error);
    expect(res.error.message).toBe('String error');
  });
});

describe('custom errors', () => {
  it('should instantiate ApiError', () => {
    const err = new ApiError('API error', 400);
    expect(err.name).toBe('ApiError');
    expect(err.message).toBe('API error');
    expect(err.status).toBe(400);
  });

  it('should instantiate ValidationError', () => {
    const err = new ValidationError('Validation failed');
    expect(err.name).toBe('ValidationError');
    expect(err.message).toBe('Validation failed');
  });

  it('should instantiate NetworkError', () => {
    const err = new NetworkError();
    expect(err.name).toBe('NetworkError');
    expect(err.message).toBe('Network connection failed');
  });
});
