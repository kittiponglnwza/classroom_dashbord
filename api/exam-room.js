import { createHash } from 'node:crypto';

const UPSTREAM_EXAM_URL = 'http://www.scibase.kmutnb.ac.th/examroom/datatrain.php';
const GOOGLE_TOKENINFO_URL = 'https://oauth2.googleapis.com/tokeninfo';
const CLASSROOM_READONLY_SCOPE = 'https://www.googleapis.com/auth/classroom.courses.readonly';
const DEFAULT_ALLOWED_ORIGINS = ['https://classrooms-hub.vercel.app'];

const RATE_WINDOW_SECONDS = 60;
const RATE_WINDOW_MS = RATE_WINDOW_SECONDS * 1000;
const PRE_AUTH_IP_LIMIT = 120;
const USER_RATE_LIMIT = 20;
const IP_RATE_LIMIT = 60;
const TOKEN_CACHE_MAX_ENTRIES = 200;
const TOKEN_CACHE_MAX_TTL_MS = 60 * 1000;
const TOKENINFO_TIMEOUT_MS = 5000;
const UPSTREAM_TIMEOUT_MS = 8500;
const REDIS_TIMEOUT_MS = 1500;
const MAX_UPSTREAM_BYTES = 2 * 1024 * 1024;
const STUDENT_ID_PIN_WINDOW_MS = 60 * 60 * 1000;

const extractEmailStudentId = (email) => {
  const match = String(email || '').toLowerCase().trim().match(/\b(\d{13})\b|s(\d{13})\b/);
  return match ? (match[1] || match[2] || '') : '';
};

const createStudentIdPinTracker = (nowFn) => {
  const pins = new Map();

  const prune = (now) => {
    if (pins.size <= 1000) return;
    for (const [key, entry] of pins.entries()) {
      if (entry.expiresAt <= now) pins.delete(key);
    }
    while (pins.size > 2000) {
      const oldest = pins.keys().next().value;
      if (oldest === undefined) break;
      pins.delete(oldest);
    }
  };

  return (userKey, requestedStudentId) => {
    const now = nowFn();
    prune(now);
    const existing = pins.get(userKey);
    if (!existing || existing.expiresAt <= now) {
      pins.set(userKey, { studentId: requestedStudentId, expiresAt: now + STUDENT_ID_PIN_WINDOW_MS });
      return true;
    }
    if (existing.studentId !== requestedStudentId) {
      return false;
    }
    existing.expiresAt = now + STUDENT_ID_PIN_WINDOW_MS;
    return true;
  };
};

const getHeader = (req, name) => {
  const headers = req?.headers;
  if (!headers) return '';
  if (typeof headers.get === 'function') {
    return String(headers.get(name) || '');
  }
  const lower = name.toLowerCase();
  const raw = headers[lower] ?? headers[name];
  if (Array.isArray(raw)) return String(raw[0] || '');
  return raw ? String(raw) : '';
};

const getClientIp = (req) => {
  const forwarded = getHeader(req, 'x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0].trim();
    if (first) return first;
  }
  const realIp = getHeader(req, 'x-real-ip').trim();
  if (realIp) return realIp;
  return String(req?.socket?.remoteAddress || 'unknown');
};

const getRequestHost = (req) => {
  const forwardedHost = getHeader(req, 'x-forwarded-host');
  const rawHost = (forwardedHost || getHeader(req, 'host')).split(',')[0].trim().toLowerCase();
  return rawHost;
};

const hashIdentifier = (value) =>
  createHash('sha256').update(String(value)).digest('hex').slice(0, 32);

const buildAllowedOrigins = (env) => {
  const rawExtra = String(env?.ALLOWED_ORIGINS || '').trim();
  const extras = rawExtra
    ? rawExtra.split(',').map((item) => item.trim()).filter(Boolean)
    : [];
  return new Set([...DEFAULT_ALLOWED_ORIGINS, ...extras]);
};

const isAllowedUrlOrigin = (rawUrl, reqHost, allowedOrigins) => {
  try {
    const parsed = new URL(rawUrl);
    const isLocalhost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
    if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && isLocalhost)) {
      return false;
    }
    if (allowedOrigins.has(parsed.origin)) {
      return true;
    }
    if (reqHost && parsed.host.toLowerCase() === reqHost) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
};

const checkOriginAllowed = (req, allowedOrigins) => {
  const secFetchSite = getHeader(req, 'sec-fetch-site').trim().toLowerCase();
  if (secFetchSite === 'cross-site') {
    return false;
  }

  const reqHost = getRequestHost(req);
  const origin = getHeader(req, 'origin').trim();
  if (origin) {
    return isAllowedUrlOrigin(origin, reqHost, allowedOrigins);
  }

  const referer = getHeader(req, 'referer').trim();
  if (referer) {
    return isAllowedUrlOrigin(referer, reqHost, allowedOrigins);
  }

  // Some privacy browsers or same-origin simple GET requests omit Origin/Referer.
  // Bearer OAuth verification still rejects unauthenticated cross-origin callers.
  return true;
};

