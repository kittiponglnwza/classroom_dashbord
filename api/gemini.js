import { createHash } from 'node:crypto';

const GEMINI_INTERACTIONS_URL = 'https://generativelanguage.googleapis.com/v1/interactions';
const GEMINI_API_REVISION = '2026-05-20';
const GOOGLE_TOKENINFO_URL = 'https://oauth2.googleapis.com/tokeninfo';
const CLASSROOM_READONLY_SCOPE = 'https://www.googleapis.com/auth/classroom.courses.readonly';
const DEFAULT_ALLOWED_ORIGINS = ['https://classrooms-hub.vercel.app'];

const DEFAULT_MODEL = 'gemini-3.5-flash-lite';
const FALLBACK_MODEL_CHAIN = [
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemma-4-26b-a4b-it',
  'gemini-4-hydrogen',
];
const ALLOWED_MODELS = new Set([
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-4-hydrogen',
  'gemini-4-argon',
  'gemini-4-neon',
  'gemini-4-carbon',
  'gemma-4-31b-it',
  'gemma-4-26b-a4b-it',
]);

const MINUTE_SECONDS = 60;
const DAY_SECONDS = 24 * 60 * 60;
const PRE_AUTH_IP_LIMIT = 60;
const DEFAULT_USER_RPM_LIMIT = 10;
const DEFAULT_USER_DAILY_LIMIT = 60;
const IP_RPM_LIMIT = 30;

const TOKEN_CACHE_MAX_ENTRIES = 200;
const TOKEN_CACHE_MAX_TTL_MS = 60 * 1000;
const TOKENINFO_TIMEOUT_MS = 5000;
const GEMINI_TIMEOUT_MS = 35000;
const REDIS_TIMEOUT_MS = 1500;

const MAX_BODY_BYTES = 64 * 1024;
const MAX_MESSAGE_CHARS = 4000;
const MAX_OUTPUT_TOKENS = 2048;
const INTERACTION_ID_PATTERN = /^[A-Za-z0-9._:=-]{1,512}$/;

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
  return (forwardedHost || getHeader(req, 'host')).split(',')[0].trim().toLowerCase();
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

  return (key, limit, windowSeconds = MINUTE_SECONDS) => {
    const now = nowFn();
    const windowMs = windowSeconds * 1000;
    prune(now);
    const current = buckets.get(key);
    if (!current || current.resetAt <= now) {
      const next = { count: 1, resetAt: now + windowMs };
      buckets.set(key, next);
      return { allowed: true, remaining: Math.max(0, limit - 1), retryAfterSeconds: windowSeconds };
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

  return async (key, limit, windowSeconds = MINUTE_SECONDS) => {
    if (!hasUpstash) {
      return memoryCheck(key, limit, windowSeconds);
    }
    const pipelineRes = await callUpstashPipeline(fetchImpl, restUrl, restToken, [
      ['INCR', key],
      ['TTL', key],
    ]);
    if (!Array.isArray(pipelineRes) || pipelineRes.length < 2) {
      return memoryCheck(key, limit, windowSeconds);
    }
    const count = Number(pipelineRes[0]?.result);
    const ttl = Number(pipelineRes[1]?.result);
    if (!Number.isFinite(count)) {
      return memoryCheck(key, limit, windowSeconds);
    }
    if (count === 1 || !Number.isFinite(ttl) || ttl < 0) {
      await callUpstashPipeline(fetchImpl, restUrl, restToken, [
        ['EXPIRE', key, windowSeconds],
      ]);
    }
    const retryAfterSeconds = Number.isFinite(ttl) && ttl > 0 ? ttl : windowSeconds;
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
          console.warn('[api/gemini] GOOGLE_CLIENT_ID / VITE_GOOGLE_CLIENT_ID is not set in function env; falling back to Classroom scope verification.');
        }
        const scopes = String(info.scope || '').split(/\s+/);
        if (!scopes.includes(CLASSROOM_READONLY_SCOPE)) {
          return { ok: false, status: 401, error: 'OAuth token lacks required application scope.' };
        }
      }

      const verifiedEmail = info.email ? String(info.email).toLowerCase().trim() : '';
      const userKey = verifiedEmail
        ? `email:${verifiedEmail}`
        : info.sub
          ? `sub:${String(info.sub)}`
          : `tok:${tokenHash}`;
      const tokenExpMs = resolveTokenExpiryMs(info, nowMs);
      setCached(tokenHash, { userKey, verifiedEmail }, tokenExpMs, nowMs);

      return { ok: true, userKey, verifiedEmail };
    } catch {
      return { ok: false, status: 503, error: 'Unable to verify Google session right now.' };
    } finally {
      clearTimeout(timeoutId);
    }
  };
};

