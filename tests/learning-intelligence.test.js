const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const dataSource = fs.readFileSync(path.join(__dirname, '..', 'data', 'learning-intelligence-data.js'), 'utf8');
const systemSource = fs.readFileSync(path.join(__dirname, '..', 'data', 'learning-intelligence.js'), 'utf8');
const scoped = new Map();
// Keep the intelligence assertions independent of the month in which CI runs.
// The production module intentionally reads Date.now()/new Date(); inject a
// deterministic clock into its VM instead of weakening month-boundary asserts.
const FIXED_NOW_ISO = '2026-10-15T12:00:00.000Z';
const FIXED_NOW = Date.parse(FIXED_NOW_ISO);
const fixedDate = (timestamp) => class FixedDate extends Date {
  constructor(...args) { super(...(args.length ? args : [timestamp])); }
  static now() { return timestamp; }
};
const now = FIXED_NOW;

function boot(userId = 'learner-a', fixture = {}) {
  const clock = Number.isFinite(fixture.clockMs) ? fixture.clockMs : FIXED_NOW;
  const DateImpl = fixedDate(clock);
  const state = { currentUser: { id: userId, studyMinutesPerDay: 20, goalLabel: 'TOPIK 1' }, currentView: 'home', learningIntelligence: null };
  const progress = fixture.progress || { stats: { streak: 2 }, skills: { listening: 32, grammar: 62, vocabulary: 78, speaking: 55, reading: 70, writing: 45 } };
  const srs = fixture.srs || [{ wordId: 'v-1', korean: '학교', mastery: 35, status: 'review', nextReview: new Date(now - 86400000).toISOString(), lastReviewed: new Date(now - 8 * 86400000).toISOString() }];
  const history = fixture.history || [{ percentage: 70, wrong: 3, total: 6, durationSeconds: 600, completedAt: new Date(now - 2 * 86400000).toISOString() }];
  const window = {
    KLEARN_APP: {
      state,
      STORAGE_KEYS: { learningIntelligence: 'intelligence', progress: 'progress', srs: 'srs', realGoalPlans: 'goals' },
      render: () => {}, setView: (view) => { state.currentView = view; }, toast: () => {}, escapeHtml: String,
      getUserProgress: () => progress, getUserSrs: () => srs,
      userScoped: (key) => scoped.get(key)?.[state.currentUser?.id] || [],
      saveUserScoped: (key, items) => { const all = scoped.get(key) || {}; all[state.currentUser?.id] = items; scoped.set(key, all); },
      PracticeService: { getHistory: () => history, statistics: () => ({}) },
      LearnerProfileService: { get: () => ({ skillScores: progress.skills, weakSkills: ['listening'] }) },
      MasteryService: { status: (score) => score >= 85 ? 'mastered' : 'learning' },
      speakKorean: (text, rate) => { window.lastAudio = { text, rate }; },
      DictionaryService: { all: () => [{ id: 'v-1', korean: '학교', topikLevel: 1 }], byId: () => ({ id: 'v-1', korean: '학교', topikLevel: 1 }) }
    },
    VocabularyService: { dueCards: () => srs.filter((item) => new Date(item.nextReview).getTime() <= Date.now()), all: () => [{ id: 'v-1', korean: '학교', topikLevel: 1 }] },
    ErrorNotebookService: { top: () => [{ correction: '은/는', count: 2, topic: 'particle' }] },
    RealGoalPlannerService: { current: () => ({ title: 'TOPIK 1' }) },
    LearningJournalService: { all: () => [] },
    KLEARN_EXTRA_VIEWS: {}, KLEARN_AFTER_RENDER: null,
    I18nService: { getPreference: () => 'vi' }
  };
  const document = { documentElement: { lang: 'vi' }, querySelector: () => null, querySelectorAll: () => [], getElementById: () => null };
  const context = { window, document, console, Date: DateImpl, String, Number, Object, Array, Math, Set, Map, FormData: class {}, setTimeout };
  vm.createContext(context);
  vm.runInContext(dataSource, context);
  vm.runInContext(systemSource, context);
  return window;
}

const app = boot();
assert.equal(app.KLEARN_LEARNING_INTELLIGENCE_DATA.exampleQuality.every((item) => item.verified && item.naturalScore), true);
assert.deepEqual([...app.GrammarDependencyService.prerequisites('grammar-object').map((item) => item.id)], ['grammar-subject']);
assert.equal(app.GrammarDependencyService.next('grammar-topic')[0].id, 'grammar-subject');
assert.equal(app.KoreanFeedService.current('2026-09-05').id, 'feed-05');

assert.equal(app.AdaptiveDifficultyService.get('quiz'), 'easy');
assert.equal(app.AdaptiveDifficultyService.record('quiz', true), 'easy');
assert.equal(app.AdaptiveDifficultyService.record('quiz', true), 'easy');
assert.equal(app.AdaptiveDifficultyService.record('quiz', true), 'medium');
assert.equal(app.AdaptiveDifficultyService.record('quiz', false), 'medium');
assert.equal(app.AdaptiveDifficultyService.record('quiz', false), 'easy');
assert.equal(app.AdaptiveDifficultyService.set('listening', 'native'), 'native');
assert.equal(app.AdaptiveDifficultyService.get('listening'), 'native');

