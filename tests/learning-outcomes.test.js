const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'data', 'learning-outcomes.js'), 'utf8');
const appSource = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const routes = fs.readFileSync(path.join(root, 'data', 'route-loader.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const worker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const migration = fs.readFileSync(path.join(root, 'supabase', 'migrations', '20260909_p52_learning_outcomes.sql'), 'utf8');
const daysAgo = (days) => new Date(Date.now() - days * 86400000).toISOString();

function boot({ withEvidence = true } = {}) {
  const values = new Map();
  const state = {
    currentUser: { id: 'outcome-user', name: 'Minh', onboardingCompleted: true, targetTopikLevel: 2 },
    currentView: 'home',
    srsData: withEvidence ? Array.from({ length: 12 }, (_, index) => ({ id: `word-${index}`, wordId: `word-${index}`, createdAt: daysAgo(index < 6 ? 40 : 10), activatedAt: daysAgo(index < 6 ? 40 : 10), lastReviewed: daysAgo(1), reviewCount: 4, correctCount: index < 10 ? 4 : 3, wrongCount: index < 10 ? 0 : 1, mastery: 80, status: index < 6 ? 'mastered' : 'review' })) : []
  };
  const history = withEvidence ? [
    { id: 'old-1', level: 'TOPIK_1', completedAt: daysAgo(30), percentage: 50, skillBreakdown: { vocabulary: 48, grammar: 50, listening: 45, speaking: 40 } },
    { id: 'old-2', level: 'TOPIK_1', completedAt: daysAgo(20), percentage: 58, skillBreakdown: { vocabulary: 55, grammar: 58, listening: 52, speaking: 48 } },
    { id: 'new-1', level: 'TOPIK_1', examMode: true, completedAt: daysAgo(10), percentage: 76, skillBreakdown: { vocabulary: 78, grammar: 72, listening: 70, speaking: 68 } },
    { id: 'new-2', level: 'TOPIK_1', examMode: true, completedAt: daysAgo(2), percentage: 84, skillBreakdown: { vocabulary: 86, grammar: 80, listening: 78, speaking: 76 } }
  ] : [];
  const progress = { stats: {}, skills: {}, lessonProgress: withEvidence ? { 'hangul-foundation': { completed: true, completedAt: daysAgo(15), score: 90 } } : {} };
  if (withEvidence) values.set('speaking_sessions', { 'outcome-user': [{ id: 'speak-1', score: 76, createdAt: daysAgo(2) }] });
  const userScoped = (key) => { const all = values.get(key); return Array.isArray(all?.[state.currentUser.id]) ? all[state.currentUser.id] : []; };
  const saveUserScoped = (key, items) => { const all = values.get(key) || {}; all[state.currentUser.id] = items; values.set(key, all); };
  const document = { querySelector: () => null, querySelectorAll: () => [] };
  const window = {
    KLEARN_APP: {
      state, STORAGE_KEYS: { learningOutcomes: 'outcomes', speakingSessions: 'speaking_sessions', listeningSessions: 'listening_sessions', handwriting: 'handwriting' },
      userScoped, saveUserScoped, getUserProgress: () => progress,
      PracticeService: { getHistory: () => history }, LearnerProfileService: { get: () => ({ targetTopikLevel: 2 }) },
      escapeHtml: String, setView: (view) => { state.currentView = view; }, render: () => {}, toast: () => {}, CloudSyncService: { schedule: () => {} }
    },
    KLEARN_THEORY_LESSONS: [{ id: 'hangul-foundation', title: 'Nền tảng Hangul' }],
    KLEARN_EXTRA_VIEWS: {}, KLEARN_AFTER_RENDER: null, addEventListener: () => {}, clearTimeout, setTimeout, print: () => {}, document, console
  };
  const context = { window, document, console, Date, String, Number, Object, Array, Math, Set, Map, RegExp, JSON, clearTimeout, setTimeout };
  vm.createContext(context);
  vm.runInContext(source, context);
  return { window, values };
}

const measured = boot();
const service = measured.window.LearningOutcomeService;
assert.ok(service, 'outcome service is registered');
const snapshot = service.buildSnapshot();
assert.equal(snapshot.status, 'measured');
assert.ok(snapshot.skills.vocabulary.delta > 0);
assert.ok(snapshot.skills.grammar.delta > 0);
assert.ok(snapshot.skills.listening.delta > 0);
assert.ok(snapshot.skills.speaking.delta > 0);
assert.equal(snapshot.retention.day7.status, 'measured');
assert.equal(snapshot.retention.day30.status, 'measured');
assert.equal(snapshot.goal.status, 'measured');
assert.ok(snapshot.goal.progress >= 70);
assert.ok(snapshot.evidence.some((item) => item.key === 'first-hangul'));
assert.ok(snapshot.evidence.some((item) => item.key === 'ten-words'));
assert.equal(snapshot.courseEffectiveness[0].status, 'measured');
assert.ok(service.saveReport().kind === 'report');
assert.ok(service.records().some((item) => item.kind === 'baseline'));
assert.ok(service.records()[0].teacherSummary, 'current aggregate is first for authorized teacher summary');

const empty = boot({ withEvidence: false }).window.LearningOutcomeService.buildSnapshot();
assert.equal(empty.status, 'collecting');
assert.equal(empty.overallGrowth, null);
assert.equal(empty.retention.day7.score, null);
assert.equal(empty.retention.day30.score, null);
assert.equal(empty.goal.progress, null);

for (const view of ['learning-outcomes', 'student-progress-report', 'teacher-outcomes']) assert.equal(typeof measured.window.KLEARN_EXTRA_VIEWS[view], 'function');
assert.match(appSource, /learningOutcomes: 'klearn_learning_outcomes'/);
assert.match(routes, /learning-outcomes student-progress-report/);
assert.doesNotMatch(index, /data\/learning-outcomes\.js\?v=1/, 'outcomes remain route-lazy');
assert.match(routes, /data\/learning-outcomes\.js\?v=1/);
assert.match(worker, /learning-outcomes\.css\?v=1/);
assert.match(worker, /data\/learning-outcomes\.js\?v=1/);
assert.match(migration, /education_student_summary/);
assert.match(migration, /teacherSummary/);
assert.match(migration, /auth\.uid\(\)/);

console.log('learning outcomes: before/after, skill growth, retention, goals, evidence, reports, course effectiveness and teacher aggregate passed');
