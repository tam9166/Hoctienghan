const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'data', 'learning-science-engine.js'), 'utf8');
const content = JSON.parse(fs.readFileSync(path.join(root, 'content', 'learning-science-engine.json'), 'utf8'));
const migration = fs.readFileSync(path.join(root, 'supabase', 'migrations', '20260906_p41_learning_science_engine.sql'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8') + fs.readFileSync(path.join(root, 'data', 'route-loader.js'), 'utf8');
const worker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const appSource = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'learning-science.css'), 'utf8');
const fixedNow = new Date('2026-09-06T12:00:00.000Z').getTime();

function boot() {
  const srs = [
    { wordId: 'school', korean: '학교', meaningVi: 'trường học', mastery: 85, correctCount: 8, wrongCount: 2, reviewCount: 10, intervalDays: 7, lastReviewed: new Date(fixedNow - 45 * 86400000).toISOString(), nextReview: new Date(fixedNow - 30 * 86400000).toISOString(), difficulty: 'hard' },
    { wordId: 'student', korean: '학생', meaningVi: 'học sinh', mastery: 75, correctCount: 5, wrongCount: 1, reviewCount: 6, intervalDays: 14, lastReviewed: new Date(fixedNow - 3 * 86400000).toISOString(), nextReview: new Date(fixedNow + 3 * 86400000).toISOString(), difficulty: 'normal' }
  ];
  const history = [
    { percentage: 90, skillBreakdown: { grammar: 86 }, completedAt: '2026-09-06T10:00:00Z' },
    { percentage: 88, skillBreakdown: { grammar: 82 }, completedAt: '2026-09-05T10:00:00Z' },
    { percentage: 91, skillBreakdown: { grammar: 91 }, completedAt: '2026-09-04T10:00:00Z' }
  ];
  const questions = ['vocabulary', 'vocabulary', 'grammar', 'grammar', 'listening', 'listening'].map((skill, index) => ({ id: `${skill}-${index}`, skill, prompt: `${skill} ${index}` }));
  const errors = [{ id: 'e1', question: 'Chọn 은/는 hoặc 이/가', mistake: '이/가', correction: '은/는', count: 3 }];
  const updates = []; let startedQuestions = null;
  const state = { currentUser: { id: 'learner', studyMinutesPerDay: 30 }, currentView: 'home', srsData: srs };
  const document = { documentElement: { lang: 'vi' }, querySelector: () => null, querySelectorAll: () => [], getElementById: () => null };
  const window = {
    document, KLEARN_EXTRA_VIEWS: {}, KLEARN_AFTER_RENDER: null,
    MemoryRiskService: { analyze(card) { const old = card.wordId === 'school'; return { riskScore: old ? 88 : 22, recallStrength: old ? 28 : 84, evidence: 'strong' }; } },
    ErrorNotebookService: { top: () => errors }, SmartReviewService: {},
    KLEARN_APP: {
      state, render() {}, setView(view) { state.currentView = view; }, toast() {}, escapeHtml: String,
      getUserProgress: () => ({ skills: { reading: 80, vocabulary: 72, grammar: 62, writing: 45 } }),
      PracticeService: { getHistory: () => history, bank: { sets: [{ id: 'all' }], getQuestions: () => questions }, startQuestions(items) { startedQuestions = items; return true; } },
      VocabularyService: { updateCard(id, changes) { updates.push({ id, changes }); Object.assign(srs.find((card) => card.wordId === id), changes); } },
      CloudSyncService: { schedule() {} }
    }
  };
  const FakeDate = class extends Date { constructor(...args) { super(...(args.length ? args : [fixedNow])); } static now() { return fixedNow; } };
  const context = { window, document, console, Date: FakeDate, Math, Object, Array, Number, String, Boolean, Set, Map, Promise, JSON, RegExp, FormData: class {}, fetch: async () => ({ ok: true, json: async () => content }) };
  vm.createContext(context); vm.runInContext(source, context); window.LearningScienceContentService.hydrate(content);
  return { window, state, srs, history, questions, updates, getStarted: () => startedQuestions };
}

