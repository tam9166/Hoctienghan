#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const qualityConfig = JSON.parse(read('content/ai-quality-safety.json'));
const evaluationDataset = JSON.parse(read('content/ai-quality-evaluation-dataset.json'));
const serverQuality = require(path.join(root, 'api', '_ai-quality.js'));

function memoryStorage() {
  const values = new Map();
  return {
    values,
    get(key, fallback) { return values.has(key) ? values.get(key) : fallback; },
    set(key, value) { values.set(key, value); return value; }
  };
}

function boot({ aiEnabled = true, fetchImpl, featureAccess = null } = {}) {
  const storage = memoryStorage();
  const sessionValues = new Map();
  const state = { currentUser: { id: 'p68-user', currentTopikLevel: 1 }, currentView: 'ai-coach' };
  const document = { querySelector: () => null, querySelectorAll: () => [] };
  const window = {
    document,
    navigator: { onLine: true },
    sessionStorage: { getItem: (key) => sessionValues.get(key) || null, setItem: (key, value) => sessionValues.set(key, value) },
    SupabaseService: { session: null },
    FeaturePermissionService: featureAccess ? { access: () => featureAccess } : undefined,
    KLEARN_APP: {
      state,
      storage,
      STORAGE_KEYS: { aiInfrastructure: 'ai-infra' },
      CloudSyncService: { schedule() {} },
      PrivacyPreferenceService: { allows: () => aiEnabled, disabled: (code) => ({ code }) },
      escapeHtml: String
    }
  };
  window.window = window;
  const context = {
    window, document, navigator: window.navigator, sessionStorage: window.sessionStorage,
    fetch: fetchImpl || (async () => { throw new Error('offline'); }), console, Date, String, Number,
    Boolean, Object, Array, Math, Set, Map, RegExp, Promise, JSON, Intl
  };
  vm.createContext(context);
  vm.runInContext(read('data/ai-infrastructure.js'), context);
  vm.runInContext(read('data/ai-quality-optimization.js'), context);
  return { window, storage, sessionValues };
}

function validGrammarReply() {
  return 'Quy tắc: 은/는 đánh dấu chủ đề. Khi dùng: đặt sau danh từ. Ví dụ: 저는 학생이에요. Cảnh báo ngữ cảnh: 이/가 có thể phù hợp hơn với thông tin mới.';
}

async function callHandler(body, { headers = {}, fetchImpl } = {}) {
  const previousKey = process.env.OPENAI_API_KEY;
  const previousFetch = global.fetch;
  process.env.OPENAI_API_KEY = 'test-only-key';
  global.fetch = fetchImpl || (async () => ({ ok: true, json: async () => ({ id: 'resp-p68', output_text: validGrammarReply(), usage: { input_tokens: 40, output_tokens: 30, total_tokens: 70 } }) }));
  const result = { statusCode: 200, body: null, headers: {} };
  const response = {
    status(code) { result.statusCode = code; return this; },
    json(value) { result.body = value; return this; },
    setHeader(name, value) { result.headers[name] = value; }
  };
  try {
    await require(path.join(root, 'api', 'chat.js'))({ method: 'POST', headers: { 'x-klearn-ai-consent': 'granted', ...headers }, body }, response);
  } finally {
    global.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previousKey;
  }
  return result;
}