const extractBearerToken = (req) => {
  const auth = getHeader(req, 'authorization').trim();
  const match = auth.match(/^Bearer\s+(\S+)$/i);
  if (!match) return null;
  const token = match[1].trim();
  if (!token || token.length > 4096) return null;
  return token;
};

const parseStudentId = (req) => {
  let rawId;
  if (req?.query && typeof req.query === 'object') {
    rawId = req.query.IDcard;
  } else {
    try {
      const parsed = new URL(req?.url || '', 'http://localhost');
      const all = parsed.searchParams.getAll('IDcard');
      if (all.length > 1) return { valid: false, error: 'Duplicate IDcard parameter.' };
      rawId = all[0];
    } catch {
      return { valid: false, error: 'Invalid request URL.' };
    }
  }

  if (Array.isArray(rawId)) {
    return { valid: false, error: 'Duplicate IDcard parameter.' };
  }
  const cleanId = String(rawId || '').trim();
  if (!/^\d{13}$/.test(cleanId)) {
    return { valid: false, error: 'Student ID (IDcard) must be exactly 13 digits.' };
  }
  return { valid: true, studentId: cleanId };
};

const createInMemoryLimiter = (nowFn) => {
  const buckets = new Map();

  const prune = (now) => {
    if (buckets.size <= 1000) return;
    for (const [key, entry] of buckets.entries()) {
      if (entry.resetAt <= now) {
        buckets.delete(key);
      }
    }
    while (buckets.size > 2000) {
      const oldestKey = buckets.keys().next().value;
      if (oldestKey === undefined) break;
      buckets.delete(oldestKey);
    }
  };

  return (key, limit) => {
    const now = nowFn();
    prune(now);
    const current = buckets.get(key);
    if (!current || current.resetAt <= now) {
      const next = { count: 1, resetAt: now + RATE_WINDOW_MS };
      buckets.set(key, next);
      return { allowed: true, remaining: Math.max(0, limit - 1), retryAfterSeconds: RATE_WINDOW_SECONDS };
    }
    current.count += 1;
    const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
    if (current.count > limit) {
      return { allowed: false, remaining: 0, retryAfterSeconds };
    }
    return { allowed: true, remaining: Math.max(0, limit - current.count), retryAfterSeconds };
  };
};

