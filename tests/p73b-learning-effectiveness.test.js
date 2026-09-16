const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const content = JSON.parse(read('content/learning-effectiveness.json'));

function createRuntime(shared = new Map()) {
  const state = { currentUser: { id: 'p73b-user', level: 'TOPIK 1', studyMinutesPerDay: 15 }, currentView: 'learning-effectiveness' };
  const srs = [{ wordId: 'eat', korean: '먹다', meanings: { vi: 'ăn' }, status: 'learning', reviewCount: 2, correctCount: 1, wrongCount: 1, mastery: 40 }];
  let progress = { stats: { lessonsCompleted: 2 }, foundation: { checkpoint: { score: 55 } } };
  const mutations = [];
  const userScoped = (key) => shared.get(key)?.[state.currentUser.id] || [];
  const saveUserScoped = (key, values, limit = 100) => { const all = shared.get(key) || {}; all[state.currentUser.id] = values.slice(0, limit); shared.set(key, all); };
  shared.set('errors', { [state.currentUser.id]: [{ mistake: '저는 학교를 가요', correction: '저는 학교에 가요', type: 'grammar' }] });
  const latestReport = { generatedAt: '2026-09-15T00:00:00.000Z', overall: 63, coverage: 86, weakest: 'listening', strongest: 'vocabulary', skills: { vocabulary: { score: 82 }, grammar: { score: 61 }, listening: { score: 42 }, speaking: { score: 55 }, reading: { score: 75 }, writing: { score: 63 }, pronunciation: { score: 59 } } };
  const window = {
    KLEARN_APP: {
      state,
      STORAGE_KEYS: { learningEffectiveness: 'effectiveness', errors: 'errors', listeningSessions: 'listening' },
      render() {}, setView(view) { state.currentView = view; }, toast() {}, escapeHtml: String,
      normalizeSearch: (value) => String(value || '').normalize('NFKC').toLowerCase(),
      userScoped, saveUserScoped, getUserProgress: () => progress, getUserSrs: () => srs,
      VocabularyService: { updateCard(wordId, changes) { const card = srs.find((item) => item.wordId === wordId); Object.assign(card, changes); return card; } },
      DictionaryService: { search(word) { return content.wordLife.filter((item) => item.korean === word).map((item) => ({ id: item.id, korean: item.korean, meanings: { vi: item.meaning } })); }, addToSrs(entry) { if (!srs.some((item) => item.wordId === entry.id)) srs.push({ ...entry, wordId: entry.id, status: 'learning', reviewCount: 0, mastery: 0 }); return srs.find((item) => item.wordId === entry.id); } },
      emitLearningMutation: (...args) => mutations.push(args), speakKorean() {}
    },
    FullLearningDiagnosticService: { latest: () => latestReport, calculate: () => latestReport, run: () => latestReport },
    PersonalLearningPrescriptionService: { create: (days) => ({ days }) },
    VietnamesePronunciationLabService: { attempts: () => [{ targetId: 'sound-eo-o', wrongSound: 'ㅓ vs ㅗ' }] },
    RealShadowingService: { attempts: () => [] },
    KLEARN_EXTRA_VIEWS: {}, KLEARN_AFTER_RENDER: null, document: null, addEventListener() {}
  };
  window.window = window;
  const context = { window, console, Date, Math, JSON, Object, Array, Number, String, Boolean, RegExp, Set, Map, Promise, Symbol, FormData: class {}, fetch: async () => ({ ok: true, json: async () => content }) };
  vm.runInNewContext(read('data/learning-effectiveness.js'), context);
  window.LearningEffectivenessContentService.hydrate(content);
  return { window, state, srs, shared, mutations, setProgress(value) { progress = value; } };
}

const runtime = createRuntime();
const w = runtime.window;
for (const service of ['LearningEffectivenessContentService', 'VietnameseLearningAssistantService', 'WordLifeService', 'LearningHealthBridgeService', 'FourteenDayImprovementPlanService', 'ListeningJourneyService', 'ActiveRecallService', 'CompleteCourseService']) assert.ok(w[service], `${service} missing`);

