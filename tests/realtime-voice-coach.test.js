'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const content = JSON.parse(read('content/advanced-voice.json'));

function boot({ online = true, aiFallback = false } = {}) {
  const values = new Map(); const sync = []; const state = { currentUser: { id: 'p57-user', currentTopikLevel: 2 }, currentView: 'realtime-voice-coach' };
  const progress = { pronunciationAttempts: [], daily: { tasks: {} }, skills: { speaking: 10 } };
  const storage = { get: (key, fallback) => values.has(key) ? values.get(key) : fallback, set: (key, value) => values.set(key, value) };
  const userScoped = (key) => values.get(key)?.[state.currentUser.id] || [];
  const saveUserScoped = (key, items, limit) => { const all = values.get(key) || {}; all[state.currentUser.id] = items.slice(0, limit); values.set(key, all); };
  const window = {
    KLEARN_APP: { state, storage, STORAGE_KEYS: { voiceLearning: 'voice' }, render() {}, setView(view) { state.currentView = view; }, toast() {}, escapeHtml: String, getUserProgress: () => progress, saveUserProgress: (value) => Object.assign(progress, value), userScoped, saveUserScoped, speakKorean() {}, CloudSyncService: { schedule: (reason) => sync.push(reason) }, PrivacyPreferenceService: { allows: () => true } },
    AIOrchestrationService: { request: async (request) => ({ reply: JSON.stringify({ replyKo: '좋아요. 음료도 필요하세요?', feedbackVi: 'Câu trả lời phù hợp và lịch sự.', correctionKo: '비빔밥 하나 주세요.', naturalness: 88, reason: 'Đúng ngữ cảnh gọi món.', confidence: .86 }), fallback: aiFallback, quality: { status: aiFallback ? 'review' : 'pass', reasons: aiFallback ? ['provider-unavailable'] : [] }, usage: { totalTokens: 160 }, request }) },
    ErrorNotebookService: { add() {} }, LearningMemoryService: { upsert() {} }, navigator: { onLine: online }, console
  };
  window.window = window;
  const context = { window, console, Date, String, Number, Object, Array, Math, Set, Map, RegExp, Promise, JSON, Float32Array, URL, Intl };
  vm.createContext(context); vm.runInContext(read('data/advanced-voice.js'), context); window.VoiceContentService.hydrate(content); vm.runInContext(read('data/realtime-voice-coach.js'), context);
  return { window, state, progress, values, sync };
}

(async () => {
  assert.equal(content.version, 2);
  assert.deepEqual(content.scenarios.filter((item) => item.coachEnabled).map((item) => item.type), ['interview', 'restaurant', 'school', 'office']);

  const app = boot(); const w = app.window;
  const phoneme = w.PhonemeAnalysisService.fallback('학교', '학겨');
  assert.equal(phoneme.segments[1].components.vowel.expected, 'ㅛ');
  assert.equal(phoneme.segments[1].components.vowel.heard, 'ㅕ');
  assert.equal(phoneme.segments[0].components.batchim.expected, 'ㄱ');

  assert.equal(w.RealtimeVoiceCoachService.scenarios().length, 4);
  w.RealtimeVoiceCoachService.start('role-restaurant');
  const result = await w.RealtimeVoiceCoachService.submit('비빔밥 하나 주세요', { durationMs: 4000, frames: [] });
  assert.equal(result.feedback.source, 'validated-ai');
  assert.equal(result.feedback.validated, true);
  assert.ok(result.feedback.naturalness >= 0 && result.feedback.naturalness <= 100);
  assert.equal(result.attempt.audioStored, false);
  assert.equal('audioBlob' in result.attempt, false);
  assert.equal(w.VoiceCoachMemoryService.get().topics.restaurant, 1);
  assert.equal(w.VoiceCoachCostService.today().requests, 1);
  assert.equal(w.VoiceCoachCostService.today().tokens, 160);
  assert.ok(app.sync.includes('voice-coach-turn'));
  assert.equal(w.VoiceCoachJourneyService.summary().days30.attempts, 1);

  const rejected = w.VoiceCoachQualityService.validate({ replyKo: 'Hello', feedbackVi: '', naturalness: 999, confidence: .1 }, {}, 70);
  assert.equal(rejected.valid, false);
  assert.ok(rejected.reasons.includes('missing-korean-reply'));

  const offline = boot({ online: false });
  offline.window.RealtimeVoiceCoachService.start('role-school');
  const fallback = await offline.window.RealtimeVoiceCoachService.submit('네 한국어 교실이 어디예요', { durationMs: 5000, frames: [] });
  assert.equal(fallback.feedback.source, 'deterministic-fallback');
  assert.equal(fallback.feedback.validated, true);
  assert.equal(offline.window.VoiceCoachCostService.today().requests, 0);
  assert.equal(offline.window.SpeakingHistoryService.all().length, 1);

  assert.match(read('data/route-loader.js'), /realtime-voice-coach\.css\?v=1/);
  assert.match(read('data/route-loader.js'), /data\/realtime-voice-coach\.js\?v=1/);
  assert.match(read('api/chat.js'), /realtime_voice_feedback/);
  assert.match(read('api/chat.js'), /max_output_tokens: task === 'realtime_voice_feedback' \? 320 : 900/);
  assert.match(read('api/chat.js'), /type: 'json_schema', name: 'voice_feedback', strict: true/);
  assert.match(read('api/chat.js'), /store: false/);
  assert.match(read('realtime-voice-coach.css'), /@media\(max-width:600px\)/);
  assert.match(read('sw.js'), /klearn-v79/);
  assert.match(read('sw.js'), /realtime-voice-coach\.js/);
  assert.match(read('app.js'), /'voice-coach-session'/);

  const previousKey = process.env.OPENAI_API_KEY; const previousFetch = global.fetch; let providerBody;
  process.env.OPENAI_API_KEY = 'test-only-key'; global.fetch = async (_url, options) => { providerBody = JSON.parse(options.body); return { ok: true, json: async () => ({ output: [{ content: [{ text: JSON.stringify({ replyKo: '좋아요.', feedbackVi: 'Ổn.', correctionKo: '네, 좋아요.', naturalness: 82, reason: 'Phù hợp.', confidence: .8 }) }] }], usage: { input_tokens: 20, output_tokens: 30, total_tokens: 50 } }) }; };
  const responseState = { code: 200, body: null, headers: {} }; const response = { status(code) { responseState.code = code; return this; }, json(body) { responseState.body = body; return this; }, setHeader(name, value) { responseState.headers[name] = value; } };
  await require(path.join(root, 'api', 'chat.js'))({ method: 'POST', headers: { 'x-klearn-ai-consent': 'granted' }, body: { messages: [{ role: 'user', content: 'voice feedback' }], task: 'realtime_voice_feedback', modelRoute: 'strong', promptVersion: 'p57-test', privacy: { aiEnabled: true } } }, response);
  global.fetch = previousFetch; if (previousKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previousKey;
  assert.equal(responseState.code, 200); assert.equal(providerBody.store, false); assert.equal(providerBody.max_output_tokens, 320); assert.equal(providerBody.text.format.strict, true); assert.equal(providerBody.text.format.schema.additionalProperties, false);
  console.log('P57: realtime voice flow, syllable/consonant/vowel/batchim analysis, fluency, validated naturalness, role-play memory, 30/90 journey, cost limits and offline fallback passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
