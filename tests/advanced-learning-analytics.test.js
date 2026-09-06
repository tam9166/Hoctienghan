const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'data', 'advanced-learning-analytics.js'), 'utf8');
const content = JSON.parse(fs.readFileSync(path.join(root, 'content', 'advanced-learning-analytics.json'), 'utf8'));
const appSource = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const workerSource = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const migration = fs.readFileSync(path.join(root, 'supabase', 'migrations', '20260906_advanced_learning_analytics.sql'), 'utf8');

const daysAgo = (days) => new Date(Date.now() - days * 86400000).toISOString();
const boot = () => {
  const values = new Map();
  const state = {
    currentUser: { id: 'analytics-user' },
    currentView: 'analytics',
    srsData: [
      { id: 'school', mastery: 88, reviewCount: 4, firstReviewed: daysAgo(2), lastReviewed: daysAgo(2), status: 'mastered' },
      { id: 'student', mastery: 62, reviewCount: 2, firstReviewed: daysAgo(45), lastReviewed: daysAgo(45) },
      { id: 'eat', mastery: 76, reviewCount: 1, createdAt: daysAgo(9), lastReviewed: daysAgo(9) }
    ]
  };
  const storage = { get(key, fallback = null) { return values.has(key) ? values.get(key) : fallback; }, set(key, value) { values.set(key, value); return true; } };
  const userScoped = (key) => { const all = values.get(key); return Array.isArray(all?.[state.currentUser.id]) ? all[state.currentUser.id] : []; };
  const saveUserScoped = (key, list) => { const all = values.get(key) || {}; all[state.currentUser.id] = list; values.set(key, all); };
  const history = [
    { id: 'now-1', completedAt: daysAgo(1), percentage: 82, durationSeconds: 900, skillBreakdown: { listening: 60, grammar: 70, vocabulary: 85 } },
    { id: 'now-2', completedAt: daysAgo(5), percentage: 90, durationSeconds: 1200, skillBreakdown: { listening: 72, grammar: 78, vocabulary: 90 } },
    { id: 'old-1', completedAt: daysAgo(100), percentage: 55, durationSeconds: 600, skillBreakdown: { listening: 35, grammar: 50, vocabulary: 60 } },
    { id: 'old-2', completedAt: daysAgo(110), percentage: 60, durationSeconds: 600, skillBreakdown: { listening: 40, grammar: 55, vocabulary: 65 } }
  ];
  const progress = { stats: { wordsLearned: 50 }, skills: { listening: 70, grammar: 78, vocabulary: 88 }, lessonProgress: { l1: { completed: true, score: 90 }, l2: { completed: false }, l3: { completed: true, score: 80 } } };
  const window = {
    KLEARN_APP: {
      state, render: () => {}, escapeHtml: (value) => String(value), storage,
      STORAGE_KEYS: { analyticsReports: 'analytics_reports' }, userScoped, saveUserScoped,
      CloudSyncService: { schedule: () => {} }, getUserProgress: () => progress,
      PracticeService: { getHistory: () => history }, LearnerProfileService: { get: () => ({ skillScores: progress.skills }) }
    },
    MemoryRiskService: { analyze: (card) => ({ recallStrength: Number(card.mastery || 0) }) },
    KLEARN_THEORY_LESSONS: [
      { id: 'l1', title: 'Hangul', courseId: 'beginner' },
      { id: 'l2', title: 'Listening', courseId: 'beginner' },
      { id: 'l3', title: 'TOPIK', topikLevel: 1 }
    ], document: null, console
  };
  const context = { window, console, Date, String, Number, Object, Array, Math, Set, Map, RegExp, Promise, JSON };
  vm.createContext(context);
  vm.runInContext(source, context);
  return { window, values };
};

assert.equal(content.verified, true);
assert.deepEqual(content.retentionCheckpoints, [1, 7, 30]);
assert.equal(content.privacy.usesPeerComparison, false);
const app = boot();
const analytics = app.window.AdvancedLearningAnalyticsService;
assert.ok(analytics);
assert.ok(analytics.velocity.calculate(7).wordsPerWeek > 0);
assert.equal(analytics.retention.calculate().length, 3);
assert.ok(analytics.retention.calculate()[0].recalledPercent >= 0);
assert.ok(Number.isFinite(analytics.skillGrowth.calculate().listening.delta));
assert.ok(analytics.knowledgeHealth.calculate().score >= 0);
assert.equal(analytics.courseCompletion.analyze().lowest.length, 2);
assert.ok(analytics.practiceQuality.calculate().score >= 0);
assert.ok(analytics.longTerm.calculate()['3m']);
assert.equal(analytics.benchmark.calculate().scope, 'same-learner-only');
const report = analytics.reports.report('weekly');
assert.equal(report.generatedBy, 'deterministic-personal-analytics');
assert.equal(report.retention.length, 3);
assert.ok(report.completion.lowest.length);
assert.equal(analytics.reports.save('monthly').type, 'monthly');
assert.equal(analytics.reports.all().length, 1);
assert.match(appSource, /analyticsReports: 'klearn_analytics_reports'/);
assert.match(indexSource, /data\/advanced-learning-analytics\.js\?v=1/);
assert.match(workerSource, /klearn-v56/);
assert.match(workerSource, /advanced-learning-analytics\.json/);
assert.match(migration, /learning_analytics_reports/);
assert.match(migration, /auth\.uid\(\)/);
assert.match(migration, /row level security/i);
console.log('advanced analytics: velocity, retention, skill growth, health, completion, quality, long-term benchmark, reports and RLS passed');
