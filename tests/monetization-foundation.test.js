const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'data', 'monetization-foundation.js'), 'utf8');
const content = JSON.parse(fs.readFileSync(path.join(root, 'content', 'monetization-foundation.json'), 'utf8'));
const migration = fs.readFileSync(path.join(root, 'supabase', 'migrations', '20260906_p39_business_monetization.sql'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8') + fs.readFileSync(path.join(root, 'data', 'route-loader.js'), 'utf8');
const worker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const appSource = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'monetization-foundation.css'), 'utf8');

function boot({ userId = 'learner-a', role = 'student', tier = 'free', subscriptionStatus = 'none', cloud = false, referralCode = '', shared = new Map() } = {}) {
  const state = { currentUser: { id: userId, fullName: userId, onboardingCompleted: true }, currentView: 'profile', supportDraft: { type: 'general', sourceId: '' } };
  const scoped = (key) => shared.get(key)?.[userId] || [];
  const saveScoped = (key, items) => { const all = shared.get(key) || {}; all[userId] = items; shared.set(key, all); };
  const document = { documentElement: { lang: 'vi' }, querySelector: () => null, querySelectorAll: () => [], getElementById: () => null };
  const requests = [];
  const session = cloud ? { user: { id: userId, app_metadata: { role, subscription_tier: tier, subscription_status: subscriptionStatus, referral_code: referralCode } } } : null;
  const client = { from(table) { return { insert(payload) { requests.push({ table, payload }); return { select() { return { single: async () => ({ data: { id: 'quote-cloud-1', status: 'new', created_at: new Date().toISOString() }, error: null }) }; } }; } }; } };
  const window = {
    document,
    fetch: async (url, options = {}) => {
      requests.push({ url: String(url), options });
      if (String(url).includes('coupons')) return { ok: true, json: async () => ({ valid: true, benefit: { type: 'percentage', value: 10 } }) };
      if (String(url).includes('referrals')) return { ok: true, json: async () => ({ status: 'attributed' }) };
      if (String(url).includes('checkout')) return { ok: true, json: async () => ({ checkoutUrl: 'https://payments.example.test/session', checkoutId: 'checkout-1' }) };
      return { ok: true, json: async () => ({}) };
    },
    SupabaseService: cloud ? { session, client } : { session: null, client: null },
    SubscriptionService: { status: () => ({ tier, status: subscriptionStatus, source: cloud ? 'cloud-metadata' : 'default', paymentEnabled: false }), activeTier: () => tier === 'premium' && ['active', 'trialing'].includes(subscriptionStatus) ? 'premium' : 'free' },
    PremiumFeatureService: { access: (feature) => ({ allowed: tier === 'premium' && subscriptionStatus === 'active' && ['advanced_analytics', 'premium_courses', 'extended_practice'].includes(feature) }) },
    SchoolManagementService: { organizations: () => [] },
    SupportService: { submit: async (payload) => cloud ? { data: { id: 'support-1', ...payload } } : { offline: true } },
    GlobalSearchService: { search: () => ({ studyTools: [] }) },
    KLEARN_EXTRA_VIEWS: {}, KLEARN_AFTER_RENDER: null,
    KLEARN_APP: { state, STORAGE_KEYS: { monetization: 'monetization' }, render() {}, setView(view) { state.currentView = view; }, toast() {}, escapeHtml: String, userScoped: scoped, saveUserScoped: saveScoped, AccessControlService: { role: () => role } }
  };
  const context = { window, document, console, Date, Intl, String, Number, Boolean, Object, Array, Math, Set, Map, RegExp, Promise, JSON, FormData: class {}, fetch: async () => ({ ok: true, json: async () => content }) };
  vm.createContext(context); vm.runInContext(source, context); window.MonetizationContentService.hydrate(content);
  return { window, state, shared, requests };
}

