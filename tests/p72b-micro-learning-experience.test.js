const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const content = JSON.parse(read('content/micro-learning-experience.json'));

function createRuntime(values = new Map(), userId = 'p72b-a') {
  const listeners = {}; const syncReasons = []; let history = [];
  const state = { currentUser: { id: userId, currentTopikLevel: 1, targetTopikLevel: 2 }, currentView: 'home', lessonProgress: {} };
  const progress = { marker: 'keep-progress', lessonProgress: {}, skills: { grammar: 30, listening: 25 }, stats: {} };
  const srs = [{ wordId: 'coffee', korean: '아메리카노', reviewCount: 2, mastery: 70 }];
  const userScoped = (key) => values.get(key)?.[state.currentUser.id] || [];
  const saveUserScoped = (key, items, limit = 100) => { const all = values.get(key) || {}; all[state.currentUser.id] = items.slice(0, limit); values.set(key, all); };
  const window = {
    KLEARN_THEORY_LESSONS: [
      { id: 'topik-1-01', topikLevel: 1, title: 'Bài 01 · Chào hỏi', topic: 'Chào hỏi' },
      { id: 'topik-1-02', topikLevel: 1, title: 'Bài 02 · Giới thiệu', topic: 'Giới thiệu' },
      { id: 'topik-1-03', topikLevel: 1, title: 'Bài 03 · Gia đình', topic: 'Gia đình' }
    ],
    KLEARN_APP: {
      state, STORAGE_KEYS: { microLearning: 'micro-learning' }, userScoped, saveUserScoped,
      getUserProgress: () => progress, getUserSrs: () => srs,
      PracticeService: { getHistory: () => history },
      CloudSyncService: { schedule: (reason) => syncReasons.push(reason) },
      LearnerProfileService: { get: () => ({ weakSkills: ['listening', 'grammar'] }) },
      setView: (view) => { state.currentView = view; }, render() {}, toast() {}, escapeHtml: String, speakKorean() {}
    },
    KLEARN_EXTRA_VIEWS: {}, KLEARN_AFTER_RENDER: null, document: null,
    addEventListener: (name, handler) => { listeners[name] = handler; }
  };
  window.window = window;
  vm.runInNewContext(read('data/micro-learning-experience.js'), { window, console, Date, Math, JSON, Object, Array, Number, String, Boolean, RegExp, Set, Map, Promise, Symbol, FormData: class FormData {} });
  window.MicroLearningContentService.hydrate(content);
  return { window, state, progress, srs, values, listeners, syncReasons, setHistory: (next) => { history = next; } };
}

