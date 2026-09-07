const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const appSource = read('app.js');
const queueSource = read('data/production-stability.js');
const dailySource = read('data/daily-learning-experience.js');

function bootQueue() {
  const values = new Map(); const listeners = {}; const userId = 'offline-user';
  const storage = { get: (key, fallback = null) => values.has(key) ? values.get(key) : fallback, set: (key, value) => values.set(key, value) };
  const state = { currentUser: { id: userId }, currentView: 'home', srsData: [] };
  const userScoped = (key) => values.get(key)?.[userId] || [];
  const saveUserScoped = (key, items) => { const all = values.get(key) || {}; all[userId] = items; values.set(key, all); };
  const window = { KLEARN_APP: { storage, state, STORAGE_KEYS: { backgroundSyncQueue: 'queue', productionTelemetry: 'telemetry', learningBackups: 'backups', recoveryCheckpoint: 'checkpoint' }, CloudSyncService: { isConfigured: () => true, flush: async () => true, schedule() {} }, PrivacyPreferenceService: { allows: () => true }, getUserProgress: () => ({}), saveUserProgress() {}, getUserSrs: () => [], saveUserSrs() {}, userScoped, saveUserScoped }, navigator: { onLine: false }, addEventListener: (type, listener) => { listeners[type] = listener; }, console };
  vm.runInNewContext(queueSource, { window, console, Date, String, Number, Object, Array, Math, Set, Map, RegExp, Promise, JSON });
  return { window, listeners };
}

function bootDaily(dueCount, learningTrack = 'foundation') {
  const state = { currentUser: { id: 'daily-user', learningTrack, fullName: 'Learner' }, currentView: 'home' };
  const window = { KLEARN_APP: { state, STORAGE_KEYS: { dailyExperience: 'daily' }, render() {}, setView() {}, toast() {}, escapeHtml: String, getUserProgress: () => ({ stats: {}, skills: {} }), userScoped: () => [], saveUserScoped() {}, PracticeService: { bank: { sets: [], getQuestions: () => [] }, getHistory: () => [] }, LearnerProfileService: { get: () => ({}) }, VocabularyService: { dueCards: () => Array.from({ length: dueCount }, (_, index) => ({ wordId: `w-${index}` })) } }, ComebackModeService: { status: () => ({ active: false }) }, ErrorNotebookService: { top: () => [] }, KLEARN_EXTRA_VIEWS: {}, addEventListener() {} };
  const document = { documentElement: { lang: 'vi' }, querySelector: () => null, querySelectorAll: () => [], getElementById: () => null };
  vm.runInNewContext(dailySource, { window, document, console, Date, Intl, String, Number, Object, Array, Math, Set, Map, FormData: class {} });
  return window.DailyLearningExperienceService;
}

(async () => {
  assert.match(appSource, /status:\s*SRS_STATES\.NOT_STARTED,\s*nextReview:\s*null/);
  assert.match(appSource, /onboardingCompleted:\s*false,\s*onboardingStep:\s*'goals'/);
  assert.match(appSource, /SRSStateService\.isDue/);
  assert.doesNotMatch(appSource, /nextReview:\s*new Date\(Date\.now\(\) - 60_000\)/);

  const content = JSON.parse(childProcess.execFileSync(process.execPath, [path.join(root, 'scripts', 'validate-vocabulary-content.js')], { encoding: 'utf8' }));
  assert.equal(content.total, 1000);
  assert.equal(content.duplicateSurface.length, 33);
  assert.equal(content.duplicateSurface.reduce((sum, group) => sum + group.ids.length - 1, 0), 34);
  assert.equal(content.automaticRomanization.length, 986);
  assert.equal(content.templateExample.length, 1000);
  assert.equal(content.missingAudioText.length, 0);
  assert.equal(content.missingExample.length, 0);
  assert.equal(content.missingMeaning.length, 0);
  assert.equal(content.inconsistentTopikLevel.length, 0);

  const queue = bootQueue();
  for (const type of ['completed_lesson', 'vocabulary_updated', 'srs_updated', 'mastery_updated', 'practice_completed']) queue.window.BackgroundSyncQueueService.enqueue({ type, entityId: type, mutationId: `m-${type}` });
  queue.window.BackgroundSyncQueueService.enqueue({ type: 'completed_lesson', entityId: 'completed_lesson', mutationId: 'm-completed_lesson' });
  assert.equal(queue.window.BackgroundSyncQueueService.pending(), 5, 'mutationId must make queue idempotent');
  queue.window.navigator.onLine = true;
  const flushed = await queue.window.BackgroundSyncQueueService.flush();
  assert.equal(flushed.flushed, 5); assert.equal(flushed.pending, 0); assert.equal(flushed.status, 'synced');

  const beginner = bootDaily(0, 'foundation');
  assert.deepEqual([...beginner.plan.build(5).tasks.map((task) => task.route)], ['foundation']);
  assert.equal(beginner.plan.build(15).tasks.some((task) => task.type === 'srs'), false);
  const existing = bootDaily(3, 'topik');
  assert.equal(existing.plan.build(15).tasks.some((task) => task.type === 'srs'), true);
  console.log('P48 unit: SRS initialization contract, onboarding, content validation, daily plan and idempotent offline queue passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
