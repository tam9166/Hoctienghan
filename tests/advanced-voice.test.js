const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'data', 'advanced-voice.js'), 'utf8');
const content = JSON.parse(fs.readFileSync(path.join(root, 'content', 'advanced-voice.json'), 'utf8'));
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8') + fs.readFileSync(path.join(root, 'data', 'route-loader.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'advanced-voice.css'), 'utf8');
const worker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const appSource = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

function boot() {
  const values = new Map(); const syncReasons = []; const errors = []; const memories = [];
  const state = { currentUser: { id: 'voice-user', level: 'TOPIK I', currentTopikLevel: 2 }, currentView: 'advanced-voice', srsData: [] };
  const progress = { pronunciationAttempts: [], daily: { tasks: {} }, skills: { speaking: 20 }, stats: {} };
  const storage = { get(key, fallback) { return values.has(key) ? values.get(key) : fallback; }, set(key, value) { values.set(key, value); } };
  const userScoped = (key) => values.get(key)?.[state.currentUser.id] || [];
  const saveUserScoped = (key, items, limit) => { const all = values.get(key) || {}; all[state.currentUser.id] = items.slice(0, limit); values.set(key, all); };
  const window = { KLEARN_APP: { state, storage, STORAGE_KEYS: { voiceLearning: 'voice' }, render: () => {}, setView: (view) => { state.currentView = view; }, toast: () => {}, escapeHtml: String, getUserProgress: () => progress, saveUserProgress: (value) => Object.assign(progress, value), userScoped, saveUserScoped, speakKorean: () => {}, CloudSyncService: { schedule: (reason) => syncReasons.push(reason) } }, ErrorNotebookService: { add: (item) => errors.push(item) }, LearningMemoryService: { upsert: (item) => memories.push(item) }, navigator: {}, console };
  const context = { window, console, Date, String, Number, Object, Array, Math, Set, Map, RegExp, Promise, JSON, Float32Array };
  vm.createContext(context); vm.runInContext(source, context); window.VoiceContentService.hydrate(content); return { window, state, progress, values, syncReasons, errors, memories };
}

(async () => {
  assert.equal(content.verified, true);
  assert.equal(content.reviewStatus, 'approved');
  assert.deepEqual(content.scenarios.map((item) => item.type), ['conversation', 'interview', 'presentation']);
  assert.equal(content.analysis.audioStored, false);
  assert.match(content.analysis.disclaimer, /ước tính/);

  const app = boot(); const w = app.window;
  const phoneme = w.PhonemeAnalysisService.fallback('학교', '학겨');
  assert.equal(phoneme.method, 'transcript-aligned-approximation');
  assert.equal(phoneme.segments[0].score, 100);
  assert.equal(phoneme.segments[1].score, 67);
  assert.deepEqual(Array.from(phoneme.focusSounds), ['ㅛ']);

  const frames = [];
  for (let index = 0; index < 60; index += 1) frames.push({ time: index * 100, rms: index > 20 && index < 28 ? 0.001 : 0.03 + (index % 4) * 0.008 });
  const signals = w.AudioSignalAnalysisService.analyze(frames, 6000, '안녕하세요 저는 민수예요', 6);
  assert.equal(signals.method, 'local-audio-signal-heuristics');
  assert.ok(signals.pauses >= 1);
  assert.ok(signals.speed >= 0 && signals.speed <= 100);
  assert.ok(signals.stress >= 0 && signals.stress <= 100);

  const analysis = await w.VoiceAnalysisService.evaluate({ target: '학교', transcript: '학겨', expectedKeywords: ['학교'], targetSeconds: 3, capture: { frames, durationMs: 3000 } });
  assert.equal(analysis.method, 'transparent-browser-fallback');
  assert.equal(analysis.audioStored, false);
  assert.ok(analysis.fluency >= 0 && analysis.fluency <= 100);
  assert.ok(analysis.confidence >= 0 && analysis.confidence <= 100);

  w.RealTimeVoiceConversationService.start('daily-introduction');
  const attempt = await w.RealTimeVoiceConversationService.submit('안녕하세요 저는 민수예요', { durationMs: 4000, frames });
  assert.equal(attempt.recordType, 'attempt');
  assert.equal(attempt.audioStored, false);
  assert.equal('audioBlob' in attempt, false);
  assert.equal(w.SpeakingHistoryService.all().length, 1);
  assert.equal(app.progress.pronunciationAttempts.length, 1);
  assert.equal(app.progress.daily.tasks.speaking, true);
  assert.ok(app.syncReasons.includes('advanced-voice-attempt'));

  const recommended = w.VoiceMatchingService.recommend();
  assert.ok(['daily-introduction', 'job-interview'].includes(recommended.id));
  const goals = w.VoiceGoalService.all();
  assert.equal(goals.length, 4);
  assert.equal(w.VoiceGoalService.select('voice-missing'), null);
  assert.equal(w.VoiceGoalService.select('practice-10').id, 'practice-10');
  const report = w.VoiceQualityReportService.generate();
  assert.equal(report.attempts, 1);
  assert.ok(['pronunciation', 'fluency', 'confidence', 'intonation'].includes(report.weakest));

  w.KLEARN_NATIVE_PHONEME_PROVIDER = { analyze: async () => ({ method: 'native-acoustic-provider', confidence: 'calibrated', score: 91, segments: [{ syllable: '학', heard: '학', score: 91, status: 'strong', focus: [] }], focusSounds: [] }) };
  const nativeResult = await w.PhonemeAnalysisService.analyze({ target: '학', transcript: '학', audioBlob: {} });
  assert.equal(nativeResult.method, 'native-acoustic-provider');
  assert.equal(nativeResult.score, 91);

  assert.match(index, /advanced-voice\.css\?v=1/);
  assert.match(index, /data\/advanced-voice\.js\?v=1/);
  assert.match(css, /voice-phoneme-grid/);
  assert.match(css, /@media \(max-width: 600px\)/);
  assert.match(worker, /klearn-v75/);
  assert.match(worker, /advanced-voice\.json/);
  assert.match(appSource, /voiceLearning: 'klearn_voice_learning'/);
  assert.match(appSource, /STORAGE_KEYS\.voiceLearning/);
  assert.match(appSource, /'voice-session'/);
  console.log('advanced voice: realtime capture contract, phoneme fallback/provider, intonation signals, fluency, history, goals, interview/presentation matching, report, privacy and CloudSync passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
