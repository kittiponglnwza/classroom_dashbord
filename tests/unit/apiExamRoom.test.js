import { describe, it, expect, vi } from 'vitest';
import { createExamRoomHandler } from '../../api/exam-room';

const CLIENT_ID = '123456-test.apps.googleusercontent.com';
const VALID_ID = '6401012345678';

function createMockRes() {
  const headers = {};
  const res = {
    statusCode: 200,
    headers,
    body: null,
    setHeader(name, value) {
      headers[name.toLowerCase()] = value;
      return res;
    },
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(payload) {
      res.body = payload;
      return res;
    },
    send(payload) {
      res.body = payload;
      return res;
    },
  };
  return res;
}

function createReq(overrides = {}) {
  return {
    method: 'GET',
    url: `/api/exam-room?IDcard=${VALID_ID}`,
    query: { IDcard: VALID_ID },
    headers: {
      host: 'classrooms-hub.vercel.app',
      origin: 'https://classrooms-hub.vercel.app',
      authorization: 'Bearer valid-google-token',
      cookie: 'session=should_not_forward',
      'x-forwarded-for': '203.0.113.10',
    },
    ...overrides,
  };
}

describe('Vercel Serverless /api/exam-room proxy', () => {
  it('rejects non-GET HTTP methods with 405', async () => {
    const fetchImpl = vi.fn();
    const handler = createExamRoomHandler({ fetchImpl, env: { VITE_GOOGLE_CLIENT_ID: CLIENT_ID } });
    const res = createMockRes();

    await handler(createReq({ method: 'POST' }), res);

    expect(res.statusCode).toBe(405);
    expect(res.headers.allow).toBe('GET');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('blocks disallowed origins and cross-site fetches with 403', async () => {
    const fetchImpl = vi.fn();
    const handler = createExamRoomHandler({ fetchImpl, env: { VITE_GOOGLE_CLIENT_ID: CLIENT_ID } });

    const badOriginRes = createMockRes();
    await handler(
      createReq({ headers: { host: 'classrooms-hub.vercel.app', origin: 'https://evil.example', authorization: 'Bearer tok' } }),
      badOriginRes
    );
    expect(badOriginRes.statusCode).toBe(403);

    const crossSiteRes = createMockRes();
    await handler(
      createReq({ headers: { host: 'classrooms-hub.vercel.app', 'sec-fetch-site': 'cross-site', authorization: 'Bearer tok' } }),
      crossSiteRes
    );
    expect(crossSiteRes.statusCode).toBe(403);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('rejects missing, malformed, or duplicate IDcard values with 400 before checking auth/upstream', async () => {
    const fetchImpl = vi.fn();
    const handler = createExamRoomHandler({ fetchImpl, env: { VITE_GOOGLE_CLIENT_ID: CLIENT_ID } });

    for (const badQuery of [{}, { IDcard: '1234' }, { IDcard: '640101234567a' }, { IDcard: [VALID_ID, VALID_ID] }]) {
      const res = createMockRes();
      await handler(createReq({ query: badQuery }), res);
      expect(res.statusCode).toBe(400);
    }
    const urlFallbackBadRes = createMockRes();
    await handler(createReq({ query: undefined, url: '/api/exam-room?IDcard=bad' }), urlFallbackBadRes);
    expect(urlFallbackBadRes.statusCode).toBe(400);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('requires a Google Bearer token issued for this application', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        aud: 'another-app-client-id.apps.googleusercontent.com',
        exp: String(Math.floor(Date.now() / 1000) + 3600),
        email: 'student@kmutnb.ac.th',
      }),
    });
    const handler = createExamRoomHandler({ fetchImpl, env: { VITE_GOOGLE_CLIENT_ID: CLIENT_ID } });

    const missingAuthRes = createMockRes();
    await handler(createReq({ headers: { host: 'classrooms-hub.vercel.app' } }), missingAuthRes);
    expect(missingAuthRes.statusCode).toBe(401);
    expect(fetchImpl).not.toHaveBeenCalled();

    const wrongAudRes = createMockRes();
    await handler(createReq(), wrongAudRes);
    expect(wrongAudRes.statusCode).toBe(401);
  });

  it('proxies validated GET request cleanly, caches verified token briefly, strips auth headers and extra params, and preserves raw bytes/content-type', async () => {
    const rawHtmlBytes = new Uint8Array([0x3c, 0x74, 0x61, 0x62, 0x6c, 0x65, 0x3e]); // <table>
    const fetchImpl = vi.fn(async (url) => {
      if (String(url).startsWith('https://oauth2.googleapis.com/tokeninfo')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            aud: CLIENT_ID,
            exp: String(Math.floor(Date.now() / 1000) + 3600),
            email: 'student@email.kmutnb.ac.th',
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/html; charset=windows-874' }),
        arrayBuffer: async () => rawHtmlBytes.buffer,
      };
    });

    const handler = createExamRoomHandler({ fetchImpl, env: { VITE_GOOGLE_CLIENT_ID: CLIENT_ID } });

    const res1 = createMockRes();
    await handler(
      createReq({
        url: `/api/exam-room?IDcard=${VALID_ID}&evil=1`,
        headers: {
          host: 'classrooms-preview-abc.vercel.app',
          origin: 'https://classrooms-preview-abc.vercel.app',
          authorization: 'Bearer valid-google-token',
          cookie: 'secret=1',
        },
      }),
      res1
    );

    expect(res1.statusCode).toBe(200);
    expect(res1.headers['content-type']).toBe('text/html; charset=windows-874');
    expect(res1.headers['cache-control']).toBe('private, no-store, max-age=0');
    expect(Buffer.isBuffer(res1.body)).toBe(true);
    expect(res1.body.toString('utf8')).toBe('<table>');

    // Upstream call must NOT include extra query params, authorization, or cookie headers
    const upstreamCall = fetchImpl.mock.calls.find(([u]) => String(u).includes('scibase.kmutnb.ac.th'));
    expect(upstreamCall[0]).toBe(`http://www.scibase.kmutnb.ac.th/examroom/datatrain.php?IDcard=${VALID_ID}`);
    expect(upstreamCall[1].headers.Authorization).toBeUndefined();
    expect(upstreamCall[1].headers.authorization).toBeUndefined();
    expect(upstreamCall[1].headers.cookie).toBeUndefined();

    // Second request with same token hits in-memory token cache (only 1 tokeninfo lookup total)
    const res2 = createMockRes();
    await handler(createReq(), res2);
    expect(res2.statusCode).toBe(200);
    const tokeninfoCalls = fetchImpl.mock.calls.filter(([u]) => String(u).includes('tokeninfo'));
    expect(tokeninfoCalls).toHaveLength(1);
  });

  it('enforces per-user rate limit in memory when Redis is not configured', async () => {
    let now = 1_700_000_000_000;
    const fetchImpl = vi.fn(async (url) => {
      if (String(url).startsWith('https://oauth2.googleapis.com/tokeninfo')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            aud: CLIENT_ID,
            exp: String(Math.floor(now / 1000) + 3600),
            email: 'spammer@email.kmutnb.ac.th',
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }),
        arrayBuffer: async () => new Uint8Array([65]).buffer,
      };
    });

    const handler = createExamRoomHandler({
      fetchImpl,
      env: { VITE_GOOGLE_CLIENT_ID: CLIENT_ID },
      nowFn: () => now,
    });

    for (let i = 0; i < 20; i += 1) {
      const okRes = createMockRes();
      await handler(createReq(), okRes);
      expect(okRes.statusCode).toBe(200);
    }

    const blockedRes = createMockRes();
    await handler(createReq(), blockedRes);
    expect(blockedRes.statusCode).toBe(429);
    expect(Number(blockedRes.headers['retry-after'])).toBeGreaterThan(0);

    // Resets cleanly once 60-second window elapses
    now += 61_000;
    const afterWindowRes = createMockRes();
    await handler(createReq(), afterWindowRes);
    expect(afterWindowRes.statusCode).toBe(200);
  });

  it('supports Upstash Redis rate limiting and falls back gracefully to memory on Redis failure', async () => {
    let upstashShouldFail = false;
    const fetchImpl = vi.fn(async (url) => {
      if (String(url).startsWith('https://oauth2.googleapis.com/tokeninfo')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            aud: CLIENT_ID,
            exp: String(Math.floor(Date.now() / 1000) + 3600),
            email: 'redis-user@email.kmutnb.ac.th',
          }),
        };
      }
      if (String(url).startsWith('https://example-upstash.upstash.io')) {
        if (upstashShouldFail) throw new Error('Redis unreachable');
        return {
          ok: true,
          status: 200,
          json: async () => [{ result: 21 }, { result: 42 }],
        };
      }
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }),
        arrayBuffer: async () => new Uint8Array([65]).buffer,
      };
    });

    const handler = createExamRoomHandler({
      fetchImpl,
      env: {
        VITE_GOOGLE_CLIENT_ID: CLIENT_ID,
        UPSTASH_REDIS_REST_URL: 'https://example-upstash.upstash.io',
        UPSTASH_REDIS_REST_TOKEN: 'secret-token',
      },
    });

    const limitedRes = createMockRes();
    await handler(createReq(), limitedRes);
    expect(limitedRes.statusCode).toBe(429);

    upstashShouldFail = true;
    const fallbackRes = createMockRes();
    await handler(createReq(), fallbackRes);
    expect(fallbackRes.statusCode).toBe(200);
  });

  it('returns 503 instead of 401 when Google tokeninfo upstream is unavailable', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    const handler = createExamRoomHandler({ fetchImpl, env: { VITE_GOOGLE_CLIENT_ID: CLIENT_ID } });
    const res = createMockRes();

    await handler(createReq(), res);
    expect(res.statusCode).toBe(503);
  });

  it('rejects upstream redirects with 502 and returns 504 on upstream timeout', async () => {
    let mode = 'redirect';
    const fetchImpl = vi.fn(async (url) => {
      if (String(url).startsWith('https://oauth2.googleapis.com/tokeninfo')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            aud: CLIENT_ID,
            exp: String(Math.floor(Date.now() / 1000) + 3600),
            email: 'student@email.kmutnb.ac.th',
          }),
        };
      }
      if (mode === 'redirect') {
        return { ok: false, status: 302, headers: new Headers({ location: 'http://other.example' }) };
      }
      const abortErr = new Error('Timed out');
      abortErr.name = 'AbortError';
      throw abortErr;
    });

    const handler = createExamRoomHandler({ fetchImpl, env: { VITE_GOOGLE_CLIENT_ID: CLIENT_ID } });

    const redirectRes = createMockRes();
    await handler(createReq(), redirectRes);
    expect(redirectRes.statusCode).toBe(502);

    mode = 'timeout';
    const timeoutRes = createMockRes();
    await handler(createReq(), timeoutRes);
    expect(timeoutRes.statusCode).toBe(504);
  });

  it('falls back to Classroom scope verification when client ID env var is omitted', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      let scope = 'openid email';
      const fetchImpl = vi.fn(async (url) => {
        if (String(url).startsWith('https://oauth2.googleapis.com/tokeninfo')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              aud: CLIENT_ID,
              exp: String(Math.floor(Date.now() / 1000) + 3600),
              email: 'student@email.kmutnb.ac.th',
              scope,
            }),
          };
        }
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }),
          arrayBuffer: async () => new Uint8Array([65]).buffer,
        };
      });

      const handler = createExamRoomHandler({ fetchImpl, env: {} });

      const missingScopeRes = createMockRes();
      await handler(createReq({ headers: { host: 'classrooms-hub.vercel.app', authorization: 'Bearer tok-no-scope' } }), missingScopeRes);
      expect(missingScopeRes.statusCode).toBe(401);

      scope = 'openid email https://www.googleapis.com/auth/classroom.courses.readonly';
      const validScopeRes = createMockRes();
      await handler(createReq({ headers: { host: 'classrooms-hub.vercel.app', authorization: 'Bearer tok-with-scope' } }), validScopeRes);
      expect(validScopeRes.statusCode).toBe(200);
      expect(validScopeRes.headers['content-security-policy']).toBe("default-src 'none'; sandbox");
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('pins each authenticated account to a single Student ID and blocks cross-student IDOR enumeration', async () => {
    let currentEmail = 's6704062611115@email.kmutnb.ac.th';
    const fetchImpl = vi.fn(async (url) => {
      if (String(url).startsWith('https://oauth2.googleapis.com/tokeninfo')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            aud: CLIENT_ID,
            exp: String(Math.floor(Date.now() / 1000) + 3600),
            email: currentEmail,
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }),
        arrayBuffer: async () => new Uint8Array([65]).buffer,
      };
    });

    const handler = createExamRoomHandler({ fetchImpl, env: { VITE_GOOGLE_CLIENT_ID: CLIENT_ID } });

    // 1. Account querying its own Student ID succeeds (200)
    const ownIdRes = createMockRes();
    await handler(
      createReq({
        url: '/api/exam-room?IDcard=6704062611115',
        query: { IDcard: '6704062611115' },
        headers: { host: 'classrooms-hub.vercel.app', authorization: 'Bearer tok-kmutnb' },
      }),
      ownIdRes
    );
    expect(ownIdRes.statusCode).toBe(200);

    // 2. Same KMUTNB account attempting to query another student's ID is rejected with 403
    const otherIdRes = createMockRes();
    await handler(
      createReq({
        url: '/api/exam-room?IDcard=6704062699999',
        query: { IDcard: '6704062699999' },
        headers: { host: 'classrooms-hub.vercel.app', authorization: 'Bearer tok-kmutnb' },
      }),
      otherIdRes
    );
    expect(otherIdRes.statusCode).toBe(403);

    // 3. Personal Gmail can query its bound ID, and querying a second Student ID is also blocked (403)
    currentEmail = 'personal.student@gmail.com';
    const firstPersonalRes = createMockRes();
    await handler(
      createReq({
        url: '/api/exam-room?IDcard=6704062611115',
        query: { IDcard: '6704062611115' },
        headers: { host: 'classrooms-hub.vercel.app', authorization: 'Bearer tok-gmail' },
      }),
      firstPersonalRes
    );
    expect(firstPersonalRes.statusCode).toBe(200);

    const secondPersonalRes = createMockRes();
    await handler(
      createReq({
        url: '/api/exam-room?IDcard=6704062699999',
        query: { IDcard: '6704062699999' },
        headers: { host: 'classrooms-hub.vercel.app', authorization: 'Bearer tok-gmail' },
      }),
      secondPersonalRes
    );
    expect(secondPersonalRes.statusCode).toBe(403);
  });

  it('rejects oversized or non-HTML upstream responses with 502', async () => {
    let upstreamContentType = 'application/javascript';
    let upstreamLength = '100';
    const fetchImpl = vi.fn(async (url) => {
      if (String(url).startsWith('https://oauth2.googleapis.com/tokeninfo')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            aud: CLIENT_ID,
            exp: String(Math.floor(Date.now() / 1000) + 3600),
            email: 'student@email.kmutnb.ac.th',
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': upstreamContentType, 'content-length': upstreamLength }),
        arrayBuffer: async () => new Uint8Array([65]).buffer,
      };
    });

    const handler = createExamRoomHandler({ fetchImpl, env: { VITE_GOOGLE_CLIENT_ID: CLIENT_ID } });

    const badCtRes = createMockRes();
    await handler(createReq(), badCtRes);
    expect(badCtRes.statusCode).toBe(502);

    upstreamContentType = 'text/html; charset=utf-8';
    upstreamLength = String(5 * 1024 * 1024);
    const oversizedRes = createMockRes();
    await handler(createReq(), oversizedRes);
    expect(oversizedRes.statusCode).toBe(502);
  });
});
