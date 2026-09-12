/* Tiếng Hàn - TamHoanq · P67 ethical Free/Premium/Pro architecture. */
(function buildPremiumMonetizationArchitecture(global) {
  'use strict';
  const app = global.KLEARN_APP;
  if (!app) return;
  const { state, STORAGE_KEYS, storage, render, setView, toast, escapeHtml, AccessControlService } = app;
  const routes = new Set(['premium-center', 'subscription-admin']);
  const runtime = state.premiumMonetization || (state.premiumMonetization = { content: null, loading: null, error: '', projection: null, quota: null, adminResult: null, adminSnapshot: null, adminLoading: null });
  const CORE_FEATURES = new Set(['hangul_foundation', 'basic_lessons', 'basic_vocabulary', 'basic_srs', 'progress_tracking', 'beginner_path', 'basic_grammar', 'basic_listening', 'basic_speaking', 'basic_writing', 'dictionary_translation', 'handwriting_pronunciation', 'offline_core', 'daily_learning', 'mastery_error_notebook', 'journal_achievements', 'community_foundation', 'core_learning', 'standard_practice', 'basic_progress']);
  const rank = Object.freeze({ free: 0, premium: 1, pro: 2 });
  const now = () => new Date().toISOString();
  const clean = (value, max = 500) => String(value || '').normalize('NFC').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);
  const cloudUser = () => global.SupabaseService?.session?.user || null;
  const token = () => global.SupabaseService?.session?.access_token || '';
  const role = () => global.RolePermissionService?.role?.() || AccessControlService?.role?.() || 'student';
  const statusName = (value) => ({ trialing: 'trial', trial: 'trial', active: 'active', expired: 'expired', inactive: 'expired', past_due: 'expired', canceled: 'cancelled', cancelled: 'cancelled' })[String(value || '').toLowerCase()] || 'expired';

  const MonetizationArchitectureContentService = {
    hydrate(value) {
      if (Number(value?.schemaVersion) !== 1 || value?.principles?.coreLearningAlwaysFree !== true || value?.principles?.clientCanGrantEntitlement !== false || value?.principles?.serverValidationRequired !== true || value?.principles?.autoChargeTrial !== false || !Array.isArray(value.plans) || value.plans.map((plan) => plan.id).join(',') !== 'free,premium,pro') throw new Error('P67 ethical monetization gate failed');
      runtime.content = value; runtime.error = ''; return value;
    },
    async load() {
      if (runtime.content) return runtime.content; if (runtime.loading) return runtime.loading;
      runtime.loading = fetch('./content/premium-monetization-architecture.json', { cache: 'default' }).then((response) => { if (!response.ok) throw new Error(`P67 content ${response.status}`); return response.json(); }).then((value) => this.hydrate(value)).catch((error) => { runtime.error = clean(error.message, 160); return null; }).finally(() => { runtime.loading = null; if (routes.has(state.currentView)) render(); });
      return runtime.loading;
    }
  };

  const EntitlementCacheService = {
    read() {
      const userId = state.currentUser?.id; if (!userId) return null;
      const all = storage.get(STORAGE_KEYS.subscriptionEntitlementCache, {}); const cached = all?.[userId];
      if (!cached || cached.userId !== userId || cached.source !== 'server-cache' || !cached.verifiedAt) return null;
      const maxAge = 7 * 24 * 60 * 60 * 1000; if (Date.now() - new Date(cached.verifiedAt).getTime() > maxAge) return null;
      return cached;
    },
    write(projection) {
      if (!state.currentUser || projection?.source !== 'server') return null;
      const all = storage.get(STORAGE_KEYS.subscriptionEntitlementCache, {}); const safe = all && typeof all === 'object' && !Array.isArray(all) ? all : {};
      safe[state.currentUser.id] = { ...projection, userId: state.currentUser.id, source: 'server-cache', verifiedAt: now() };
      storage.set(STORAGE_KEYS.subscriptionEntitlementCache, safe); return safe[state.currentUser.id];
    },
    isAuthoritative() { return false; }
  };

  const ServerEntitlementService = {
    normalize(value = {}, source = 'server') {
      const plan = ['free','premium','pro'].includes(String(value.plan || value.tier).toLowerCase()) ? String(value.plan || value.tier).toLowerCase() : 'free';
      const status = plan === 'free' ? 'active' : statusName(value.status);
      const endDate = value.endDate || value.end_date || value.currentPeriodEnd || value.current_period_end || null;
      const notEnded = !endDate || new Date(endDate).getTime() > Date.now();
      const accessActive = plan === 'free' || (['trial','active','cancelled'].includes(status) && notEnded);
      const effectivePlan = accessActive ? plan : 'free';
      return { plan, effectivePlan, status: accessActive ? status : 'expired', startDate: value.startDate || value.start_date || null, endDate, paymentProvider: value.paymentProvider || value.payment_provider || null, source, serverVerified: source === 'server', accessActive, fetchedAt: now() };
    },
    metadataProjection() {
      const meta = cloudUser()?.app_metadata || {}; const data = meta.commercial_subscription || meta.subscription || {};
      const tier = meta.subscription_tier || data.plan || data.tier; const status = meta.subscription_status || data.status;
      if (!tier || !status) return null;
      return this.normalize({ plan: tier, status, startDate: data.start_date, endDate: data.end_date || data.current_period_end, paymentProvider: data.payment_provider }, 'server-token');
    },
    current() { return runtime.projection || this.metadataProjection() || EntitlementCacheService.read() || this.normalize({ plan: 'free', status: 'active' }, 'default'); },
    status() { const value = this.current(); return { tier: value.effectivePlan, plan: value.plan, status: value.status, source: value.source, paymentEnabled: false, currentPeriodEnd: value.endDate }; },
    activeTier() { return this.current().effectivePlan; },
    tier() { return this.current().effectivePlan; },
    plan() { return runtime.content?.plans?.find((item) => item.id === this.activeTier()) || runtime.content?.plans?.[0] || { id: 'free', features: [...CORE_FEATURES] }; },
    entitlements() { return new Set([...CORE_FEATURES, ...(this.plan().features || [])]); },
    can(feature) { return CORE_FEATURES.has(feature) || this.entitlements().has(feature); },
    canActivateFromClient() { return false; },
    acceptServerProjection(value) { runtime.projection = this.normalize(value, 'server'); EntitlementCacheService.write(runtime.projection); return runtime.projection; },
    async refresh() {
      if (!token()) return this.current();
      try {
        const response = await fetch('/api/billing/entitlements', { method: 'GET', credentials: 'same-origin', headers: { authorization: `Bearer ${token()}` } });
        const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
        runtime.quota = body.aiUsage || null; return this.acceptServerProjection(body.subscription || body);
      } catch (_) { return this.current(); }
    }
  };

  const FeaturePermissionService = {
    mapping() { return runtime.content?.featureValueMap || []; },
    access(feature) {
      const plan = ServerEntitlementService.activeTier();
      if (CORE_FEATURES.has(feature)) return { feature, allowed: true, permission: 'allowed', requiredPlan: 'free', plan, source: 'ethical-core-rule' };
      if (feature === 'ai_assistance') {
        const item = runtime.content?.plans?.find((entry) => entry.id === plan); const limit = Number(item?.aiDailyLimit || 0); const used = Number(runtime.quota?.used || 0); const remaining = Math.max(0, limit - used);
        return { feature, allowed: remaining > 0, permission: remaining > 0 ? 'limited' : 'blocked', requiredPlan: 'free', plan, limit, used, remaining, source: runtime.quota?.source || 'plan-limit' };
      }
      const required = this.mapping().find((item) => item.key === feature)?.recommendedTier || 'premium'; const allowed = rank[plan] >= rank[required];
      return { feature, allowed, permission: allowed ? 'allowed' : 'blocked', requiredPlan: required, plan, source: ServerEntitlementService.current().source };
    },
    assert(feature) { const result = this.access(feature); return result.allowed ? result : { ...result, message: `Tính năng mở rộng thuộc gói ${result.requiredPlan}. Việc học cốt lõi và tiến độ vẫn miễn phí.` }; }
  };

  const EthicalTrialService = {
    config() { return runtime.content?.trial || null; },
    async start() {
      const config = this.config(); if (!config || !token() || ServerEntitlementService.activeTier() !== 'free') return { ok: false, reason: 'not-eligible' };
      const response = await fetch('/api/billing/trial', { method: 'POST', credentials: 'same-origin', headers: { authorization: `Bearer ${token()}`, 'content-type': 'application/json' }, body: JSON.stringify({ plan: config.plan, acceptedNoAutoCharge: true }) });
      const body = await response.json().catch(() => ({})); if (!response.ok) return { ok: false, reason: body.error || `HTTP ${response.status}` };
      if (body.subscription) ServerEntitlementService.acceptServerProjection(body.subscription); return { ok: true, subscription: body.subscription, autoCharge: false };
    }
  };

  const ProviderNeutralPaymentService = {
    providers() { return runtime.content?.payment?.providers || []; },
    pricesDecided() { return runtime.content?.payment?.prices !== null; },
    async checkout(plan, provider, billingPeriod = 'monthly') {
      if (!['premium','pro'].includes(plan) || !this.providers().some((item) => item.id === provider) || !['monthly','yearly'].includes(billingPeriod) || !token()) return { ok: false, reason: 'invalid-or-unauthenticated', entitlementChanged: false };
      const response = await fetch('/api/billing/checkout', { method: 'POST', credentials: 'same-origin', headers: { authorization: `Bearer ${token()}`, 'content-type': 'application/json' }, body: JSON.stringify({ plan, provider, billingPeriod, idempotencyKey: `checkout-${Date.now().toString(36)}` }) });
      const body = await response.json().catch(() => ({})); return { ok: response.ok, reason: body.error || '', checkoutUrl: body.checkoutUrl || '', entitlementChanged: false };
    },
    confirmOnClient() { return { ok: false, reason: 'server-webhook-required', entitlementChanged: false }; }
  };

  const EthicalCancellationService = {
    async request(reason = '') {
      if (!token() || ServerEntitlementService.activeTier() === 'free') return { ok: false, reason: 'no-active-paid-plan' };
      const response = await fetch('/api/billing/cancel', { method: 'POST', credentials: 'same-origin', headers: { authorization: `Bearer ${token()}`, 'content-type': 'application/json' }, body: JSON.stringify({ reason: clean(reason, 240), preserveProgress: true }) });
      const body = await response.json().catch(() => ({})); return response.ok ? { ok: true, request: body.request, progressPreserved: true } : { ok: false, reason: body.error || `HTTP ${response.status}` };
    }
  };

  const SubscriptionAdminService = {
    allowed() { return role() === 'admin'; },
    async load() {
      if (!this.allowed() || !global.SupabaseService?.client) return { ok: false, reason: 'not-authorized' };
      if (runtime.adminLoading) return runtime.adminLoading;
      const client = global.SupabaseService.client;
      runtime.adminLoading = Promise.all([
        client.from('commercial_subscriptions').select('user_id,tier,status,start_date,end_date,payment_provider,updated_at').order('updated_at', { ascending: false }).limit(50),
        client.from('commercial_subscription_audit').select('user_id,actor_id,action,from_plan,to_plan,from_status,to_status,reason,source,created_at').order('created_at', { ascending: false }).limit(50),
        client.from('commercial_payment_events').select('provider,event_type,status,amount,currency,created_at').order('created_at', { ascending: false }).limit(25)
      ]).then(([subscriptions, audit, payments]) => {
        const error = subscriptions.error || audit.error || payments.error; if (error) return { ok: false, reason: error.message };
        runtime.adminSnapshot = { subscriptions: subscriptions.data || [], audit: audit.data || [], payments: payments.data || [] }; return { ok: true, data: runtime.adminSnapshot };
      }).finally(() => { runtime.adminLoading = null; render(); });
      return runtime.adminLoading;
    },
    async set({ userId, plan, status, endDate, reason }) {
      if (!this.allowed() || !global.SupabaseService?.client || !['free','premium','pro'].includes(plan) || !['trial','active','expired','cancelled'].includes(status)) return { ok: false, reason: 'not-authorized-or-invalid' };
      const { data, error } = await global.SupabaseService.client.rpc('commercial_admin_set_subscription', { target_user_id: userId, target_plan: plan, target_status: status, target_end_date: endDate || null, change_reason: clean(reason, 240) });
      if (error) return { ok: false, reason: error.message }; runtime.adminSnapshot = null; return { ok: true, data };
    },
    clientCannotGrant() { return true; }
  };

  function heading(back, eyebrow, title, description) { return `<section class="section page-heading p67-heading"><button class="back-link" data-view="${back}">←</button><p class="eyebrow">${escapeHtml(eyebrow)}</p><h1 class="headline">${escapeHtml(title)}</h1><p class="subtle">${escapeHtml(description)}</p></section>`; }
  function loading() { MonetizationArchitectureContentService.load(); return `${heading('profile','P67 · MONETIZATION','Đang tải kiến trúc gói học…','Kiểm tra ethical access gate và server authority.')}`; }
  function planCard(plan, current) { const isCurrent = current === plan.id; return `<article class="p67-plan ${isCurrent ? 'current' : ''}"><header><div><small>${isCurrent ? 'GÓI HIỆN TẠI' : plan.id.toUpperCase()}</small><h2>${escapeHtml(plan.name)}</h2></div><span>${plan.id === 'free' ? 'Luôn miễn phí' : 'Chưa công bố giá'}</span></header><p>${escapeHtml(plan.promise)}</p><small>${escapeHtml(plan.audience)}</small><ul>${plan.features.map((feature) => `<li>✓ ${escapeHtml(FeaturePermissionService.mapping().find((item) => item.key === feature)?.feature || feature.replaceAll('_',' '))}</li>`).join('')}</ul><div class="p67-ai"><b>${plan.aiDailyLimit} lượt AI/ngày</b><span>${plan.fairUse ? 'Fair use · không gọi là vô hạn tuyệt đối' : 'Giới hạn rõ ràng, không tắt AI với Free'}</span></div>${plan.id === 'free' ? '<button class="btn secondary" disabled>Luôn có thể học</button>' : `<button class="btn ${isCurrent ? 'secondary' : 'primary'}" data-p67-interest="${plan.id}" ${isCurrent ? 'disabled' : ''}>${isCurrent ? 'Đang sử dụng' : 'Xem lựa chọn nâng cấp'}</button>`}</article>`; }
  function premiumView() {
    if (!runtime.content) return loading(); const subscription = ServerEntitlementService.current(); const ai = FeaturePermissionService.access('ai_assistance');
    return `${heading('profile','P67 · PREMIUM PRODUCT','Gói học rõ ràng, không pay-to-learn','Free học thật. Premium và Pro chỉ mở rộng chiều sâu, phản hồi và lộ trình nghề nghiệp.')}<section class="p67-status section"><div><small>QUYỀN HIỆN TẠI</small><b>${escapeHtml(subscription.effectivePlan.toUpperCase())}</b><span>${escapeHtml(subscription.status)} · ${escapeHtml(subscription.source)}</span></div><div><small>AI HÔM NAY</small><b>${ai.remaining}/${ai.limit}</b><span>Còn lại theo fair-use plan</span></div><div><small>THANH TOÁN</small><b>Server-only</b><span>Client không thể tự mở gói</span></div></section><section class="p67-ethics section"><b>Bạn vẫn có thể tiếp tục học miễn phí.</b><span>${escapeHtml(runtime.content.upgradeCopy)}</span></section><section class="p67-plans section">${runtime.content.plans.map((plan) => planCard(plan, subscription.effectivePlan)).join('')}</section><section class="p67-comparison section"><div class="section-heading"><div><p class="eyebrow">VALUE MAPPING</p><h2 class="section-title">Giá trị, chi phí và tier đề xuất</h2></div></div><div class="p67-table" role="table">${runtime.content.featureValueMap.map((item) => `<div role="row"><b role="cell">${escapeHtml(item.feature)}</b><span role="cell">${escapeHtml(item.userValue)}</span><small role="cell">Cost: ${escapeHtml(item.cost)}</small><em role="cell">${escapeHtml(item.recommendedTier)}</em></div>`).join('')}</div></section><section class="p67-trial-cancel section"><article><small>7-DAY PREMIUM TRIAL</small><h2>Thử trước, không tự trừ tiền</h2><p>Không cần phương thức thanh toán. Hết trial sẽ trở về Free trừ khi bạn chủ động xác nhận gói trả phí.</p>${subscription.effectivePlan === 'free' ? '<button class="btn primary" data-p67-trial>Bắt đầu trial sau khi xác nhận</button>' : '<button class="btn secondary" disabled>Không áp dụng cho gói hiện tại</button>'}</article><article><small>CANCEL WITHOUT FRICTION</small><h2>Hủy dễ dàng, giữ nguyên tiến độ</h2><p>${escapeHtml(runtime.content.cancelCopy)}</p>${subscription.effectivePlan !== 'free' ? '<button class="btn secondary" data-p67-cancel>Gửi yêu cầu hủy</button>' : '<button class="btn secondary" disabled>Không có gói trả phí</button>'}</article></section>${SubscriptionAdminService.allowed() ? '<section class="section"><button class="btn secondary" data-view="subscription-admin">Mở quản trị subscription →</button></section>' : ''}`;
  }
  function adminView() {
    if (!SubscriptionAdminService.allowed()) return `${heading('premium-center','P67 · ADMIN','Không có quyền truy cập','Grant/revoke chỉ dành cho Admin và luôn đi qua RPC có audit log.')}<section class="empty-state section"><h2>🔒 Server role required</h2></section>`;
    if (!runtime.adminSnapshot && !runtime.adminLoading) SubscriptionAdminService.load();
    const snapshot = runtime.adminSnapshot || { subscriptions: [], audit: [], payments: [] };
    return `${heading('premium-center','P67 · ADMIN','Quản trị subscription','Mọi thay đổi đi qua security-definer RPC, ghi audit và không bao giờ xóa progress.')}<form class="p67-admin section" data-p67-admin><label>User UUID<input name="userId" required autocomplete="off"></label><label>Plan<select name="plan"><option>free</option><option>premium</option><option>pro</option></select></label><label>Status<select name="status"><option>active</option><option>trial</option><option>expired</option><option>cancelled</option></select></label><label>End date<input name="endDate" type="datetime-local"></label><label>Lý do<textarea name="reason" maxlength="240" required></textarea></label><button class="btn primary">Gửi thay đổi có audit</button><output>${escapeHtml(runtime.adminResult || '')}</output></form><section class="p67-admin-ledger section"><article><h2>Subscriptions</h2>${snapshot.subscriptions.length ? snapshot.subscriptions.map((item) => `<div><b>${escapeHtml(item.user_id)}</b><span>${escapeHtml(item.tier)} · ${escapeHtml(item.status)}</span><small>${escapeHtml(item.payment_provider || 'no provider')}</small></div>`).join('') : '<p>Chưa có bản ghi hoặc đang tải…</p>'}</article><article><h2>Access audit</h2>${snapshot.audit.length ? snapshot.audit.map((item) => `<div><b>${escapeHtml(item.action)}</b><span>${escapeHtml(item.from_plan || 'none')} → ${escapeHtml(item.to_plan || 'free')}</span><small>${escapeHtml(item.source)}</small></div>`).join('') : '<p>Chưa có bản ghi hoặc đang tải…</p>'}</article><article><h2>Payment audit</h2>${snapshot.payments.length ? snapshot.payments.map((item) => `<div><b>${escapeHtml(item.provider)} · ${escapeHtml(item.status)}</b><span>${Number(item.amount || 0)} ${escapeHtml(item.currency || '')}</span><small>${escapeHtml(item.event_type)}</small></div>`).join('') : '<p>Chưa có sự kiện hoặc đang tải…</p>'}</article></section>`;
  }

  Object.assign(global, { MonetizationArchitectureContentService, EntitlementCacheService, ServerEntitlementService, FeaturePermissionService, EthicalTrialService, ProviderNeutralPaymentService, EthicalCancellationService, SubscriptionAdminService });
  global.SubscriptionService = ServerEntitlementService;
  global.PremiumFeatureService = {
    all: () => FeaturePermissionService.mapping().filter((item) => item.recommendedTier !== 'free').map((item) => ({ id: item.key, title: { vi: item.feature, en: item.feature, 'zh-CN': item.feature }, description: { vi: item.userValue, en: item.userValue, 'zh-CN': item.userValue } })),
    access: (feature) => FeaturePermissionService.access(feature)
  };
  global.KLEARN_EXTRA_VIEWS = { ...(global.KLEARN_EXTRA_VIEWS || {}), 'premium-center': premiumView, 'subscription-admin': adminView };
  if (global.GlobalSearchService && !global.GlobalSearchService.__p67Wrapped) { const original = global.GlobalSearchService.search.bind(global.GlobalSearchService); global.GlobalSearchService.search = (query = '') => { const result = original(query); if (/premium|nâng cấp|gói học|subscription|pro plan/i.test(String(query))) result.studyTools = [{ id: 'premium-center', view: 'premium-center', title: 'Free · Premium · Pro', description: 'So sánh giá trị và quyền học minh bạch' }, ...(result.studyTools || [])]; return result; }; global.GlobalSearchService.__p67Wrapped = true; }
  const previousAfterRender = global.KLEARN_AFTER_RENDER;
  global.KLEARN_AFTER_RENDER = () => {
    previousAfterRender?.(); if (!state.currentUser) return;
    if (state.currentView === 'business-center' && !document.querySelector('[data-p67-entry]')) document.querySelector('.biz-launch-grid')?.insertAdjacentHTML('afterbegin', '<button data-p67-entry><span>★</span><b>Free · Premium · Pro</b><small>Giá trị rõ ràng · không pay-to-learn</small></button>');
    if (state.currentView === 'billing-center' && !document.querySelector('[data-p67-entry]')) document.querySelector('.biz-plan-grid')?.insertAdjacentHTML('beforebegin', '<button class="p67-billing-entry section" data-p67-entry><b>Mở kiến trúc gói học mới</b><span>Free học thật · trial không tự trừ tiền · hủy giữ tiến độ →</span></button>');
    document.querySelectorAll('[data-p67-entry]').forEach((button) => { button.onclick = () => setView('premium-center'); });
    if (!routes.has(state.currentView)) return;
    if (!runtime.content) { MonetizationArchitectureContentService.load(); return; }
    document.querySelectorAll('[data-p67-interest]').forEach((button) => { button.onclick = () => { global.UserResearchService?.track?.('upgrade_interest', { plan: button.dataset.p67Interest }); toast('Đã ghi nhận nhu cầu. Giá chưa được quyết định và chưa có giao dịch nào được tạo.'); }; });
    document.querySelector('[data-p67-trial]')?.addEventListener('click', async () => { const result = await EthicalTrialService.start(); toast(result.ok ? 'Trial đã được server xác nhận. Không có tự động trừ tiền.' : `Chưa thể bắt đầu trial: ${result.reason}`); if (result.ok) render(); }, { once: true });
    document.querySelector('[data-p67-cancel]')?.addEventListener('click', async () => { const result = await EthicalCancellationService.request('user_requested_in_app'); toast(result.ok ? 'Đã gửi yêu cầu hủy. Tiến độ học được giữ nguyên.' : `Chưa thể gửi yêu cầu: ${result.reason}`); }, { once: true });
    const form = document.querySelector('[data-p67-admin]'); if (form) form.onsubmit = async (event) => { event.preventDefault(); const data = new FormData(form); const result = await SubscriptionAdminService.set({ userId: clean(data.get('userId'), 80), plan: data.get('plan'), status: data.get('status'), endDate: data.get('endDate') || null, reason: data.get('reason') }); runtime.adminResult = result.ok ? 'Đã cập nhật và ghi audit.' : `Không thể cập nhật: ${result.reason}`; if (result.ok) await SubscriptionAdminService.load(); render(); };
  };
  if (routes.has(state.currentView)) MonetizationArchitectureContentService.load();
})(window);
