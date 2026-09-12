/* Tiếng Hàn - TamHoanq · P39 Business Monetization Foundation */
(function buildMonetizationFoundation(global) {
  'use strict';
  const app = global.KLEARN_APP;
  if (!app) return;
  const { state, STORAGE_KEYS, render, setView, toast, escapeHtml, userScoped, saveUserScoped, AccessControlService } = app;
  const STORE_KEY = STORAGE_KEYS.monetization || 'klearn_monetization';
  const routes = new Set(['business-center', 'billing-center', 'organization-plans', 'revenue-center', 'crm-center']);
  const runtime = state.monetizationRuntime || (state.monetizationRuntime = { content: null, loading: false, error: '', coupon: null, revenue: null, crm: [] });
  const now = () => new Date().toISOString();
  const clean = (value, max = 400) => String(value || '').normalize('NFC').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);
  const role = () => global.RolePermissionService?.role?.() || AccessControlService?.role?.() || 'student';
  const cloud = () => Boolean(global.SupabaseService?.client && global.SupabaseService?.session?.user?.id);
  const emptyStore = () => ({ version: 1, checkoutAttempts: [], couponChecks: [], referrals: [], quoteRequests: [] });
  const readStore = () => { const value = userScoped(STORE_KEY)[0]; return value && typeof value === 'object' && !Array.isArray(value) ? { ...emptyStore(), ...value } : emptyStore(); };
  const writeStore = (value) => { const next = { ...emptyStore(), ...value, version: 1, updatedAt: now() }; saveUserScoped(STORE_KEY, [next], 1); return next; };
  const pushRecord = (key, value, limit = 30) => { const current = readStore(); current[key] = [value, ...(Array.isArray(current[key]) ? current[key] : [])].slice(0, limit); writeStore(current); return value; };
  const safeFetch = async (url, options = {}) => {
    if (!cloud() || typeof global.fetch !== 'function') return { ok: false, unavailable: true, reason: 'cloud-required' };
    if (!/^\/api\/billing\/[a-z0-9/_-]+$/i.test(String(url || ''))) return { ok: false, unavailable: true, reason: 'unsafe-endpoint' };
    try {
      const accessToken = global.SupabaseService?.session?.access_token;
      const response = await global.fetch(url, { ...options, credentials: 'same-origin', headers: { 'content-type': 'application/json', ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}), ...(options.headers || {}) } });
      const body = await response.json().catch(() => ({}));
      return response.ok ? { ok: true, data: body } : { ok: false, unavailable: false, reason: clean(body.error || `HTTP ${response.status}`, 120) };
    } catch (error) { return { ok: false, unavailable: true, reason: clean(error?.message || 'network-unavailable', 120) }; }
  };

  const MonetizationContentService = {
    hydrate(value) {
      const endpoints = [value?.payment?.checkoutEndpoint, value?.payment?.portalEndpoint, value?.payment?.couponEndpoint, value?.payment?.referralEndpoint];
      if (value?.verified !== true || value.reviewStatus !== 'approved' || !Array.isArray(value.plans) || value.payment?.clientCanActivatePremium !== false || value.payment?.storesCardData !== false || endpoints.some((endpoint) => !/^\/api\/billing\/[a-z0-9/_-]+$/i.test(String(endpoint || '')))) throw new Error('Monetization content quality gate failed');
      runtime.content = value; runtime.error = ''; return value;
    },
    async load() {
      if (runtime.content) return runtime.content;
      if (runtime.loading) return runtime.loading;
      runtime.loading = fetch('./content/monetization-foundation.json', { cache: 'default' }).then((response) => { if (!response.ok) throw new Error(`Monetization content ${response.status}`); return response.json(); }).then((value) => this.hydrate(value)).catch((error) => { runtime.error = clean(error.message, 160); return null; }).finally(() => { runtime.loading = false; if (routes.has(state.currentView)) render(); });
      return runtime.loading;
    }
  };

  const CommercialSubscriptionService = {
    status() { return global.SubscriptionService?.status?.() || { tier: 'free', status: 'none', source: 'default', paymentEnabled: false }; },
    tier() { return global.SubscriptionService?.activeTier?.() || 'free'; },
    plans() { return runtime.content?.plans || []; },
    can(feature) { if (['core_learning', 'standard_practice', 'basic_progress'].includes(feature)) return true; return Boolean(global.PremiumFeatureService?.access?.(feature)?.allowed); },
    canActivateFromClient() { return false; }
  };

  const PaymentArchitectureService = {
    config() { return runtime.content?.payment || null; },
    async createCheckout({ planId = 'premium', billingPeriod = 'monthly', couponCode = '' } = {}) {
      if (!this.config() || !['monthly', 'yearly'].includes(billingPeriod) || planId !== 'premium') return { ok: false, reason: 'invalid-plan', subscriptionChanged: false };
      const attempt = { id: `checkout-${Date.now().toString(36)}`, planId, billingPeriod, couponApplied: Boolean(couponCode), createdAt: now(), status: 'requested', subscriptionChanged: false };
      const result = await safeFetch(this.config().checkoutEndpoint, { method: 'POST', body: JSON.stringify({ planId, billingPeriod, couponCode: clean(couponCode, 32).toUpperCase(), idempotencyKey: attempt.id }) });
      pushRecord('checkoutAttempts', { ...attempt, status: result.ok ? 'server-created' : 'unavailable', reason: result.reason || '' });
      if (!result.ok) return { ok: false, unavailable: result.unavailable, reason: result.reason, subscriptionChanged: false };
      let checkoutUrl = '';
      try { const candidate = new URL(result.data.checkoutUrl || ''); if (candidate.protocol === 'https:' && this.config().allowedCheckoutHosts.includes(candidate.hostname)) checkoutUrl = candidate.href; } catch (_) { /* URL is optional until a provider is configured. */ }
      return { ok: true, checkoutUrl, checkoutId: result.data.checkoutId || '', subscriptionChanged: false };
    },
    async openPortal() { const config = this.config(); if (!config) return { ok: false, unavailable: true }; return safeFetch(config.portalEndpoint, { method: 'POST', body: '{}' }); },
    confirmClientPayment() { return { ok: false, reason: 'webhook-required', subscriptionChanged: false }; }
  };

  const CouponService = {
    normalize(code) { return clean(code, 32).toUpperCase(); },
    syntax(code) { const value = this.normalize(code); const config = runtime.content?.coupon; if (!config) return { valid: false, code: value, reason: 'content-unavailable' }; if (value.length < config.minimumCodeLength || value.length > config.maximumCodeLength || !(new RegExp(config.allowedPattern)).test(value)) return { valid: false, code: value, reason: 'invalid-format' }; return { valid: true, code: value, reason: 'server-validation-required' }; },
    async validate(code, planId = 'premium') {
      const syntax = this.syntax(code); runtime.coupon = syntax; if (!syntax.valid) return syntax;
      const result = await safeFetch(runtime.content.payment.couponEndpoint, { method: 'POST', body: JSON.stringify({ code: syntax.code, planId }) });
      const checked = { code: syntax.code, valid: Boolean(result.ok && result.data.valid), benefit: result.ok ? result.data.benefit || null : null, reason: result.ok ? (result.data.reason || '') : result.reason, checkedAt: now(), source: 'server' };
      runtime.coupon = checked; pushRecord('couponChecks', { codeHashHint: `${syntax.code.slice(0, 2)}***`, valid: checked.valid, checkedAt: checked.checkedAt }, 10); return checked;
    }
  };

  const ReferralProgramService = {
    code() { const meta = global.SupabaseService?.session?.user?.app_metadata || {}; return clean(meta.referral_code || '', 32); },
    history() { return readStore().referrals || []; },
    async attribute(code) {
      const normalized = CouponService.normalize(code); if (!CouponService.syntax(normalized).valid) return { ok: false, reason: 'invalid-format', rewardGranted: false };
      if (this.code() && normalized === this.code().toUpperCase()) return { ok: false, reason: 'self-referral', rewardGranted: false };
      const result = await safeFetch(runtime.content.payment.referralEndpoint, { method: 'POST', body: JSON.stringify({ referralCode: normalized }) });
      const record = { codeHint: `${normalized.slice(0, 2)}***`, status: result.ok ? (result.data.status || 'attributed') : 'unavailable', createdAt: now(), rewardGranted: false };
      pushRecord('referrals', record, 10); return { ok: result.ok, unavailable: result.unavailable, reason: result.reason || '', status: record.status, rewardGranted: false };
    }
  };

  const OrganizationPackageService = {
    packages() { return runtime.content?.organizationPackages || []; },
    canManage() { return ['teacher', 'admin'].includes(role()); },
    licenseStatus() { const organization = global.SchoolManagementService?.organizations?.()?.[0]; const subscription = organization?.subscription || null; return subscription ? { plan: subscription.plan, status: subscription.status, seatLimit: subscription.seat_limit, source: 'cloud' } : { plan: 'none', status: 'not-connected', seatLimit: null, source: 'unavailable' }; },
    async requestQuote({ packageId, organizationName, seats, note } = {}) {
      const item = this.packages().find((entry) => entry.id === packageId); const seatCount = Math.max(1, Math.min(10000, Math.round(Number(seats) || 0)));
      if (!item || clean(organizationName, 120).length < 2 || !seatCount) return { ok: false, reason: 'invalid-request' };
      const request = { id: `quote-${Date.now().toString(36)}`, packageId, seatCount, createdAt: now(), status: 'draft' };
      if (!cloud()) { pushRecord('quoteRequests', request); return { ok: false, offline: true, request }; }
      const userId = global.SupabaseService.session.user.id;
      const { data, error } = await global.SupabaseService.client.from('commercial_quote_requests').insert({ requester_id: userId, package_slug: packageId, organization_name: clean(organizationName, 120), requested_seats: seatCount, note: clean(note, 500) }).select('id,status,created_at').single();
      if (error) throw error; pushRecord('quoteRequests', { ...request, id: data.id, status: data.status || 'new' }); return { ok: true, offline: false, request: data };
    }
  };

  const RevenueAnalyticsService = {
    available() { return role() === 'admin'; },
    async refresh() {
      if (!this.available()) return null;
      if (!cloud()) { runtime.revenue = null; return null; }
      const { data, error } = await global.SupabaseService.client.from('commercial_revenue_daily').select('metric_date,currency,gross_revenue,net_revenue,refund_amount,new_subscriptions,canceled_subscriptions,coupon_redemptions,referral_conversions,active_licenses').order('metric_date', { ascending: false }).limit(90);
      if (error) throw error; runtime.revenue = Array.isArray(data) ? data : []; if (routes.has(state.currentView)) render(); return runtime.revenue;
    },
    snapshot() { if (!this.available() || !Array.isArray(runtime.revenue)) return null; return runtime.revenue.reduce((out, row) => ({ currency: row.currency || out.currency, grossRevenue: out.grossRevenue + Number(row.gross_revenue || 0), netRevenue: out.netRevenue + Number(row.net_revenue || 0), refunds: out.refunds + Number(row.refund_amount || 0), newSubscriptions: out.newSubscriptions + Number(row.new_subscriptions || 0), cancellations: out.cancellations + Number(row.canceled_subscriptions || 0), coupons: out.coupons + Number(row.coupon_redemptions || 0), referrals: out.referrals + Number(row.referral_conversions || 0), licenses: Math.max(out.licenses, Number(row.active_licenses || 0)) }), { currency: 'VND', grossRevenue: 0, netRevenue: 0, refunds: 0, newSubscriptions: 0, cancellations: 0, coupons: 0, referrals: 0, licenses: 0 }); }
  };

  const CustomerSupportService = {
    categories() { return runtime.content?.supportCategories || []; },
    async submit({ category, subject, message } = {}) { const allowed = this.categories().some((item) => item.id === category); const safeSubject = clean(subject, 120); const safeMessage = clean(message, 2000); if (!allowed || safeSubject.length < 3 || safeMessage.length < 10) return { ok: false, reason: 'invalid-request' }; const result = await global.SupportService.submit({ type: category, sourceId: 'business-center', message: `${safeSubject}\n${safeMessage}` }); return { ok: !result.offline, offline: Boolean(result.offline), data: result.data }; }
  };

  const CrmFoundationService = {
    available() { return role() === 'admin'; },
    stages() { return runtime.content?.crmStages || []; },
    records() { return this.available() ? runtime.crm : []; },
    async refresh() { if (!this.available()) return null; if (!cloud()) { runtime.crm = []; return []; } const { data, error } = await global.SupabaseService.client.from('commercial_crm_accounts').select('id,organization_id,account_name,stage,source,next_action_at,owner_id,updated_at').order('updated_at', { ascending: false }).limit(100); if (error) throw error; runtime.crm = data || []; if (state.currentView === 'crm-center') render(); return runtime.crm; },
    async move(accountId, stage) { if (!this.available() || !this.stages().some((item) => item.id === stage) || !cloud()) return { ok: false, reason: 'not-authorized' }; const { data, error } = await global.SupabaseService.client.from('commercial_crm_accounts').update({ stage, updated_at: now() }).eq('id', accountId).select('id,organization_id,account_name,stage,source,next_action_at,owner_id,updated_at').single(); if (error) throw error; await this.refresh(); return { ok: true, data }; }
  };

  const heading = (back, eyebrow, title, description) => `<section class="biz-heading section"><button class="back-btn" data-view="${back}">←</button><div><small>${eyebrow}</small><h1>${title}</h1><p>${description}</p></div></section>`;
  const loading = () => '<section class="empty-state section"><h2>Đang tải trung tâm thương mại…</h2></section>';
  const denied = (title) => `${heading('business-center', 'ROLE-BASED ACCESS', title, 'Quyền được xác thực từ cloud metadata và RLS.')}<section class="biz-empty section"><span>🔒</span><div><h2>Không có quyền truy cập</h2><p>Dữ liệu tài chính và CRM chỉ dành cho Admin.</p></div></section>`;
  const money = (value, currency = 'VND') => new Intl.NumberFormat('vi-VN', { style: 'currency', currency, maximumFractionDigits: currency === 'VND' ? 0 : 2 }).format(Number(value || 0));

  function businessView() { if (!runtime.content) return loading(); const subscription = CommercialSubscriptionService.status(); const license = OrganizationPackageService.licenseStatus(); const planLabel = subscription.tier === 'pro' ? 'Pro' : subscription.tier === 'premium' ? 'Premium' : 'Free'; return `${heading('profile', 'P39 · BUSINESS FOUNDATION', 'Trung tâm thương mại', 'Quản lý gói dịch vụ, ưu đãi, giới thiệu, giấy phép và hỗ trợ trong một luồng rõ ràng.')}<section class="biz-status section"><article><small>GÓI CÁ NHÂN</small><b>${planLabel}</b><span>${escapeHtml(subscription.status)}</span></article><article><small>GIẤY PHÉP TỔ CHỨC</small><b>${escapeHtml(license.plan)}</b><span>${escapeHtml(license.status)}</span></article><article><small>THANH TOÁN</small><b>Server xác nhận</b><span>Không lưu dữ liệu thẻ trên trình duyệt</span></article></section><section class="biz-launch-grid section"><button data-view="billing-center"><span>01</span><b>Gói & thanh toán</b><small>Free, Premium, Pro, coupon và referral</small></button><button data-view="organization-plans"><span>02</span><b>Doanh nghiệp & trường học</b><small>Gói nhóm, seat và yêu cầu tư vấn</small></button><button data-business-support><span>03</span><b>Hỗ trợ khách hàng</b><small>Subscription, hóa đơn và license</small></button>${role() === 'admin' ? '<button data-view="revenue-center"><span>04</span><b>Revenue Analytics</b><small>Chỉ số tổng hợp, không có PII</small></button><button data-view="crm-center"><span>05</span><b>CRM Foundation</b><small>Pipeline tối giản cho tổ chức</small></button>' : ''}</section><section class="biz-principles section"><b>Ranh giới an toàn</b><ul><li>Học cốt lõi luôn thuộc gói Free.</li><li>Client không thể tự cấp Premium hoặc Pro.</li><li>Checkout dùng idempotency key; webhook là nguồn xác nhận.</li></ul></section>`; }

  function billingView() { if (!runtime.content) return loading(); const current = CommercialSubscriptionService.tier(); const code = ReferralProgramService.code(); return `${heading('business-center', 'SUBSCRIPTION & PAYMENT', 'Gói học phù hợp nhu cầu', 'Premium mở rộng trải nghiệm; các chức năng học cốt lõi không bị khóa.')}<section class="biz-plan-grid section">${CommercialSubscriptionService.plans().map((plan) => `<article class="${current === plan.id ? 'current' : ''}"><header><div><small>${current === plan.id ? 'GÓI HIỆN TẠI' : 'LỰA CHỌN'}</small><h2>${plan.name}</h2></div><span>${plan.id === 'free' ? '0đ' : 'Liên hệ server'}</span></header><p>${escapeHtml(plan.summary)}</p><ul>${plan.features.map((item) => `<li>✓ ${escapeHtml(item.replaceAll('_', ' '))}</li>`).join('')}</ul>${plan.id === 'premium' ? '<button class="btn primary full" data-start-checkout>Tiếp tục nâng cấp</button>' : '<button class="btn secondary full" disabled>Luôn khả dụng</button>'}</article>`).join('')}</section><section class="biz-tools section"><form id="couponForm" class="biz-tool-card"><small>MÃ ƯU ĐÃI</small><h2>Kiểm tra coupon</h2><p>Giá trị chỉ có hiệu lực sau khi server xác thực.</p><label>Mã<input name="code" maxlength="32" autocomplete="off" required placeholder="Nhập mã"></label><button class="btn secondary" type="submit">Kiểm tra</button><output>${runtime.coupon ? (runtime.coupon.valid ? 'Mã hợp lệ theo server.' : `Chưa áp dụng: ${escapeHtml(runtime.coupon.reason || '')}`) : ''}</output></form><form id="referralForm" class="biz-tool-card"><small>REFERRAL</small><h2>Giới thiệu minh bạch</h2><p>${code ? `Mã của bạn: <b>${escapeHtml(code)}</b>` : 'Mã giới thiệu được server cấp; tài khoản này chưa có mã.'}</p><label>Mã người giới thiệu<input name="code" maxlength="32" autocomplete="off" required></label><button class="btn secondary" type="submit">Ghi nhận</button></form></section><section class="biz-payment-note section"><b>Payment architecture</b><span>Checkout → nhà cung cấp thanh toán → webhook → cập nhật entitlement. Không có nút nào trên trang này tự đổi tài khoản thành Premium.</span></section>`; }

  function organizationView() { if (!runtime.content) return loading(); const license = OrganizationPackageService.licenseStatus(); return `${heading('business-center', 'B2B & EDUCATION', 'Gói cho doanh nghiệp và trường học', 'Seat, quyền quản trị và báo cáo được giới hạn theo tổ chức.')}<section class="biz-license section"><div><small>LICENSE HIỆN TẠI</small><b>${escapeHtml(license.plan)}</b><span>${license.seatLimit ? `${license.seatLimit} seats` : 'Chưa có dữ liệu cloud'}</span></div></section><section class="biz-org-grid section">${OrganizationPackageService.packages().map((item) => `<article><small>${item.audience.toUpperCase()} · ${escapeHtml(item.seatRange)} SEATS</small><h2>${escapeHtml(item.name)}</h2><ul>${item.features.map((feature) => `<li>✓ ${escapeHtml(feature)}</li>`).join('')}</ul><button class="btn secondary" data-quote-package="${item.id}">Yêu cầu tư vấn</button></article>`).join('')}</section><form id="quoteForm" class="biz-form section hidden"><input type="hidden" name="packageId"><h2>Yêu cầu báo giá</h2><label>Tên đơn vị<input name="organizationName" maxlength="120" required></label><label>Số người học<input name="seats" type="number" min="1" max="10000" required></label><label>Nhu cầu<textarea name="note" rows="3" maxlength="500"></textarea></label><button class="btn primary" type="submit">Gửi yêu cầu</button></form>`; }

  function revenueView() { if (!RevenueAnalyticsService.available()) return denied('Revenue Analytics'); const value = RevenueAnalyticsService.snapshot(); if (!value) return `${heading('business-center', 'REVENUE ANALYTICS', 'Doanh thu tổng hợp', 'Không suy diễn số liệu khi backend chưa kết nối.')}<section class="biz-empty section"><span>—</span><div><h2>Chưa có dữ liệu backend</h2><p>Kết nối Supabase với quyền Admin để đọc aggregate 90 ngày.</p></div></section>`; return `${heading('business-center', 'REVENUE ANALYTICS', 'Doanh thu 90 ngày', 'Chỉ số tổng hợp; không hiển thị dữ liệu thanh toán cá nhân.')}<section class="biz-metrics section"><article><small>GROSS</small><b>${money(value.grossRevenue, value.currency)}</b></article><article><small>NET</small><b>${money(value.netRevenue, value.currency)}</b></article><article><small>NEW PREMIUM</small><b>${value.newSubscriptions}</b></article><article><small>CANCELLED</small><b>${value.cancellations}</b></article><article><small>COUPON</small><b>${value.coupons}</b></article><article><small>REFERRAL</small><b>${value.referrals}</b></article></section>`; }

  function crmView() { if (!CrmFoundationService.available()) return denied('CRM Foundation'); const records = CrmFoundationService.records(); return `${heading('business-center', 'CRM FOUNDATION', 'Pipeline tổ chức', 'Chỉ lưu dữ liệu vận hành tối thiểu; không đưa nhật ký học, chat hoặc dữ liệu thẻ vào CRM.')}<section class="biz-crm-board section">${CrmFoundationService.stages().map((stage) => `<article><header><b>${escapeHtml(stage.label)}</b><span>${records.filter((item) => item.stage === stage.id).length}</span></header>${records.filter((item) => item.stage === stage.id).map((item) => `<div class="biz-crm-item"><b>${escapeHtml(item.account_name)}</b><small>${escapeHtml(item.source || 'direct')}</small><select data-crm-id="${item.id}" aria-label="Chuyển giai đoạn">${CrmFoundationService.stages().map((option) => `<option value="${option.id}" ${option.id === item.stage ? 'selected' : ''}>${escapeHtml(option.label)}</option>`).join('')}</select></div>`).join('') || '<p>Chưa có tài khoản</p>'}</article>`).join('')}</section>`; }

  global.MonetizationContentService = MonetizationContentService;
  global.CommercialSubscriptionService = CommercialSubscriptionService;
  global.PaymentArchitectureService = PaymentArchitectureService;
  global.CouponService = CouponService;
  global.ReferralProgramService = ReferralProgramService;
  global.OrganizationPackageService = OrganizationPackageService;
  global.RevenueAnalyticsService = RevenueAnalyticsService;
  global.CustomerSupportService = CustomerSupportService;
  global.CrmFoundationService = CrmFoundationService;
  global.KLEARN_EXTRA_VIEWS = { ...(global.KLEARN_EXTRA_VIEWS || {}), 'business-center': businessView, 'billing-center': billingView, 'organization-plans': organizationView, 'revenue-center': revenueView, 'crm-center': crmView };

  const previousSearch = global.GlobalSearchService?.search?.bind(global.GlobalSearchService);
  if (previousSearch) global.GlobalSearchService.search = (query) => { const result = previousSearch(query); const normalized = String(query || '').toLocaleLowerCase('vi'); if (/premium|thanh toán|coupon|mã ưu đãi|referral|giới thiệu|doanh nghiệp|school license|crm|doanh thu/.test(normalized)) result.studyTools = [...(result.studyTools || []), { id: 'business-center', title: 'Trung tâm thương mại', subtitle: 'Subscription · Coupon · Referral · License · Support', route: 'business-center' }]; return result; };

  const previousAfterRender = global.KLEARN_AFTER_RENDER;
  global.KLEARN_AFTER_RENDER = () => {
    previousAfterRender?.();
    if (!state.currentUser) return;
    if (state.currentView === 'support' && runtime.content) {
      const select = global.document.querySelector('#supportRequestForm select[name="type"]');
      CustomerSupportService.categories().forEach((item) => { if (select && !select.querySelector(`option[value="${item.id}"]`)) select.insertAdjacentHTML('beforeend', `<option value="${item.id}">${escapeHtml(item.label)}</option>`); });
      if (select && CustomerSupportService.categories().some((item) => item.id === state.supportDraft?.type)) select.value = state.supportDraft.type;
    }
    if (routes.has(state.currentView)) MonetizationContentService.load();
    if (state.currentView === 'enterprise-platform' && !global.document.querySelector('[data-business-entry]')) global.document.querySelector('.ep-launch-grid')?.insertAdjacentHTML('beforeend', '<button data-view="business-center" data-business-entry><span>◫</span><b>Business Center</b><small>Billing · Coupon · Referral · License · CRM</small></button>');
    if (state.currentView === 'profile' && !global.document.querySelector('[data-business-profile]')) global.document.querySelector('[data-enterprise-platform-entry], .profile-action-list, #app > .section')?.insertAdjacentHTML('afterend', `<section class="biz-profile-entry section" data-business-profile><div><span>P39 · ${CommercialSubscriptionService.tier()}</span><h2>Gói dịch vụ & hỗ trợ</h2><p>Premium, coupon, giới thiệu và giấy phép tổ chức.</p></div><button class="btn primary" data-view="business-center">Mở</button></section>`);
    global.document.querySelector('[data-business-support]')?.addEventListener('click', () => { state.supportDraft = { type: 'billing', sourceId: 'business-center' }; setView('support'); });
    global.document.querySelector('[data-start-checkout]')?.addEventListener('click', async () => { const result = await PaymentArchitectureService.createCheckout({ planId: 'premium', billingPeriod: 'monthly', couponCode: runtime.coupon?.valid ? runtime.coupon.code : '' }); if (result.ok && result.checkoutUrl) global.location.assign(result.checkoutUrl); else toast(result.reason === 'cloud-required' ? 'Hãy đăng nhập cloud để tiếp tục.' : 'Checkout server chưa được cấu hình. Tài khoản của bạn không thay đổi.'); });
    const couponForm = global.document.getElementById('couponForm'); if (couponForm) couponForm.onsubmit = async (event) => { event.preventDefault(); const result = await CouponService.validate(new FormData(couponForm).get('code')); toast(result.valid ? 'Coupon đã được server xác thực.' : 'Coupon chưa thể áp dụng.'); render(); };
    const referralForm = global.document.getElementById('referralForm'); if (referralForm) referralForm.onsubmit = async (event) => { event.preventDefault(); const result = await ReferralProgramService.attribute(new FormData(referralForm).get('code')); toast(result.ok ? 'Đã ghi nhận mã giới thiệu.' : result.reason === 'self-referral' ? 'Không thể dùng mã của chính bạn.' : 'Chưa thể ghi nhận mã giới thiệu.'); };
    global.document.querySelectorAll('[data-quote-package]').forEach((button) => { button.onclick = () => { const form = global.document.getElementById('quoteForm'); form?.classList.remove('hidden'); if (form) form.elements.packageId.value = button.dataset.quotePackage; form?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }; });
    const quoteForm = global.document.getElementById('quoteForm'); if (quoteForm) quoteForm.onsubmit = async (event) => { event.preventDefault(); const form = new FormData(quoteForm); const result = await OrganizationPackageService.requestQuote({ packageId: form.get('packageId'), organizationName: form.get('organizationName'), seats: form.get('seats'), note: form.get('note') }); toast(result.ok ? 'Đã gửi yêu cầu tư vấn.' : 'Đã giữ bản nháp; cần kết nối cloud để gửi.'); };
    global.document.querySelectorAll('[data-crm-id]').forEach((select) => { select.onchange = async () => { try { const result = await CrmFoundationService.move(select.dataset.crmId, select.value); toast(result.ok ? 'Đã cập nhật pipeline.' : 'Không thể cập nhật.'); } catch (error) { toast(`Không thể cập nhật: ${clean(error.message, 100)}`); } }; });
    if (state.currentView === 'revenue-center' && runtime.revenue === null) RevenueAnalyticsService.refresh().catch((error) => { runtime.error = clean(error.message, 160); });
    if (state.currentView === 'crm-center' && !runtime.crm.length) CrmFoundationService.refresh().catch((error) => { runtime.error = clean(error.message, 160); });
  };
  MonetizationContentService.load();
})(window);
