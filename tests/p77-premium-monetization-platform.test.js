#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const config = JSON.parse(read('content/premium-monetization-platform.json'));
const source = read('data/premium-monetization-platform.js');
const migration = read('supabase/migrations/20260917_p77_premium_monetization_platform.sql');

function boot({ rawRole = 'student', projection = { plan: 'free', status: 'active', serverVerified: true }, authenticated = true } = {}) {
  const records = new Map(); const requests = []; let currentProjection = projection;
  const state = { currentUser: { id: 'p77-user', fullName: 'P77 User' }, currentView: 'home' };
  const storage = { get(key, fallback) { return records.has(key) ? structuredClone(records.get(key)) : structuredClone(fallback); }, set(key, value) { records.set(key, structuredClone(value)); return true; } };
  const document = { querySelector: () => null, querySelectorAll: () => [] };
  const window = {
    document, KLEARN_EXTRA_VIEWS: {}, KLEARN_AFTER_RENDER: null,
    SupabaseService: authenticated ? { session: { access_token: 'server-token', user: { id: 'p77-user' } } } : { session: null },
    ServerEntitlementService: { current: () => currentProjection, acceptServerProjection(value) { currentProjection = { ...value, serverVerified: true }; return currentProjection; } },
    KLEARN_APP: { state, storage, escapeHtml: String, render() {}, setView(view) { state.currentView = view; }, toast() {}, AccessControlService: { role: () => rawRole } },
    fetch: async (url, options = {}) => {
      requests.push({ url, options });
      if (url.includes('/api/commerce/access')) return { ok: true, status: 200, json: async () => ({ allowed: true, reason: 'active_subscription', source: 'server', serverVerified: true }) };
      if (url.includes('/api/billing/trial')) return { ok: true, status: 200, json: async () => ({ subscription: { plan: 'premium', status: 'trial', end_date: '2099-01-01T00:00:00Z' }, autoCharge: false, autoRenew: false }) };
      if (url.includes('/api/billing/checkout')) return { ok: true, status: 200, json: async () => ({ provider: 'mock', status: 'pending', entitlementChanged: false }) };
      if (url.includes('/api/commerce/catalog')) return { ok: true, status: 200, json: async () => ({ courses: [] }) };
      if (url.includes('/api/commerce/purchases')) return { ok: true, status: 200, json: async () => ({ purchases: [{ id: 'purchase-1', course_id: '11111111-1111-1111-1111-111111111111', price: 199000, currency: 'VND', purchased_at: '2026-09-17T00:00:00Z', status: 'completed', provider: 'mock', payment_id: 'mock_transaction_1' }] }) };
      if (url.includes('/api/commerce/purchase')) return { ok: true, status: 200, json: async () => ({ purchase: { status: 'completed' }, unlocked: true, cardDataStored: false, paymentSecretStored: false }) };
      if (url.includes('/api/commerce/dashboard')) return { ok: true, status: 200, json: async () => ({ dashboard: { courseCount: 2, salesCount: 4, revenueEstimate: 557200 }, aggregateOnly: true, includesPrivateLearnerData: false }) };
      return { ok: true, status: 200, json: async () => config };
    }
  };
  window.window = window;
  const context = { window, document, console, Date, Intl, Math, JSON, Object, Array, Number, String, Boolean, RegExp, Set, Map, Promise, Symbol, structuredClone, setTimeout, fetch: window.fetch };
  vm.runInNewContext(source, context); window.P77MonetizationConfigService.hydrate(config);
  return { window, state, records, requests, setProjection(value) { currentProjection = value; } };
}

