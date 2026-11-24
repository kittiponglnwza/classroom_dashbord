import { afterEach, describe, expect, it, vi } from 'vitest';
import { EXAM_CONFIG } from '../../src/config/exam';
import { fetchExamHtml } from '../../src/services/api/examApi';
import { ApiError, NetworkError } from '../../src/utils/result';

describe('fetchExamHtml', () => {
  afterEach(() => {
    EXAM_CONFIG.seatingLookupEnabled = true;
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('does not send a student ID when the lookup is disabled', async () => {
    EXAM_CONFIG.seatingLookupEnabled = false;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchExamHtml('6401012345678');

    expect(result.success).toBe(false);
    expect(result.error).toBeInstanceOf(ApiError);
    expect(result.error.status).toBe(503);
    expect(result.error.message).toMatch(/paused until an HTTPS endpoint/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('requests the exam proxy with an encoded student ID and returns HTML on success', async () => {
    const html = '<table><tr><td>040613203</td></tr></table>';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => html,
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchExamHtml('6401012345678');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/exam-room?IDcard=6401012345678',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    expect(result).toEqual({ success: true, data: html });
  });

  it('returns an ApiError when the proxy responds with a non-OK status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
    }));

    const result = await fetchExamHtml('6401012345678');

    expect(result.success).toBe(false);
    expect(result.error).toBeInstanceOf(ApiError);
    expect(result.error.status).toBe(502);
    expect(result.error.message).toContain('502');
  });

  it('fails with 502 ApiError if the proxy returns the SPA shell HTML', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '<!doctype html><html><body><div id="root"></div></body></html>',
    }));

    const result = await fetchExamHtml('6401012345678');

    expect(result.success).toBe(false);
    expect(result.error).toBeInstanceOf(ApiError);
    expect(result.error.status).toBe(502);
    expect(result.error.message).toMatch(/application shell/i);
  });

  it('returns AbortError immediately when passed an already-aborted signal', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();
    controller.abort();

    const result = await fetchExamHtml('6401012345678', controller.signal);

    expect(result.success).toBe(false);
    expect(result.error.name).toBe('AbortError');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('aborts in-flight fetch when the external signal aborts', async () => {
    const externalController = new AbortController();
    vi.stubGlobal('fetch', vi.fn((_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => {
        reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
      });
    })));

    const promise = fetchExamHtml('6401012345678', externalController.signal);
    externalController.abort();
    const result = await promise;

    expect(result.success).toBe(false);
    expect(result.error.name).toBe('AbortError');
  });

  it('returns NetworkError when the request exceeds the 15s timeout', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => {
        reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
      });
    })));

    const promise = fetchExamHtml('6401012345678');
    await vi.advanceTimersByTimeAsync(15000);
    const result = await promise;

    expect(result.success).toBe(false);
    expect(result.error).toBeInstanceOf(NetworkError);
    expect(result.error.message).toMatch(/timed out/i);
  });

  it('returns NetworkError on unexpected fetch rejection', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));

    const result = await fetchExamHtml('6401012345678');

    expect(result.success).toBe(false);
    expect(result.error).toBeInstanceOf(NetworkError);
    expect(result.error.message).toMatch(/Could not connect/i);
  });
});
