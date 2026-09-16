const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const content = JSON.parse(read('content/product-delight.json'));

function runtime(options = {}) {
  const userId = options.userId || 'p74-user';
  const maps = new Map();
  const scoped = new Map();
  const savedSessions = [];
  const researchEvents = [];
  const feedback = [];
  const progress = options.progress || { foundation: { learnedCharacters: [] }, lessonProgress: {} };
  const state = {
    currentUser: { id: userId, createdAt: options.createdAt || '2026-09-16T00:00:00.000Z', currentTopikLevel: 0 },
    currentView: 'product-delight',
    srsData: options.srs || []
  };
  const userScoped = (key) => scoped.get(key)?.[userId] || [];
  const saveUserScoped = (key, value, limit = 100) => {
    const all = scoped.get(key) || {};
    all[userId] = value.slice(0, limit);
    scoped.set(key, all);
  };
  if (options.sentenceProgress) maps.set('sentence-progress', { [userId]: options.sentenceProgress });
  const events = options.events || [];
  const window = {
    KLEARN_APP: {
      storage: { get: (key, fallback) => maps.get(key) || fallback },
      state,
      STORAGE_KEYS: { productDelight: 'p74-store', sentenceBuilderProgress: 'sentence-progress' },
      userScoped,
      saveUserScoped,
      getUserProgress: () => progress,
      getUserSrs: () => state.srsData,
      PracticeService: { getHistory: () => options.practice || [] },
      LearnerProfileService: { get: () => options.profile || { weakSkills: ['listening'] } },
      render() {},
      setView(view) { state.currentView = view; },
      toast() {},
      escapeHtml: String
    },
    LearningActivityService: { events: () => events },
    HabitFormationService: { analyze: () => options.habit || { ready: events.length >= 3, bestWindow: events.length ? '20:00–22:00' : null, minutes: events.reduce((sum, item) => sum + item.minutes, 0), activeDays: new Set(events.map((item) => item.at.slice(0, 10))).size } },
    FocusSessionService: {
      start(minutes) { return { id: `focus-${minutes}`, targetMinutes: minutes, status: 'active', tasks: [] }; },
      save(session) { savedSessions.push(structuredClone(session)); }
    },
    VocabularyService: { dueCards: () => options.due || [] },
    ErrorNotebookService: { top: () => options.errors || [] },
    GoalTrackingService: { getGoal: () => options.goal || null, progress: () => options.goalProgress || 0 },
    RealKoreanMissionService: { history: () => options.missions || [], recommended: () => options.recommendedMission || null },
    ConversationHistoryService: { all: () => options.conversations || [] },
    OfflinePackService: {
      catalog: () => options.packs || ['beginner', 'topik-1', 'topik-2', 'vocabulary', 'listening', 'business-korean', 'travel-korean'].map((id) => ({ id, version: 1, assets: [`./content/${id}.json`] })),
      metadata: () => options.downloaded || [],
      status: (pack) => (options.downloaded || []).some((item) => item.id === pack.id) ? 'downloaded' : 'available'
    },
    UserResearchService: {
      track(event, properties) { const item = { event, properties, createdAt: new Date().toISOString() }; researchEvents.push(item); return item; },
      submitFeedback(value) { feedback.push(value); return value; },
      all: () => ({ consent: options.consent || 'granted', events: options.researchEvents || [] }),
      featureUsage: () => ({ focus_session: 2 })
    },
    ExperimentService: { assignment: () => ({ experimentId: 'home_layout', variant: 'B' }) },
    KLEARN_EXTRA_VIEWS: {},
    KLEARN_AFTER_RENDER: null,
    document: null,
    navigator: { storage: { estimate: async () => ({ usage: 1024, quota: 1024 * 1024 }) } },
    setTimeout,
    fetch: async () => ({ ok: true, json: async () => content })
  };
  window.window = window;
  const context = { window, console, Date, Intl, Math, JSON, Object, Array, Number, String, Boolean, RegExp, Set, Map, Promise, Symbol, FormData: class {}, fetch: window.fetch, setTimeout, structuredClone };
  vm.runInNewContext(read('data/product-delight.js'), context);
  window.ProductDelightContentService.hydrate(content);
  return { window, state, scoped, savedSessions, researchEvents, feedback };
}

assert.equal(content.celebrations.length, 7);
assert.equal(content.culture.length, 6);
assert.equal(content.careerPaths.length, 4);
assert.deepEqual(content.focusTemplates['15'].map((item) => item.minutes), [3, 5, 5, 2]);
assert.equal(content.focusTemplates['15'].reduce((sum, item) => sum + item.minutes, 0), 15);

const fresh = runtime();
for (const name of ['LearningCompanionService', 'DelightCelebrationService', 'HabitIntelligenceService', 'DelightFocusSessionService', 'DelightReturnLoopService', 'DelightOfflinePackService', 'CultureContextLayerService', 'CareerKoreanJourneyService', 'DelightFeedbackService', 'DelightAnalyticsService']) assert.ok(fresh.window[name], `${name} missing`);
assert.equal(fresh.window.LearningCompanionService.summary().evidence.length, 0);
assert.equal(fresh.window.DelightCelebrationService.all().filter((item) => item.unlocked).length, 0);
assert.equal(fresh.window.HabitIntelligenceService.analyze().evidenceReady, false);
assert.equal(fresh.window.DelightAnalyticsService.snapshot().sensitiveDataCollected, false);

const invalid = structuredClone(content); invalid.celebrations.pop();
assert.throws(() => fresh.window.ProductDelightContentService.hydrate(invalid), /schema invalid/);
fresh.window.ProductDelightContentService.hydrate(content);

