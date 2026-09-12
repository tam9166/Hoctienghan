#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const content = JSON.parse(read('content/premium-monetization-architecture.json'));
const source = read('data/premium-monetization-architecture.js');
const migration = read('supabase/migrations/20260912_p67_premium_monetization_architecture.sql');
const appSource = read('app.js');
const loader = read('data/route-loader.js');
const worker = read('sw.js');
const chat = read('api/chat.js');
const checkout = read('api/billing/checkout.js');
const trial = read('api/billing/trial.js');
const cancellation = read('api/billing/cancel.js');

function boot({ userId = 'p67-user', role = 'student', metadata = null, shared = new Map() } = {}) {
  const state = { currentUser: { id: userId, fullName: 'P67 User', onboardingCompleted: true }, currentView: 'profile' };
  const storage = { get(key, fallback) { return shared.has(key) ? shared.get(key) : fallback; }, set(key, value) { shared.set(key, value); return value; } };
  const document = { querySelector: () => null, querySelectorAll: () => [] };
  const window = {
    document, KLEARN_EXTRA_VIEWS: {}, KLEARN_AFTER_RENDER: null,
    SupabaseService: { session: metadata ? { access_token: 'server-token', user: { id: userId, app_metadata: metadata } } : null, client: null },
    GlobalSearchService: { search: () => ({ studyTools: [] }) },
    KLEARN_APP: { state, STORAGE_KEYS: { subscriptionEntitlementCache: 'entitlement-cache' }, storage, render() {}, setView(view) { state.currentView = view; }, toast() {}, escapeHtml: String, AccessControlService: { role: () => role } }
  };
  const context = { window, document, console, Date, String, Number, Boolean, Object, Array, Math, Set, Map, RegExp, Promise, JSON, FormData: class {}, fetch: async () => ({ ok: true, json: async () => ({}) }) };
  vm.createContext(context); vm.runInContext(source, context); window.MonetizationArchitectureContentService.hydrate(content);
  return { window, state, shared };
}

assert.equal(content.principles.coreLearningAlwaysFree, true);
assert.equal(content.principles.progressNeverPaywalled, true);
assert.equal(content.principles.clientCanGrantEntitlement, false);
assert.equal(content.principles.serverValidationRequired, true);
assert.equal(content.principles.autoChargeTrial, false);
assert.equal(content.principles.priceDecided, false);
assert.deepEqual(content.plans.map((plan) => plan.id), ['free', 'premium', 'pro']);
assert.deepEqual(content.permissionModes, ['allowed', 'limited', 'blocked']);
assert.deepEqual(content.subscriptionStatuses, ['trial', 'active', 'expired', 'cancelled']);
assert.equal(content.trial.days, 7);
assert.equal(content.trial.paymentMethodRequired, false);
assert.equal(content.trial.autoCharge, false);
assert.deepEqual(content.payment.providers.map((provider) => provider.id), ['stripe', 'google_play', 'apple_store', 'local_payment']);
assert.equal(content.payment.prices, null, 'pricing must not be invented before research');

const shared = new Map();
const free = boot({ shared });
assert.equal(free.window.ServerEntitlementService.activeTier(), 'free');
for (const core of ['hangul_foundation','basic_lessons','basic_vocabulary','basic_srs','progress_tracking']) assert.equal(free.window.FeaturePermissionService.access(core).allowed, true, `${core} stays free`);
assert.equal(free.window.FeaturePermissionService.access('full_topik_roadmap').permission, 'blocked');
assert.deepEqual({ permission: free.window.FeaturePermissionService.access('ai_assistance').permission, limit: free.window.FeaturePermissionService.access('ai_assistance').limit }, { permission: 'limited', limit: 5 });
assert.equal(free.window.ServerEntitlementService.canActivateFromClient(), false);
assert.equal(free.window.ProviderNeutralPaymentService.confirmOnClient().entitlementChanged, false);

free.window.ServerEntitlementService.acceptServerProjection({ plan: 'premium', status: 'active', end_date: '2099-01-01T00:00:00Z' });
assert.equal(free.window.ServerEntitlementService.activeTier(), 'premium');
assert.equal(free.window.FeaturePermissionService.access('full_topik_roadmap').allowed, true);
assert.equal(free.window.FeaturePermissionService.access('career_korean').allowed, false);
assert.equal(free.window.FeaturePermissionService.access('ai_assistance').limit, 50);
assert.equal(free.window.EntitlementCacheService.isAuthoritative(), false);
assert.equal(shared.get('entitlement-cache')['p67-user'].source, 'server-cache');