const parseJsonBody = async (req) => {
  if (req?.body !== undefined && req?.body !== null) {
    if (typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
      const serialized = JSON.stringify(req.body);
      if (Buffer.byteLength(serialized, 'utf8') > MAX_BODY_BYTES) {
        return { ok: false, status: 413, error: 'Request payload is too large.' };
      }
      return { ok: true, data: req.body };
    }
    const rawStr = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : String(req.body);
    if (Buffer.byteLength(rawStr, 'utf8') > MAX_BODY_BYTES) {
      return { ok: false, status: 413, error: 'Request payload is too large.' };
    }
    try {
      const parsed = JSON.parse(rawStr);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { ok: false, status: 400, error: 'JSON body must be an object.' };
      }
      return { ok: true, data: parsed };
    } catch {
      return { ok: false, status: 400, error: 'Invalid JSON request body.' };
    }
  }

  if (typeof req?.on === 'function') {
    return new Promise((resolve) => {
      const chunks = [];
      let totalBytes = 0;
      let settled = false;

      req.on('data', (chunk) => {
        if (settled) return;
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
        totalBytes += buf.byteLength;
        if (totalBytes > MAX_BODY_BYTES) {
          settled = true;
          resolve({ ok: false, status: 413, error: 'Request payload is too large.' });
          return;
        }
        chunks.push(buf);
      });

      req.on('end', () => {
        if (settled) return;
        settled = true;
        try {
          const rawStr = Buffer.concat(chunks).toString('utf8');
          if (!rawStr.trim()) {
            resolve({ ok: false, status: 400, error: 'Request body cannot be empty.' });
            return;
          }
          const parsed = JSON.parse(rawStr);
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            resolve({ ok: false, status: 400, error: 'JSON body must be an object.' });
            return;
          }
          resolve({ ok: true, data: parsed });
        } catch {
          resolve({ ok: false, status: 400, error: 'Invalid JSON request body.' });
        }
      });

      req.on('error', () => {
        if (settled) return;
        settled = true;
        resolve({ ok: false, status: 400, error: 'Failed reading request stream.' });
      });
    });
  }

  return { ok: false, status: 400, error: 'Invalid JSON request body.' };
};

const cleanText = (val, maxLen = 160) =>
  String(val ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);

const sanitizeWorkspaceContext = (rawContext) => {
  if (!rawContext || typeof rawContext !== 'object') {
    return {
      lang: 'th',
      studentName: '',
      currentLocalTime: '',
      assignments: [],
      schedule: [],
      exams: [],
      courses: [],
    };
  }

  const lang = rawContext.lang === 'en' ? 'en' : 'th';
  const studentName = cleanText(rawContext.studentName, 80);
  const currentLocalTime = cleanText(rawContext.currentLocalTime, 64);

  const assignments = Array.isArray(rawContext.assignments)
    ? rawContext.assignments.slice(0, 35).map((item) => ({
        title: cleanText(item?.title, 140),
        course: cleanText(item?.course, 100),
        courseCode: cleanText(item?.courseCode, 30),
        dueDate: cleanText(item?.dueDate, 40),
        status: cleanText(item?.status, 20),
        points: Number.isFinite(Number(item?.points)) ? Number(item.points) : null,
        description: cleanText(item?.description, 180),
      })).filter((a) => a.title)
    : [];

  const schedule = Array.isArray(rawContext.schedule)
    ? rawContext.schedule.slice(0, 30).map((slot) => ({
        title: cleanText(slot?.title, 120),
        courseCode: cleanText(slot?.courseCode, 30),
        day: cleanText(slot?.day, 20),
        startTime: cleanText(slot?.startTime, 16),
        endTime: cleanText(slot?.endTime, 16),
        room: cleanText(slot?.room, 40),
      })).filter((s) => s.title)
    : [];

  const exams = Array.isArray(rawContext.exams)
    ? rawContext.exams.slice(0, 20).map((exam) => ({
        courseCode: cleanText(exam?.courseCode || exam?.subjectCode, 30),
        subjectName: cleanText(exam?.subjectName || exam?.courseName, 120),
        date: cleanText(exam?.date, 40),
        time: cleanText(exam?.time, 40),
        room: cleanText(exam?.room, 40),
        seat: cleanText(exam?.seat, 40),
      })).filter((e) => e.courseCode || e.subjectName)
    : [];

  const courses = Array.isArray(rawContext.courses)
    ? rawContext.courses.slice(0, 25).map((course) => ({
        name: cleanText(course?.name, 120),
        code: cleanText(course?.code, 30),
      })).filter((c) => c.name)
    : [];

  return {
    lang,
    studentName,
    currentLocalTime,
    assignments,
    schedule,
    exams,
    courses,
  };
};

