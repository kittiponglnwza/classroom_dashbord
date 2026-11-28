import { describe, it, expect, vi } from 'vitest';
import { createGeminiHandler } from '../../api/gemini';

const CLIENT_ID = '123456-test.apps.googleusercontent.com';

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
    method: 'POST',
    url: '/api/gemini',
    headers: {
      host: 'classrooms-hub.vercel.app',
      origin: 'https://classrooms-hub.vercel.app',
      authorization: 'Bearer valid-google-token',
      'content-type': 'application/json',
      'x-forwarded-for': '203.0.113.10',
    },
    body: {
      message: 'ช่วยสรุปงานด่วนให้หน่อย',
      context: {
        lang: 'th',
        studentName: 'Somchai',
        assignments: [
          {
            title: 'Lab 3: Digital Logic',
            course: 'Computer Hardware',
            courseCode: '010123102',
            dueDate: '2026-11-29T23:59:00',
            status: 'todo',
            points: 10,
          },
        ],
        schedule: [
          {
            title: 'Computer Hardware',
            courseCode: '010123102',
            day: 'Monday',
            startTime: '09:00',
            endTime: '12:00',
            room: '78-401',
          },
        ],
        exams: [
          {
            courseCode: '010123102',
            subjectName: 'Computer Hardware',
            date: '2026-12-10',
            time: '09:00-12:00',
            room: '78-502',
            seat: 'A12',
          },
        ],
      },
    },
    ...overrides,
  };
}

function createValidTokenFetch() {
  return vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      aud: CLIENT_ID,
      email: 's6601012610012@email.kmutnb.ac.th',
      expires_in: '3599',
    }),
  }));
}