const callUpstashPipeline = async (fetchImpl, restUrl, restToken, commands) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REDIS_TIMEOUT_MS);
  try {
    const baseUrl = String(restUrl).replace(/\/+$/, '');
    const res = await fetchImpl(`${baseUrl}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${restToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(commands),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
};

const createHybridRateLimiter = ({ fetchImpl, env, nowFn }) => {
  const memoryCheck = createInMemoryLimiter(nowFn);
  const restUrl = String(env?.UPSTASH_REDIS_REST_URL || '').trim();
  const restToken = String(env?.UPSTASH_REDIS_REST_TOKEN || '').trim();
  const hasUpstash = Boolean(restUrl && restToken);

  return async (key, limit) => {
    if (!hasUpstash) {
      return memoryCheck(key, limit);
    }
    const pipelineRes = await callUpstashPipeline(fetchImpl, restUrl, restToken, [
      ['INCR', key],
      ['TTL', key],
    ]);
    if (!Array.isArray(pipelineRes) || pipelineRes.length < 2) {
      return memoryCheck(key, limit);
    }
    const count = Number(pipelineRes[0]?.result);
    const ttl = Number(pipelineRes[1]?.result);
    if (!Number.isFinite(count)) {
      return memoryCheck(key, limit);
    }
    if (count === 1 || !Number.isFinite(ttl) || ttl < 0) {
      await callUpstashPipeline(fetchImpl, restUrl, restToken, [
        ['EXPIRE', key, RATE_WINDOW_SECONDS],
      ]);
    }
    const retryAfterSeconds = Number.isFinite(ttl) && ttl > 0 ? ttl : RATE_WINDOW_SECONDS;
    if (count > limit) {
      return { allowed: false, remaining: 0, retryAfterSeconds };
    }
    return { allowed: true, remaining: Math.max(0, limit - count), retryAfterSeconds };
  };
};

const isTokenActive = (tokenInfo, nowMs) => {
  if (tokenInfo?.exp !== undefined) {
    const expMs = Number(tokenInfo.exp) * 1000;
    return Number.isFinite(expMs) && expMs > nowMs;
  }
  if (tokenInfo?.expires_in !== undefined) {
    const expiresIn = Number(tokenInfo.expires_in);
    return Number.isFinite(expiresIn) && expiresIn > 0;
  }
  return false;
};

const resolveTokenExpiryMs = (tokenInfo, nowMs) => {
  if (tokenInfo?.exp !== undefined) {
    const expMs = Number(tokenInfo.exp) * 1000;
    if (Number.isFinite(expMs)) return expMs;
  }
  if (tokenInfo?.expires_in !== undefined) {
    const expiresIn = Number(tokenInfo.expires_in);
    if (Number.isFinite(expiresIn)) return nowMs + expiresIn * 1000;
  }
  return nowMs + TOKEN_CACHE_MAX_TTL_MS;
};

const createTokenVerifier = ({ fetchImpl, env, nowFn }) => {
  const tokenCache = new Map();
  let warnedMissingClientId = false;

  const getCached = (tokenHash, nowMs) => {
    const cached = tokenCache.get(tokenHash);
    if (!cached) return null;
    if (cached.cachedUntilMs <= nowMs || cached.tokenExpMs <= nowMs) {
      tokenCache.delete(tokenHash);
      return null;
    }
    return cached;
  };

  const setCached = (tokenHash, identity, tokenExpMs, nowMs) => {
    if (tokenCache.size >= TOKEN_CACHE_MAX_ENTRIES) {
      const oldestKey = tokenCache.keys().next().value;
      if (oldestKey !== undefined) tokenCache.delete(oldestKey);
    }
    tokenCache.set(tokenHash, {
      ...identity,
      tokenExpMs,
      cachedUntilMs: Math.min(tokenExpMs, nowMs + TOKEN_CACHE_MAX_TTL_MS),
    });
  };

  return async (token) => {
    const nowMs = nowFn();
    const tokenHash = hashIdentifier(token);
    const cachedIdentity = getCached(tokenHash, nowMs);
    if (cachedIdentity) {
      return {
        ok: true,
        userKey: cachedIdentity.userKey,
        verifiedEmail: cachedIdentity.verifiedEmail || '',
        emailStudentId: cachedIdentity.emailStudentId || '',
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TOKENINFO_TIMEOUT_MS);

    try {
      const verifyUrl = `${GOOGLE_TOKENINFO_URL}?access_token=${encodeURIComponent(token)}`;
      const res = await fetchImpl(verifyUrl, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });

      if (res.status >= 500) {
        return { ok: false, status: 503, error: 'Unable to verify Google session right now.' };
      }

      const info = await res.json().catch(() => null);
      if (!res.ok || !info || info.error) {
        return { ok: false, status: 401, error: 'Invalid or expired Google session.' };
      }

      if (!isTokenActive(info, nowMs)) {
        return { ok: false, status: 401, error: 'Google session expired.' };
      }

      const expectedClientId = String(env?.GOOGLE_CLIENT_ID || env?.VITE_GOOGLE_CLIENT_ID || '').trim();
      if (expectedClientId) {
        const matchesClient = info.aud === expectedClientId || info.azp === expectedClientId;
        if (!matchesClient) {
          return { ok: false, status: 401, error: 'OAuth token was not issued for this application.' };
        }
      } else {
        if (!warnedMissingClientId) {
          warnedMissingClientId = true;
          console.warn('[api/exam-room] GOOGLE_CLIENT_ID / VITE_GOOGLE_CLIENT_ID is not set in function env; falling back to Classroom scope verification.');
        }
        const scopes = String(info.scope || '').split(/\s+/);
        if (!scopes.includes(CLASSROOM_READONLY_SCOPE)) {
          return { ok: false, status: 401, error: 'OAuth token lacks required application scope.' };
        }
      }

      const verifiedEmail = info.email ? String(info.email).toLowerCase().trim() : '';
      const emailStudentId = extractEmailStudentId(verifiedEmail);
      const userKey = verifiedEmail
        ? `email:${verifiedEmail}`
        : info.sub
          ? `sub:${String(info.sub)}`
          : `tok:${tokenHash}`;
      const tokenExpMs = resolveTokenExpiryMs(info, nowMs);
      setCached(tokenHash, { userKey, verifiedEmail, emailStudentId }, tokenExpMs, nowMs);

      return { ok: true, userKey, verifiedEmail, emailStudentId };
    } catch {
      return { ok: false, status: 503, error: 'Unable to verify Google session right now.' };
    } finally {
      clearTimeout(timeoutId);
    }
  };
};

const sendJson = (res, status, payload) => {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.status(status).json(payload);
};

export function createExamRoomHandler(deps = {}) {
  const fetchImpl = deps.fetchImpl || globalThis.fetch;
  const env = deps.env || process.env;
  const nowFn = deps.nowFn || (() => Date.now());
  const allowedOrigins = buildAllowedOrigins(env);
  const preAuthIpLimit = createInMemoryLimiter(nowFn);
  const checkRateLimit = createHybridRateLimiter({ fetchImpl, env, nowFn });
  const verifyGoogleToken = createTokenVerifier({ fetchImpl, env, nowFn });
  const checkStudentIdPin = createStudentIdPinTracker(nowFn);
  const allowCrossStudentLookup = String(env?.ALLOW_CROSS_STUDENT_EXAM_LOOKUP || '').toLowerCase() === 'true';

  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Vary', 'Authorization, Origin');

    if (String(req?.method || '').toUpperCase() !== 'GET') {
      res.setHeader('Allow', 'GET');
      return sendJson(res, 405, { error: 'Method not allowed.' });
    }

    if (!checkOriginAllowed(req, allowedOrigins)) {
      return sendJson(res, 403, { error: 'Forbidden origin.' });
    }

    const idCheck = parseStudentId(req);
    if (!idCheck.valid) {
      return sendJson(res, 400, { error: idCheck.error });
    }

    const clientIp = getClientIp(req);
    const ipHash = hashIdentifier(clientIp);
    const preAuthResult = preAuthIpLimit(`exam:preauth:${ipHash}`, PRE_AUTH_IP_LIMIT);
    if (!preAuthResult.allowed) {
      res.setHeader('Retry-After', String(preAuthResult.retryAfterSeconds));
      return sendJson(res, 429, { error: 'Too many requests. Please wait a minute and try again.' });
    }

    const bearerToken = extractBearerToken(req);
    if (!bearerToken) {
      return sendJson(res, 401, { error: 'Google sign-in required.' });
    }

    const authResult = await verifyGoogleToken(bearerToken);
    if (!authResult.ok) {
      return sendJson(res, authResult.status, { error: authResult.error });
    }

    if (!allowCrossStudentLookup && !checkStudentIdPin(authResult.userKey, idCheck.studentId)) {
      return sendJson(res, 403, {
        error: 'Forbidden: Querying multiple different Student IDs from one account is not permitted.',
      });
    }

    const userLimit = await checkRateLimit(`exam:user:${hashIdentifier(authResult.userKey)}`, USER_RATE_LIMIT);
    if (!userLimit.allowed) {
      res.setHeader('Retry-After', String(userLimit.retryAfterSeconds));
      return sendJson(res, 429, { error: 'Rate limit exceeded. Please wait a minute before searching again.' });
    }

    const ipLimit = await checkRateLimit(`exam:ip:${ipHash}`, IP_RATE_LIMIT);
    if (!ipLimit.allowed) {
      res.setHeader('Retry-After', String(ipLimit.retryAfterSeconds));
      return sendJson(res, 429, { error: 'Rate limit exceeded for this network. Please try again shortly.' });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

    try {
      const targetUrl = `${UPSTREAM_EXAM_URL}?IDcard=${encodeURIComponent(idCheck.studentId)}`;
      const upstreamRes = await fetchImpl(targetUrl, {
        method: 'GET',
        headers: {
          Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
          'User-Agent': 'ClassroomHub-ExamProxy/1.0',
        },
        redirect: 'manual',
        signal: controller.signal,
      });

      if (upstreamRes.status >= 300 && upstreamRes.status < 400) {
        return sendJson(res, 502, { error: 'Unexpected redirect from university exam server.' });
      }

      const contentLengthHeader = Number(upstreamRes.headers?.get?.('content-length') || 0);
      if (Number.isFinite(contentLengthHeader) && contentLengthHeader > MAX_UPSTREAM_BYTES) {
        return sendJson(res, 502, { error: 'Upstream exam server response exceeded size limit.' });
      }

      const contentType = upstreamRes.headers?.get?.('content-type') || 'text/html; charset=utf-8';
      const normalizedCt = String(contentType).toLowerCase();
      if (!normalizedCt.startsWith('text/html') && !normalizedCt.startsWith('text/plain')) {
        return sendJson(res, 502, { error: 'Unexpected content type from university exam server.' });
      }

      const bodyBuffer = Buffer.from(await upstreamRes.arrayBuffer());
      if (bodyBuffer.byteLength > MAX_UPSTREAM_BYTES) {
        return sendJson(res, 502, { error: 'Upstream exam server response exceeded size limit.' });
      }

      res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
      res.setHeader('Content-Type', contentType);
      return res.status(upstreamRes.status).send(bodyBuffer);
    } catch (error) {
      if (error?.name === 'AbortError') {
        return sendJson(res, 504, { error: 'University exam server timed out.' });
      }
      return sendJson(res, 502, { error: 'Could not reach university exam server.' });
    } finally {
      clearTimeout(timeoutId);
    }
  };
}

export default createExamRoomHandler();
