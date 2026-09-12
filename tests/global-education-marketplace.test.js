const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'data', 'global-education-marketplace.js'), 'utf8');
const content = JSON.parse(fs.readFileSync(path.join(root, 'content', 'global-education-marketplace.json'), 'utf8'));
const migration = fs.readFileSync(path.join(root, 'supabase', 'migrations', '20260906_p45_global_education_marketplace.sql'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8') + fs.readFileSync(path.join(root, 'data', 'route-loader.js'), 'utf8');
const worker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const appSource = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

function boot(userId = 'p45-student', initialRole = 'student') {
  const scoped = new Map(); const syncEvents = []; let activeRole = initialRole;
  const state = { currentUser: { id: userId, goals: ['conversation'], onboardingCompleted: true }, currentView: 'global-education-marketplace' };
  const userScoped = (key) => (scoped.get(key) || {})[state.currentUser.id] || [];
  const saveUserScoped = (key, value) => { const all = scoped.get(key) || {}; all[state.currentUser.id] = value; scoped.set(key, all); };
  const window = {
    document: null, location: { assign: () => {} }, KLEARN_EXTRA_VIEWS: {}, KLEARN_AFTER_RENDER: null,
    RolePermissionService: { role: () => activeRole }, GlobalSearchService: { search: () => ({ studyTools: [] }) },
    KLEARN_APP: {
      state, STORAGE_KEYS: { globalEducationMarketplace: 'p45-marketplace' }, userScoped, saveUserScoped,
      CloudSyncService: { schedule: (reason) => syncEvents.push(reason) }, LearnerProfileService: { get: () => ({ goal: 'conversation', weakSkills: ['listening'] }) },
      AccessControlService: { role: () => activeRole }, setView: (view) => { state.currentView = view; }, render: () => {}, toast: () => {}, escapeHtml: String
    }, console
  };
  const context = { window, console, Date, String, Number, Object, Array, Math, Set, Map, Promise, JSON, Intl, URL, FormData: class {} };
  vm.createContext(context); vm.runInContext(source, context); window.GlobalEducationMarketplace.content.hydrate(content);
  return { window, state, scoped, syncEvents, setRole: (value) => { activeRole = value; } };
}

(async () => {
  assert.equal(content.verified, true); assert.equal(content.reviewStatus, 'approved'); assert.equal(content.version, '1.0.0');
  assert.deepEqual(content.supportedLanguages.map((item) => item.id), ['ko', 'ja', 'zh', 'en']);
  assert.equal(content.supportedLanguages.filter((item) => item.status === 'active').length, 1);
  assert.equal(content.courses.length, 5); assert.ok(content.courses.every((item) => item.verified && item.status === 'approved'));
  assert.deepEqual(content.creator.allowedTypes, ['lesson', 'vocabulary', 'practice']);
  assert.equal(content.creator.creatorCanSelfPublish, false); assert.equal(content.checkout.clientCanGrantOwnership, false); assert.equal(content.revenueSharing.clientCanMarkPaid, false);

  const app = boot(); const market = app.window.GlobalEducationMarketplace;
  assert.equal(market.courses.catalog().length, 5); assert.equal(market.teachers.all().length, 3);
  const profile = market.teachers.publicProfile('teacher-minji'); assert.equal(profile.name, 'Kim Min-ji'); assert.equal('email' in profile, false); assert.equal('paymentAccount' in profile, false); assert.equal('legalName' in profile, false);
  assert.equal(market.courses.filtered('conversation').length, 1); assert.equal(market.courses.filtered('speaking').length, 1);
  assert.match(market.recommendations.recommend(1)[0].reasons.join(' '), /listening|mục tiêu/);

  assert.equal(market.reviews.submit({ courseId: 'global-hangul-foundation', quality: 5, difficulty: 2 }).ok, false);
  const free = await market.courses.acquire('global-hangul-foundation'); assert.equal(free.ok, true); assert.equal(free.status, 'enrolled'); assert.equal(market.courses.progress('global-hangul-foundation'), 0);
  assert.equal(market.courses.updateProgress('global-hangul-foundation', 60), 60); assert.equal(market.courses.updateProgress('global-hangul-foundation', 40), 60, 'progress must not move backward');
  assert.equal(market.reviews.submit({ courseId: 'global-hangul-foundation', quality: 6, difficulty: 2 }).ok, false);
  assert.equal(market.reviews.submit({ courseId: 'global-hangul-foundation', quality: 5, difficulty: 2, comment: 'Rõ ràng' }).ok, true);
  assert.equal(market.reviews.submit({ courseId: 'global-hangul-foundation', quality: 4, difficulty: 3, comment: 'Cập nhật' }).ok, true);
  assert.equal(market.reviews.mine().length, 1, 'one review per course');
  assert.equal(market.checkout.confirmFromClient().ownershipGranted, false); assert.equal(market.checkout.confirmFromClient().reason, 'signed-webhook-required');
  assert.equal(market.revenue.markPaidFromClient().paid, false); assert.equal(market.courses.catalog().filter((item) => market.courses.progress(item.id) > 0).length, 1);
  const paid = await market.courses.acquire('global-topik-one'); assert.equal(paid.ok, false); assert.equal(paid.reason, 'cloud-required');
  let checkoutBody = null; app.window.SupabaseService = { session: { user: { id: 'cloud-p45' } } }; app.window.fetch = async (url, options) => { checkoutBody = JSON.parse(options.body); return { ok: true, json: async () => ({ checkoutId: 'checkout-server-1', checkoutUrl: 'https://payments.example.test/checkout/1' }) }; };
  const checkout = await market.courses.acquire('global-topik-one'); assert.equal(checkout.ok, true); assert.equal(checkout.ownershipGranted, false); assert.equal(checkout.checkoutUrl, 'https://payments.example.test/checkout/1'); assert.equal(checkoutBody.courseId, 'global-topik-one'); assert.ok(checkoutBody.idempotencyKey); assert.equal(market.courses.progress('global-topik-one'), 0);

  assert.equal(market.certificates.issue('global-hangul-foundation'), null); market.courses.updateProgress('global-hangul-foundation', 100);
  const certificate = market.certificates.issue('global-hangul-foundation'); assert.equal(certificate.status, 'local-preview'); assert.equal(certificate.backendSignatureRequired, true); assert.equal(certificate.progressEvidence, 100);
  assert.ok(app.syncEvents.includes('global-education-marketplace'));

  assert.equal(market.creator.create({ type: 'lesson', title: 'Bài giao tiếp', language: 'ko' }).ok, false);
  app.setRole('teacher');
  const courseDraft = market.creator.createCourse({ title: 'Korean for Hospitality', language: 'ko', difficulty: 'Intermediate', price: 550000, description: 'Khóa học theo tình huống nghề nghiệp.' }); assert.equal(courseDraft.ok, true); assert.equal(courseDraft.draft.type, 'course'); assert.equal(courseDraft.draft.price, 550000); assert.equal(courseDraft.draft.creatorCanSelfPublish, false);
  assert.equal(market.creator.create({ type: 'video', title: 'Nội dung sai', language: 'ko' }).ok, false);
  const draft = market.creator.create({ type: 'lesson', title: 'Giao tiếp tại nhà ga', language: 'ko', difficulty: 'Beginner', description: 'Mục tiêu hội thoại rõ ràng.' }); assert.equal(draft.ok, true); assert.equal(draft.draft.status, 'draft');
  const submitted = market.creator.submit(draft.draft.id); assert.equal(submitted.ok, true); assert.equal(submitted.draft.status, 'in_review'); assert.equal(submitted.published, false);
  assert.equal(market.creator.publishFromClient().published, false); assert.equal(market.moderation.canModerate(), false);
  const split = market.revenue.estimate(1000000); assert.deepEqual([split.creatorShare, split.platformShare], [700000, 300000]);
  app.setRole('content_editor'); assert.equal(market.moderation.canModerate(), true); assert.equal(market.moderation.queue().length, 1); assert.equal((await market.moderation.decide(draft.draft.id, 'approve')).reason, 'cloud-required'); assert.equal(market.moderation.publishFromClient().published, false);

  assert.equal(market.community.connectTeacher('teacher-junho'), true); assert.equal(app.state.currentView, 'learning-community'); assert.equal(market.community.askCourse('global-topik-one'), true); assert.equal(app.state.currentView, 'community-questions');
  assert.equal(app.window.GlobalSearchService.search('khóa học').studyTools.some((item) => item.route === 'global-education-marketplace'), true);
  for (const route of ['global-education-marketplace','marketplace-course','marketplace-teacher','creator-studio','marketplace-moderation','creator-revenue','marketplace-certificates']) assert.equal(typeof app.window.KLEARN_EXTRA_VIEWS[route], 'function', `${route} missing`);

  const other = boot('p45-other'); other.window.GlobalEducationMarketplace.content.hydrate(content); assert.equal(other.window.GlobalEducationMarketplace.courses.progress('global-hangul-foundation'), 0); assert.equal(other.window.GlobalEducationMarketplace.reviews.mine().length, 0);

  for (const table of ['global_marketplace_teacher_profiles','global_marketplace_courses','global_marketplace_creator_content','global_marketplace_orders','global_marketplace_ownerships','global_marketplace_reviews','global_marketplace_revenue_ledger','global_marketplace_certificates','global_marketplace_moderation_log']) assert.match(migration, new RegExp(table));
  assert.match(migration, /enable row level security/gi); assert.match(migration, /auth\.uid\(\)/); assert.match(migration, /No browser insert\/update policy/); assert.match(migration, /signed by the backend/i); assert.doesNotMatch(migration, /create policy[^;]+global_marketplace_orders for insert/is); assert.doesNotMatch(migration, /create policy[^;]+global_marketplace_revenue_ledger for (insert|update)/is);
  assert.match(index, /global-education-marketplace\.css\?v=1/); assert.match(index, /data\/global-education-marketplace\.js\?v=1/); assert.match(index, /app\.js\?v=72/);
  assert.match(worker, /klearn-v86/); assert.match(worker, /content\/global-education-marketplace\.json/); assert.match(appSource, /globalEducationMarketplace: 'klearn_global_education_marketplace'/); assert.match(appSource, /STORAGE_KEYS\.globalEducationMarketplace/);
  console.log('global education marketplace: catalog, verified teachers, purchase boundary, creator review, revenue split, certificates, recommendations, community, globalization and RLS passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
