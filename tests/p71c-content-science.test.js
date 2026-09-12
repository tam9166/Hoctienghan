const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const content = JSON.parse(read('content/content-science-system.json'));
const clone = (value) => JSON.parse(JSON.stringify(value));

function createRuntime() {
  const values = new Map(); const sync = []; const tracked = []; const rpcCalls = []; const listeners = {};
  const oldDate = new Date(Date.now() - 35 * 86400000).toISOString();
  const state = {
    currentUser: { id: 'learner-a', email: 'private@example.test', currentTopikLevel: 1 },
    currentView: 'analytics',
    srsData: []
  };
  const progress = {
    regressionMarker: 'keep-progress',
    lessonProgress: {
      'lesson-first-introduction': { completed: true, score: 72, masteryScore: 76, completedAt: oldDate, updatedAt: oldDate }
    },
    skills: { listening: 42, grammar: 68 }
  };
  const srs = [
    { wordId: 'freq-학교', reviewCount: 5, correctCount: 4, wrongCount: 1, mastery: 80, activatedAt: oldDate, lastReviewed: oldDate },
    { wordId: 'freq-학생', reviewCount: 4, correctCount: 2, wrongCount: 2, mastery: 50, activatedAt: oldDate, lastReviewed: oldDate }
  ];
  state.srsData = srs;
  const scoped = (key) => values.get(key)?.[state.currentUser.id] || [];
  const saveScoped = (key, items, limit = 100) => { const all = values.get(key) || {}; all[state.currentUser.id] = items.slice(0, limit); values.set(key, all); };
  const privacy = { telemetry: true }; const consent = { value: true };
  const window = {
    KLEARN_APP: {
      state,
      STORAGE_KEYS: { contentScience: 'p71c', contentFeedback: 'feedback' },
      userScoped: scoped,
      saveUserScoped: saveScoped,
      getUserProgress: () => progress,
      getUserSrs: () => srs,
      LearnerProfileService: { get: () => ({ skillScores: progress.skills }) },
      CloudSyncService: { schedule: (reason) => sync.push(reason) },
      PrivacyPreferenceService: { allows: (name) => name !== 'telemetry' || privacy.telemetry },
      setView(view) { state.currentView = view; }, render() {}, toast() {}, escapeHtml: String
    },
    AdvancedContentService: { byId: (id) => id === 'lesson-dynamic' ? { id, type: 'lesson' } : null },
    SkillGrowthService: { calculate: () => ({ listening: { skill: 'listening', current: 55, previous: 40, delta: 15, series: [] } }) },
    UserResearchService: { consent: { enabled: () => consent.value }, segment: () => 'topik_learner', track: (...args) => tracked.push(args) },
    SupabaseService: { client: { rpc: async (name, args) => { rpcCalls.push({ name, args }); return { error: null }; } } },
    KLEARN_EXTRA_VIEWS: {}, KLEARN_AFTER_RENDER: null, document: null,
    addEventListener: (name, handler) => { listeners[name] = handler; }
  };
  window.window = window;
  vm.runInNewContext(read('data/content-science-system.js'), { window, console, Date, Math, JSON, Object, Array, Number, String, Boolean, Set, Map, Promise, FormData: class {} });
  window.ContentScienceContentService.hydrate(content);
  return { window, state, values, progress, srs, sync, tracked, rpcCalls, listeners, privacy, consent };
}

