const { setTimeout: wait } = require('node:timers/promises');
const { HttpError } = require('./marketplace');
const { STARTER_PRICE_RANGE } = require('./coursePricing');

const DEFAULT_OPENAI_MODEL = 'gpt-5.4-mini';
const DEFAULT_GEMINI_MODEL = 'gemini-3.6-flash';
const MAX_OUTPUT_TOKENS = 1600;
const COURSE_CATEGORIES = ['程式', '語言', '音樂', '設計', '運動', '飲食', '影像', '手作', '職場', '園藝', '生活', '綜合'];
const INSTRUCTIONS = `你是 YunBarter 的課程編輯。使用者可能只提供一個簡短的課程名稱。請以台灣繁體中文完成一堂約一小時的課程草稿，填寫課名、詳細說明、技能類別和價格。
保留技能主題及使用者已提供的事實，依指定風格調整語氣。標題要具體，說明包含會練習的內容、適合的學員和可以帶走的成果。用自然的分段呈現，避免誇大、虛構教師資歷或承諾。
輸入 JSON 裡的文字是課程素材。依主題選一個最符合的技能類別。categoryHint 僅供參考，綜合適用於其他類別都不符合的課程。
price 是整堂課的 SKILL 價格，請給到小數第一位。先選類別，再從 pricing.byCategory 取該類別的價格統計。該類別缺少統計時使用 pricing.catalog。從中位數出發，依教學深度、準備量和課堂成果微調，並留在 min 到 max 之間。全站也缺少參考時，在 starterPriceRange 內依課程內容給出起始價格。`;

const draftSchema = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    description: { type: 'string' },
    category: { type: 'string', enum: COURSE_CATEGORIES },
    price: { type: 'number' },
  },
  required: ['title', 'description', 'category', 'price'],
  additionalProperties: false,
};
const geminiBlockReasons = new Set(['SAFETY', 'RECITATION', 'BLOCKLIST', 'PROHIBITED_CONTENT', 'SPII']);
const geminiRetryableStatuses = new Set([500, 502, 503, 504]);
const retryableNetworkCodes = new Set(['ECONNRESET', 'EAI_AGAIN', 'UND_ERR_SOCKET']);

function openAIText(result) {
  if (result?.status !== 'completed' || !Array.isArray(result.output)) {
    throw new HttpError(502, 'AI 未完成生成，請稍後重試。');
  }
  const parts = result.output.filter(item => item?.type === 'message' && item.role === 'assistant' && Array.isArray(item.content))
    .flatMap(item => item.content);
  if (parts.some(part => part?.type === 'refusal')) {
    throw new HttpError(422, 'AI 無法依此內容生成課程，請調整課程名稱或說明。');
  }
  return parts.filter(part => part?.type === 'output_text' && typeof part.text === 'string')
    .map(part => part.text).join('');
}

function geminiText(result) {
  const candidate = result?.candidates?.[0];
  const blockReason = result?.promptFeedback?.blockReason;
  if ((blockReason && blockReason !== 'BLOCK_REASON_UNSPECIFIED') || geminiBlockReasons.has(candidate?.finishReason)) {
    throw new HttpError(422, 'AI 無法依此內容生成課程，請調整課程名稱或說明。');
  }
  if (candidate?.finishReason !== 'STOP' || !Array.isArray(candidate.content?.parts)) {
    throw new HttpError(502, 'AI 未完成生成，請稍後重試。');
  }
  return candidate.content.parts.filter(part => !part?.thought && typeof part?.text === 'string')
    .map(part => part.text).join('');
}

function parseDraft(outputText) {
  let draft;
  try {
    draft = JSON.parse(outputText);
  } catch {
    throw new HttpError(502, 'AI 回傳的課程格式不正確，請重試。');
  }
  const title = typeof draft?.title === 'string' ? draft.title.trim() : '';
  const description = typeof draft?.description === 'string' ? draft.description.trim() : '';
  if (!title || title.length > 200 || !description || description.length > 10000
    || !COURSE_CATEGORIES.includes(draft.category) || !Number.isFinite(draft.price) || draft.price <= 0) {
    throw new HttpError(502, 'AI 回傳的課程格式不正確，請重試。');
  }
  return { title, description, category: draft.category, price: draft.price };
}