(() => {
  const r = createRuntime(); const w = r.window;
  for (const service of ['MicroLearningContentService', 'MicroPathService', 'CharacterProgressService', 'AdventureLearningService', 'MicroLearningExperience']) assert.ok(w[service], `${service} missing`);
  assert.throws(() => w.MicroLearningContentService.hydrate({ schemaVersion: 1, status: 'draft', verified: false }), /quality gate failed/);
  w.MicroLearningContentService.hydrate(content);

  const units = w.MicroPathService.units(); const nodes = w.MicroPathService.nodes();
  assert.equal(units.length, 3); assert.equal(nodes.length, 24); assert.deepEqual([...new Set(nodes.map((node) => node.type))], ['reading', 'vocabulary', 'grammar', 'listening', 'speaking', 'writing', 'review', 'checkpoint']);
  assert.ok(nodes.every((node) => node.minutes >= 3 && node.minutes <= 10)); assert.equal(w.MicroPathService.status(nodes[0]), 'available'); assert.equal(w.MicroPathService.status(nodes[1]), 'locked');

  assert.equal(w.MicroPathService.open(nodes[0].id), true); assert.equal(r.state.currentView, 'lesson-preview'); assert.equal(w.MicroPathService.status(nodes[0]), 'in_progress'); assert.equal(w.MicroPathService.summary().completed, 0, 'opening a node must not complete it');
  r.state.microLearningActiveNodeId = '';
  assert.equal(w.MicroPathService.completeFromEvidence({ type: 'completed_lesson', entityId: 'topik-1-01', mutationId: 'lesson-proof-1', score: 80 }), true, 'persisted active node should resume after reload');
  assert.equal(w.MicroPathService.status(nodes[0]), 'completed'); assert.equal(w.MicroPathService.status(nodes[1]), 'available');
  assert.equal(w.MicroPathService.completeFromEvidence({ type: 'completed_lesson', entityId: 'topik-1-01', mutationId: 'lesson-proof-1', score: 80 }), false, 'evidence must be idempotent');

  w.MicroPathService.open(nodes[1].id); r.state.microLearningActiveNodeId = '';
  r.listeners['klearn-sync-action']({ detail: { type: 'srs_updated', entityId: 'coffee', mutationId: 'srs-proof-1' } }); assert.equal(w.MicroPathService.status(nodes[1]), 'completed');
  const yuna = w.CharacterProgressService.refresh().find((item) => item.id === 'yuna'); assert.equal(yuna.unlocked, true); assert.ok(r.values.get('micro-learning')['p72b-a'][0].characterEvents.some((item) => item.id === 'unlock:yuna'));

  const cafe = w.AdventureLearningService.catalog().find((item) => item.id === 'seoul-cafe-order'); assert.equal(cafe.available, true); assert.equal(w.AdventureLearningService.recommended().id, 'seoul-cafe-order'); assert.equal(w.AdventureLearningService.integration(cafe).vocabulary.find((item) => item.word === '아메리카노').learned, true);
  const masteryBefore = JSON.stringify(r.progress);
  w.AdventureLearningService.start(cafe.id); assert.equal(r.state.currentView, 'adventure-session');
  let response = w.AdventureLearningService.submit('order-eat'); assert.equal(response.consequence, 'hint'); assert.equal(w.AdventureLearningService.active().stepIndex, 0);
  response = w.AdventureLearningService.submit('order-exists'); assert.equal(response.consequence, 'alternative'); assert.equal(w.AdventureLearningService.active().stepIndex, 1);
  const run = w.AdventureLearningService.submit('take'); assert.equal(run.percentage, 75); assert.equal(run.freeResponseStored, false); assert.equal(run.rawAudioStored, false); assert.equal(r.state.currentView, 'adventure-result'); assert.equal(JSON.stringify(r.progress), masteryBefore, 'character/adventure progress must not modify learning mastery');
  assert.equal(w.CharacterProgressService.get('ara').unlocked, true, 'teacher character unlocks after a real adventure');

  const reloaded = createRuntime(r.values); assert.equal(reloaded.window.MicroPathService.summary().completed, 2); assert.equal(reloaded.window.CharacterProgressService.get('yuna').unlocked, true); assert.equal(reloaded.window.AdventureLearningService.catalog().find((item) => item.id === cafe.id).completed, true);
  reloaded.state.currentUser = { id: 'p72b-b', currentTopikLevel: 1 }; assert.equal(reloaded.window.MicroPathService.summary().completed, 0); assert.equal(reloaded.window.AdventureLearningService.catalog().find((item) => item.id === cafe.id).completed, false);

  const app = read('app.js'); const index = read('index.html'); const worker = read('sw.js'); const css = read('micro-learning-experience.css');
  assert.match(app, /microLearning: 'klearn_micro_learning'/); assert.match(app, /mergeMicroLearning/); assert.match(app, /STORAGE_KEYS\.microLearning/); assert.match(app, /'micro-path', 'character-room'/);
  assert.match(index, /micro-learning-experience\.css\?v=1/); assert.match(index, /data\/micro-learning-experience\.js\?v=1/); assert.match(index, /app\.js\?v=89/);
  assert.match(worker, /klearn-v105/); assert.match(worker, /content\/micro-learning-experience\.json/); assert.match(css, /@media \(max-width: 600px\)/); assert.match(css, /prefers-reduced-motion/);
  assert.deepEqual(content.privacy, { progressIsUserScoped: true, storesRawAudio: false, storesFreeResponse: false }); assert.equal(JSON.stringify(content).includes('Duo'), true, 'explicit non-copy exclusion should be documented');
  assert.equal(r.progress.marker, 'keep-progress'); assert.equal(r.srs[0].wordId, 'coffee'); assert.ok(r.syncReasons.includes('micro-node-complete'));
  console.log('P72B micro path evidence, persistent characters, contextual adventure, privacy, user isolation and offline assets passed');
})();
