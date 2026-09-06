const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const content = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'content', 'enterprise-platform.json'), 'utf8'));
const source = fs.readFileSync(path.join(__dirname, '..', 'data', 'enterprise-platform.js'), 'utf8');
const migration = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'migrations', '20260906_enterprise_education_platform.sql'), 'utf8');
const openapi = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'docs', 'partner-api-v1.openapi.json'), 'utf8'));

function boot({ userId = 'learner-a', tier = 'free', subscriptionStatus, role = 'student', shared = new Map() } = {}) {
  const state = { currentUser: { id: userId, fullName: userId, level: 'TOPIK 1' }, currentView: 'profile' };
  const scoped = (key) => shared.get(key)?.[userId] || [];
  const saveScoped = (key, items) => { const all = shared.get(key) || {}; all[userId] = items; shared.set(key, all); };
  const document = { documentElement: { lang: 'vi' }, querySelector: () => null, querySelectorAll: () => [], getElementById: () => null };
  const organizations = [{ id: 'org-a', type: 'center' }]; const classes = [{ id: 'class-a', organizationId: 'org-a' }];
  const window = {
    document,
    SupabaseService: { session: { user: { id: userId, app_metadata: { role, subscription_tier: tier, ...(subscriptionStatus ? { subscription_status: subscriptionStatus } : {}) } } } },
    KLEARN_APP: { state, STORAGE_KEYS: { enterprisePlatform: 'enterprise-platform' }, userScoped: scoped, saveUserScoped: saveScoped, escapeHtml: String, render: () => {}, setView: (view) => { state.currentView = view; }, toast: () => {}, AccessControlService: { role: () => role } },
    KLEARN_EXTRA_VIEWS: {}, KLEARN_AFTER_RENDER: null, GlobalSearchService: { search: () => ({ studyTools: [] }) },
    OrganizationService: { all: () => organizations, classes: () => classes }, TeacherDashboardService: { analytics: () => ({ students: 8, averageProgress: 72, studyMinutes: 420, mistakeCount: 13 }) }
  };
  const context = { window, document, console, Date, String, Number, Object, Array, Math, Set, Map, RegExp, fetch: async () => ({ ok: true, json: async () => content }) };
  vm.createContext(context); vm.runInContext(source, context); window.EnterpriseContentService.hydrate(content); return window;
}

assert.equal(content.verified, true);
assert.equal(content.reviewStatus, 'approved');
assert.deepEqual(content.plans.map((item) => item.id), ['free', 'premium']);
assert.deepEqual(content.productLanguages.map((item) => item.id), ['ko', 'ja', 'zh']);

const shared = new Map(); const free = boot({ shared });
assert.equal(free.SubscriptionService.tier(), 'free');
assert.equal(free.SubscriptionService.status().paymentEnabled, false);
assert.equal(free.SubscriptionService.can('core_learning'), true);
assert.equal(free.SubscriptionService.can('premium_courses'), false);
assert.equal(free.PremiumFeatureService.access('advanced_analytics').allowed, false);
assert.equal(free.CourseMarketplaceService.catalog().length, 3);
assert.ok(free.CourseMarketplaceService.enroll('market-beginner-korean'));
assert.equal(free.CourseMarketplaceService.enroll('market-topik-strategy'), null, 'free user cannot enroll in premium course');
assert.equal(free.CertificationService.issue('beginner-korean'), null, 'certificate requires completion evidence');
assert.equal(free.CourseMarketplaceService.recordProgress('market-beginner-korean', 100), 100);
const certificate = free.CertificationService.issue('beginner-korean');
assert.equal(certificate.status, 'local-preview');
assert.match(certificate.verificationCode, /^TH-/);
assert.equal(free.ProductLanguageService.current().id, 'ko');
assert.equal(free.ProductLanguageService.set('ja'), null, 'foundation language is not selectable before release');
assert.equal(free.SchoolManagementService.canManage(), false);
assert.equal(free.AdminAnalyticsService.snapshot(), null);
assert.equal(free.PartnerApiService.enabled(), false);

const premium = boot({ userId: 'premium-a', tier: 'premium', subscriptionStatus: 'active', shared });
assert.equal(premium.SubscriptionService.status().source, 'cloud-metadata');
assert.equal(premium.SubscriptionService.can('premium_courses'), true);
assert.ok(premium.CourseMarketplaceService.enroll('market-topik-strategy'));
assert.equal(premium.CourseMarketplaceService.enrollments().length, 1);
assert.equal(free.CourseMarketplaceService.enrollments().length, 1, 'enterprise records must remain user scoped');

const canceled = boot({ userId: 'canceled-a', tier: 'premium', subscriptionStatus: 'canceled' });
assert.equal(canceled.SubscriptionService.tier(), 'premium');
assert.equal(canceled.SubscriptionService.activeTier(), 'free');
assert.equal(canceled.SubscriptionService.can('premium_courses'), false, 'inactive premium status must not unlock entitlements');

const teacher = boot({ userId: 'teacher-a', role: 'teacher' });
assert.equal(teacher.SchoolManagementService.canManage(), true);
assert.equal(teacher.CenterAnalyticsService.snapshot().students, 8);
assert.equal(teacher.CenterAnalyticsService.snapshot().dataScope, 'organization-summary-only');
assert.equal(teacher.AdminAnalyticsService.available(), false);

const admin = boot({ userId: 'admin-a', role: 'admin' });
assert.equal(admin.AdminAnalyticsService.available(), true);
assert.equal(admin.AdminAnalyticsService.snapshot().users, null, 'unavailable backend metrics must not be fabricated');
assert.equal(admin.AdminAnalyticsService.snapshot().piiIncluded, false);

for (const route of ['enterprise-platform','subscription-center','premium-features','school-management','center-dashboard','course-marketplace','certification-center','partner-api','admin-analytics','language-platform']) assert.equal(typeof free.KLEARN_EXTRA_VIEWS[route], 'function', `${route} is registered`);
assert.equal(free.GlobalSearchService.search('premium').studyTools[0].route, 'enterprise-platform');

for (const table of ['commercial_subscriptions','commercial_plan_entitlements','education_organization_subscriptions','commercial_marketplace_courses','commercial_marketplace_enrollments','commercial_certificates','partner_clients','partner_credentials','partner_api_audit','commercial_admin_daily_metrics','product_languages']) assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`), `${table} must enable RLS`);
assert.match(migration, /users read own subscription/);
assert.match(migration, /users enroll accessible marketplace courses/);
assert.match(migration, /partner_credentials intentionally has no authenticated policy/);
assert.match(migration, /revoke all on function public\.commercial_has_entitlement/);
assert.match(migration, /Aggregate operational metrics without user-level PII/);
assert.equal(openapi.openapi, '3.1.0');
assert.match(openapi.info.description, /Architecture contract only/);
assert.equal(openapi.servers[0].url, 'https://api.example.invalid/v1');

console.log('enterprise platform: subscription entitlements, marketplace, certification evidence, school/center roles, partner API, admin privacy, languages and RLS passed');