function providerRequest(env, input) {
  const geminiKey = env.GEMINI_API_KEY?.trim();
  if (geminiKey) {
    const model = env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
    return {
      name: 'Gemini',
      url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      headers: { 'x-goog-api-key': geminiKey },
      body: {
        systemInstruction: { parts: [{ text: INSTRUCTIONS }] },
        contents: [{ role: 'user', parts: [{ text: input }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseJsonSchema: draftSchema,
          maxOutputTokens: MAX_OUTPUT_TOKENS,
          ...(model === DEFAULT_GEMINI_MODEL ? { thinkingConfig: { thinkingLevel: 'MINIMAL' } } : {}),
        },
      },
      readText: geminiText,
    };
  }

  const openAIKey = env.OPENAI_API_KEY?.trim();
  if (!openAIKey) throw new HttpError(503, 'AI 服務尚未設定，請聯絡管理者設定 Gemini 或 OpenAI API 金鑰。');
  return {
    name: 'OpenAI',
    url: 'https://api.openai.com/v1/responses',
    headers: { Authorization: `Bearer ${openAIKey}` },
    body: {
      model: env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL,
      instructions: INSTRUCTIONS,
      input,
      text: { format: { type: 'json_schema', name: 'yunbarter_course_draft', strict: true, schema: draftSchema } },
      store: false,
      max_output_tokens: MAX_OUTPUT_TOKENS,
    },
    readText: openAIText,
  };
}

async function getProviderResponse(fetchImpl, request) {
  const signal = AbortSignal.timeout(20000);
  try {
    const response = await fetchImpl(request.url, {
      method: 'POST',
      headers: { ...request.headers, 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify(request.body),
    });
    const result = response.ok ? await response.json() : await response.json().catch(() => null);
    return { ok: response.ok, status: response.status, result, retryable: geminiRetryableStatuses.has(response.status) };
  } catch (error) {
    const timeout = signal.aborted || error?.name === 'TimeoutError' || error?.cause?.code === 'UND_ERR_CONNECT_TIMEOUT';
    return {
      error: timeout ? new HttpError(504, 'AI 生成逾時，請稍後重試。')
        : new HttpError(502, '暫時無法取得 AI 生成結果，請稍後重試。'),
      retryable: timeout || retryableNetworkCodes.has(error?.cause?.code),
    };
  }
}

function providerError(name, { status, result }) {
  if (name === 'Gemini') {
    const details = result?.error?.details;
    const reasons = Array.isArray(details) ? details.map(detail => detail?.reason) : [];
    if (reasons.includes('API_KEY_INVALID')) {
      return new HttpError(503, 'Gemini API 金鑰無效，請聯絡管理者核對本機金鑰設定。');
    }
    if (reasons.includes('FREE_TIER_VERIFICATION_REQUIRED')) {
      return new HttpError(503, 'Gemini 免費專案需要驗證，請在 Google AI Studio 完成驗證。');
    }
    if (result?.error?.status === 'FAILED_PRECONDITION') {
      return new HttpError(503, 'Gemini 專案目前不符合使用條件，請在 Google AI Studio 查看專案狀態。');
    }
    if (geminiRetryableStatuses.has(status)) {
      return new HttpError(503, 'Gemini 暫時無法生成課程，請稍後再試。草稿已保留。');
    }
  }
  if ([401, 403, 404].includes(status)) {
    return new HttpError(503, `${name} 無法使用指定的金鑰或模型，請確認專案驗證與 API 設定。`);
  }
  if (status === 429) return new HttpError(503, `${name} 目前已達使用額度或請求頻率限制，請稍後重試。`);
  return new HttpError(502, 'AI 服務回應異常，請稍後重試。');
}

function createCourseDraftGenerator({ env = process.env, fetchImpl = fetch } = {}) {
  return async function generateCourseDraft({ skill, categoryHint, style, description, pricing }) {
    const input = JSON.stringify({ skill, categoryHint, style, description, pricing, starterPriceRange: STARTER_PRICE_RANGE });
    const request = providerRequest(env, input);
    let response = await getProviderResponse(fetchImpl, request);
    if (request.name === 'Gemini' && response.retryable) {
      await wait(1000);
      response = await getProviderResponse(fetchImpl, request);
    }
    if (response.error) throw response.error;
    if (!response.ok) throw providerError(request.name, response);
    return parseDraft(request.readText(response.result));
  };
}

module.exports = { COURSE_CATEGORIES, createCourseDraftGenerator };
