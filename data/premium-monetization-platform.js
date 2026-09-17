/* Tiếng Hàn - TamHoanq · P77 Premium & Monetization Platform. */
(function premiumMonetizationPlatform(global) {
  'use strict';
  const app = global.KLEARN_APP;
  if (!app) return;
  const { state, storage, escapeHtml = String, render, setView, toast, AccessControlService } = app;
  const STORE_KEY = 'klearn_p77_commerce_ui';
  const routes = new Set(['premium-benefits-p77', 'premium-courses-p77', 'premium-course-p77', 'my-purchases-p77', 'admin-business-p77', 'teacher-business-p77']);
  const runtime = state.p77Commerce || (state.p77Commerce = { config: null, loading: null, error: '', courses: [], selectedCourseId: '', purchases: [], dashboard: null, dashboardMode: '', busy: false });
  const clean = (value, max = 500) => String(value == null ? '' : value).normalize('NFC').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const object = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const token = () => global.SupabaseService?.session?.access_token || '';
  const role = () => global.TeacherCreatorRoleService?.role?.() || ({ student: 'learner', content_creator: 'creator', content_editor: 'creator', center_admin: 'admin', super_admin: 'admin' })[AccessControlService?.role?.()] || AccessControlService?.role?.() || 'learner';
  const now = () => new Date().toISOString();
  const money = (amount, currency = 'VND') => new Intl.NumberFormat('vi-VN', { style: 'currency', currency, maximumFractionDigits: currency === 'VND' ? 0 : 2 }).format(Number(amount || 0));
  const request = async (url, options = {}) => {
    const headers = { ...(options.headers || {}) }; if (token()) headers.authorization = `Bearer ${token()}`;
    const response = await fetch(url, { credentials: 'same-origin', ...options, headers });
    const body = await response.json().catch(() => ({}));
    return { ok: response.ok, status: response.status, body };
  };

  const P77MonetizationConfigService = {
    hydrate(value) {
      if (Number(value?.schemaVersion) !== 1 || value?.principles?.learningQualityFirst !== true || value?.principles?.serverAuthoritativeAccess !== true || value?.principles?.clientCanGrantEntitlement !== false || value?.principles?.storesCardData !== false || value?.plans?.map((item) => item.id).join(',') !== 'free,premium,teacher_pro' || value?.subscriptionStatuses?.join(',') !== 'trial,active,expired,cancelled,pending') throw new Error('P77 monetization safety contract failed');
      runtime.config = clone(value); runtime.error = ''; return this.get();
    },
    get() { return runtime.config ? clone(runtime.config) : null; },
    async load() {
      if (runtime.config) return this.get(); if (runtime.loading) return runtime.loading;
      runtime.loading = fetch('./content/premium-monetization-platform.json', { cache: 'default' }).then((response) => { if (!response.ok) throw new Error(`P77 content ${response.status}`); return response.json(); }).then((value) => this.hydrate(value)).catch((error) => { runtime.error = clean(error.message, 160); return null; }).finally(() => { runtime.loading = null; if (routes.has(state.currentView)) render(); });
      return runtime.loading;
    }
  };

  const P77SubscriptionService = {
    normalizePlan(value) { const plan = clean(value, 40).toLowerCase(); return runtime.config?.legacyPlanAliases?.[plan] || (['free','premium','teacher_pro'].includes(plan) ? plan : 'free'); },
    normalize(value = {}) {
      const sourcePlan = clean(value.plan || value.tier || 'free', 40).toLowerCase(); const plan = this.normalizePlan(sourcePlan);
      const status = runtime.config?.subscriptionStatuses?.includes(value.status) ? value.status : plan === 'free' ? 'active' : 'expired';
      const endDate = value.endDate || value.end_date || null; const notEnded = !endDate || new Date(endDate).getTime() > Date.now();
      const active = plan === 'free' || (['trial','active','cancelled'].includes(status) && notEnded);
      return { id: value.id || null, userId: value.userId || value.user_id || null, plan, sourcePlan, effectivePlan: active ? plan : 'free', status: active ? status : status === 'pending' ? 'pending' : 'expired', startDate: value.startDate || value.start_date || null, endDate, provider: value.provider || value.payment_provider || null, autoRenew: Boolean(value.autoRenew ?? value.auto_renew), createdAt: value.createdAt || value.created_at || null, serverVerified: value.serverVerified === true, active };
    },
    current() { const projection = global.ServerEntitlementService?.current?.() || { plan: 'free', status: 'active', source: 'default' }; return this.normalize({ ...projection, serverVerified: projection.serverVerified === true }); },
    features(plan = this.current().effectivePlan) { return new Set(runtime.config?.plans?.find((item) => item.id === plan)?.features || []); },
    can(feature) { return this.features().has(feature); },
    statuses() { return [...(runtime.config?.subscriptionStatuses || [])]; }
  };

  const BackendEntitlementService = {
    preview(resource = {}) {
      const accessLevel = clean(resource.accessLevel || resource.access_level || 'free', 40); const plan = P77SubscriptionService.current().effectivePlan;
      const allowed = accessLevel === 'free' || (accessLevel === 'premium' && plan === 'premium') || (accessLevel === 'teacher_pro' && plan === 'teacher_pro');
      return { allowed, accessLevel, plan, source: accessLevel === 'free' ? 'ethical-free-rule' : 'client-preview', authoritative: false };
    },
    async verify(resource = {}) {
      const accessLevel = clean(resource.accessLevel || resource.access_level || 'free', 40);
      if (accessLevel === 'free') return { allowed: true, reason: 'free_resource', source: 'ethical-free-rule', serverVerified: false };
      if (!token()) return { allowed: false, reason: 'authentication_required', source: 'client', serverVerified: false };
      const response = await request('/api/commerce/access', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ resourceType: resource.resourceType || resource.resource_type || 'feature', resourceId: resource.resourceId || resource.id || null, accessLevel }) });
      return response.ok ? response.body : { allowed: false, reason: response.body.error || `HTTP ${response.status}`, source: 'server', serverVerified: true };
    },
    clientCanGrant() { return false; }
  };

  const PaymentProviderService = {
    providers() { return runtime.config?.payments?.adapters || []; },
    active() { return runtime.config?.payments?.activeProvider || 'mock'; },
    livePaymentsEnabled() { return runtime.config?.payments?.livePaymentsEnabled === true; },
    async createSubscriptionCheckout(plan, provider = this.active()) {
      if (!['premium','teacher_pro'].includes(plan) || provider !== 'mock' || !token()) return { ok: false, reason: 'invalid-or-unauthenticated', entitlementChanged: false };
      const response = await request('/api/billing/checkout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ plan, provider, billingPeriod: 'monthly', idempotencyKey: `checkout-${Date.now().toString(36)}` }) });
      return { ok: response.ok, ...response.body, entitlementChanged: false };
    },
    confirmOnClient() { return { ok: false, reason: 'server-verification-required', entitlementChanged: false }; },
    storesSensitivePaymentData() { return false; }
  };

  function installationToken() {
    const current = object(storage.get(STORE_KEY, {})); if (/^[A-Za-z0-9_-]{24,100}$/.test(current.trialIntegrity || '')) return current.trialIntegrity;
    const tokenValue = `p77_${Array.from({ length: 5 }, () => Math.random().toString(36).slice(2)).join('')}`.slice(0, 72);
    storage.set(STORE_KEY, { ...current, trialIntegrity: tokenValue, createdAt: current.createdAt || now() }); return tokenValue;
  }

  const PremiumTrialLifecycleService = {
    config() { return clone(runtime.config?.trial || {}); },
    events() { return [...(runtime.config?.trial?.events || [])]; },
    async start() {
      if (!token() || P77SubscriptionService.current().effectivePlan !== 'free') return { ok: false, reason: 'not-eligible' };
      const response = await request('/api/billing/trial', { method: 'POST', headers: { 'content-type': 'application/json', 'x-trial-integrity': installationToken() }, body: JSON.stringify({ plan: 'premium', acceptedNoAutoCharge: true }) });
      if (response.ok && response.body.subscription && global.ServerEntitlementService?.acceptServerProjection) global.ServerEntitlementService.acceptServerProjection(response.body.subscription);
      return response.ok ? { ok: true, ...response.body } : { ok: false, reason: response.body.error || `HTTP ${response.status}` };
    }
  };

  const PremiumCourseService = {
    hydrate(courses) { runtime.courses = Array.isArray(courses) ? courses.map((item) => ({ ...item, accessLevel: item.accessLevel || item.access_level || 'free', creatorId: item.creatorId || item.owner_id || '', previewLessonId: item.previewLessonId || item.preview_lesson_id || null, subscriptionEligible: Boolean(item.subscriptionEligible ?? item.subscription_eligible), salesCount: Number(item.salesCount ?? item.sales_count ?? 0) })) : []; return this.all(); },
    all() { return runtime.courses.map(clone); },
    byId(id) { const item = runtime.courses.find((course) => course.id === id); return item ? clone(item) : null; },
    preview(id) { const course = this.byId(id); return course ? { id: course.id, title: course.title, description: course.description, price: Number(course.price || 0), currency: course.currency || 'VND', creatorId: course.creatorId, previewLessonId: course.previewLessonId, accessLevel: course.accessLevel, previewOnly: true } : null; },
    async load() { if (!token()) return this.all(); const response = await request('/api/commerce/catalog'); if (response.ok) this.hydrate(response.body.courses); return this.all(); },
    select(id) { runtime.selectedCourseId = clean(id, 80); setView('premium-course-p77'); },
    async configure(input = {}) {
      if (!['teacher','creator','admin'].includes(role()) || !token()) return { ok: false, reason: 'not-authorized' };
      const response = await request('/api/commerce/course', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) });
      return response.ok ? { ok: true, course: response.body.course } : { ok: false, reason: response.body.error || `HTTP ${response.status}` };
    },
    async purchase(courseId, provider = 'mock') {
      const course = this.byId(courseId); if (!course || course.accessLevel !== 'premium' || !token()) return { ok: false, reason: 'invalid-or-unauthenticated', unlocked: false };
      const response = await request('/api/commerce/purchase', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ courseId, provider, idempotencyKey: `purchase-${Date.now().toString(36)}` }) });
      if (response.ok) await PurchaseHistoryService.load();
      return response.ok ? { ok: true, ...response.body } : { ok: false, reason: response.body.error || `HTTP ${response.status}`, unlocked: false };
    }
  };

  const PurchaseHistoryService = {
    hydrate(items) { runtime.purchases = Array.isArray(items) ? items.map((item) => ({ id: item.id, courseId: item.courseId || item.course_id, price: Number(item.price || 0), currency: item.currency || 'VND', date: item.date || item.purchased_at, status: item.status, paymentId: item.paymentId || item.payment_id, provider: item.provider })) : []; return this.all(); },
    all() { return runtime.purchases.map(clone); },
    async load() { if (!token()) return this.all(); const response = await request('/api/commerce/purchases'); if (response.ok) this.hydrate(response.body.purchases); return this.all(); }
  };

  const CreatorRevenueFoundationService = {
    estimate({ price = 0, revenueShare = 70, salesCount = 0 } = {}) { const grossRevenue = Number(price) * Number(salesCount); const creatorBalance = Math.round(grossRevenue * Number(revenueShare)) / 100; return { salesCount: Number(salesCount), grossRevenue, creatorBalance, platformRevenue: grossRevenue - creatorBalance, revenueShare: Number(revenueShare), payoutEnabled: false }; },
    defaultShare() { return Number(runtime.config?.creatorRevenue?.defaultRevenueShare || 70); },
    realPayoutsEnabled() { return false; }
  };

  const BusinessDashboardService = {
    can(mode) { return mode === 'admin' ? role() === 'admin' : ['teacher','creator','admin'].includes(role()); },
    async load(mode) { if (!this.can(mode) || !token()) return { ok: false, reason: 'not-authorized' }; const response = await request(`/api/commerce/dashboard?mode=${mode}`); if (response.ok) { runtime.dashboard = response.body.dashboard; runtime.dashboardMode = mode; } return response.ok ? { ok: true, data: runtime.dashboard, aggregateOnly: true } : { ok: false, reason: response.body.error || `HTTP ${response.status}` }; },
    snapshot() { return runtime.dashboard ? clone(runtime.dashboard) : null; },
    includesPrivateLearnerData() { return false; }
  };

  const ConversionAnalyticsService = {
    events() { return [...(runtime.config?.analyticsEvents || [])]; },
    sensitivePersonalDataCollected() { return false; },
    metricDefinitions() { return { freeToTrial: 'free_to_trial / eligible_free_accounts', trialToPremium: 'converted / completed_trials', premiumRetention: 'retained_premium / active_premium_start', churn: 'premium_churned / active_premium_start' }; }
  };

  const heading = (eyebrow, title, text, back = 'premium-center') => `<section class="section page-heading p77-heading"><button class="back-link" data-view="${back}">←</button><p class="eyebrow">${escapeHtml(eyebrow)}</p><h1 class="headline">${escapeHtml(title)}</h1><p class="subtle">${escapeHtml(text)}</p></section>`;
  const emptyState = (title, text) => `<article class="p77-empty"><h2>${escapeHtml(title)}</h2><p>${escapeHtml(text)}</p></article>`;
  function benefitsView() {
    if (!runtime.config) { P77MonetizationConfigService.load(); return heading('P77 · PREMIUM', 'Đang tải quyền lợi…', 'Kiểm tra cấu hình an toàn.'); }
    const current = P77SubscriptionService.current(); const featureNames = { beginner_foundation: 'Beginner Foundation', topik_1_basic: 'TOPIK 1 cơ bản', basic_srs: 'SRS', learning_journey: 'Learning Journey', basic_report: 'Basic Report', advanced_topik: 'TOPIK nâng cao', advanced_ai_speaking: 'AI Speaking nâng cao', advanced_learning_report: 'Advanced Learning Report', extended_offline_pack: 'Offline Pack mở rộng', career_korean: 'Career Korean', premium_courses: 'Premium Course', advanced_creator_studio: 'Creator Studio nâng cao', classroom: 'Classroom', student_analytics: 'Student Analytics', course_management: 'Course Management' };
    const rows = [...new Set(runtime.config.plans.flatMap((plan) => plan.features))];
    return `<div class="p77-shell">${heading('P77 · PREMIUM BENEFITS', 'Học nền tảng miễn phí, mở rộng khi cần', runtime.config.ux.upgradeCopy)}<section class="section p77-current"><div><small>GÓI HIỆN TẠI</small><b>${escapeHtml(current.effectivePlan.toUpperCase())}</b><span>${escapeHtml(current.status)} · ${current.autoRenew ? 'auto-renew' : 'không tự gia hạn'}</span></div><div><small>ACCESS AUTHORITY</small><b>Backend</b><span>UI không thể tự mở quyền</span></div><div><small>PAYMENT</small><b>Mock only</b><span>Không lưu thẻ hoặc payment secret</span></div></section><section class="section p77-plans">${runtime.config.plans.map((plan) => `<article class="${current.effectivePlan === plan.id ? 'current' : ''}"><small>${plan.id.replace('_',' ').toUpperCase()}</small><h2>${escapeHtml(plan.name)}</h2><ul>${plan.features.map((feature) => `<li>✓ ${escapeHtml(featureNames[feature] || feature)}</li>`).join('')}</ul>${plan.id === 'free' ? '<button class="btn secondary" disabled>Luôn có thể học</button>' : `<button class="btn primary" data-p77-checkout="${plan.id}">${plan.id === 'premium' ? 'Dùng mock checkout' : 'Xem Teacher Pro'}</button>`}</article>`).join('')}</section><section class="section p77-compare"><h2>Free vs Premium vs Teacher Pro</h2><div role="table">${rows.map((feature) => `<div role="row"><b role="cell">${escapeHtml(featureNames[feature] || feature)}</b>${runtime.config.plans.map((plan) => `<span role="cell" aria-label="${plan.name}">${plan.features.includes(feature) ? '✓' : '—'}</span>`).join('')}</div>`).join('')}</div></section><section class="section p77-actions"><button class="btn primary" data-view="premium-courses-p77">Khám phá Premium Course</button><button class="btn secondary" data-view="my-purchases-p77">My Purchases</button>${current.effectivePlan === 'free' ? '<button class="btn secondary" data-p77-trial>Thử Premium 7 ngày</button>' : ''}${BusinessDashboardService.can('teacher') ? '<button class="btn secondary" data-view="teacher-business-p77">Teacher Business</button>' : ''}${BusinessDashboardService.can('admin') ? '<button class="btn secondary" data-view="admin-business-p77">Admin Business</button>' : ''}</section><section class="section p77-ethics"><b>Learning Quality là trung tâm.</b><p>Không spam nâng cấp, không khóa progress hiện có và không giảm chất lượng Free để ép mua.</p></section></div>`;
  }
  function coursesView() {
    if (!runtime.config) { P77MonetizationConfigService.load(); return heading('P77 · COURSES', 'Đang tải…', ''); }
    if (!runtime.courses.length && token() && !runtime.busy) { runtime.busy = true; PremiumCourseService.load().finally(() => { runtime.busy = false; render(); }); }
    return `<div class="p77-shell">${heading('P77 · PREMIUM COURSES', 'Xem trước rồi mới quyết định', runtime.config.ux.purchaseCopy, 'premium-benefits-p77')}<section class="section p77-course-grid">${runtime.courses.map((course) => `<article><span>${escapeHtml(course.accessLevel.toUpperCase())}</span><h2>${escapeHtml(course.title)}</h2><p>${escapeHtml(course.description || course.goal || '')}</p><div><b>${course.accessLevel === 'free' ? 'Miễn phí' : money(course.price, course.currency)}</b><small>${Number(course.salesCount || 0)} lượt mua · Creator ${escapeHtml(course.creatorId.slice(0, 8))}</small></div><button class="btn primary" data-p77-course="${course.id}">Landing page & preview</button></article>`).join('') || emptyState('Chưa có khóa học đã publish', 'Creator có thể cấu hình Free/Premium trong Course Builder; chỉ course đã qua review mới xuất hiện.')}</section></div>`;
  }
  function courseDetailView() {
    const course = PremiumCourseService.byId(runtime.selectedCourseId); if (!course) return `<div class="p77-shell">${heading('P77 · COURSE', 'Không tìm thấy khóa học', 'Quay lại marketplace để chọn khóa học.', 'premium-courses-p77')}${emptyState('Course unavailable', 'Course chưa publish hoặc catalog chưa tải.')}</div>`;
    return `<div class="p77-shell">${heading('P77 · COURSE LANDING', course.title, course.description || course.goal || '', 'premium-courses-p77')}<section class="section p77-course-landing"><div class="p77-preview"><small>PREVIEW LESSON</small><h2>${course.previewLessonId ? 'Bài học mẫu sẵn sàng' : 'Creator chưa chọn bài học mẫu'}</h2><p>Preview không mở toàn bộ course và không thay đổi progress.</p><code>${escapeHtml(course.previewLessonId || 'preview-pending')}</code></div><aside><small>CREATOR</small><b>${escapeHtml(course.creatorId || 'TamHoanq')}</b><span>${escapeHtml(course.level || '')}</span><h2>${course.accessLevel === 'free' ? 'Miễn phí' : money(course.price, course.currency)}</h2>${course.accessLevel === 'free' ? '<button class="btn primary" data-p77-open-free>Học miễn phí</button>' : `<button class="btn primary" data-p77-buy="${course.id}">Purchase bằng Mock Provider</button>`}<small>Backend xác minh trước khi unlock.</small></aside></section></div>`;
  }
  function purchasesView() {
    if (!runtime.purchases.length && token() && !runtime.busy) { runtime.busy = true; PurchaseHistoryService.load().finally(() => { runtime.busy = false; render(); }); }
    return `<div class="p77-shell">${heading('P77 · PURCHASE HISTORY', 'My Purchases', 'Chỉ tài khoản hiện tại xem được course, giá, ngày, trạng thái và provider transaction ID.', 'premium-benefits-p77')}<section class="section p77-table"><header><b>Course</b><b>Price</b><b>Date</b><b>Status</b><b>Payment ID</b></header>${runtime.purchases.map((item) => `<article><span>${escapeHtml(PremiumCourseService.byId(item.courseId)?.title || item.courseId)}</span><b>${money(item.price,item.currency)}</b><span>${escapeHtml((item.date || '').slice(0,10))}</span><span>${escapeHtml(item.status)}</span><code>${escapeHtml(item.paymentId)}</code></article>`).join('') || emptyState('Chưa có giao dịch', 'Purchase hoàn tất bằng Mock Provider sẽ xuất hiện tại đây.')}</section></div>`;
  }
  function dashboardView(mode) {
    if (!BusinessDashboardService.can(mode)) return `<div class="p77-shell">${heading('P77 · BUSINESS', 'Không có quyền truy cập', 'Dashboard được bảo vệ bởi role và RPC phía server.', 'premium-benefits-p77')}${emptyState('Backend role required', 'UI không thể tự cấp quyền dashboard.')}</div>`;
    if ((runtime.dashboardMode !== mode || !runtime.dashboard) && !runtime.busy && token()) { runtime.busy = true; BusinessDashboardService.load(mode).finally(() => { runtime.busy = false; render(); }); }
    const data = runtime.dashboardMode === mode ? object(runtime.dashboard) : {};
    if (mode === 'admin') return `<div class="p77-shell">${heading('P77 · ADMIN BUSINESS', 'Toàn cảnh mô hình kinh doanh', 'Chỉ số aggregate; không chứa dữ liệu học riêng tư.', 'premium-benefits-p77')}<section class="section p77-metrics"><article><small>Total users</small><b>${Number(data.totalUsers || 0)}</b></article><article><small>Premium users</small><b>${Number(data.premiumUsers || 0)}</b></article><article><small>Revenue</small><b>${money(data.revenue || 0)}</b></article><article><small>Churn</small><b>${Number(data.premiumChurned || 0)}</b></article></section><section class="section p77-dashboard-grid"><article><h2>Subscription status</h2><pre>${escapeHtml(JSON.stringify(data.subscriptions || {}, null, 2))}</pre></article><article><h2>Popular courses</h2>${(data.popularCourses || []).map((item) => `<p><b>${escapeHtml(item.title)}</b><span>${Number(item.sales_count || 0)} sales</span></p>`).join('') || '<p>Chưa có dữ liệu.</p>'}</article><article><h2>Creator performance</h2>${(data.creatorPerformance || []).map((item) => `<p><b>${escapeHtml(String(item.creator_id || '').slice(0,8))}</b><span>${money(item.gross_revenue || 0)}</span></p>`).join('') || '<p>Chưa có dữ liệu.</p>'}</article></section></div>`;
    return `<div class="p77-shell">${heading('P77 · TEACHER BUSINESS', 'Hiệu quả khóa học của bạn', 'Chỉ aggregate students/course/completion/revenue estimate; không hiển thị learner identity.', 'premium-benefits-p77')}<section class="section p77-metrics"><article><small>Students</small><b>${Number(data.students || data.salesCount || 0)}</b></article><article><small>Courses</small><b>${Number(data.courseCount || 0)}</b></article><article><small>Completion</small><b>${data.completionRate == null ? '—' : `${Number(data.completionRate)}%`}</b></article><article><small>Revenue estimate</small><b>${money(data.revenueEstimate || 0)}</b></article></section><section class="section p77-table"><header><b>Course</b><b>Sales</b><b>Gross</b><b>Creator share</b><b>Privacy</b></header>${(data.courses || []).map((item) => `<article><span>${escapeHtml(item.title)}</span><b>${Number(item.salesCount || 0)}</b><span>${money(item.grossRevenue || 0)}</span><span>${Number(item.revenueShare || 0)}%</span><small>aggregate only</small></article>`).join('') || emptyState('Chưa có dữ liệu course', 'Publish course để bắt đầu thu thập chỉ số tổng hợp.')}</section></div>`;
  }

  Object.assign(global, { P77MonetizationConfigService, P77SubscriptionService, BackendEntitlementService, PaymentProviderService, PremiumTrialLifecycleService, PremiumCourseService, PurchaseHistoryService, CreatorRevenueFoundationService, BusinessDashboardService, ConversionAnalyticsService });
  global.KLEARN_EXTRA_VIEWS = { ...(global.KLEARN_EXTRA_VIEWS || {}), 'premium-benefits-p77': benefitsView, 'premium-courses-p77': coursesView, 'premium-course-p77': courseDetailView, 'my-purchases-p77': purchasesView, 'admin-business-p77': () => dashboardView('admin'), 'teacher-business-p77': () => dashboardView('teacher') };
  const previousAfterRender = global.KLEARN_AFTER_RENDER;
  global.KLEARN_AFTER_RENDER = () => {
    previousAfterRender?.();
    if (!state.currentUser) return;
    if (state.currentView === 'premium-center' && !document.querySelector('[data-p77-entry]')) document.querySelector('.p67-ethics')?.insertAdjacentHTML('afterend', '<section class="section p77-entry"><div><small>P77 · PREMIUM PLATFORM</small><b>Benefits · Courses · Purchases · Creator Revenue</b><span>Mock payment, backend entitlement và dashboard aggregate.</span></div><button class="btn primary" data-p77-entry>Mở P77</button></section>');
    document.querySelector('[data-p77-entry]')?.addEventListener('click', () => setView('premium-benefits-p77'), { once: true });
    if (!routes.has(state.currentView)) return;
    if (!runtime.config) { P77MonetizationConfigService.load(); return; }
    document.querySelectorAll('[data-p77-course]').forEach((button) => { button.onclick = () => PremiumCourseService.select(button.dataset.p77Course); });
    document.querySelector('[data-p77-open-free]')?.addEventListener('click', () => toast('Nội dung Free luôn có thể học; progress vẫn dùng Learning Core.'), { once: true });
    document.querySelector('[data-p77-trial]')?.addEventListener('click', async () => { const result = await PremiumTrialLifecycleService.start(); toast(result.ok ? 'Trial Premium 7 ngày đã được backend xác nhận. Không tự gia hạn.' : `Chưa thể bắt đầu trial: ${result.reason}`); if (result.ok) render(); }, { once: true });
    document.querySelectorAll('[data-p77-checkout]').forEach((button) => { button.onclick = async () => { const result = await PaymentProviderService.createSubscriptionCheckout(button.dataset.p77Checkout); toast(result.ok ? 'Mock checkout đã tạo. Chưa có entitlement nào được mở từ client.' : `Checkout chưa sẵn sàng: ${result.reason || result.error}`); }; });
    document.querySelector('[data-p77-buy]')?.addEventListener('click', async (event) => { const result = await PremiumCourseService.purchase(event.currentTarget.dataset.p77Buy); toast(result.ok && result.unlocked ? 'Mock purchase đã được backend xác minh và course đã mở.' : `Purchase thất bại: ${result.reason || 'server verification required'}`); if (result.ok) setView('my-purchases-p77'); }, { once: true });
  };
  if (routes.has(state.currentView) || state.currentView === 'premium-center') P77MonetizationConfigService.load();
})(window);