free.window.ServerEntitlementService.acceptServerProjection({ plan: 'pro', status: 'active', end_date: '2099-01-01T00:00:00Z' });
assert.equal(free.window.FeaturePermissionService.access('career_korean').allowed, true);
assert.equal(free.window.FeaturePermissionService.access('professional_writing').allowed, true);
assert.equal(free.window.FeaturePermissionService.access('ai_assistance').limit, 200);

free.window.ServerEntitlementService.acceptServerProjection({ plan: 'premium', status: 'expired', end_date: '2020-01-01T00:00:00Z' });
assert.equal(free.window.ServerEntitlementService.activeTier(), 'free');
assert.equal(free.window.FeaturePermissionService.access('basic_srs').allowed, true, 'expiry cannot lock core learning');
assert.equal(free.window.FeaturePermissionService.access('advanced_analytics').allowed, false);

const cached = boot({ shared });
assert.equal(cached.window.ServerEntitlementService.current().source, 'server-cache');
assert.equal(cached.window.ServerEntitlementService.activeTier(), 'free', 'cached expired projection must remain expired');
const tokenPremium = boot({ userId: 'token-user', metadata: { subscription_tier: 'premium', subscription_status: 'active', subscription: { end_date: '2099-01-01T00:00:00Z' } } });
assert.equal(tokenPremium.window.ServerEntitlementService.activeTier(), 'premium');
assert.equal(tokenPremium.window.ServerEntitlementService.current().serverVerified, false, 'JWT/cache projection is useful offline but not an entitlement mutation authority');
assert.equal(tokenPremium.window.PremiumFeatureService.all()[0].title.vi.length > 0, true, 'legacy Premium UI contract remains compatible');

assert.match(appSource, /subscriptionEntitlementCache: 'klearn_subscription_entitlement_cache'/);
const syncBlock = appSource.slice(appSource.indexOf('const USER_SYNC_KEYS'), appSource.indexOf('function boundedCloudValue'));
assert.doesNotMatch(syncBlock, /subscriptionEntitlementCache/, 'CloudSync payload must not overwrite server subscription state');
assert.match(loader, /premium-monetization-architecture\.js\?v=1/);
assert.match(loader, /routes\('premium-center subscription-admin', \['monetization'\]\)/);
assert.match(worker, /const CACHE = 'klearn-v83'/);
assert.match(worker, /content\/premium-monetization-architecture\.json/);
assert.match(worker, /premium-monetization\.css\?v=1/);

for (const table of ['commercial_subscription_trials','commercial_cancellation_requests','commercial_subscription_audit','commercial_ai_usage_daily','commercial_pricing_research']) assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`), `${table} needs RLS`);
assert.match(migration, /commercial_admin_set_subscription/);
assert.match(migration, /commercial_start_trial/);
assert.match(migration, /commercial_claim_ai_usage/);
assert.match(migration, /for update/, 'AI quota row must be locked atomically');
assert.match(migration, /target_plan not in \('free','premium','pro'\)/);
assert.match(migration, /payment_provider/);
assert.doesNotMatch(migration, /\b(delete|truncate)\s+(from\s+)?public\.(user_|learning_|srs|mastery)/i);
assert.doesNotMatch(migration, /update\s+public\.(user_|learning_progress|srs|mastery)/i);

assert.match(chat, /BILLING_ENFORCEMENT_ENABLED === 'true'/);
assert.match(chat, /commercial_claim_ai_usage/);
assert.match(chat, /AI_DAILY_LIMIT_REACHED/);
assert.match(checkout, /PAYMENT_PROVIDER_NOT_CONFIGURED/);
assert.match(checkout, /entitlementChanged: false/);
assert.doesNotMatch(checkout, /(STRIPE_SECRET|service_role|APPLE_SHARED_SECRET)/);
assert.match(trial, /acceptedNoAutoCharge/);
assert.match(trial, /autoCharge: false/);
assert.match(cancellation, /preserveProgress/);
assert.match(cancellation, /entitlementChanged: false/);

console.log('P67 premium monetization architecture: ethical tiers, permissions, server authority, trial, cancellation, AI quotas, admin audit, provider neutrality, RLS and data isolation passed');
