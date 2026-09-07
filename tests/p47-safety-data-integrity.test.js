const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const appSource = read('app.js');
const aiSource = read('data/ai-infrastructure.js');
const cloudProviderSource = read('data/cloud-sync.js');
const telemetrySource = read('data/production-stability.js');
const researchSource = read('data/user-research.js');
const apiHandler = require(path.join(root, 'api', 'chat.js'));
const migration = read('supabase/migrations/20260907_p47_safety_data_integrity.sql');

function bootAi(aiEnabled, fetchImpl) {
  const values = new Map();
  const state = { currentUser: { id: 'privacy-user' } };
  const storage = { get: (key, fallback = null) => values.has(key) ? values.get(key) : fallback, set: (key, value) => { values.set(key, value); return true; } };
  const privacy = { allows: (name) => name !== 'aiUsage' || aiEnabled, disabled: (code) => ({ code, disabled: true, action: { label: 'Mở cài đặt', route: 'profile' } }) };
  const window = { KLEARN_APP: { storage, state, STORAGE_KEYS: { aiInfrastructure: 'ai' }, CloudSyncService: { schedule() {} }, PrivacyPreferenceService: privacy } };
  vm.runInNewContext(aiSource, { window, fetch: fetchImpl, console, Date, String, Number, Object, Array, Math, Set, Map, RegExp, Promise, JSON });
  return window;
}

function bootTelemetry(telemetryEnabled) {
  const values = new Map(); const state = { currentUser: { id: 'telemetry-user' }, currentView: 'home' };
  const storage = { get: (key, fallback = null) => values.has(key) ? values.get(key) : fallback, set: (key, value) => { values.set(key, value); return true; } };
  const window = { KLEARN_APP: { storage, state, STORAGE_KEYS: { productionTelemetry: 'telemetry', backgroundSyncQueue: 'queue', learningBackups: 'backups', recoveryCheckpoint: 'checkpoint' }, PrivacyPreferenceService: { allows: (name) => name !== 'telemetry' || telemetryEnabled }, CloudSyncService: {}, getUserProgress: () => ({}), getUserSrs: () => [], userScoped: () => [], saveUserScoped() {} }, navigator: { onLine: true }, console, addEventListener() {} };
  vm.runInNewContext(telemetrySource, { window, console, Date, String, Number, Object, Array, Math, Set, Map, RegExp, Promise, JSON }); return window;
}

function responseRecorder() {
  const result = { statusCode: 200, body: null, headers: {} };
  return { result, response: { status(code) { result.statusCode = code; return this; }, json(body) { result.body = body; return this; }, setHeader(name, value) { result.headers[name] = value; } } };
}

(async () => {
  let fetchCount = 0;
  const disabledAi = bootAi(false, async () => { fetchCount += 1; throw new Error('must not fetch'); });
  const disabled = await disabledAi.AIOrchestrationService.request({ task: 'tutor', input: 'help', messages: [{ role: 'user', content: 'help' }], context: { currentTopikLevel: 1 } });
  assert.equal(disabled.code, 'AI_DISABLED_BY_USER');
  assert.equal(fetchCount, 0, 'AI-disabled request must stop before fetch');
  assert.equal(disabled.usage.totalTokens, 0);

  const enabledAi = bootAi(true, async (_url, options) => { fetchCount += 1; assert.equal(options.headers['X-KLearn-AI-Consent'], 'granted'); assert.equal(JSON.parse(options.body).privacy.aiEnabled, true); return { ok: true, json: async () => ({ reply: 'Nội dung học đã kiểm duyệt.', usage: { totalTokens: 5 } }) }; });
  const enabled = await enabledAi.AIOrchestrationService.request({ task: 'tutor', input: 'help', messages: [{ role: 'user', content: 'help' }] });
  assert.equal(enabled.fallback, false);
  assert.equal(fetchCount, 1);

  const telemetryOff = bootTelemetry(false);
  assert.equal(telemetryOff.ProductionMonitoringService.captureError({ message: 'must not persist' }), null);
  assert.equal(telemetryOff.ProductionMonitoringService.snapshot().errorCount, 0);
  const telemetryOn = bootTelemetry(true);
  telemetryOn.ProductionMonitoringService.captureError({ message: 'allowed' });
  assert.equal(telemetryOn.ProductionMonitoringService.snapshot().errorCount, 1);

  const blockedResponse = responseRecorder();
  await apiHandler({ method: 'POST', headers: {}, body: { messages: [{ role: 'user', content: 'hello' }] } }, blockedResponse.response);
  assert.equal(blockedResponse.result.statusCode, 403);
  assert.equal(blockedResponse.result.body.code, 'AI_DISABLED_BY_USER');

  assert.match(appSource, /PBKDF2/);
  assert.match(appSource, /passwordHashVersion/);
  assert.match(appSource, /sessionCreatedAt/);
  assert.match(appSource, /sessionExpiresAt/);
  assert.doesNotMatch(appSource, /passwordHash:\s*await\s+hashPassword/);
  assert.doesNotMatch(appSource, /passwordHash\s*:\s*(?:window\.)?btoa/);
  assert.match(cloudProviderSource, /compare_and_swap_learning_sync/);
  assert.doesNotMatch(cloudProviderSource, /from\('learning_sync'\)\.upsert/);
  assert.match(migration, /add column if not exists revision/);
  assert.match(migration, /learning_sync_mutations/);
  assert.match(migration, /for update/i);
  assert.match(migration, /sync_status.*current_revision.*current_payload/s);
  assert.match(migration, /revoke insert, update, delete/);
  assert.match(researchSource, /PrivacyPreferenceService/);
  console.log('P47 unit: AI boundary, telemetry consent, API consent, PBKDF2/session versioning, CAS migration and idempotency contract passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