export const buildSystemInstruction = (ctx) => {
  const lines = [
    'You are the Classroom Hub Study Assistant for university students (KMUTNB).',
    ctx.lang === 'en'
      ? 'Respond clearly and concisely in English unless the student writes in Thai.'
      : 'ตอบกลับเป็นภาษาไทยที่กระชับ อ่านง่าย เป็นธรรมชาติ ยกเว้นผู้ใช้ถามเป็นภาษาอังกฤษ',
    'Rules:',
    '- Ground all answers strictly in the live workspace snapshot below when answering about the student\'s assignments, deadlines, timetable, courses, or exams.',
    '- Never invent due dates, course codes, exam rooms, or seat numbers that are not present in the snapshot.',
    '- When prioritizing tasks, put overdue items first, then nearest deadlines, then unscheduled coursework.',
    '- Format lists cleanly with short bullet points and bold key titles/dates. Avoid filler introductions.',
  ];

  if (ctx.currentLocalTime) {
    lines.push(`Current student local time: ${ctx.currentLocalTime}`);
  }
  if (ctx.studentName) {
    lines.push(`Student name: ${ctx.studentName}`);
  }

  lines.push('\n--- LIVE WORKSPACE SNAPSHOT ---');

  if (ctx.courses.length > 0) {
    lines.push(`Enrolled courses (${ctx.courses.length}): ${ctx.courses.map((c) => (c.code ? `${c.code} ${c.name}` : c.name)).join(' | ')}`);
  }

  if (ctx.assignments.length > 0) {
    lines.push(`Active/Pending Assignments (${ctx.assignments.length}):`);
    for (const a of ctx.assignments) {
      const courseTag = a.courseCode || a.course || 'General';
      const dueTag = a.dueDate || 'No due date';
      const ptsTag = a.points ? `, ${a.points} pts` : '';
      const descTag = a.description ? ` — ${a.description}` : '';
      lines.push(`- [${a.status || 'todo'}] ${a.title} (${courseTag}, Due: ${dueTag}${ptsTag})${descTag}`);
    }
  } else {
    lines.push('Active/Pending Assignments: None pending right now.');
  }

  if (ctx.schedule.length > 0) {
    lines.push(`Weekly Class Schedule (${ctx.schedule.length}):`);
    for (const s of ctx.schedule) {
      const code = s.courseCode ? `${s.courseCode} ` : '';
      const room = s.room ? ` @ Room ${s.room}` : '';
      lines.push(`- ${s.day}: ${s.startTime}-${s.endTime} ${code}${s.title}${room}`);
    }
  } else {
    lines.push('Weekly Class Schedule: Not imported yet.');
  }

  if (ctx.exams.length > 0) {
    lines.push(`Upcoming Exams (${ctx.exams.length}):`);
    for (const e of ctx.exams) {
      const room = e.room ? `, Room: ${e.room}` : '';
      const seat = e.seat ? `, Seat: ${e.seat}` : '';
      lines.push(`- ${e.courseCode} ${e.subjectName} | Date: ${e.date} ${e.time}${room}${seat}`);
    }
  } else {
    lines.push('Upcoming Exams: None saved right now.');
  }

  return lines.join('\n');
};

export const extractOutputText = (interaction) => {
  if (typeof interaction?.output_text === 'string' && interaction.output_text.trim()) {
    return interaction.output_text.trim();
  }
  const steps = Array.isArray(interaction?.steps) ? interaction.steps : [];
  const trailingParts = [];
  for (let i = steps.length - 1; i >= 0; i -= 1) {
    const step = steps[i];
    if (step?.type !== 'model_output') {
      if (trailingParts.length > 0) break;
      continue;
    }
    const content = Array.isArray(step.content) ? step.content : [];
    const stepText = content
      .filter((part) => part?.type === 'text' && typeof part.text === 'string')
      .map((part) => part.text)
      .join('');
    if (stepText) {
      trailingParts.unshift(stepText);
    }
  }
  return trailingParts.join('').trim();
};

