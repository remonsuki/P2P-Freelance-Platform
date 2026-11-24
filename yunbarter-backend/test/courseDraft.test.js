const assert = require('node:assert/strict');
const { once } = require('node:events');
const { test } = require('node:test');
const { inspect } = require('node:util');
const { createCourseDraftGenerator } = require('../courseDraft');
const { createApp } = require('../server');

const draft = {
  title: '用手機拍出有層次的街景',
  description: '用手機拍攝街景，練習自然光、取景和簡單修圖。',
  category: '影像',
  price: 3.7,
};
const topic = { skill: '手機街景構圖', style: '幽默風趣', description: '練習自然光構圖' };
const categories = ['程式', '語言', '音樂', '設計', '運動', '飲食', '影像', '手作', '職場', '園藝', '生活', '綜合'];
const referencePricing = {
  byCategory: { 影像: { referenceCount: 3, min: 2.4, max: 5.6, median: 3.8, basis: 'category' } },
  catalog: null,
};

function providerResult(value) {
  return new Response(JSON.stringify({
    status: 'completed',
    output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: JSON.stringify(value) }] }],
  }));
}

function geminiErrorResponse(status, error) {
  return Response.json({ error: { code: status, ...error } }, { status });
}

async function openDraftEndpoint(t, { rows, generateCourseDraft }) {
  const db = {
    async query(sql) {
      if (sql.includes('FROM user_sessions')) return { rows: [{ user_id: '1' }] };
      if (/\bFROM\s+courses\b/i.test(sql)) return { rows };
      throw new Error('Unexpected query in course draft test');
    },
  };
  const server = createApp({ db, chain: null, generateCourseDraft }).listen(0, '127.0.0.1');
  t.after(async () => { await new Promise(resolve => server.close(resolve)); });
  await once(server, 'listening');
  const url = `http://127.0.0.1:${server.address().port}/api/ai/generate`;
  return body => fetch(url, {
    method: 'POST',
    headers: { Cookie: `yunbarter_session=${'a'.repeat(64)}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(3000),
  });
}

test('the draft generator requests a structured OpenAI result and reads generated fields', async () => {
  const env = { OPENAI_API_KEY: 'unit-test-key', OPENAI_MODEL: 'unit-test-model' };
  let sent;
  const generate = createCourseDraftGenerator({ env, async fetchImpl(url, options) {
    sent = { url: String(url), ...options, body: JSON.parse(options.body) };
    return providerResult(draft);
  } });
  assert.deepEqual(await generate({ ...topic, pricing: referencePricing }), draft);
  assert.equal(sent.url, 'https://api.openai.com/v1/responses');
  assert.equal(sent.method, 'POST');
  assert.equal(new Headers(sent.headers).get('Authorization'), 'Bearer unit-test-key');
  assert.equal(sent.body.model, env.OPENAI_MODEL);
  assert.equal(sent.body.text.format.type, 'json_schema');
  assert.equal(sent.body.text.format.strict, true);
  assert.deepEqual(new Set(sent.body.text.format.schema.properties.category.enum), new Set(categories));
  assert.equal(sent.body.text.format.schema.properties.price.type, 'number');
  assert.deepEqual(sent.body.text.format.schema.required.sort(), ['category', 'description', 'price', 'title']);
  assert.deepEqual(JSON.parse(sent.body.input), { ...topic, pricing: referencePricing, starterPriceRange: { min: 1, max: 10 } });
});

test('the draft generator prefers Gemini and sends a structured request with catalog pricing', async () => {
  const env = { GEMINI_API_KEY: 'gemini-test-key', GEMINI_MODEL: 'gemini-unit-test', OPENAI_API_KEY: 'openai-test-key' };
  const outputText = JSON.stringify(draft);
  const requests = [];
  const generate = createCourseDraftGenerator({ env, async fetchImpl(url, options) {
    requests.push({ url: String(url), ...options, body: JSON.parse(options.body) });
    return new Response(JSON.stringify({
      candidates: [{
        finishReason: 'STOP',
        content: { role: 'model', parts: [{ text: outputText.slice(0, 15) }, { text: outputText.slice(15) }] },
      }],
    }));
  } });

  assert.deepEqual(await generate({ ...topic, pricing: referencePricing }), draft);
  assert.equal(requests.length, 1);
  const [sent] = requests;
  assert.equal(sent.url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-unit-test:generateContent');
  assert.equal(sent.method, 'POST');
  const headers = new Headers(sent.headers);
  assert.equal(headers.get('x-goog-api-key'), 'gemini-test-key');
  assert.equal(headers.get('Authorization'), null);
  assert.match(sent.body.systemInstruction.parts[0].text, /pricing\.byCategory/);
  const [message] = sent.body.contents;
  assert.equal(message.role, 'user');
  assert.deepEqual(JSON.parse(message.parts[0].text), { ...topic, pricing: referencePricing, starterPriceRange: { min: 1, max: 10 } });
  const { responseMimeType, responseJsonSchema, maxOutputTokens } = sent.body.generationConfig;
  assert.equal(responseMimeType, 'application/json');
  assert.equal(maxOutputTokens, 1600);
  assert.equal(sent.body.generationConfig.thinkingConfig, undefined);
  assert.deepEqual(new Set(responseJsonSchema.properties.category.enum), new Set(categories));
  assert.equal(responseJsonSchema.properties.price.type, 'number');
  assert.deepEqual(responseJsonSchema.required.sort(), ['category', 'description', 'price', 'title']);
});

test('Gemini reports blocked and incomplete draft generation without a template result', async () => {
  const env = { GEMINI_API_KEY: 'gemini-test-key' };
  const cases = [
    { result: { promptFeedback: { blockReason: 'SAFETY' } }, status: 422 },
    { result: { candidates: [{ finishReason: 'SAFETY' }] }, status: 422 },
    { result: { candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: JSON.stringify(draft) }] } }] }, status: 502 },
  ];
  for (const { result, status } of cases) {
    let sentUrl;
    const generate = createCourseDraftGenerator({ env, async fetchImpl(url) {
      sentUrl = String(url);
      return new Response(JSON.stringify(result));
    } });
    await assert.rejects(generate({ ...topic, pricing: referencePricing }), { status });
    assert.equal(sentUrl, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent');
  }
});

test('Gemini uses minimal thinking for course drafts and retries a transient HTTP 503', async () => {
  let attempts = 0;
  const generate = createCourseDraftGenerator({
    env: { GEMINI_API_KEY: 'gemini-test-key' },
    async fetchImpl(url, options) {
      attempts += 1;
      assert.deepEqual(JSON.parse(options.body).generationConfig.thinkingConfig, { thinkingLevel: 'MINIMAL' });
      if (attempts === 1) return geminiErrorResponse(503, { status: 'UNAVAILABLE' });
      return Response.json({
        candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(draft) }] } }],
      });
    },
  });

  assert.deepEqual(await generate({ ...topic, pricing: referencePricing }), draft);
  assert.equal(attempts, 2);
});

test('Gemini retries once when the network connection resets', async () => {
  let attempts = 0;
  const generate = createCourseDraftGenerator({
    env: { GEMINI_API_KEY: 'gemini-test-key' },
    async fetchImpl() {
      attempts += 1;
      throw new TypeError('fetch failed', { cause: { code: 'ECONNRESET' } });
    },
  });

  await assert.rejects(generate({ ...topic, pricing: referencePricing }), { status: 502 });
  assert.equal(attempts, 2);
});

test('Gemini returns a retryable app error after one retry is exhausted', async () => {
  let attempts = 0;
  const generate = createCourseDraftGenerator({
    env: { GEMINI_API_KEY: 'gemini-test-key' },
    async fetchImpl() {
      attempts += 1;
      return geminiErrorResponse(503, { status: 'UNAVAILABLE' });
    },
  });

  await assert.rejects(generate({ ...topic, pricing: referencePricing }), { status: 503, message: /Gemini.*暫時/ });
  assert.equal(attempts, 2);
});

test('Gemini does not retry key, project setup, or quota errors and keeps provider details private', async t => {
  const apiKey = 'private-test-api-key';
  const upstreamMessage = 'private provider error text';
  const warning = t.mock.method(console, 'warn', () => {});
  const errorLog = t.mock.method(console, 'error', () => {});
  const cases = [
    { httpStatus: 400, providerStatus: 'INVALID_ARGUMENT', reason: 'API_KEY_INVALID', publicMessage: /Gemini.*金鑰/ },
    { httpStatus: 400, providerStatus: 'FAILED_PRECONDITION', publicMessage: /Gemini.*(?:專案|地區|帳務|帳單|計費)/ },
    { httpStatus: 429, providerStatus: 'RESOURCE_EXHAUSTED', publicMessage: /Gemini.*(?:額度|頻率)/ },
  ];

  for (const { httpStatus, providerStatus, reason, publicMessage } of cases) {
    let attempts = 0;
    const generate = createCourseDraftGenerator({
      env: { GEMINI_API_KEY: apiKey },
      async fetchImpl() {
        attempts += 1;
        return geminiErrorResponse(httpStatus, {
          status: providerStatus,
          message: `${upstreamMessage} ${apiKey}`,
          details: reason ? [{
            '@type': 'type.googleapis.com/google.rpc.ErrorInfo',
            reason,
            domain: 'googleapis.com',
            metadata: { consumer: upstreamMessage },
          }] : [],
        });
      },
    });

    await assert.rejects(generate({ ...topic, pricing: referencePricing }), error => {
      assert.equal(error.status, 503);
      assert.match(error.message, publicMessage);
      assert.doesNotMatch(inspect(error, { depth: null }), /private-test-api-key|private provider error text/);
      return true;
    });
    assert.equal(attempts, 1);
  }
  assert.doesNotMatch(inspect([warning.mock.calls, errorLog.mock.calls], { depth: null }), /private-test-api-key|private provider error text/);
});

test('missing credentials, invalid output, and refusals fail without a template result', async () => {
  const input = { ...topic, pricing: { byCategory: {}, catalog: null } };
  const withoutCredentials = createCourseDraftGenerator({ env: {}, fetchImpl: () => assert.fail('Unexpected request to OpenAI') });
  await assert.rejects(withoutCredentials(input), { status: 503 });

  const malformed = createCourseDraftGenerator({
    env: { OPENAI_API_KEY: 'unit-test-key' },
    fetchImpl: async () => providerResult({ ...draft, title: '' }),
  });
  await assert.rejects(malformed(input), { status: 502 });

  const unsupportedCategory = createCourseDraftGenerator({
    env: { OPENAI_API_KEY: 'unit-test-key' },
    fetchImpl: async () => providerResult({ ...draft, category: '自訂攝影分類' }),
  });
  await assert.rejects(unsupportedCategory(input), { status: 502 });

  const invalidPrice = createCourseDraftGenerator({
    env: { OPENAI_API_KEY: 'unit-test-key' },
    fetchImpl: async () => providerResult({ ...draft, price: 0 }),
  });
  await assert.rejects(invalidPrice(input), { status: 502 });

  const refusal = createCourseDraftGenerator({
    env: { OPENAI_API_KEY: 'unit-test-key' },
    fetchImpl: async () => new Response(JSON.stringify({
      status: 'completed',
      output: [{ type: 'message', role: 'assistant', content: [{ type: 'refusal', refusal: 'Provider refusal' }] }],
    })),
  });
  await assert.rejects(refusal(input), { status: 422 });
});

test('the draft endpoint constrains the suggested price using the model-selected category', async t => {
  const rows = [
    { title: '手機街景取景', category: '影像', price: 2 },
    { title: '手機人像攝影', category: '影像', price: 3 },
    { title: '手機夜景攝影', category: '影像', price: 5 },
    { title: '網頁程式開發', category: '程式', price: 100 },
  ];
  let input;
  const submit = await openDraftEndpoint(t, { rows, async generateCourseDraft(value) {
    input = value;
    return { ...draft, price: 99 };
  } });

  const response = await submit({ ...topic, category: '程式' });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(input.skill, topic.skill);
  assert.equal(input.categoryHint, '程式');
  assert.equal(input.pricing.byCategory.影像.referenceCount, 3);
  assert.equal(input.pricing.byCategory.程式.max, 100);
  assert.equal(result.title, draft.title);
  assert.equal(result.description, draft.description);
  assert.equal(result.category, '影像');
  assert.deepEqual(result.pricing, input.pricing.byCategory.影像);
  assert.equal(result.price, result.pricing.max);
  assert.equal(result.price, 5);
});

test('the draft endpoint uses catalog pricing when the model-selected category has no peers', async t => {
  const rows = [
    { title: '基本日文會話', category: '語言', price: 7 },
    { title: '居家伸展運動', category: '運動', price: 9 },
  ];
  const submit = await openDraftEndpoint(t, { rows, async generateCourseDraft(input) {
    assert.equal(input.pricing.byCategory.影像, undefined);
    assert.equal(input.pricing.catalog.basis, 'catalog');
    return { ...draft, price: 15 };
  } });

  const response = await submit({ skill: topic.skill });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.category, '影像');
  assert.equal(result.pricing.basis, 'catalog');
  assert.equal(result.price, 9);
});

test('the draft endpoint needs only a title and still suggests a price when the catalog is empty', async t => {
  const submit = await openDraftEndpoint(t, { rows: [], async generateCourseDraft(input) {
    assert.equal(Object.keys(input.pricing.byCategory).length, 0);
    assert.equal(input.pricing.catalog, null);
    assert.equal(input.categoryHint, undefined);
    assert.equal(input.style, '專業嚴謹');
    return { ...draft, price: 25 };
  } });

  const response = await submit({ skill: topic.skill });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ...draft, price: 10, pricing: null });
});