(async () => {
  const runtime = createRuntime(); const w = runtime.window;
  for (const service of ['ContentScienceContentService', 'VerifiedContentService', 'ContentQualityScoreService', 'ContentEffectivenessService', 'ContentRetentionAnalyticsService', 'LearningCurveService', 'ContentScienceFeedbackService', 'AnonymousLearningStatisticsService', 'ContentScienceSystem']) assert.ok(w[service], `${service} missing`);

  assert.throws(() => w.ContentScienceContentService.hydrate({ schemaVersion: 1, status: 'draft', verified: false, reviews: [] }), /trust gate/);
  w.ContentScienceContentService.hydrate(content);
  assert.equal(w.VerifiedContentService.all().length, 5);
  const cafe = w.VerifiedContentService.metadata('lesson-cafe-order');
  assert.equal(cafe.verified, true); assert.equal(cafe.quality.score, 95); assert.equal(Object.keys(cafe.quality.dimensions).length, 4); assert.match(cafe.disclosure, /Internal curriculum review/);
  const unknown = w.VerifiedContentService.metadata('unknown-content');
  assert.equal(unknown.verified, false); assert.equal(unknown.quality.score, null); assert.match(unknown.disclosure, /không hiển thị nhãn Verified/);

  const progressBefore = clone(runtime.progress); const srsBefore = clone(runtime.srs);
  w.ContentEffectivenessService.bootstrap();
  assert.ok(w.ContentEffectivenessService.events().some((item) => item.evidenceType === 'studied'));
  assert.ok(w.ContentEffectivenessService.events().some((item) => item.evidenceType === 'improved'));
  assert.equal(w.ContentEffectivenessService.events().filter((item) => item.evidenceType === 'remembered').length, 2);
  assert.deepEqual(runtime.progress, progressBefore); assert.deepEqual(runtime.srs, srsBefore);
  w.ContentEffectivenessService.record('grammar-topic-particle', 'remembered', { score: 60, outcome: 'forgot', at: '2026-08-01T00:00:00.000Z', signature: 'grammar-old' });
  w.ContentEffectivenessService.record('grammar-topic-particle', 'used', { score: 90, outcome: 'completed', at: '2026-09-01T00:00:00.000Z', signature: 'grammar-new' });
  const grammarSummary = w.ContentEffectivenessService.summary('grammar-topic-particle');
  assert.equal(grammarSummary.studied, 0); assert.equal(grammarSummary.remembered, 1); assert.equal(grammarSummary.used, 1); assert.equal(grammarSummary.retention, 0); assert.equal(grammarSummary.improvement, 30);
  runtime.listeners['klearn-sync-action']({ detail: { type: 'practice_completed', entityId: 'practice-real-usage', score: 88, mutationId: 'mutation-1' } });
  assert.equal(w.ContentEffectivenessService.summary('practice-real-usage').used, 1);

  const retention = w.ContentRetentionAnalyticsService.report();
  assert.equal(retention.vocabulary.score, 65); assert.equal(retention.vocabulary.sampleSize, 2); assert.equal(retention.grammar.score, 75); assert.equal(retention.grammar.sampleSize, 2); assert.equal(retention.skills.listening.delta, 15);
  const curve = w.LearningCurveService.points(); assert.ok(curve.length >= 3); assert.equal(curve[0].day, 1); assert.ok(curve.at(-1).vocabulary >= 2);

  assert.deepEqual([...w.ContentScienceFeedbackService.types().map((item) => item.id)], ['wrong_meaning', 'confusing_example', 'broken_audio']);
  const issue = w.ContentScienceFeedbackService.submit({ contentId: 'lesson-cafe-order', reportType: 'confusing_example', message: 'Ví dụ thứ hai chưa rõ ngữ cảnh.' });
  assert.equal(issue.userId, 'learner-a'); assert.equal(issue.status, 'received'); assert.equal(w.ContentScienceFeedbackService.all().length, 1); assert.ok(runtime.tracked.some(([name]) => name === 'feedback_submitted'));
  assert.throws(() => w.ContentScienceFeedbackService.submit({ contentId: 'missing', reportType: 'wrong_meaning', message: 'Sai.' }), /Không tìm thấy/);

  runtime.consent.value = false;
  assert.equal(w.AnonymousLearningStatisticsService.payload().status, 'disabled');
  runtime.consent.value = true; runtime.privacy.telemetry = true;
  const projection = w.AnonymousLearningStatisticsService.payload('grammar-topic-particle');
  assert.equal(projection.status, 'ready');
  const serialized = JSON.stringify(projection.payload);
  for (const forbidden of ['learner-a', 'private@example.test', 'password', 'token', 'freeText', 'audio', 'transcript', 'journal', 'ipAddress', 'deviceId']) assert.equal(serialized.includes(forbidden), false, `private field leaked: ${forbidden}`);
  assert.deepEqual(Object.keys(projection.payload).sort(), [...content.research.allowedFields].sort());
  assert.equal(w.AnonymousLearningStatisticsService.payload('private@example.test').payload.contentId, 'all');
  const submitted = await w.AnonymousLearningStatisticsService.submit('grammar-topic-particle');
  assert.equal(submitted.submitted, true); assert.equal(runtime.rpcCalls[0].name, 'submit_anonymous_content_science'); assert.deepEqual(runtime.rpcCalls[0].args.p_payload, projection.payload);

  runtime.state.currentUser = { id: 'learner-b', currentTopikLevel: 0 };
  assert.equal(w.ContentEffectivenessService.events().length, 0); assert.equal(w.ContentScienceFeedbackService.all().length, 0);
  runtime.state.currentUser = { id: 'learner-a', currentTopikLevel: 1 };
  assert.ok(w.ContentEffectivenessService.events().length > 0); assert.equal(w.ContentScienceFeedbackService.all().length, 1); assert.ok(runtime.sync.includes('p71c-content-feedback'));

  const appSource = read('app.js'); const loader = read('data/route-loader.js'); const worker = read('sw.js'); const css = read('content-science.css');
  const migration = read('supabase/migrations/20260912_p71c_content_science.sql'); const report = read('docs/P71C_CONTENT_SCIENCE_REPORT.md');
  assert.match(appSource, /contentScience: 'klearn_content_science'/); assert.match(appSource, /STORAGE_KEYS\.contentScience/); assert.match(appSource, /\[STORAGE_KEYS\.contentScience\]: 600/);
  assert.match(loader, /content-science\.css\?v=1/); assert.match(loader, /data\/content-science-system\.js\?v=1/); assert.match(loader, /dependencies: \['contentQuality', 'advancedAnalytics', 'outcomes'\]/);
  assert.match(worker, /klearn-v88/); assert.match(worker, /content\/content-science-system\.json/); assert.match(css, /@media\(max-width:600px\)/); assert.match(css, /@media\(max-width:380px\)/);
  for (const table of ['content_science_reviews', 'content_learning_effectiveness_events', 'content_science_issue_reports', 'anonymous_content_science_aggregates']) { assert.match(migration, new RegExp(`create table if not exists public\\.${table}`)); assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`)); }
  assert.ok((migration.match(/user_id = auth\.uid\(\)/g) || []).length >= 4); assert.match(migration, /Sensitive field rejected/); assert.match(migration, /Unexpected field rejected/); assert.match(migration, /Invalid aggregate identity/); assert.match(migration, /revoke insert, update, delete on public\.anonymous_content_science_aggregates/); assert.match(migration, /grant execute on function public\.submit_anonymous_content_science/);
  const aggregateDefinition = migration.match(/create table if not exists public\.anonymous_content_science_aggregates[\s\S]*?\n\);/)[0];
  assert.doesNotMatch(aggregateDefinition, /user_id|email|password|token|free_text|audio|transcript|journal|ip_address|device_id/i);
  for (const heading of ['# P71C CONTENT SCIENCE REPORT', '## Verified Content', '## Quality Score', '## Learning Analytics', '## Retention', '## Feedback Loop', '## Testing', '## Git']) assert.match(report, new RegExp(heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  console.log('P71C verification, quality, outcome evidence, retention, feedback, consent privacy and user isolation passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