const createRestInteractionsClient = (fetchImpl, apiKey) => ({
  interactions: {
    async create(payload) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
      try {
        const res = await fetchImpl(GEMINI_INTERACTIONS_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'x-goog-api-key': apiKey,
            'api-revision': GEMINI_API_REVISION,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        const data = await res.json().catch(() => null);
        if (!res.ok) {
          const message = data?.error?.message || data?.message || `Gemini API error (${res.status})`;
          const err = new Error(message);
          err.status = res.status;
          err.code = data?.error?.code || '';
          throw err;
        }

        return {
          ...data,
          output_text: extractOutputText(data),
        };
      } finally {
        clearTimeout(timeoutId);
      }
    },
  },
});

const isInvalidPreviousInteractionError = (error) => {
  const status = Number(error?.status || error?.statusCode || 0);
  const msg = String(error?.message || '').toLowerCase();
  if (status === 404) return true;
  if (status === 400 && (msg.includes('previous_interaction_id') || msg.includes('interaction') || msg.includes('not found'))) {
    return true;
  }
  return false;
};

const resolvePositiveInt = (rawValue, fallback) => {
  const parsed = Number(rawValue);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
};

const resolveModelChain = (env) => {
  const configured = String(env?.GEMINI_MODEL || '').trim();
  if (configured && ALLOWED_MODELS.has(configured)) {
    const rest = FALLBACK_MODEL_CHAIN.filter((m) => m !== configured);
    return [configured, ...rest];
  }
  return [...FALLBACK_MODEL_CHAIN];
};

const sendJson = (res, status, payload) => {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.status(status).json(payload);
};