async function main() {
  assert.deepEqual(config.plans.map((plan) => plan.id), ['free','premium','teacher_pro']);
  assert.deepEqual(config.subscriptionStatuses, ['trial','active','expired','cancelled','pending']);
  assert.equal(config.principles.coreLearningAlwaysFree, true);
  assert.equal(config.principles.existingLearningDataNeverLocked, true);
  assert.equal(config.principles.serverAuthoritativeAccess, true);
  assert.equal(config.principles.storesCardData, false);
  assert.equal(config.payments.activeProvider, 'mock');
  assert.deepEqual(config.payments.interface, ['createCheckout','verifyTransaction','refund','normalizeEvent']);
  assert.deepEqual(config.trial.events, ['trial_started','trial_completed','trial_expired','converted']);

  const rt = boot(); const w = rt.window;
  ['P77SubscriptionService','BackendEntitlementService','PaymentProviderService','PremiumTrialLifecycleService','PremiumCourseService','PurchaseHistoryService','CreatorRevenueFoundationService','BusinessDashboardService','ConversionAnalyticsService'].forEach((name) => assert.ok(w[name], `${name} missing`));
  assert.equal(w.P77SubscriptionService.current().effectivePlan, 'free');
  assert.equal(w.P77SubscriptionService.can('beginner_foundation'), true);
  assert.equal(w.BackendEntitlementService.preview({ accessLevel: 'free' }).allowed, true);
  assert.equal(w.BackendEntitlementService.preview({ accessLevel: 'premium' }).allowed, false);
  assert.equal(w.BackendEntitlementService.clientCanGrant(), false);
  assert.equal(w.PaymentProviderService.confirmOnClient().entitlementChanged, false);
  assert.equal(w.PaymentProviderService.storesSensitivePaymentData(), false);

  rt.setProjection({ plan: 'premium', status: 'active', endDate: '2099-01-01T00:00:00Z', serverVerified: true });
  assert.equal(w.P77SubscriptionService.current().effectivePlan, 'premium');
  assert.equal(w.P77SubscriptionService.can('advanced_topik'), true);
  assert.equal(w.P77SubscriptionService.can('course_management'), false);
  assert.equal((await w.BackendEntitlementService.verify({ resourceType: 'course', resourceId: '11111111-1111-1111-1111-111111111111', accessLevel: 'premium' })).serverVerified, true);

  rt.setProjection({ plan: 'teacher_pro', status: 'active', endDate: '2099-01-01T00:00:00Z', serverVerified: true });
  assert.equal(w.P77SubscriptionService.can('student_analytics'), true);
  assert.equal(w.P77SubscriptionService.can('advanced_topik'), false);
  rt.setProjection({ plan: 'premium', status: 'expired', endDate: '2020-01-01T00:00:00Z', serverVerified: true });
  assert.equal(w.P77SubscriptionService.current().effectivePlan, 'free');
  assert.equal(w.P77SubscriptionService.can('basic_srs'), true, 'expiry must preserve free learning');
  assert.equal(w.P77SubscriptionService.normalize({ plan: 'premium', status: 'pending' }).effectivePlan, 'free');
  assert.equal(w.P77SubscriptionService.normalize({ plan: 'pro', status: 'active' }).effectivePlan, 'premium', 'legacy P67 pro remains compatible');

  rt.setProjection({ plan: 'free', status: 'active', serverVerified: true });
  const trial = await w.PremiumTrialLifecycleService.start();
  assert.equal(trial.ok, true); assert.equal(trial.autoRenew, false);
  const trialRequest = rt.requests.find((item) => item.url.includes('/api/billing/trial'));
  assert.match(trialRequest.options.headers['x-trial-integrity'], /^[A-Za-z0-9_-]{24,100}$/);
  assert.equal(w.PremiumTrialLifecycleService.events().includes('converted'), true);

  const courseId = '11111111-1111-1111-1111-111111111111';
  w.PremiumCourseService.hydrate([{ id: courseId, owner_id: 'creator-1', title: 'TOPIK 5', description: 'Advanced', access_level: 'premium', price: 199000, currency: 'VND', revenue_share: 70, preview_lesson_id: '22222222-2222-2222-2222-222222222222', sales_count: 2 }]);
  const preview = w.PremiumCourseService.preview(courseId);
  assert.equal(preview.previewOnly, true); assert.equal(preview.price, 199000); assert.equal(preview.creatorId, 'creator-1');
  const purchase = await w.PremiumCourseService.purchase(courseId);
  assert.equal(purchase.ok, true); assert.equal(purchase.unlocked, true); assert.equal(purchase.cardDataStored, false);
  assert.equal(w.PurchaseHistoryService.all()[0].paymentId, 'mock_transaction_1');
  const revenue = w.CreatorRevenueFoundationService.estimate({ price: 199000, revenueShare: 70, salesCount: 2 });
  assert.deepEqual(JSON.parse(JSON.stringify(revenue)), { salesCount: 2, grossRevenue: 398000, creatorBalance: 278600, platformRevenue: 119400, revenueShare: 70, payoutEnabled: false });
  assert.equal(w.CreatorRevenueFoundationService.realPayoutsEnabled(), false);
  assert.equal(w.ConversionAnalyticsService.sensitivePersonalDataCollected(), false);

  const teacher = boot({ rawRole: 'teacher' });
  assert.equal(teacher.window.BusinessDashboardService.can('teacher'), true);
  assert.equal(teacher.window.BusinessDashboardService.can('admin'), false);
  const dashboard = await teacher.window.BusinessDashboardService.load('teacher');
  assert.equal(dashboard.aggregateOnly, true);
  assert.equal(teacher.window.BusinessDashboardService.includesPrivateLearnerData(), false);
  const admin = boot({ rawRole: 'admin' });
  assert.equal(admin.window.BusinessDashboardService.can('admin'), true);

  const loader = read('data/route-loader.js'); const worker = read('sw.js'); const checkout = read('api/billing/_checkout.js'); const trialApi = read('api/billing/_trial.js'); const purchaseApi = read('api/commerce/_purchase.js');
  assert.match(loader, /premiumPlatform/); assert.match(loader, /my-purchases-p77/);
  assert.match(worker, /premium-monetization-platform\.json/); assert.match(worker, /premium-monetization-platform\.css\?v=1/);
  assert.match(checkout, /paymentProviders\.get\('mock'\)/); assert.match(checkout, /entitlementChanged: false/);
  assert.match(trialApi, /createHmac\('sha256'/); assert.match(trialApi, /p77_start_trial/);
  assert.match(purchaseApi, /p77_create_mock_course_purchase/); assert.match(purchaseApi, /cardDataStored: false/);

  for (const table of ['commercial_resource_entitlements','commercial_creator_balances','commercial_course_purchases','commercial_course_learning_progress','commercial_mock_payment_sessions','commercial_trial_integrity','commercial_trial_events','commercial_conversion_daily']) assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`), `${table} RLS missing`);
  assert.match(migration, /status in \('trial','active','expired','cancelled','pending'\)/);
  assert.match(migration, /tier in \('free','premium','pro','teacher_pro'\)/);
  assert.match(migration, /insert into public\.commercial_subscriptions[\s\S]*from auth\.users[\s\S]*on conflict \(user_id\) do nothing/);
  assert.match(migration, /p77_check_resource_access/); assert.match(migration, /commercial_course_purchases[\s\S]*status = 'completed'/);
  assert.match(migration, /p77_create_mock_course_purchase/); assert.match(migration, /for update/); assert.match(migration, /idempotency_key/);
  assert.match(migration, /revenue_share/); assert.match(migration, /creator_balance/); assert.match(migration, /sales_count/);
  assert.match(migration, /p77_admin_business_dashboard/); assert.match(migration, /p77_teacher_business_dashboard/);
  assert.match(migration, /p77_track_trial_lifecycle/); assert.match(migration, /completionRate/); assert.match(migration, /count\(distinct enrollment\.student_id\)/);
  assert.match(migration, /aggregate_only_no_learner_identity/);
  assert.doesNotMatch(migration, /\b(card_number|card_cvc|payment_secret|provider_secret)\b/i);
  assert.doesNotMatch(migration, /\b(delete|truncate)\s+(from\s+)?public\.(learning|srs|mastery|user_progress|adaptive)/i);
  assert.doesNotMatch(source, /passwordHash\s*:/);

  console.log('P77 unit: extensible plans, server entitlement, mock payment, one-account trial, premium course purchase, creator revenue, purchase history, aggregate dashboards, privacy and migration preservation passed');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
