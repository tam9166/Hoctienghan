const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'data', 'product-growth.js'), 'utf8');
const content = JSON.parse(fs.readFileSync(path.join(root, 'content', 'product-growth.json'), 'utf8'));
const appSource = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const routes = fs.readFileSync(path.join(root, 'data', 'route-loader.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const locales = ['vi.js', 'en.js', 'zh-CN.js'].map((file) => fs.readFileSync(path.join(root, 'locales', file), 'utf8')).join('\n');
const worker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const migration = fs.readFileSync(path.join(root, 'supabase', 'migrations', '20260909_p53_product_growth.sql'), 'utf8');
const daysAgo = (days) => new Date(Date.now() - days * 86400000).toISOString();

function boot({ evidence = true } = {}) {
  const values = new Map(); const tracked = []; const copied = []; const experimentLogs = [];
  const state = { currentUser: { id: 'growth-user', fullName: 'Growth QA', onboardingCompleted: true, createdAt: daysAgo(40) }, currentView: 'home', srsData: evidence ? [{ wordId: 'school', lastReviewed: daysAgo(39), correctCount: 1, mastery: 80 }] : [], lessonProgress: {} };
  const progress = { lessonProgress: evidence ? { hangul: { completed: true, completedAt: daysAgo(33) } } : {}, stats: {}, skills: {} };
  const history = evidence ? [
    { id: 'activation', completedAt: daysAgo(39), percentage: 70, skillBreakdown: { vocabulary: 70 } },
    { id: 'return-7', completedAt: daysAgo(33), percentage: 76, skillBreakdown: { grammar: 76 } },
    { id: 'return-30', completedAt: daysAgo(10), percentage: 82, skillBreakdown: { listening: 82 } }
  ] : [];
  const userScoped = (key) => { const all = values.get(key); return Array.isArray(all?.[state.currentUser.id]) ? all[state.currentUser.id] : []; };
  const saveUserScoped = (key, items) => { const all = values.get(key) || {}; all[state.currentUser.id] = items; values.set(key, all); };
  const document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] };
  const experimentDefinitions = [];
  const window = {
    KLEARN_APP: { state, STORAGE_KEYS: { productGrowth: 'growth-store' }, userScoped, saveUserScoped, getUserProgress: () => progress, PracticeService: { getHistory: () => history }, AccessControlService: { role: () => 'student' }, CloudSyncService: { schedule: () => {} }, escapeHtml: String, setView: (view) => { state.currentView = view; }, render: () => {}, toast: () => {} },
    KLEARN_USER_RESEARCH_CONTENT: { experiments: experimentDefinitions },
    UserResearchService: { track: (event, properties) => { tracked.push({ event, properties }); }, consent: { get: () => 'granted' }, all: () => ({ surveys: [{ questionId: 'learning-blocker', answer: 'time' }] }), dropOffs: () => ({ onboarding: 2 }) },
    ExperimentService: { assignment: (id) => ({ experimentId: id, variant: 'control' }), log: (value) => { experimentLogs.push(value); return value; } },
    LearningOutcomeService: { current: () => ({ evidence: evidence ? [{ key: 'first-hangul', title: 'Đọc được Hangul đầu tiên', achievedAt: daysAgo(33) }] : [] }) },
    SharedAchievementService: { available: () => [], share: () => ({ status: 'private-preview' }) },
    KLEARN_EXTRA_VIEWS: {}, KLEARN_AFTER_RENDER: null, document, location: { href: 'https://app.test/?ref=THFRIEND01&utm_source=referral&utm_medium=invite#home', origin: 'https://app.test' }, navigator: { clipboard: { writeText: async (value) => { copied.push(value); } } }, addEventListener: () => {}, clearTimeout, setTimeout, console
  };
  const context = { window, document, URL, console, Date, String, Number, Object, Array, Math, Set, Map, RegExp, JSON, Promise, clearTimeout, setTimeout };
  vm.createContext(context); vm.runInContext(source, context);
  window.ProductGrowthService.content.hydrate(content);
  return { window, values, tracked, copied, experimentLogs };
}

(async () => {
  assert.equal(content.verified, true);
  assert.equal(content.privacy.storesRecipientContact, false);
  assert.deepEqual(content.retentionCheckpoints, [1, 7, 30]);
  const fixture = boot(); const growth = fixture.window.ProductGrowthService;
  assert.ok(growth);
  assert.equal(growth.acquisition.get().source, 'referral');
  assert.equal(growth.acquisition.get().referralCode, 'THFRIEND01');
  assert.equal(growth.activation.status().activated, true);
  assert.equal(growth.activation.status().activation.evidenceType, 'practice_passed');
  assert.deepEqual(Array.from(growth.retention.checkpoints(), (item) => item.retained), [true, true, true]);
  const invite = await growth.referrals.create('study_partner', 'copy');
  assert.equal(invite.type, 'study_partner');
  assert.match(invite.link, /ref=TH/);
  assert.equal(Object.hasOwn(invite, 'recipientEmail'), false);
  const shared = await growth.achievements.share('first-hangul');
  assert.equal(shared.containsScore, false);
  assert.ok(fixture.copied[0].includes('Hangul'));
  assert.equal(growth.churn.analyze().status, 'at_risk');
  assert.ok(growth.churn.analyze().reasons.includes('time'));
  assert.ok(growth.churn.analyze().reasons.includes('drop:onboarding'));
  assert.equal(growth.analytics.snapshot().conversion.activated, true);
  assert.equal(growth.experiments.all().length, 3);
  assert.equal(growth.experiments.all()[0].measurement, 'consented');
  assert.ok(growth.experiments.log('growth_home_cta', 'positive', 'lesson_start', 1));
  assert.equal(fixture.experimentLogs.length, 1);
  assert.ok(fixture.tracked.some((item) => item.properties?.feature === 'first_successful_learning_moment'));
  for (const view of ['growth-center', 'invite-friends', 'growth-analytics', 'product-experiments']) assert.equal(typeof fixture.window.KLEARN_EXTRA_VIEWS[view], 'function');

  const empty = boot({ evidence: false }).window.ProductGrowthService;
  assert.equal(empty.activation.status().activated, false);
  assert.equal(empty.analytics.snapshot().conversion.activated, false);

  assert.match(appSource, /productGrowth: 'klearn_product_growth'/);
  assert.match(appSource, /welcome\.value/);
  assert.match(locales, /Bắt đầu đúng trình độ/);
  assert.match(locales, /Start at the right level/);
  assert.match(routes, /data\/product-growth\.js\?v=1/);
  assert.match(routes, /routes\('home', \['growth'\]\)/);
  assert.match(index, /app\.js\?v=60/);
  assert.match(worker, /klearn-v74/);
  assert.match(worker, /app\.js\?v=60/);
  assert.match(worker, /content\/product-growth\.json/);
  assert.match(migration, /product_growth_referral_codes/);
  assert.match(migration, /referrer_id <> referred_user_id/);
  assert.match(migration, /row level security/i);
  assert.match(migration, /has_any_role\(array\['admin'\]\)/);
  console.log('product growth: referral, invite, achievement sharing, activation, retention, churn, re-engagement, attribution, experiments and aggregate RLS passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