export function createGeminiHandler(deps = {}) {
  const fetchImpl = deps.fetchImpl || globalThis.fetch;
  const env = deps.env || process.env;
  const nowFn = deps.nowFn || (() => Date.now());
  const createGenAIClient = deps.createGenAIClient || ((apiKey) => createRestInteractionsClient(fetchImpl, apiKey));

  const allowedOrigins = buildAllowedOrigins(env);
  const preAuthIpLimit = createInMemoryLimiter(nowFn);
  const checkRateLimit = createHybridRateLimiter({ fetchImpl, env, nowFn });
  const verifyGoogleToken = createTokenVerifier({ fetchImpl, env, nowFn });

  const userRpmLimit = resolvePositiveInt(env?.GEMINI_USER_RPM_LIMIT, DEFAULT_USER_RPM_LIMIT);
  const userDailyLimit = resolvePositiveInt(env?.GEMINI_USER_DAILY_LIMIT, DEFAULT_USER_DAILY_LIMIT);

  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Vary', 'Authorization, Origin');

    if (String(req?.method || '').toUpperCase() !== 'POST') {
      res.setHeader('Allow', 'POST');
      return sendJson(res, 405, { error: 'Method not allowed.' });
    }

    if (!checkOriginAllowed(req, allowedOrigins)) {
      return sendJson(res, 403, { error: 'Forbidden origin.' });
    }

    const apiKey = String(env?.GEMINI_API_KEY || env?.GOOGLE_API_KEY || '').trim();
    if (!apiKey) {
      return sendJson(res, 503, {
        error: 'Gemini API key is not configured on the server (GEMINI_API_KEY).',
        code: 'MISSING_API_KEY',
      });
    }

    const clientIp = getClientIp(req);
    const ipHash = hashIdentifier(clientIp);
    const preAuthResult = preAuthIpLimit(`gemini:preauth:${ipHash}`, PRE_AUTH_IP_LIMIT, MINUTE_SECONDS);
    if (!preAuthResult.allowed) {
      res.setHeader('Retry-After', String(preAuthResult.retryAfterSeconds));
      return sendJson(res, 429, { error: 'Too many requests. Please wait a minute and try again.' });
    }

    const bearerToken = extractBearerToken(req);
    if (!bearerToken) {
      return sendJson(res, 401, { error: 'Google sign-in required to use Study Assistant.' });
    }

    const authResult = await verifyGoogleToken(bearerToken);
    if (!authResult.ok) {
      return sendJson(res, authResult.status, { error: authResult.error });
    }

    const bodyResult = await parseJsonBody(req);
    if (!bodyResult.ok) {
      return sendJson(res, bodyResult.status, { error: bodyResult.error });
    }

    const rawMessage = typeof bodyResult.data.message === 'string' ? bodyResult.data.message.trim() : '';
    if (!rawMessage) {
      return sendJson(res, 400, { error: 'Message is required.' });
    }
    if (rawMessage.length > MAX_MESSAGE_CHARS) {
      return sendJson(res, 400, { error: `Message must not exceed ${MAX_MESSAGE_CHARS} characters.` });
    }

    let previousInteractionId = '';
    if (bodyResult.data.previousInteractionId !== undefined && bodyResult.data.previousInteractionId !== null && bodyResult.data.previousInteractionId !== '') {
      const candidateId = String(bodyResult.data.previousInteractionId).trim();
      if (!INTERACTION_ID_PATTERN.test(candidateId)) {
        return sendJson(res, 400, { error: 'Invalid previousInteractionId format.' });
      }
      previousInteractionId = candidateId;
    }

    const userHash = hashIdentifier(authResult.userKey);
    const rpmCheck = await checkRateLimit(`gemini:rpm:${userHash}`, userRpmLimit, MINUTE_SECONDS);
    if (!rpmCheck.allowed) {
      res.setHeader('Retry-After', String(rpmCheck.retryAfterSeconds));
      return sendJson(res, 429, {
        error: 'Rate limit exceeded. Please wait a moment before sending another message.',
        code: 'USER_RPM_LIMIT',
      });
    }

    const dailyCheck = await checkRateLimit(`gemini:daily:${userHash}`, userDailyLimit, DAY_SECONDS);
    if (!dailyCheck.allowed) {
      res.setHeader('Retry-After', String(dailyCheck.retryAfterSeconds));
      return sendJson(res, 429, {
        error: 'Daily AI assistant quota reached for your account. Please try again tomorrow.',
        code: 'USER_DAILY_LIMIT',
      });
    }

    const ipCheck = await checkRateLimit(`gemini:ip:${ipHash}`, IP_RPM_LIMIT, MINUTE_SECONDS);
    if (!ipCheck.allowed) {
      res.setHeader('Retry-After', String(ipCheck.retryAfterSeconds));
      return sendJson(res, 429, { error: 'Network rate limit exceeded. Please try again shortly.' });
    }

    const modelCandidates = resolveModelChain(env);
    const sanitizedContext = sanitizeWorkspaceContext(bodyResult.data.context);
    const systemInstruction = buildSystemInstruction(sanitizedContext);

    try {
      const client = createGenAIClient(apiKey);
      const runWithModel = (modelName, prevId) =>
        client.interactions.create({
          model: modelName,
          input: rawMessage,
          system_instruction: systemInstruction,
          generation_config: {
            max_output_tokens: MAX_OUTPUT_TOKENS,
          },
          ...(prevId ? { previous_interaction_id: prevId } : {}),
        });

      let interaction = null;
      let usedModel = modelCandidates[0] || DEFAULT_MODEL;
      let lastError = null;

      for (let idx = 0; idx < modelCandidates.length; idx += 1) {
        const candidateModel = modelCandidates[idx];
        // Only send previous_interaction_id on the primary model; if falling back to another model on 429, start clean turn
        const prevIdForAttempt = idx === 0 ? previousInteractionId : '';
        try {
          try {
            interaction = await runWithModel(candidateModel, prevIdForAttempt);
          } catch (err) {
            if (prevIdForAttempt && isInvalidPreviousInteractionError(err)) {
              interaction = await runWithModel(candidateModel, '');
            } else {
              throw err;
            }
          }
          usedModel = candidateModel;
          lastError = null;
          break;
        } catch (err) {
          lastError = err;
          const status = Number(err?.status || err?.statusCode || 0);
          if (status === 429 && idx < modelCandidates.length - 1) {
            continue;
          }
          throw err;
        }
      }

      if (!interaction && lastError) {
        throw lastError;
      }

      const replyText = extractOutputText(interaction);
      if (!replyText) {
        return sendJson(res, 502, { error: 'Gemini returned an empty response. Please try rephrasing your question.' });
      }

      return sendJson(res, 200, {
        reply: replyText,
        interactionId: interaction?.id || null,
        model: usedModel,
        remainingDaily: dailyCheck.remaining,
      });
    } catch (error) {
      const upstreamStatus = Number(error?.status || error?.statusCode || 0);
      if (upstreamStatus === 429) {
        return sendJson(res, 429, {
          error: 'Shared Gemini API quota is temporarily busy. Please try again in a minute.',
          code: 'UPSTREAM_QUOTA_EXCEEDED',
        });
      }
      if (upstreamStatus === 401 || upstreamStatus === 403) {
        return sendJson(res, 502, {
          error: 'Server Gemini API key was rejected by Google AI Studio.',
          code: 'INVALID_GEMINI_KEY',
        });
      }
      if (error?.name === 'AbortError' || upstreamStatus === 504) {
        return sendJson(res, 504, { error: 'Gemini request timed out. Please try a shorter question.' });
      }
      return sendJson(res, 502, { error: 'Failed to communicate with Gemini service.' });
    }
  };
}

export default createGeminiHandler();