describe('Vercel Serverless /api/gemini endpoint', () => {
  it('rejects non-POST HTTP methods with 405', async () => {
    const handler = createGeminiHandler({
      fetchImpl: vi.fn(),
      env: { GEMINI_API_KEY: 'test-key', VITE_GOOGLE_CLIENT_ID: CLIENT_ID },
    });
    const res = createMockRes();

    await handler(createReq({ method: 'GET' }), res);

    expect(res.statusCode).toBe(405);
    expect(res.headers.allow).toBe('POST');
  });

  it('blocks disallowed origins and cross-site fetches with 403', async () => {
    const handler = createGeminiHandler({
      fetchImpl: vi.fn(),
      env: { GEMINI_API_KEY: 'test-key', VITE_GOOGLE_CLIENT_ID: CLIENT_ID },
    });

    const badOriginRes = createMockRes();
    await handler(
      createReq({
        headers: {
          host: 'classrooms-hub.vercel.app',
          origin: 'https://attacker.example',
          authorization: 'Bearer valid-google-token',
        },
      }),
      badOriginRes
    );
    expect(badOriginRes.statusCode).toBe(403);

    const crossSiteRes = createMockRes();
    await handler(
      createReq({
        headers: {
          host: 'classrooms-hub.vercel.app',
          'sec-fetch-site': 'cross-site',
          authorization: 'Bearer valid-google-token',
        },
      }),
      crossSiteRes
    );
    expect(crossSiteRes.statusCode).toBe(403);
  });

  it('returns 503 MISSING_API_KEY when GEMINI_API_KEY is not configured', async () => {
    const handler = createGeminiHandler({
      fetchImpl: vi.fn(),
      env: { VITE_GOOGLE_CLIENT_ID: CLIENT_ID },
    });
    const res = createMockRes();

    await handler(createReq(), res);

    expect(res.statusCode).toBe(503);
    expect(res.body.code).toBe('MISSING_API_KEY');
  });

  it('requires a valid Google OAuth Bearer token (401)', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 400,
      json: async () => ({ error: 'invalid_token' }),
    }));
    const handler = createGeminiHandler({
      fetchImpl,
      env: { GEMINI_API_KEY: 'test-key', VITE_GOOGLE_CLIENT_ID: CLIENT_ID },
    });

    const missingAuthRes = createMockRes();
    await handler(
      createReq({
        headers: {
          host: 'classrooms-hub.vercel.app',
          origin: 'https://classrooms-hub.vercel.app',
        },
      }),
      missingAuthRes
    );
    expect(missingAuthRes.statusCode).toBe(401);

    const invalidTokenRes = createMockRes();
    await handler(createReq(), invalidTokenRes);
    expect(invalidTokenRes.statusCode).toBe(401);
  });

  it('calls Gemini Interactions API with workspace system_instruction and returns reply + interactionId', async () => {
    const interactionsCreate = vi.fn(async () => ({
      id: 'inter_abc123',
      output_text: '- **Lab 3: Digital Logic** ส่งภายในพรุ่งนี้ ควรเริ่มทำเป็นชิ้นแรก',
    }));

    const handler = createGeminiHandler({
      fetchImpl: createValidTokenFetch(),
      env: { GEMINI_API_KEY: 'test-key', VITE_GOOGLE_CLIENT_ID: CLIENT_ID },
      createGenAIClient: () => ({
        interactions: { create: interactionsCreate },
      }),
    });

    const res = createMockRes();
    await handler(createReq(), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.reply).toContain('Lab 3: Digital Logic');
    expect(res.body.interactionId).toBe('inter_abc123');
    expect(res.body.model).toBe('gemini-3.5-flash-lite');

    expect(interactionsCreate).toHaveBeenCalledTimes(1);
    const callArg = interactionsCreate.mock.calls[0][0];
    expect(callArg.model).toBe('gemini-3.5-flash-lite');
    expect(callArg.input).toBe('ช่วยสรุปงานด่วนให้หน่อย');
    expect(callArg.system_instruction).toContain('Lab 3: Digital Logic');
    expect(callArg.system_instruction).toContain('78-401');
    expect(callArg.system_instruction).toContain('78-502');
  });

  it('automatically falls back to secondary model when primary model hits 429 Free Tier quota', async () => {
    const interactionsCreate = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('Rate limit exceeded'), { status: 429 }))
      .mockResolvedValueOnce({
        id: 'inter_fallback_ok',
        steps: [{ type: 'model_output', content: [{ type: 'text', text: 'ตอบจากโมเดลสำรองสำเร็จ' }] }],
      });

    const handler = createGeminiHandler({
      fetchImpl: createValidTokenFetch(),
      env: {
        GEMINI_API_KEY: 'test-key',
        GEMINI_MODEL: 'gemini-4-hydrogen',
        VITE_GOOGLE_CLIENT_ID: CLIENT_ID,
      },
      createGenAIClient: () => ({
        interactions: { create: interactionsCreate },
      }),
    });

    const res = createMockRes();
    await handler(createReq(), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.reply).toBe('ตอบจากโมเดลสำรองสำเร็จ');
    expect(res.body.model).toBe('gemini-3.5-flash-lite');
    expect(interactionsCreate).toHaveBeenCalledTimes(2);
    expect(interactionsCreate.mock.calls[0][0].model).toBe('gemini-4-hydrogen');
    expect(interactionsCreate.mock.calls[1][0].model).toBe('gemini-3.5-flash-lite');
  });

  it('retries cleanly without previous_interaction_id when an expired interaction ID returns 404', async () => {
    const interactionsCreate = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('Interaction not found'), { status: 404 }))
      .mockResolvedValueOnce({
        id: 'inter_fresh_456',
        output_text: 'เริ่มรอบสนทนาใหม่เรียบร้อย',
      });

    const handler = createGeminiHandler({
      fetchImpl: createValidTokenFetch(),
      env: { GEMINI_API_KEY: 'test-key', VITE_GOOGLE_CLIENT_ID: CLIENT_ID },
      createGenAIClient: () => ({
        interactions: { create: interactionsCreate },
      }),
    });

    const res = createMockRes();
    await handler(
      createReq({
        body: {
          message: 'แล้วพรุ่งนี้ต้องอ่านวิชาอะไรต่อ',
          previousInteractionId: 'inter_expired_001',
          context: { lang: 'th' },
        },
      }),
      res
    );

    expect(res.statusCode).toBe(200);
    expect(res.body.interactionId).toBe('inter_fresh_456');
    expect(interactionsCreate).toHaveBeenCalledTimes(2);
    expect(interactionsCreate.mock.calls[0][0].previous_interaction_id).toBe('inter_expired_001');
    expect(interactionsCreate.mock.calls[1][0].previous_interaction_id).toBeUndefined();
  });

  it('enforces per-user RPM rate limits with 429 and Retry-After header', async () => {
    const interactionsCreate = vi.fn(async () => ({
      id: 'inter_rate_test',
      output_text: 'รับทราบครับ',
    }));

    const handler = createGeminiHandler({
      fetchImpl: createValidTokenFetch(),
      env: {
        GEMINI_API_KEY: 'test-key',
        VITE_GOOGLE_CLIENT_ID: CLIENT_ID,
        GEMINI_USER_RPM_LIMIT: '2',
      },
      createGenAIClient: () => ({
        interactions: { create: interactionsCreate },
      }),
    });

    const r1 = createMockRes();
    const r2 = createMockRes();
    const r3 = createMockRes();

    await handler(createReq(), r1);
    await handler(createReq(), r2);
    await handler(createReq(), r3);

    expect(r1.statusCode).toBe(200);
    expect(r2.statusCode).toBe(200);
    expect(r3.statusCode).toBe(429);
    expect(r3.body.code).toBe('USER_RPM_LIMIT');
    expect(Number(r3.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('includes Classroom attachment filenames in system_instruction and sends multimodal user_input steps for attached PDF/image files', async () => {
    const interactionsCreate = vi.fn(async () => ({
      id: 'inter_multimodal_1',
      output_text: 'ในไฟล์ Lab3_Sheet.pdf ให้ต่อวงจร Adder 4-bit ครับ',
    }));

    const handler = createGeminiHandler({
      fetchImpl: createValidTokenFetch(),
      env: { GEMINI_API_KEY: 'test-key', VITE_GOOGLE_CLIENT_ID: CLIENT_ID },
      createGenAIClient: () => ({
        interactions: { create: interactionsCreate },
      }),
    });

    const tinyBase64 = 'JVBERi0xLjQK';
    const res = createMockRes();
    await handler(
      createReq({
        body: {
          message: 'สรุปโจทย์ในไฟล์นี้ให้หน่อย',
          files: [
            {
              name: 'Lab3_Sheet.pdf',
              mimeType: 'application/pdf',
              data: tinyBase64,
            },
          ],
          context: {
            lang: 'th',
            assignments: [
              {
                title: 'Lab 3: Digital Logic',
                course: 'Computer Hardware',
                dueDate: '2026-11-29',
                status: 'todo',
                attachments: [{ name: 'Lab3_Sheet.pdf', size: 'Google Drive File' }],
              },
            ],
            resources: [
              {
                title: 'Week 5 Lecture Slides',
                course: 'Computer Hardware',
                type: 'material',
                attachments: [{ name: 'Week5_Adder.pdf', size: 'Google Drive File' }],
              },
            ],
          },
        },
      }),
      res
    );

    expect(res.statusCode).toBe(200);
    expect(res.body.reply).toContain('Adder 4-bit');

    const callArg = interactionsCreate.mock.calls[0][0];
    expect(callArg.system_instruction).toContain('Lab3_Sheet.pdf (Google Drive File)');
    expect(callArg.system_instruction).toContain('Week5_Adder.pdf (Google Drive File)');
    expect(Array.isArray(callArg.input)).toBe(true);
    expect(callArg.input[0].type).toBe('user_input');
    expect(callArg.input[0].content).toEqual([
      {
        type: 'document',
        mime_type: 'application/pdf',
        data: tinyBase64,
      },
      {
        type: 'text',
        text: 'สรุปโจทย์ในไฟล์นี้ให้หน่อย',
      },
    ]);
  });
});