// Evidence comes from the existing learning truth, never from XP or a page visit.
const learner = runtime({
  createdAt: '2026-08-17T00:00:00.000Z',
  progress: { foundation: { learnedCharacters: ['ㅏ'] }, lessonProgress: { lessonA: { completed: true } } },
  sentenceProgress: { completedIds: ['sb-1'], attempts: [{ exerciseId: 'sb-1', correct: true }] },
  srs: Array.from({ length: 100 }, (_, index) => ({ id: `word-${index}`, mastery: 90, status: 'mastered' })),
  missions: [{ id: 'm1', completed: true }],
  practice: [{ id: 'topik-1', setTitle: 'TOPIK 1 mock', percentage: 72 }]
});
const unlocked = learner.window.DelightCelebrationService.all().filter((item) => item.unlocked).map((item) => item.id);
assert.deepEqual(unlocked, ['first-hangul', 'first-sentence', 'words-100', 'first-conversation', 'topik-milestone']);
assert.equal(learner.window.DelightCelebrationService.acknowledge('words-500'), null);
assert.ok(learner.window.DelightCelebrationService.acknowledge('first-hangul'));

// Fourteen days of evidence are required before the app recommends a study time.
const habitEvents = [0, 3, 7, 10, 14].map((offset, index) => ({ id: `e-${index}`, type: index < 3 ? 'listening' : 'lesson', minutes: 15 + index, at: new Date(Date.UTC(2026, 8, 1 + offset, 20)).toISOString() }));
const month = runtime({ createdAt: '2026-08-01T00:00:00.000Z', events: habitEvents });
const habit = month.window.HabitIntelligenceService.analyze(new Date('2026-09-16T00:00:00.000Z'));
assert.equal(habit.evidenceReady, true);
assert.equal(habit.bestWindow, '20:00–22:00');
assert.equal(habit.preferredType, 'listening');
assert.equal(month.window.DelightFeedbackService.due(new Date('2026-09-16T00:00:00.000Z')).id, 'day-30');
const reminder = month.window.HabitIntelligenceService.updateReminder({ enabled: true, hour: 21 });
assert.deepEqual({ enabled: reminder.enabled, hour: reminder.hour }, { enabled: true, hour: 21 });

const plan = month.window.DelightFocusSessionService.build(15);
assert.deepEqual(plan.tasks.map((item) => item.minutes), [3, 5, 5, 2]);
assert.equal(plan.tasks.reduce((sum, item) => sum + item.minutes, 0), 15);
const session = month.window.DelightFocusSessionService.start(15);
assert.equal(session.engine, 'existing-focus-session');
assert.equal(month.savedSessions.length, 1);

// Return priority: unfinished lesson, error, near goal, mission, then a five-minute session.
const lessonReturn = runtime({ progress: { foundation: { learnedCharacters: [] }, lessonProgress: { l1: { status: 'in_progress', progress: 35, updatedAt: '2026-09-15T00:00:00Z' } } }, errors: [{ mistake: '은/는', resolved: false }], goal: { targetLevel: 2 }, goalProgress: 90 });
assert.equal(lessonReturn.window.DelightReturnLoopService.recommend().type, 'lesson');
const errorReturn = runtime({ errors: [{ mistake: '은/는', resolved: false }], goal: { targetLevel: 2 }, goalProgress: 90 });
assert.equal(errorReturn.window.DelightReturnLoopService.recommend().type, 'error');
const goalReturn = runtime({ goal: { targetLevel: 2 }, goalProgress: 90 });
assert.equal(goalReturn.window.DelightReturnLoopService.recommend().type, 'goal');
const shortReturn = runtime();
assert.equal(shortReturn.window.DelightReturnLoopService.recommend().type, 'short');

assert.equal(month.window.DelightOfflinePackService.summary().total, 7);
assert.equal(month.window.CultureContextLayerService.all().length, 6);
assert.equal(month.window.CareerKoreanJourneyService.select('business').id, 'business');
const sent = month.window.DelightFeedbackService.submit({ promptId: 'day-30', category: 'learning_problem', rating: 4, comment: 'Phần nghe còn nhanh.' });
assert.equal(sent.category, 'learning_problem');
assert.equal(month.feedback.length, 1);
assert.equal(month.feedback[0].type, 'issue_report');

// Long-term learner unlocks the 1,000-word milestone from SRS mastery.
const veteran = runtime({ createdAt: '2026-03-20T00:00:00.000Z', srs: Array.from({ length: 1000 }, (_, index) => ({ id: `v-${index}`, mastery: 90 })) });
assert.equal(veteran.window.DelightCelebrationService.all().find((item) => item.id === 'words-1000').unlocked, true);

const app = read('app.js');
const index = read('index.html');
const worker = read('sw.js');
const loader = read('data/route-loader.js');
const css = read('product-delight.css');
const practical = read('data/practical-study.js');
assert.match(app, /productDelight: 'klearn_product_delight'/);
assert.match(app, /mergeProductDelight/);
assert.match(app, /STORAGE_KEYS\.productDelight/);
assert.match(loader, /productDelightCore/);
assert.match(loader, /routes\('home', \['growth', 'realUserRetentionCore', 'productDelightCore'\]\)/);
assert.match(index, /route-loader\.js\?v=25/);
assert.match(index, /app\.js\?v=83/);
assert.match(worker, /klearn-v101/);
assert.match(worker, /content\/product-delight\.json/);
assert.match(practical, /id:'vocabulary-pack'/);
assert.match(practical, /id:'listening-pack'/);
assert.match(css, /@media \(max-width: 560px\)/);
assert.match(css, /prefers-reduced-motion/);
assert.doesNotMatch(read('data/product-delight.js'), /passwordHash|access_token|refresh_token/);

console.log('P74 unit: companion, evidence celebrations, habit intelligence, focus session, smart return, offline packs, culture, career, feedback, analytics and cloud merge passed');
