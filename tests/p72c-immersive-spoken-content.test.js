const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const content = JSON.parse(read('content/immersive-spoken-content.json'));

function createRuntime(values = new Map(), userId = 'p72c-a') {
  const sync = []; const mutations = []; const spoken = []; const srs = [];
  const state = { currentUser: { id: userId, currentTopikLevel: 1 }, currentView: 'home' };
  const userScoped = (key) => values.get(key)?.[state.currentUser.id] || [];
  const saveUserScoped = (key, items, limit = 100) => { const all = values.get(key) || {}; all[state.currentUser.id] = items.slice(0, limit); values.set(key, all); };
  const window = {
    KLEARN_APP: { state, STORAGE_KEYS: { immersiveSpoken: 'spoken-store' }, userScoped, saveUserScoped, getUserSrs: () => srs, DictionaryService: { search: (word) => [{ id: `dict-${word}`, korean: word, meaningVi: word }], addToSrs: (entry) => { if (!srs.some((item) => item.wordId === entry.id)) srs.push({ wordId: entry.id, korean: entry.korean, status: 'learning', mastery: 0 }); return entry; } }, VocabularyService: {}, CloudSyncService: { schedule: (reason) => sync.push(reason) }, setView: (view) => { state.currentView = view; }, render() {}, toast() {}, escapeHtml: String, speakKorean: (text, rate) => spoken.push({ text, rate }), emitLearningMutation: (...args) => mutations.push(args) },
    VoiceCaptureService: { supported: () => ({ microphone: false, recognition: false }), active: () => false },
    VoiceAnalysisService: { evaluate: async ({ target, transcript, expectedKeywords }) => ({ pronunciation: target === transcript ? 96 : 70, relevance: expectedKeywords.some((item) => transcript.includes(item)) ? 100 : 0, method: 'transparent-browser-fallback' }) },
    KLEARN_EXTRA_VIEWS: {}, KLEARN_AFTER_RENDER: null, document: null, addEventListener() {}
  };
  window.window = window;
  vm.runInNewContext(read('data/immersive-spoken-content.js'), { window, console, Date, Math, JSON, Object, Array, Number, String, Boolean, RegExp, Set, Map, Promise, Symbol, FormData: class FormData {} });
  window.ImmersiveSpokenContentService.hydrate(content);
  return { window, state, values, sync, mutations, spoken, srs };
}