(async () => {
  assert.equal(qualityConfig.principles.aiOptional, true);
  assert.equal(qualityConfig.principles.learningCoreWorksWithoutAi, true);
  assert.equal(qualityConfig.principles.rawPromptStored, false);
  assert.equal(qualityConfig.principles.rawResponseStored, false);
  assert.equal(qualityConfig.featureAudit.length, 7);
  assert.deepEqual(qualityConfig.featureAudit.map((item) => item.feature), ['AI Coach','Sentence Correction','Speaking Feedback','Weekly Report','Personalized Practice','Grammar Support','Learning Recommendation']);
  assert.equal(qualityConfig.taskContracts.learning_recommendation.preferRuleEngine, true);
  assert.equal(qualityConfig.cost.defaultMonetaryEstimate, null);
  assert.deepEqual(qualityConfig.quality.dimensions, ['accuracy','usefulness','naturalness','completeness']);

  for (const testCase of evaluationDataset.cases) {
    const evaluated = serverQuality.evaluateResponse(testCase.response, { task: testCase.task, level: testCase.context?.currentTopikLevel, reference: testCase.reference });
    assert.equal(evaluated.status, testCase.expected, `${testCase.id} should be ${testCase.expected}, got ${evaluated.status}`);
    for (const score of Object.values(evaluated.dimensions)) assert.ok(score >= 0 && score <= 100, `${testCase.id} dimension outside 0-100`);
  }

  const serverContext = serverQuality.sanitizeContext({ currentTopikLevel: 1, currentLesson: '은/는', password: 'hidden', email: 'learner@example.com', fullDatabase: ['private'], weakGrammar: ['은/는'] }, 'grammar_support');
  assert.equal(serverContext.currentTopikLevel, 1);
  assert.deepEqual(serverContext.weakGrammar, ['은/는']);
  assert.equal('password' in serverContext, false);
  assert.equal('email' in serverContext, false);
  assert.equal('fullDatabase' in serverContext, false);
  assert.equal(serverQuality.contractFor('grammar_support').route, 'strong');
  assert.equal(serverQuality.contractFor('learning_recommendation').route, 'small');

  delete process.env.OPENAI_INPUT_COST_PER_MILLION_MICROS;
  delete process.env.OPENAI_OUTPUT_COST_PER_MILLION_MICROS;
  assert.equal(serverQuality.estimatedCostMicros({ inputTokens: 100, outputTokens: 50 }), null);
  process.env.OPENAI_INPUT_COST_PER_MILLION_MICROS = '1000000';
  process.env.OPENAI_OUTPUT_COST_PER_MILLION_MICROS = '2000000';
  assert.equal(serverQuality.estimatedCostMicros({ inputTokens: 100, outputTokens: 50 }), 200);
  delete process.env.OPENAI_INPUT_COST_PER_MILLION_MICROS;
  delete process.env.OPENAI_OUTPUT_COST_PER_MILLION_MICROS;

  let fetchCount = 0;
  let sentBody;
  const successfulFetch = async (_url, options) => {
    fetchCount += 1;
    sentBody = JSON.parse(options.body);
    return { ok: true, json: async () => ({ requestId: `req-${fetchCount}`, reply: validGrammarReply(), quality: { status: 'pass', displaySafe: true }, usage: { inputTokens: 20, outputTokens: 30, totalTokens: 50 }, modelRoute: 'strong', promptVersion: 'p68-grammar_support-v1', estimatedCostMicros: null }) };
  };
  const runtime = boot({ fetchImpl: successfulFetch });
  const optimized = runtime.window.AIContextService.build({ currentTopikLevel: 1, currentLesson: 'Trợ từ', weakGrammar: ['은/는'], email: 'hidden@example.com', token: 'private', scores: [99], fullDatabase: ['no'] }, 'grammar_support');
  assert.equal(optimized.currentLesson, 'Trợ từ');
  assert.equal('email' in optimized, false);
  assert.equal('token' in optimized, false);
  assert.equal('scores' in optimized, false);
  assert.equal('fullDatabase' in optimized, false);

  const request = { task: 'grammar_support', input: 'Giải thích 은/는', context: { currentTopikLevel: 1 }, language: 'vi', cachePolicy: 'public' };
  const first = await runtime.window.AIOrchestrationService.request(request);
  const second = await runtime.window.AIOrchestrationService.request(request);
  assert.equal(first.fallback, false);
  assert.equal(second.cacheStatus, 'hit');
  assert.equal(fetchCount, 1, 'explicit public grammar request should use session cache');
  assert.equal(sentBody.learnerContext.task, 'grammar_support');
  assert.equal(sentBody.modelRoute, 'strong');

  let concurrentFetches = 0;
  const concurrent = boot({ fetchImpl: async (_url, options) => { concurrentFetches += 1; await new Promise((resolve) => setTimeout(resolve, 15)); return successfulFetch(_url, options); } });
  await Promise.all([
    concurrent.window.AIOrchestrationService.request({ task: 'grammar_support', input: '이/가?', context: { currentTopikLevel: 1 } }),
    concurrent.window.AIOrchestrationService.request({ task: 'grammar_support', input: '이/가?', context: { currentTopikLevel: 1 } })
  ]);
  assert.equal(concurrentFetches, 1, 'identical in-flight requests should be deduplicated');

  let personalFetches = 0;
  const personal = boot({ fetchImpl: async () => { personalFetches += 1; return { ok: true, json: async () => ({ requestId: `personal-${personalFetches}`, reply: 'Câu 1: Chọn 은/는. Đáp án: 은. Giải thích: danh từ kết thúc bằng phụ âm.', quality: { status: 'pass', displaySafe: true }, usage: { totalTokens: 40 }, modelRoute: 'strong' }) }; } });
  const personalRequest = { task: 'personalized_practice', input: 'Tạo bài luyện', context: { currentTopikLevel: 1, recentMistakes: ['은/는'] }, cachePolicy: 'public' };
  await personal.window.AIOrchestrationService.request(personalRequest);
  await personal.window.AIOrchestrationService.request(personalRequest);
  assert.equal(personalFetches, 2, 'personalized content must never use the public cache');

  const unsafe = boot({ fetchImpl: async () => ({ ok: true, json: async () => ({ requestId: 'unsafe-1', reply: 'Quy tắc: 께서요는 luôn đúng. Ví dụ: 저는께서요는 학생.', quality: { status: 'pass', displaySafe: true }, usage: { totalTokens: 25 } }) }) });
  const rejected = await unsafe.window.AIOrchestrationService.request({ task: 'grammar_support', input: 'Kiểm tra', context: { currentTopikLevel: 1 } });
  assert.equal(rejected.fallback, true);
  assert.match(rejected.reply, /Không thể phân tích chính xác/);
  assert.equal(rejected.learningCoreAvailable, true);

  let disabledFetches = 0;
  const disabled = boot({ aiEnabled: false, fetchImpl: async () => { disabledFetches += 1; } });
  const off = await disabled.window.AIOrchestrationService.request({ task: 'tutor', input: 'Học gì?' });
  assert.equal(off.fallback, true);
  assert.equal(off.learningCoreAvailable, true);
  assert.equal(disabledFetches, 0);
  const tierBlocked = boot({ featureAccess: { allowed: false, permission: 'blocked', reason: 'daily-limit' } });
  const limited = await tierBlocked.window.AIOrchestrationService.request({ task: 'coach', input: 'Hỗ trợ' });
  assert.ok(limited.quality.reasons.includes('AI_DAILY_LIMIT_REACHED'));
  assert.equal(limited.learningCoreAvailable, true);
  const highTraffic = boot({ fetchImpl: async () => ({ ok: false, json: async () => ({ code: 'AI_DAILY_LIMIT_REACHED', retryAfterSeconds: 60 }) }) });
  const throttled = await highTraffic.window.AIOrchestrationService.request({ task: 'tutor', input: 'Học gì tiếp theo?' });
  assert.equal(throttled.fallback, true);
  assert.equal(throttled.learningCoreAvailable, true);
  assert.ok(throttled.quality.reasons.includes('AI_DAILY_LIMIT_REACHED'));

  const apiResult = await callHandler({ messages: [{ role: 'user', content: 'Giải thích 은/는' }], task: 'grammar_support', modelRoute: 'small', learnerContext: { currentTopikLevel: 1, password: 'do-not-send', scores: [1, 2, 3] }, learningLanguage: 'vi', privacy: { aiEnabled: true } }, { fetchImpl: async (_url, options) => { sentBody = JSON.parse(options.body); return { ok: true, json: async () => ({ id: 'server-p68', output_text: validGrammarReply(), usage: { input_tokens: 25, output_tokens: 25, total_tokens: 50 } }) }; } });
  assert.equal(apiResult.statusCode, 200);
  assert.equal(apiResult.body.modelRoute, 'strong', 'server contract must override client route');
  assert.equal(apiResult.body.estimatedCostMicros, null);
  assert.equal(sentBody.store, false);
  assert.equal(sentBody.max_output_tokens, 650);
  assert.doesNotMatch(JSON.stringify(sentBody), /do-not-send|"scores"/);

  const rejectedApi = await callHandler({ messages: [{ role: 'user', content: 'Tạo quy tắc' }], task: 'grammar_support', privacy: { aiEnabled: true } }, { fetchImpl: async () => ({ ok: true, json: async () => ({ id: 'bad-server', output_text: 'Quy tắc: 께서요는 luôn đúng.', usage: {} }) }) });
  assert.equal(rejectedApi.statusCode, 502);
  assert.equal(rejectedApi.body.code, 'AI_RESPONSE_REJECTED');
  assert.equal(rejectedApi.body.learningCoreAvailable, true);

  const migration = read('supabase/migrations/20260912_p68_ai_quality_safety_cost.sql');
  assert.match(migration, /alter table public\.ai_response_feedback enable row level security/);
  assert.match(migration, /security_invoker = true/);
  assert.match(migration, /raw AI prompts and responses are prohibited/i);
  assert.doesNotMatch(migration, /\b(raw_prompt|raw_response|password|access_token)\b/i);
  assert.doesNotMatch(migration, /\b(delete|truncate)\s+(from\s+)?public\.(learning|srs|mastery|user_progress)/i);

  const chatSource = read('api/chat.js');
  assert.match(chatSource, /AbortSignal\.timeout\(20000\)/);
  assert.match(chatSource, /BILLING_ENFORCEMENT_ENABLED === 'true'/);
  assert.match(chatSource, /store: false/);
  assert.match(chatSource, /AI_RESPONSE_REJECTED/);
  assert.match(read('api/ai/feedback.js'), /rawPromptStored: false/);
  assert.match(read('api/ai/feedback.js'), /rawResponseStored: false/);
  assert.match(read('data/route-loader.js'), /ai-quality-optimization\.js\?v=1/);
  assert.match(read('sw.js'), /const CACHE = 'klearn-v83'/);
  assert.match(read('sw.js'), /content\/ai-quality-evaluation-dataset\.json/);
  assert.match(read('index.html'), /app\.js\?v=69/);

  console.log('P68 AI quality, safety and cost: task audit/contracts, minimized context, two-layer validation, hallucination dataset, optional AI, fallback, dedupe, public-only cache, tier control, aggregate telemetry and RLS passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