const invalid = structuredClone(content); invalid.wordLife[0].realUsage = ''; invalid.wordLife.length = 4;
assert.throws(() => w.LearningEffectivenessContentService.hydrate(invalid), /quality gate failed/);
w.LearningEffectivenessContentService.hydrate(content);
assert.equal(w.VietnameseLearningAssistantService.all().length, 6);
assert.equal(w.VietnameseLearningAssistantService.recommendations()[0].priority, 'personal');
assert.deepEqual(Object.keys(w.WordLifeService.get('eat')).filter((key) => ['meaning', 'example', 'related', 'commonMistake', 'pattern', 'realUsage', 'situation'].includes(key)).sort(), ['commonMistake', 'example', 'meaning', 'pattern', 'realUsage', 'related', 'situation']);

const diagnostic = w.LearningHealthBridgeService.report();
assert.equal(diagnostic.weakest, 'listening');
assert.deepEqual(Array.from(diagnostic.strengths), ['vocabulary', 'reading']);
const plan = w.FourteenDayImprovementPlanService.create();
assert.equal(plan.days, 14); assert.equal(plan.weakSkill, 'listening'); assert.equal(plan.phases.length, 3); assert.equal(plan.phases[0].from, 1); assert.equal(plan.phases.at(-1).to, 14);
assert.equal(w.ListeningJourneyService.stages().length, 5);
assert.equal(w.ListeningJourneyService.stages()[0].status, 'completed');

assert.deepEqual(Array.from(w.ActiveRecallService.modes(), (item) => item.id), ['vi-ko', 'listen-write', 'listen-speak', 'look-speak']);
const question = w.ActiveRecallService.question('vi-ko');
const beforeReview = runtime.srs[0].reviewCount;
const result = w.ActiveRecallService.grade(question, '먹다');
assert.equal(result.correct, true); assert.equal(runtime.srs[0].reviewCount, beforeReview + 1); assert.ok(runtime.mutations.some((item) => item[0] === 'srs_updated'));
assert.equal(w.WordLifeService.addToSrs('go').status, 'added'); assert.ok(runtime.srs.some((item) => item.korean === '가다'));

assert.equal(w.CompleteCourseService.definition().chapters.length, 4);
assert.equal(w.CompleteCourseService.certificate().eligible, false);
runtime.setProgress({ stats: { lessonsCompleted: 25 }, foundation: { checkpoint: { score: 82 } } });
assert.equal(w.CompleteCourseService.certificate().eligible, true);

const restored = createRuntime(runtime.shared);
assert.equal(restored.window.FourteenDayImprovementPlanService.current().days, 14);
assert.equal(restored.window.ActiveRecallService.history().length, 1);

const app = read('app.js'); const index = read('index.html'); const worker = read('sw.js'); const loader = read('data/route-loader.js'); const css = read('learning-effectiveness.css');
assert.match(app, /learningEffectiveness: 'klearn_learning_effectiveness'/); assert.match(app, /mergeLearningEffectiveness/); assert.match(app, /STORAGE_KEYS\.learningEffectiveness/);
assert.doesNotMatch(index, /data\/learning-effectiveness\.js\?v=1/); assert.match(index, /app\.js\?v=83/);
assert.match(worker, /klearn-v102/); assert.match(worker, /content\/learning-effectiveness\.json/); assert.match(worker, /learning-effectiveness\.css\?v=1/);
assert.match(loader, /learningEffectiveness: \{ dependencies: \['intelligenceMemory', 'realKoreanExperience', 'science'\]/); assert.match(loader, /routes\('lessons'.*'learningEffectiveness'/);
assert.match(css, /@media\(max-width:720px\)/); assert.match(css, /prefers-reduced-motion/); assert.match(css, /overflow-wrap/);
console.log('P73B unit: Vietnamese learner advantage, Word Life, diagnostic bridge, 14-day plan, listening journey, active recall/SRS integrity, complete course and lazy assets passed');
