const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const content = JSON.parse(read('content/engagement-core.json'));
const day = 86400000;

function createRuntime() {
  const values = new Map(); const listeners = {}; const syncReasons = []; const rpcCalls = []; let history = [];
  const state = { currentUser: { id: 'learner-a', currentTopikLevel: 1, learningMode: 'casual' }, currentView: 'home', srsData: [] };
  const progress = { marker: 'keep-progress', lessonProgress: {}, pronunciationAttempts: [], writingSubmissions: [], skills: {}, stats: { streak: 7 } };
  const srs = [{ wordId: 'w1', korean: '학교', reviewCount: 3, correctCount: 8, wrongCount: 2, mastery: 80 }]; state.srsData = srs;
  const storage = { get: (key, fallback) => values.has(key) ? values.get(key) : fallback, set: (key, value) => { values.set(key, value); return true; } };
  const userScoped = (key) => values.get(key)?.[state.currentUser.id] || [];
  const saveUserScoped = (key, items, limit = 100) => { const all = values.get(key) || {}; all[state.currentUser.id] = items.slice(0, limit); values.set(key, all); };
  const questions = [
    { id: 'q-v', skill: 'vocabulary', level: 'TOPIK_1', prompt: '학교 = ?', options: ['school'] },
    { id: 'q-g', skill: 'grammar', level: 'TOPIK_1', prompt: '은/는', options: ['topic'] },
    { id: 'q-l', skill: 'listening', level: 'TOPIK_1', prompt: 'Nghe', options: ['A'] },
    { id: 'q-r', skill: 'reading', level: 'TOPIK_1', prompt: '읽기', options: ['A'] },
    { id: 'q-w', skill: 'writing', level: 'TOPIK_1', prompt: '쓰기', options: ['A'] }
  ];
  const practice = { bank: { sets: [{ id: 'set-1' }], getQuestions: () => questions }, getHistory: () => history, startQuestions(items, title, source) { this.started = { items, title, source }; return true; } };
  const window = {
    KLEARN_APP: { storage, state, STORAGE_KEYS: { engagement: 'engagement', listeningSessions: 'listening' }, userScoped, saveUserScoped, getUserProgress: () => progress, getUserSrs: () => srs, VocabularyService: { dueCards: () => srs }, PracticeService: practice, CloudSyncService: { schedule: (reason) => syncReasons.push(reason) }, setView: (view) => { state.currentView = view; }, render() {}, toast() {}, escapeHtml: String },
    DailyMissionService: { completed: false, getToday() { return { id: 'mission-today', priorities: [{ id: 'listen' }], completedItems: [], completed: this.completed }; }, complete() { this.completed = true; return this.getToday(); } },
    AdaptiveLearningEngine: { priorities: () => [{ id: 'listening', title: 'Luyện nghe yếu', reason: 'Evidence' }] }, GoalTrackingService: { getGoal: () => ({ goalType: 'topik' }) },
    navigator: { onLine: false }, KLEARN_EXTRA_VIEWS: {}, KLEARN_AFTER_RENDER: null, document: null,
    addEventListener(name, handler) { listeners[name] = handler; }, setTimeout() { return 1; }
  };
  window.window = window;
  vm.runInNewContext(read('data/engagement-core.js'), { window, console, Date, Math, JSON, Object, Array, Number, String, Boolean, RegExp, Set, Map, Promise, Symbol });
  window.EngagementContentService.hydrate(content);
  return { window, state, progress, srs, values, listeners, syncReasons, rpcCalls, practice, questions, setHistory: (value) => { history = value; } };
}