(async () => {
  assert.equal(content.verified, true); assert.equal(content.reviewStatus, 'approved'); assert.equal(content.privacy.storesRawAnswers, false); assert.equal(content.privacy.medicalInference, false);
  const fixture = boot(); const app = fixture.window;

  const old = app.SpacedRepetitionOptimizer.analyze(fixture.srs[0], fixedNow); const recent = app.SpacedRepetitionOptimizer.analyze(fixture.srs[1], fixedNow);
  assert.equal(old.difficulty, 'hard'); assert.equal(old.mistakeFrequency, 20); assert.ok(old.forgettingProbability > recent.forgettingProbability); assert.ok(old.priority > recent.priority); assert.equal(typeof app.SmartReviewService.science, 'function');
  assert.ok(app.SpacedRepetitionOptimizer.nextInterval(fixture.srs[0], { correct: false, confidence: 1 }) < app.SpacedRepetitionOptimizer.nextInterval(fixture.srs[0], { correct: true, confidence: 5 }));

  const recall = app.ActiveRecallService.start(2); assert.equal(recall.cards[0].prompt.includes('trường học'), false, 'prompt must not reveal the answer');
  const before = app.KLEARN_EXTRA_VIEWS['active-recall'](); assert.doesNotMatch(before, /trường học/, 'answer must remain hidden before submission');
  const feedback = app.ActiveRecallService.answer('trường học', 4); assert.equal(feedback.correct, true); assert.equal(fixture.updates[0].changes.lastResult.responseStored, false); assert.equal(fixture.updates[0].changes.confidence, 4);
  const after = app.KLEARN_EXTRA_VIEWS['active-recall'](); assert.match(after, /trường học/); assert.equal(recall.responses[0].rawAnswerStored, false);

  const mixed = app.InterleavedPracticeService.build(6, fixture.questions); for (let index = 1; index < mixed.length; index += 1) assert.notEqual(mixed[index].skill, mixed[index - 1].skill, 'skills must be interleaved when pools allow');
  assert.equal(app.InterleavedPracticeService.start(6), true); assert.equal(fixture.getStarted().length, 6);
  assert.equal(app.DifficultyAdaptationService.recommend(fixture.history).level, 'hard'); assert.equal(app.DifficultyAdaptationService.recommend([{ percentage: 40 }, { percentage: 50 }]).ready, false);
  assert.equal(app.LearningFatigueService.assess({ durationMinutes: 50 }).shouldPause, true); assert.equal(app.LearningFatigueService.assess({ answers: [{ correct: false }, { correct: false }, { correct: false }] }).shouldPause, true); assert.equal(app.LearningFatigueService.assess({ durationMinutes: 10 }).medicalAssessment, false);
  assert.ok(app.CognitiveLoadService.estimate({ preferredMinutes: 30 }).minutes <= 60);
  const retention = app.RetentionScoreService.scores(); assert.equal(retention.vocabulary, 56); assert.equal(retention.grammar, 86);
  assert.equal(app.MisconceptionDetectionService.detect()[0].id, 'topic-vs-subject');
  const tree = app.ConceptMasteryTreeService.tree(); assert.deepEqual([...tree.map((item) => item.id)], ['hangul', 'vocabulary', 'grammar', 'sentence']); assert.equal(tree.every((item) => item.locked === false), true);
  const plan = app.OptimalLearningPlanService.build({ minutes: 15 }); assert.ok(plan.minutes <= plan.capacityMinutes); assert.ok(plan.tasks.length <= 3); assert.match(plan.disclaimer, /không phải đánh giá y khoa/i);
  assert.equal(typeof app.KLEARN_EXTRA_VIEWS['learning-science'], 'function'); assert.equal(typeof app.KLEARN_EXTRA_VIEWS['concept-mastery'], 'function');

  for (const table of ['learning_science_profiles','learning_science_recall_events','learning_science_session_summaries','learning_science_misconceptions']) assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`));
  assert.match(migration, /raw_answer_stored boolean not null default false check \(raw_answer_stored = false\)/); assert.match(migration, /not medical or diagnostic data/);
  assert.match(index, /learning-science\.css\?v=1/); assert.match(index, /data\/learning-science-engine\.js\?v=1/); assert.match(index, /app\.js\?v=71/); assert.match(worker, /klearn-v85/); assert.match(worker, /content\/learning-science-engine\.json/); assert.match(appSource, /'learning-science', 'active-recall', 'interleaved-practice', 'concept-mastery'/); assert.match(css, /@media\(max-width:600px\)/);
  console.log('learning science engine: optimized SRS, active recall, interleaving, adaptation, load, retention, fatigue, mastery tree, misconception detection, optimal plan and private RLS passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