(async () => {
  const r = createRuntime(); const w = r.window;
  for (const service of ['ImmersiveSpokenContentService', 'StoryLearningService', 'KoreanRadioService', 'SpokenExerciseService', 'SpeakingFlashcardService', 'SpokenShadowingService', 'ImmersiveSpokenLearning']) assert.ok(w[service], `${service} missing`);
  const invalid = structuredClone(content); invalid.radioSeries[0].audio = { source: 'Native', evidence: null }; assert.throws(() => w.ImmersiveSpokenContentService.hydrate(invalid), /quality gate failed/); w.ImmersiveSpokenContentService.hydrate(content);
  const episodes = w.ImmersiveSpokenContentService.episodes(); assert.equal(episodes.length, 3); assert.ok(episodes.every((item) => item.estimatedMinutes >= 3 && item.estimatedMinutes <= 10)); assert.ok(episodes.filter((item) => item.level === 'Beginner').every((item) => item.grammar.every((grammar) => grammar.explanation)));
  assert.equal(w.StoryLearningService.status(episodes[0]), 'available'); assert.equal(w.StoryLearningService.status(episodes[1]), 'locked'); assert.equal(w.StoryLearningService.open(episodes[0].id), true); assert.equal(r.state.currentView, 'story-episode'); assert.equal(w.StoryLearningService.status(episodes[0]), 'available', 'opening is not completion');
  w.StoryLearningService.mark('listened'); assert.equal(w.StoryLearningService.status(episodes[0]), 'available'); assert.equal(w.StoryLearningService.answer(2).correct, false); assert.equal(w.StoryLearningService.answer(0).correct, true); assert.equal(w.StoryLearningService.status(episodes[0]), 'completed'); assert.equal(w.StoryLearningService.status(episodes[1]), 'available'); assert.ok(r.mutations.some((item) => item[0] === 'story_completed'));
  assert.equal(w.StoryLearningService.open('work-meeting-update'), false, 'beginner cannot open intermediate story');

  assert.deepEqual(w.KoreanRadioService.all().map((item) => item.series), ['Daily Korean', 'Beginner Talk']); const radio = w.KoreanRadioService.get('radio-daily'); assert.equal(radio.audio.source, 'TTS'); w.KoreanRadioService.listen(radio.id); assert.equal(r.spoken[0].text, radio.transcript); assert.equal(w.KoreanRadioService.answer(radio.id, 0).correct, true);
  const typed = await w.SpokenExerciseService.evaluate('spoken-food', '김치찌개 먹어요.', {}); assert.equal(typed.inputMode, 'type'); assert.equal(typed.relevance, 100); assert.ok(typed.pronunciation >= 90); assert.equal(typed.audioStored, false); assert.ok(r.mutations.some((item) => item[0] === 'speaking_completed'));
  const card = w.SpeakingFlashcardService.get('speak-korea'); const beforeSrs = r.srs.length; const flash = await w.SpeakingFlashcardService.evaluate(card.id, card.korean, {}); assert.equal(flash.srsScheduleChanged, false); assert.equal(r.srs.length, beforeSrs, 'speaking must not change SRS'); w.SpeakingFlashcardService.addToSrs(card.id); assert.equal(r.srs.length, beforeSrs + 1); assert.equal(w.SpeakingFlashcardService.srsStatus(card).active, true);
  const shadow = await w.SpokenShadowingService.compare('spoken-shadow-cafe', '아메리카노 한 잔 주세요.', {}); assert.ok(shadow.overall >= 90); assert.equal(shadow.audioStored, false); assert.equal(shadow.speed, 1);

  const restored = createRuntime(r.values); assert.equal(restored.window.StoryLearningService.status(restored.window.ImmersiveSpokenContentService.episodes()[0]), 'completed'); assert.equal(restored.window.KoreanRadioService.history('radio-daily').some((item) => item.correct), true); assert.equal(restored.values.get('spoken-store')['p72c-a'][0].spokenAttempts.length, 1); restored.state.currentUser = { id: 'p72c-b', currentTopikLevel: 1 }; assert.equal(restored.window.StoryLearningService.status(restored.window.ImmersiveSpokenContentService.episodes()[0]), 'available'); assert.equal(restored.window.KoreanRadioService.history('radio-daily').length, 0);

  const app = read('app.js'); const index = read('index.html'); const worker = read('sw.js'); const loader = read('data/route-loader.js'); const css = read('immersive-spoken-content.css');
  assert.match(app, /immersiveSpoken: 'klearn_immersive_spoken'/); assert.match(app, /mergeImmersiveSpoken/); assert.match(app, /STORAGE_KEYS\.immersiveSpoken/); assert.doesNotMatch(index, /data\/immersive-spoken-content\.js\?v=1/); assert.match(index, /app\.js\?v=81/); assert.match(worker, /klearn-v99/); assert.match(worker, /content\/immersive-spoken-content\.json/); assert.match(loader, /immersiveSpoken: \{ dependencies: \['voice'\], styles: \['immersive-spoken-content\.css\?v=1'\], scripts: \['data\/immersive-spoken-content\.js\?v=1'\] \}/); assert.match(loader, /spoken-exercises speaking-flashcards spoken-shadowing/); assert.match(css, /@media\(max-width:600px\)/);
  assert.ok(r.sync.includes('story-complete')); assert.equal(content.audioPolicy.nativeRequiresEvidence, true); assert.equal(content.privacy.storesRawAudio, false);
  console.log('P72C stories, radio source labels, spoken fallback, speaking flashcards, SRS isolation, shadowing, persistence and offline assets passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