(async () => {
  const r = createRuntime(); const w = r.window;
  for (const service of ['LearningXPService','TamHoanqScoreService','QuestEngine','StreakProtectionService','EngagementQuickPracticeService','EngagementCoreSystem']) assert.ok(w[service], `${service} missing`);
  assert.throws(() => w.EngagementContentService.hydrate({ schemaVersion: 1, status: 'draft', verified: false }), /gate failed/);
  w.EngagementContentService.hydrate(content);

  r.progress.lessonProgress.lesson1 = { completed: true };
  const earned = w.LearningXPService.record({ activityType: 'lesson_completed', eventId: 'completed_lesson:learner-a:lesson1:first', referenceId: 'lesson1' });
  assert.equal(earned.awarded, 10); assert.equal(w.LearningXPService.total(), 10);
  assert.deepEqual(['event_id','user_id','activity_type','xp','created_at'].every((key) => Object.hasOwn(earned.event, key)), true);
  assert.equal(w.LearningXPService.record({ activityType: 'lesson_completed', eventId: earned.event.event_id, referenceId: 'lesson1' }).status, 'duplicate');
  assert.equal(w.LearningXPService.record({ activityType: 'lesson_completed', eventId: 'completed_lesson:learner-a:lesson1:again', referenceId: 'lesson1' }).reason, 'repetition-limit');
  assert.equal(w.LearningXPService.record({ activityType: 'listening_practice', eventId: 'listening_completed:fake', referenceId: 'fake' }).reason, 'learning-evidence-required');
  assert.equal(w.LearningXPService.record({ activityType: 'lesson_completed', eventId: 'wrong-prefix:1', referenceId: 'lesson1' }).reason, 'invalid-event');
  const firstSrs = w.LearningXPService.record({ activityType: 'srs_review', eventId: 'srs_updated:learner-a:w1:one', referenceId: 'w1' });
  const secondSrs = w.LearningXPService.record({ activityType: 'srs_review', eventId: 'srs_updated:learner-a:w1:two', referenceId: 'w1' });
  const thirdSrs = w.LearningXPService.record({ activityType: 'srs_review', eventId: 'srs_updated:learner-a:w1:three', referenceId: 'w1' });
  assert.equal(firstSrs.awarded, 2); assert.equal(secondSrs.awarded, 1); assert.equal(thirdSrs.reason, 'repetition-limit');

  assert.equal(w.TamHoanqScoreService.calculate().score, null);
  r.setHistory([{ id: 'p1', setId: 'set-1', skillBreakdown: { grammar: 60, listening: 50, reading: 70 } }, { id: 'p2', setId: 'set-2', skillBreakdown: { grammar: 80, listening: 70, reading: 90 } }]);
  r.progress.pronunciationAttempts.push({ id: 's1', score: 75 }); r.progress.writingSubmissions.push({ id: 'wrt1', preliminaryScore: 65 });
  const ability = w.TamHoanqScoreService.calculate(); assert.equal(ability.score, 72); assert.equal(ability.skillCoverage, 6); assert.equal(ability.xpIncluded, false); assert.equal(ability.aiJudgment, false); assert.notEqual(ability.confidence, 'insufficient');
  const abilityBeforeXp = JSON.stringify(ability); r.progress.lessonProgress.lesson2 = { completed: true }; w.LearningXPService.record({ activityType: 'lesson_completed', eventId: 'completed_lesson:learner-a:lesson2:first', referenceId: 'lesson2' }); assert.equal(JSON.stringify(w.TamHoanqScoreService.calculate()), abilityBeforeXp);

  w.DailyMissionService.complete(); const daily = w.QuestEngine.current().find((item) => item.type === 'daily'); assert.equal(daily.status, 'completed'); const claim = w.QuestEngine.claim(daily.id); assert.equal(claim.reward_type, 'xp'); assert.equal(w.QuestEngine.claim(daily.id), null); assert.equal(Object.hasOwn(claim, 'mastery'), false);
  const oldQuests = w.QuestEngine.refresh(new Date('2026-01-15T12:00:00Z')); w.QuestEngine.refresh(new Date('2026-02-15T12:00:00Z')); assert.ok(oldQuests.every((item) => w.QuestEngine.refresh(new Date('2026-02-15T12:00:00Z')).find((candidate) => candidate.id === item.id)?.status === 'expired' || item.status === 'claimed'));

  const reference = new Date(); const today = reference.toISOString(); const twoDaysAgo = new Date(reference.getTime() - 2 * day).toISOString();
  let store = r.values.get('engagement')['learner-a'][0]; store.xpEvents.push({ event_id: 'seed-old', user_id: 'learner-a', activity_type: 'srs_review', reference_id: 'old', xp: 1, created_at: twoDaysAgo }, { event_id: 'seed-now', user_id: 'learner-a', activity_type: 'srs_review', reference_id: 'now', xp: 1, created_at: today }); store.wallet.streakFreezes = 1; r.values.get('engagement')['learner-a'] = [store];
  assert.ok(w.StreakProtectionService.eligibleGap(reference)); assert.equal(w.StreakProtectionService.useFreeze(reference).protection_type, 'freeze'); assert.equal(w.StreakProtectionService.useFreeze(reference), null);
  store = r.values.get('engagement')['learner-a'][0]; store.protections = []; store.wallet.streakFreezes = 0; r.values.get('engagement')['learner-a'] = [store];
  assert.equal(w.StreakProtectionService.repair(reference).protection_type, 'repair'); assert.equal(w.StreakProtectionService.repair(reference), null); assert.equal(r.progress.stats.streak, 7);

  const plan = w.EngagementQuickPracticeService.plan(10); assert.equal(plan.minutes, 10); assert.equal(plan.continuous, true); assert.equal(plan.engine, 'existing-practice-service'); assert.ok(plan.questions.length > 0); assert.equal(w.EngagementQuickPracticeService.start(15), true); assert.equal(r.practice.started.source, 'engagement-quick');
  assert.deepEqual(content.practiceCenter.map((item) => item.id), ['mistakes','vocabulary','grammar','listening','speaking','writing','topik','quick']);

  r.progress.lessonProgress.offline = { completed: true }; const offline = w.LearningXPService.record({ activityType: 'lesson_completed', eventId: 'completed_lesson:learner-a:offline:first', referenceId: 'offline' }); assert.equal(offline.event.sync_status, 'pending');
  w.navigator.onLine = true; w.SupabaseService = { client: { rpc: async (name, args) => { r.rpcCalls.push({ name, args }); return { data: name === 'record_learning_xp' ? 10 : true, error: null }; } } };
  const syncResult = await w.LearningXPService.syncPending(); assert.ok(syncResult.synced > 0); assert.ok(r.rpcCalls.some((item) => item.name === 'record_learning_xp')); assert.equal(w.LearningXPService.pending().length, 0);
  const aCount = w.LearningXPService.events().length; r.state.currentUser = { id: 'learner-b', currentTopikLevel: 1 }; assert.equal(w.LearningXPService.events().length, 0); r.state.currentUser = { id: 'learner-a', currentTopikLevel: 1 }; assert.equal(w.LearningXPService.events().length, aCount); assert.equal(r.progress.marker, 'keep-progress'); assert.equal(r.srs[0].wordId, 'w1');

  const app = read('app.js'); const index = read('index.html'); const worker = read('sw.js'); const css = read('engagement-core.css'); const migration = read('supabase/migrations/20260913_p72a_engagement_core.sql'); const report = read('P72A_ENGAGEMENT_CORE_REPORT.md');
  assert.match(app, /engagement: 'klearn_engagement_core'/); assert.match(app, /mergeEngagement/); assert.match(app, /speaking_completed/); assert.match(app, /writing_completed/); assert.match(app, /listening_completed/); assert.match(app, /topik_completed/);
  assert.match(index, /engagement-core\.css\?v=1/); assert.match(index, /data\/engagement-core\.js\?v=1/); assert.match(worker, /klearn-v90/); assert.match(worker, /content\/engagement-core\.json/); assert.match(css, /@media \(max-width: 600px\)/);
  for (const table of ['learning_xp_events','engagement_quest_claims','streak_protection_events']) { assert.match(migration, new RegExp(`create table if not exists public\\.${table}`)); assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`)); }
  assert.match(migration, /record_learning_xp/); assert.match(migration, /pg_advisory_xact_lock/); assert.match(migration, /dailyCap|300 - today_total/); assert.match(migration, /revoke insert, update, delete on public\.learning_xp_events/);
  for (const heading of ['# P72A ENGAGEMENT CORE REPORT','## 1. XP system','## 2. Score system','## 3. Quest system','## 4. Streak system','## 5. Practice Center','## 6. Anti-gaming','## 7. Offline','## 8. Tests','## 9. Remaining risks','## 10. Git SHA']) assert.match(report, new RegExp(heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  console.log('P72A XP, ability score, quest, streak protection, practice routing, offline sync and user isolation passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