const plan = app.LearningDirectorService.plan();
assert.ok(plan.tasks.some((item) => item.id === 'srs'));
assert.ok(plan.tasks.some((item) => item.id === 'error'));
assert.ok(plan.tasks.some((item) => item.skill === 'listening'));
assert.ok(plan.totalMinutes >= 20);
app.LearningDirectorService.complete('srs');
assert.equal(app.LearningDirectorService.isComplete('srs'), true);

const rank = app.VocabularyImportanceService.ranked(1)[0];
assert.equal(rank.importance, 5);
assert.ok(rank.priority >= 5);
assert.equal(rank.stars.length, 5);
assert.ok(app.NativeAudioService.play('학교', 'slow'));
assert.equal(app.NativeAudioService.label('native'), 'Tự nhiên');
assert.equal(app.PersonalLearningReportService.report().attempts, 1);
assert.equal(app.PersonalLearningReportService.report().minutes, 10);
assert.equal(app.PersonalLearningReportService.report().mastered, 0);
assert.equal(app.FatigueDetectionService.shouldSuggest(), false);

// Boundary coverage: same day, yesterday, 3/7 days ago stay in the fixed
// month; 30 days ago is in the previous month and must not count in the
// monthly report. This remains stable across local/CI timezone settings.
const boundaryHistory = [0, 1, 3, 7, 30].map((days) => ({
  percentage: 70,
  durationSeconds: 600,
  completedAt: new Date(FIXED_NOW - days * 86400000).toISOString()
}));
const boundary = boot('learner-boundaries', { history: boundaryHistory });
assert.equal(boundary.PersonalLearningReportService.report().month, '2026-10');
assert.equal(boundary.PersonalLearningReportService.report().attempts, 4);
assert.equal(boundary.PersonalLearningReportService.report().minutes, 40);
assert.equal(boundary.ComebackModeService.status().active, false);
const comebackBoundary = boot('learner-comeback-boundary', {
  history: [{ percentage: 50, wrong: 5, total: 6, completedAt: new Date(FIXED_NOW - 7 * 86400000).toISOString() }]
});
assert.equal(comebackBoundary.ComebackModeService.status().active, true);

const firstOfMonth = boot('learner-first-of-month', {
  clockMs: Date.parse('2026-10-01T12:00:00.000Z'),
  history: [
    { percentage: 80, durationSeconds: 600, completedAt: '2026-10-01T00:00:00.000Z' },
    { percentage: 80, durationSeconds: 600, completedAt: '2026-09-30T23:59:59.000Z' }
  ]
});
assert.equal(firstOfMonth.PersonalLearningReportService.report().attempts, 1);
const lastOfMonth = boot('learner-last-of-month', {
  clockMs: Date.parse('2026-10-31T12:00:00.000Z'),
  history: [
    { percentage: 80, durationSeconds: 600, completedAt: '2026-10-31T00:00:00.000Z' },
    { percentage: 80, durationSeconds: 600, completedAt: '2026-10-01T00:00:00.000Z' },
    { percentage: 80, durationSeconds: 600, completedAt: '2026-09-30T23:59:59.000Z' }
  ]
});
assert.equal(lastOfMonth.PersonalLearningReportService.report().attempts, 2);
const utcLocal = boot('learner-utc-local', {
  clockMs: Date.parse('2026-10-01T12:00:00.000Z'),
  history: [
    { percentage: 80, durationSeconds: 600, completedAt: '2026-10-01T00:30:00Z' },
    { percentage: 80, durationSeconds: 600, completedAt: '2026-10-01T00:30:00+07:00' }
  ]
});
// The report deliberately groups persisted ISO strings by their serialized
// date prefix, so a local-offset timestamp that starts on 2026-10-01 remains
// in the October bucket regardless of the runner timezone.
assert.equal(utcLocal.PersonalLearningReportService.report().attempts, 2);
for (const iso of ['2026-10-05T12:00:00.000Z', '2026-10-11T12:00:00.000Z']) {
  const weekBoundary = boot(`learner-week-${iso.slice(8, 10)}`, { clockMs: Date.parse(iso), history: [] });
  assert.equal(weekBoundary.LearningDirectorService.plan().date, iso.slice(0, 10));
}

const awayHistory = [{ percentage: 50, wrong: 5, total: 6, completedAt: new Date(now - 9 * 86400000).toISOString() }];
const away = boot('learner-away', { history: awayHistory });
assert.equal(away.ComebackModeService.status().active, true);
assert.equal(away.ComebackModeService.status().tasks[0].title, 'Ôn 10 từ quan trọng');
assert.equal(typeof away.KLEARN_EXTRA_VIEWS['personal-report'], 'function');
assert.match(away.KLEARN_EXTRA_VIEWS['personal-report'](), /Tóm tắt tiến độ/);
console.log('learning intelligence: verified examples, adaptive difficulty, director, comeback, ranking, audio and personal report passed');