(async () => {
  assert.equal(content.verified, true);
  assert.equal(content.reviewStatus, 'approved');
  assert.equal(content.payment.clientCanActivatePremium, false);
  assert.equal(content.payment.storesCardData, false);
  assert.ok(content.principles.includes('core-learning-remains-free'));

  const shared = new Map(); const free = boot({ shared }); const app = free.window;
  assert.equal(app.CommercialSubscriptionService.tier(), 'free');
  assert.equal(app.CommercialSubscriptionService.can('core_learning'), true);
  assert.equal(app.CommercialSubscriptionService.can('advanced_analytics'), false);
  assert.equal(app.CommercialSubscriptionService.canActivateFromClient(), false);
  const clientConfirmation = app.PaymentArchitectureService.confirmClientPayment();
  assert.equal(clientConfirmation.ok, false); assert.equal(clientConfirmation.reason, 'webhook-required'); assert.equal(clientConfirmation.subscriptionChanged, false);
  const offlineCheckout = await app.PaymentArchitectureService.createCheckout({ planId: 'premium', billingPeriod: 'monthly' });
  assert.equal(offlineCheckout.ok, false);
  assert.equal(offlineCheckout.subscriptionChanged, false);
  assert.equal(app.CommercialSubscriptionService.tier(), 'free', 'checkout attempt must never change tier');
  assert.equal(app.CouponService.syntax('a!').valid, false);
  assert.equal(app.CouponService.syntax('valid-code').valid, true);
  assert.equal((await app.ReferralProgramService.attribute('friend-code')).rewardGranted, false, 'client must never grant referral reward');
  const quote = await app.OrganizationPackageService.requestQuote({ packageId: 'school-license', organizationName: 'Trường An', seats: 120, note: 'TOPIK' });
  assert.equal(quote.offline, true);
  assert.equal(app.OrganizationPackageService.packages().length, 2);

  const premium = boot({ userId: 'premium-a', tier: 'premium', subscriptionStatus: 'active', cloud: true, referralCode: 'OWN-CODE', shared });
  assert.equal(premium.window.CommercialSubscriptionService.can('advanced_analytics'), true);
  assert.equal((await premium.window.ReferralProgramService.attribute('OWN-CODE')).reason, 'self-referral');
  const coupon = await premium.window.CouponService.validate('WELCOME-10');
  assert.equal(coupon.valid, true);
  assert.equal(coupon.source, 'server');
  const checkout = await premium.window.PaymentArchitectureService.createCheckout({ planId: 'premium', billingPeriod: 'yearly', couponCode: 'WELCOME-10' });
  assert.equal(checkout.ok, true);
  assert.equal(checkout.checkoutUrl, '', 'unlisted payment host must not receive browser navigation');
  assert.equal(checkout.subscriptionChanged, false);
  assert.match(premium.requests.find((item) => item.url.includes('checkout')).options.body, /idempotencyKey/);
  assert.equal((await premium.window.CustomerSupportService.submit({ category: 'billing', subject: 'Cần kiểm tra hóa đơn', message: 'Tôi cần hỗ trợ kiểm tra trạng thái hóa đơn.' })).ok, true);
  const cloudQuote = await premium.window.OrganizationPackageService.requestQuote({ packageId: 'corporate-team', organizationName: 'Công ty P39', seats: 35, note: 'Học tiếng Hàn công sở' });
  assert.equal(cloudQuote.ok, true);
  assert.equal(premium.requests.find((item) => item.table === 'commercial_quote_requests').payload.package_slug, 'corporate-team');
  assert.equal(free.window.ReferralProgramService.history().length, 1);
  assert.equal(premium.window.ReferralProgramService.history().length, 0, 'commercial records must remain user scoped');

  const student = boot();
  assert.equal(student.window.RevenueAnalyticsService.available(), false);
  assert.equal(student.window.CrmFoundationService.available(), false);
  const admin = boot({ userId: 'admin-a', role: 'admin' });
  admin.state.monetizationRuntime.revenue = [{ currency: 'VND', gross_revenue: 1000000, net_revenue: 850000, refund_amount: 50000, new_subscriptions: 4, canceled_subscriptions: 1, coupon_redemptions: 2, referral_conversions: 1, active_licenses: 3 }];
  assert.equal(admin.window.RevenueAnalyticsService.snapshot().netRevenue, 850000);
  assert.equal(admin.window.RevenueAnalyticsService.snapshot().licenses, 3);
  assert.equal(admin.window.CrmFoundationService.available(), true);

  for (const route of ['business-center', 'billing-center', 'organization-plans', 'revenue-center', 'crm-center']) assert.equal(typeof app.KLEARN_EXTRA_VIEWS[route], 'function', `${route} registered`);
  assert.equal(app.GlobalSearchService.search('coupon').studyTools[0].route, 'business-center');

  for (const table of ['commercial_payment_events','commercial_coupons','commercial_coupon_redemptions','commercial_referral_codes','commercial_referrals','commercial_organization_packages','commercial_quote_requests','commercial_revenue_daily','commercial_crm_accounts']) assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`), `${table} RLS`);
  assert.match(migration, /coupon redemptions, referral identities and code hashes intentionally have no browser policy/);
  assert.match(migration, /drop policy if exists "users read own subscription"/);
  assert.match(migration, /check \(referrer_id <> referred_user_id\)/);
  assert.match(migration, /users create own commercial quote/);
  assert.match(migration, /admins read revenue aggregates/);
  assert.match(migration, /admins manage crm accounts/);
  assert.match(migration, /raw provider payloads and card data are prohibited/);
  assert.match(migration, /support_requests_type_check/);
  assert.match(index, /monetization-foundation\.css\?v=1/);
  assert.match(index, /data\/monetization-foundation\.js\?v=1/);
  assert.match(index, /app\.js\?v=62/);
  assert.match(worker, /klearn-v76/);
  assert.match(worker, /content\/monetization-foundation\.json/);
  assert.match(appSource, /'business-center', 'billing-center', 'organization-plans', 'revenue-center', 'crm-center'/);
  assert.match(css, /@media\(max-width:600px\)/);
  console.log('monetization foundation: Free/Premium controls, server-only payment, coupon/referral, B2B licenses, revenue aggregates, support, CRM, RLS and privacy boundaries passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
