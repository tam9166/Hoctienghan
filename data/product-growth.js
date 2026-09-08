/* Tiếng Hàn - TamHoanq · P53 privacy-first product growth foundation. */
(function buildProductGrowth(global) {
  'use strict';
  const app = global.KLEARN_APP;
  if (!app || global.ProductGrowthService) return;

  const { state, STORAGE_KEYS, userScoped, saveUserScoped, getUserProgress, PracticeService, AccessControlService, CloudSyncService, escapeHtml, setView, render, toast } = app;
  const STORE_KEY = STORAGE_KEYS.productGrowth || 'klearn_product_growth';
  const DAY = 86400000;
  const routes = new Set(['home', 'profile', 'admin-analytics', 'growth-center', 'invite-friends', 'growth-analytics', 'product-experiments']);
  const runtime = state.productGrowthRuntime || (state.productGrowthRuntime = { content: null, loading: false, error: '', admin: { status: 'idle', rows: [], error: '' }, referralCode: '' });
  const now = () => new Date().toISOString();
  const uid = () => state.currentUser?.id || '';
  const clean = (value, max = 160) => String(value == null ? '' : value).normalize('NFC').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);
  const token = (value, max = 80) => clean(value, max).replace(/[^a-zA-Z0-9_.-]/g, '');
  const dateMs = (value) => { const parsed = new Date(value || 0).getTime(); return Number.isFinite(parsed) ? parsed : 0; };
  const dayKey = (value) => { const date = new Date(value); return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10); };
  const hash = (value) => { let output = 2166136261; for (const char of String(value)) { output ^= char.charCodeAt(0); output = Math.imul(output, 16777619); } return output >>> 0; };
  const cloud = () => Boolean(global.SupabaseService?.client && global.SupabaseService?.session?.user?.id);
  const defaultStore = () => ({ version: 1, attribution: null, activation: null, invites: [], achievementShares: [], reengagement: [], updatedAt: now() });
  const read = () => { const saved = userScoped(STORE_KEY)[0]; const value = saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {}; return { ...defaultStore(), ...value, invites: Array.isArray(value.invites) ? value.invites : [], achievementShares: Array.isArray(value.achievementShares) ? value.achievementShares : [], reengagement: Array.isArray(value.reengagement) ? value.reengagement : [] }; };
  const write = (value) => { if (!uid()) return null; const next = { ...defaultStore(), ...value, version: 1, updatedAt: now() }; saveUserScoped(STORE_KEY, [next], 1); CloudSyncService?.schedule?.('product-growth'); return next; };
  const update = (mutator) => { const current = read(); return write(mutator(current) || current); };
  const fallbackContent = { verified: true, reviewStatus: 'approved', activation: { id: 'first-successful-learning-moment', minimumPracticeScore: 60 }, inviteTypes: [{ id: 'friend', title: 'Mời một người bạn', description: 'Cùng duy trì nhịp học.' }, { id: 'study_partner', title: 'Mời bạn học cùng', description: 'Cùng luyện tập.' }], retentionCheckpoints: [1, 7, 30], reengagement: [{ id: 'return-7', minimumAwayDays: 7, maximumAwayDays: 29, title: 'Quay lại bằng một phiên 5 phút', route: 'quick-practice' }, { id: 'return-30', minimumAwayDays: 30, title: 'Khởi động lại nhẹ nhàng', route: 'command-center' }], experiments: [], privacy: { analyticsRequireConsent: true, storesRecipientContact: false } };

  const GrowthContentService = {
    hydrate(value) {
      if (value?.verified !== true || value.reviewStatus !== 'approved' || !value.activation?.id || !Array.isArray(value.inviteTypes) || !Array.isArray(value.retentionCheckpoints) || ![1, 7, 30].every((day) => value.retentionCheckpoints.includes(day)) || value.privacy?.storesRecipientContact !== false) throw new Error('Product growth content quality gate failed');
      runtime.content = value; runtime.error = ''; registerExperiments(value.experiments); return value;
    },
    async load() {
      if (runtime.content) return runtime.content;
      if (runtime.loading) return runtime.loading;
      if (typeof global.fetch !== 'function') { runtime.content = fallbackContent; registerExperiments(fallbackContent.experiments); return fallbackContent; }
      runtime.loading = global.fetch('./content/product-growth.json', { cache: 'default' }).then((response) => { if (!response.ok) throw new Error(`Product growth content ${response.status}`); return response.json(); }).then((value) => this.hydrate(value)).catch((error) => { runtime.error = clean(error?.message || 'Growth content unavailable'); runtime.content = fallbackContent; registerExperiments(fallbackContent.experiments); return fallbackContent; }).finally(() => { runtime.loading = false; if (routes.has(state.currentView)) render(); });
      return runtime.loading;
    },
    get() { return runtime.content || fallbackContent; }
  };

  function registerExperiments(experiments = []) {
    const config = global.KLEARN_USER_RESEARCH_CONTENT;
    if (!config || !Array.isArray(config.experiments)) return;
    experiments.forEach((experiment) => { if (!config.experiments.some((item) => item.id === experiment.id)) config.experiments.push({ id: experiment.id, goal: experiment.goal, status: experiment.status, variants: experiment.variants, allocation: experiment.allocation }); });
  }

  const AcquisitionService = {
    capture(url = global.location?.href || '') {
      if (!uid() || read().attribution) return read().attribution;
      let parsed; try { parsed = new URL(url, global.location?.origin || 'https://app.local'); } catch (_) { return null; }
      const referralCode = token(parsed.searchParams.get('ref'), 48).toUpperCase();
      const source = token(parsed.searchParams.get('utm_source'), 60) || (referralCode ? 'referral' : 'direct');
      const medium = token(parsed.searchParams.get('utm_medium'), 60) || (referralCode ? 'invite' : 'none');
      const campaign = token(parsed.searchParams.get('utm_campaign'), 80) || '';
      const attribution = { source, medium, campaign, referralCode, referralCodeHint: referralCode ? `${referralCode.slice(0, 3)}***` : '', capturedAt: now(), scope: 'first-touch' };
      update((value) => ({ ...value, attribution }));
      global.UserResearchService?.track?.('feature_used', { feature: 'acquisition_attributed', route: source });
      return attribution;
    },
    get() { return read().attribution || this.capture(); }
  };

  const ActivationService = {
    definition() { return GrowthContentService.get().activation; },
    evidence() {
      const progress = getUserProgress();
      const lesson = Object.entries(progress.lessonProgress || {}).filter(([, value]) => value?.completed).sort((a, b) => dateMs(a[1].completedAt || a[1].updatedAt) - dateMs(b[1].completedAt || b[1].updatedAt))[0];
      const threshold = Number(this.definition().minimumPracticeScore || 60);
      const practice = (PracticeService?.getHistory?.() || []).filter((item) => Number(item.percentage) >= threshold).sort((a, b) => dateMs(a.completedAt) - dateMs(b.completedAt))[0];
      const review = (state.srsData || []).filter((item) => dateMs(item.lastReviewed) && ((Number(item.correctCount) || 0) > 0 || Number(item.mastery) >= threshold)).sort((a, b) => dateMs(a.lastReviewed) - dateMs(b.lastReviewed))[0];
      const candidates = [lesson ? { type: 'lesson_completed', entityId: lesson[0], at: lesson[1].completedAt || lesson[1].updatedAt } : null, practice ? { type: 'practice_passed', entityId: practice.id || practice.setId, at: practice.completedAt } : null, review ? { type: 'review_recalled', entityId: review.wordId || review.id, at: review.lastReviewed } : null].filter(Boolean).sort((a, b) => dateMs(a.at) - dateMs(b.at));
      return candidates[0] || null;
    },
    evaluate() {
      const current = read().activation; if (current) return current;
      const evidence = this.evidence(); if (!evidence) return null;
      const activation = { id: this.definition().id, activatedAt: evidence.at || now(), evidenceType: evidence.type, evidenceId: clean(evidence.entityId, 120), definitionVersion: 1 };
      update((value) => ({ ...value, activation }));
      global.UserResearchService?.track?.('feature_used', { feature: 'first_successful_learning_moment', result: evidence.type });
      return activation;
    },
    status() { const activation = read().activation || this.evaluate(); return { activated: Boolean(activation), activation, definition: this.definition() }; }
  };

  const ReferralGrowthService = {
    localCode() { return `TH${hash(uid()).toString(36).toUpperCase().slice(0, 8)}`; },
    code() { return token(runtime.referralCode || global.ReferralProgramService?.code?.() || '', 48).toUpperCase() || this.localCode(); },
    isServerCode() { return Boolean(runtime.referralCode || global.ReferralProgramService?.code?.()); },
    async ensureCode() {
      if (!cloud()) return { code: this.code(), source: 'local-invite', rewardEligible: false };
      const { data, error } = await global.SupabaseService.client.rpc('ensure_growth_referral_code');
      if (error) return { code: this.code(), source: 'local-invite', rewardEligible: false, error: clean(error.message) };
      runtime.referralCode = token(typeof data === 'string' ? data : data?.code, 48).toUpperCase(); render();
      return { code: this.code(), source: 'server', rewardEligible: true };
    },
    inviteLink(code = this.code()) {
      const base = new URL(global.location?.href || 'https://app.local/'); base.hash = 'register'; base.search = '';
      base.searchParams.set('ref', code); base.searchParams.set('utm_source', 'referral'); base.searchParams.set('utm_medium', 'invite'); base.searchParams.set('utm_campaign', 'study_together'); return base.href;
    },
    inviteTypes() { return GrowthContentService.get().inviteTypes; },
    history() { return read().invites; },
    async create(type = 'friend', channel = 'copy') {
      if (!this.inviteTypes().some((item) => item.id === type) || !['copy', 'web_share'].includes(channel)) return null;
      const codeResult = await this.ensureCode(); const invite = { id: `invite-${Date.now().toString(36)}-${hash(`${uid()}:${type}:${Date.now()}`).toString(36)}`, type, channel, codeHint: `${codeResult.code.slice(0, 3)}***`, status: 'created', rewardEligible: codeResult.rewardEligible, createdAt: now() };
      update((value) => ({ ...value, invites: [invite, ...value.invites].slice(0, 100) }));
      if (cloud() && codeResult.source === 'server') global.SupabaseService.client.rpc('create_growth_invite', { p_invite_type: type, p_channel: channel }).catch(() => null);
      global.UserResearchService?.track?.('feature_used', { feature: 'invite_created', result: type }); return { ...invite, link: this.inviteLink(codeResult.code) };
    },
    async share(type = 'friend') {
      const channel = typeof global.navigator?.share === 'function' ? 'web_share' : 'copy'; const invite = await this.create(type, channel); if (!invite) return null;
      const payload = { title: 'Tiếng Hàn - TamHoanq', text: 'Cùng học tiếng Hàn theo lộ trình rõ ràng nhé.', url: invite.link };
      try {
        if (channel === 'web_share') await global.navigator.share(payload);
        else await global.navigator?.clipboard?.writeText?.(invite.link);
        update((value) => ({ ...value, invites: value.invites.map((item) => item.id === invite.id ? { ...item, status: 'shared', sharedAt: now() } : item) }));
        return { ...invite, status: 'shared' };
      } catch (error) { return { ...invite, status: error?.name === 'AbortError' ? 'cancelled' : 'copy-failed' }; }
    },
    async attribute() {
      const attribution = AcquisitionService.get(); if (!attribution?.referralCode) return { ok: false, reason: 'no-referral-code' };
      if (global.ReferralProgramService?.attribute) return global.ReferralProgramService.attribute(attribution.referralCode);
      if (!cloud()) return { ok: false, offline: true, reason: 'cloud-required' };
      const { data, error } = await global.SupabaseService.client.rpc('attribute_growth_referral', { p_code: attribution.referralCode });
      return error ? { ok: false, reason: clean(error.message) } : { ok: Boolean(data?.ok ?? data), status: data?.status || 'attributed', rewardGranted: false };
    }
  };

  const GrowthAchievementService = {
    available() {
      const outcome = global.LearningOutcomeService?.current?.()?.evidence || [];
      const community = global.SharedAchievementService?.available?.() || [];
      const values = [...outcome.map((item) => ({ id: item.key || item.id, title: item.title, reachedAt: item.achievedAt, source: 'learning-evidence' })), ...community.map((item) => ({ ...item, source: 'achievement' }))];
      return [...new Map(values.filter((item) => item.id && item.title).map((item) => [item.id, item])).values()].slice(0, 20);
    },
    history() { return read().achievementShares; },
    async share(milestoneId) {
      const item = this.available().find((value) => value.id === milestoneId); if (!item) return null;
      const text = `Mình vừa đạt cột mốc “${item.title}” khi học tiếng Hàn trên Tiếng Hàn - TamHoanq.`; const url = ReferralGrowthService.inviteLink(); const channel = typeof global.navigator?.share === 'function' ? 'web_share' : 'copy';
      try { if (channel === 'web_share') await global.navigator.share({ title: 'Cột mốc học tiếng Hàn', text, url }); else await global.navigator?.clipboard?.writeText?.(`${text} ${url}`); } catch (error) { if (error?.name === 'AbortError') return { status: 'cancelled' }; return { status: 'failed' }; }
      global.SharedAchievementService?.share?.(milestoneId, 'private');
      const record = { id: `achievement-share-${Date.now().toString(36)}`, milestoneId, title: clean(item.title, 160), channel, createdAt: now(), containsScore: false };
      update((value) => ({ ...value, achievementShares: [record, ...value.achievementShares].slice(0, 100) }));
      global.UserResearchService?.track?.('feature_used', { feature: 'achievement_shared', contentId: milestoneId }); return record;
    }
  };

  function activityDates() {
    const external = global.LearningActivityService?.events?.();
    if (Array.isArray(external)) return external.map((item) => item.at).filter(Boolean);
    const progress = getUserProgress();
    const lessons = Object.values(progress.lessonProgress || {}).map((item) => item.completedAt || item.updatedAt);
    const practices = (PracticeService?.getHistory?.() || []).map((item) => item.completedAt || item.createdAt);
    const reviews = (state.srsData || []).map((item) => item.lastReviewed);
    return [...lessons, ...practices, ...reviews].filter((value) => dateMs(value));
  }

  const GrowthRetentionService = {
    checkpoints(reference = new Date()) {
      const createdAt = dateMs(state.currentUser?.createdAt); const ageDays = createdAt ? Math.floor((reference.getTime() - createdAt) / DAY) : 0; const active = new Set(activityDates().map(dayKey));
      return GrowthContentService.get().retentionCheckpoints.map((day) => { const target = new Date(createdAt + day * DAY); const measured = createdAt > 0 && ageDays >= day; const retained = measured ? [0, 1].some((offset) => { const value = new Date(target); value.setUTCDate(value.getUTCDate() + offset); return active.has(dayKey(value)); }) : null; return { day, status: measured ? 'measured' : 'collecting', retained, value: measured ? (retained ? 100 : 0) : null }; });
    },
    latestActivity() { return activityDates().sort((a, b) => dateMs(b) - dateMs(a))[0] || state.currentUser?.createdAt || null; }
  };

  const ChurnAnalysisService = {
    analyze(reference = new Date()) {
      const latest = GrowthRetentionService.latestActivity(); const awayDays = latest ? Math.max(0, Math.floor((reference.getTime() - dateMs(latest)) / DAY)) : 0;
      const research = global.UserResearchService?.all?.() || {}; const explicit = (research.surveys || []).filter((item) => item.questionId === 'learning-blocker').map((item) => item.answer); const dropOffs = global.UserResearchService?.dropOffs?.() || {}; const topDrop = Object.entries(dropOffs).sort((a, b) => b[1] - a[1])[0];
      const reasons = [...new Set([...explicit, ...(topDrop ? [`drop:${topDrop[0]}`] : [])])];
      return { status: awayDays >= 30 ? 'inactive_30d' : awayDays >= 7 ? 'at_risk' : 'active', awayDays, latestAt: latest, reasons, reasonEvidence: reasons.length ? 'explicit-or-observed' : 'insufficient', message: reasons.length ? 'Nguyên nhân dựa trên phản hồi hoặc bước bỏ dở đã ghi nhận.' : 'Chưa đủ dữ liệu để kết luận vì sao người dùng rời app.' };
    }
  };

  const ReengagementGrowthService = {
    plan() {
      const existing = global.ReactivationService?.status?.(); if (existing?.active) return { ...existing.plan, awayDays: existing.awayDays, source: 'retention-system' };
      const churn = ChurnAnalysisService.analyze(); const plan = GrowthContentService.get().reengagement.slice().sort((a, b) => b.minimumAwayDays - a.minimumAwayDays).find((item) => churn.awayDays >= item.minimumAwayDays && (!item.maximumAwayDays || churn.awayDays <= item.maximumAwayDays)); return plan ? { ...plan, awayDays: churn.awayDays, source: 'growth-fallback' } : null;
    },
    record(action, planId) { const item = { id: `reengagement-${Date.now().toString(36)}`, action: token(action, 40), planId: token(planId, 80), createdAt: now() }; update((value) => ({ ...value, reengagement: [item, ...value.reengagement].slice(0, 60) })); global.UserResearchService?.track?.('feature_used', { feature: 'reengagement', result: item.action }); return item; }
  };

  const ProductExperimentService = {
    consent() { return global.UserResearchService?.consent?.get?.() || 'unknown'; },
    all() { return GrowthContentService.get().experiments.map((definition) => { const assignment = this.consent() === 'granted' ? global.ExperimentService?.assignment?.(definition.id) : null; return { ...definition, assignment, measurement: assignment ? 'consented' : 'paused-until-consent' }; }); },
    log(experimentId, outcome, metric, value) { if (this.consent() !== 'granted') return null; return global.ExperimentService?.log?.({ experimentId, outcome, metric, value }) || null; }
  };

  const GrowthAnalyticsService = {
    snapshot() {
      const attribution = AcquisitionService.get(); const activation = ActivationService.status(); const retention = GrowthRetentionService.checkpoints(); const churn = ChurnAnalysisService.analyze();
      return { source: { source: attribution?.source || 'direct', medium: attribution?.medium || 'none', campaign: attribution?.campaign || '' }, conversion: { activated: activation.activated, activatedAt: activation.activation?.activatedAt || null, definition: activation.definition.id }, retention, churn, invites: ReferralGrowthService.history().length, shares: GrowthAchievementService.history().length, experiments: ProductExperimentService.all().length, scope: 'current-user', updatedAt: now() };
    }
  };

  const GrowthAdminAnalyticsService = {
    available() { return AccessControlService?.role?.() === 'admin'; },
    async load() {
      if (!this.available()) return null; if (!cloud()) { runtime.admin = { status: 'unavailable', rows: [], error: 'Backend aggregate chưa kết nối.' }; return runtime.admin; }
      runtime.admin.status = 'loading';
      try { const { data, error } = await global.SupabaseService.client.from('product_growth_daily_metrics').select('metric_date,source,visitors,registrations,activated_users,day_1_retention,day_7_retention,day_30_retention,reengaged_users,churned_users,generated_at').order('metric_date', { ascending: false }).limit(90); if (error) throw error; runtime.admin = { status: 'ready', rows: data || [], error: '' }; }
      catch (error) { runtime.admin = { status: 'error', rows: [], error: clean(error?.message || 'Growth analytics unavailable') }; }
      if (state.currentView === 'growth-analytics') render(); return runtime.admin;
    },
    summary() {
      if (runtime.admin.status !== 'ready' || !runtime.admin.rows.length) return null;
      const rows = runtime.admin.rows; const sum = (key) => rows.reduce((total, row) => total + Number(row[key] || 0), 0); const weighted = (key) => { const visitors = sum('visitors'); return visitors ? Math.round(rows.reduce((total, row) => total + Number(row[key] || 0) * Number(row.visitors || 0), 0) / visitors) : null; };
      return { visitors: sum('visitors'), registrations: sum('registrations'), activatedUsers: sum('activated_users'), activationRate: sum('registrations') ? Math.round(sum('activated_users') / sum('registrations') * 100) : null, day1: weighted('day_1_retention'), day7: weighted('day_7_retention'), day30: weighted('day_30_retention'), reengaged: sum('reengaged_users'), churned: sum('churned_users'), sources: [...new Set(rows.map((row) => row.source))].length };
    }
  };

  function metric(value, suffix = '') { return value == null ? '—' : `${value}${suffix}`; }
  function heading(back, eyebrow, title, description) { return `<section class="growth-heading section"><button class="back-link" data-view="${back}" aria-label="Quay lại">←</button><div><small>${escapeHtml(eyebrow)}</small><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p></div></section>`; }
  function centerView() {
    const activation = ActivationService.status(); const retention = GrowthRetentionService.checkpoints(); const reengagement = ReengagementGrowthService.plan(); const achievements = GrowthAchievementService.available();
    return `${heading('profile', 'PRODUCT GROWTH', 'Học cùng nhau, tiến bộ bền vững', 'Mời bạn học, chia sẻ cột mốc và theo dõi hành trình quay lại mà không spam.')}
      <section class="growth-activation section ${activation.activated ? 'done' : ''}"><span>${activation.activated ? '✓' : '1'}</span><div><small>USER ACTIVATION</small><h2>${escapeHtml(activation.definition.title || 'Khoảnh khắc học thành công đầu tiên')}</h2><p>${activation.activated ? `Đã đạt bằng ${escapeHtml(activation.activation.evidenceType)}.` : escapeHtml(activation.definition.definition || 'Hoàn thành một hoạt động học có kết quả.')}</p></div><button class="btn ${activation.activated ? 'secondary' : 'primary'}" data-view="${activation.activated ? 'learning-outcomes' : 'command-center'}">${activation.activated ? 'Xem kết quả' : 'Bắt đầu học'}</button></section>
      ${reengagement ? `<section class="growth-reengagement section"><div><small>CHÀO MỪNG QUAY LẠI · ${reengagement.awayDays} NGÀY</small><h2>${escapeHtml(reengagement.title)}</h2><p>Một bước nhẹ là đủ để lấy lại nhịp học.</p></div><button class="btn primary" data-growth-reengage="${escapeHtml(reengagement.id)}" data-route="${escapeHtml(reengagement.route)}">Tiếp tục</button></section>` : ''}
      <section class="growth-launch-grid section"><button data-view="invite-friends"><span>01</span><b>Mời bạn học cùng</b><small>Friend · Study partner</small></button><button data-view="growth-analytics"><span>02</span><b>Hành trình tăng trưởng</b><small>Source · Activation · Retention</small></button><button data-view="product-experiments"><span>03</span><b>Thử nghiệm sản phẩm</b><small>UI · Onboarding · Content</small></button></section>
      <section class="growth-retention section"><div class="section-heading"><div><small>RETENTION</small><h2>Day 1 · Day 7 · Day 30</h2></div></div><div>${retention.map((item) => `<article><span>Day ${item.day}</span><b>${item.status === 'collecting' ? 'Đang đo' : item.retained ? 'Đã quay lại' : 'Chưa quay lại'}</b><small>${item.status === 'collecting' ? 'Chưa đến mốc' : metric(item.value, '%')}</small></article>`).join('')}</div></section>
      <section class="growth-achievement-preview section"><div><small>SHARING ACHIEVEMENT</small><h2>Chia sẻ cột mốc, không chia sẻ dữ liệu riêng tư</h2><p>${achievements.length ? `${achievements.length} cột mốc sẵn sàng.` : 'Hoàn thành một cột mốc học tập để chia sẻ.'}</p></div><button class="btn secondary" data-view="invite-friends">Xem cột mốc</button></section>`;
  }

  function inviteView() {
    const code = ReferralGrowthService.code(); const attribution = AcquisitionService.get(); const achievements = GrowthAchievementService.available();
    return `${heading('growth-center', 'REFERRAL & INVITE', 'Mời bạn học cùng', 'Không cần nhập email hoặc số điện thoại của người nhận. Reward chỉ có hiệu lực khi server xác nhận.')}
      <section class="growth-code-card section"><div><small>MÃ MỜI CỦA BẠN</small><strong>${escapeHtml(code)}</strong><p>${ReferralGrowthService.isServerCode() ? 'Mã đã được server xác nhận.' : 'Link mời local; chưa đủ điều kiện nhận reward.'}</p></div><button class="btn secondary" data-growth-code>Đồng bộ mã</button></section>
      <section class="growth-invite-grid section">${ReferralGrowthService.inviteTypes().map((item) => `<article><small>${item.id === 'study_partner' ? 'STUDY PARTNER' : 'FRIEND'}</small><h2>${escapeHtml(item.title)}</h2><p>${escapeHtml(item.description)}</p><button class="btn primary" data-growth-invite="${item.id}">Chia sẻ lời mời</button></article>`).join('')}</section>
      ${attribution?.referralCode ? `<section class="growth-attribution section"><div><small>LỜI MỜI ĐÃ NHẬN</small><h2>${escapeHtml(attribution.referralCodeHint)}</h2><p>Nguồn ${escapeHtml(attribution.source)} · ${escapeHtml(attribution.medium)}</p></div><button class="btn secondary" data-growth-attribute>Xác nhận với server</button></section>` : ''}
      <section class="growth-share-list section"><div class="section-heading"><div><small>LEARNING EVIDENCE</small><h2>Chia sẻ cột mốc</h2></div></div>${achievements.length ? achievements.map((item) => `<article><div><b>${escapeHtml(item.title)}</b><small>${escapeHtml(String(item.reachedAt || '').slice(0, 10) || 'Đã đạt')}</small></div><button class="btn secondary" data-growth-share-achievement="${escapeHtml(item.id)}">Chia sẻ</button></article>`).join('') : '<div class="empty-state"><h3>Chưa có cột mốc</h3><p>App chỉ cho chia sẻ thành tích có bằng chứng học tập.</p><button class="btn primary" data-view="command-center">Bắt đầu học</button></div>'}</section>
      <p class="growth-privacy section">Không lưu thông tin liên hệ người nhận. Link không chứa lịch sử học, điểm số hoặc user ID thô.</p>`;
  }

  function analyticsView() {
    const value = GrowthAnalyticsService.snapshot(); const admin = GrowthAdminAnalyticsService.available(); const aggregate = GrowthAdminAnalyticsService.summary(); if (admin && runtime.admin.status === 'idle') global.setTimeout(() => GrowthAdminAnalyticsService.load(), 0);
    return `${heading('growth-center', 'GROWTH ANALYTICS', 'Source → Activation → Retention', 'Số liệu cá nhân thuộc tài khoản hiện tại; số liệu admin chỉ là aggregate không có PII.')}
      <section class="growth-funnel section"><article><small>SOURCE</small><b>${escapeHtml(value.source.source)}</b><span>${escapeHtml(value.source.medium)}</span></article><i>→</i><article><small>ACTIVATION</small><b>${value.conversion.activated ? 'Đã đạt' : 'Chưa đạt'}</b><span>${escapeHtml(value.conversion.definition)}</span></article><i>→</i><article><small>RETENTION</small><b>${value.retention.filter((item) => item.retained).length}/${value.retention.length}</b><span>Mốc đã quay lại</span></article></section>
      <section class="growth-analysis-grid section"><article><small>INVITES</small><strong>${value.invites}</strong><p>Lời mời đã tạo trên tài khoản này.</p></article><article><small>ACHIEVEMENT SHARES</small><strong>${value.shares}</strong><p>Cột mốc đã chia sẻ.</p></article><article><small>CHURN STATUS</small><strong>${escapeHtml(value.churn.status)}</strong><p>${escapeHtml(value.churn.message)}</p></article><article><small>REASON EVIDENCE</small><strong>${value.churn.reasons.length || '—'}</strong><p>${value.churn.reasons.length ? escapeHtml(value.churn.reasons.join(' · ')) : 'Không suy đoán nguyên nhân.'}</p></article></section>
      ${admin ? `<section class="growth-admin section"><div class="section-heading"><div><small>ADMIN · AGGREGATE ONLY</small><h2>Tăng trưởng toàn sản phẩm</h2></div><button class="btn secondary" data-growth-admin-refresh>Làm mới</button></div>${runtime.admin.status === 'ready' && aggregate ? `<div><article><small>Visitors</small><b>${aggregate.visitors}</b></article><article><small>Registrations</small><b>${aggregate.registrations}</b></article><article><small>Activation</small><b>${metric(aggregate.activationRate, '%')}</b></article><article><small>D7 retention</small><b>${metric(aggregate.day7, '%')}</b></article><article><small>Re-engaged</small><b>${aggregate.reengaged}</b></article><article><small>Churned</small><b>${aggregate.churned}</b></article></div>` : `<div class="empty-state"><h3>${runtime.admin.status === 'loading' ? 'Đang tải aggregate…' : 'Chưa có dữ liệu aggregate'}</h3><p>${escapeHtml(runtime.admin.error || 'Không hiển thị số 0 khi backend chưa cung cấp số liệu.')}</p></div>`}</section>` : ''}`;
  }

  function experimentsView() {
    const consent = ProductExperimentService.consent(); const items = ProductExperimentService.all();
    return `${heading('growth-center', 'PRODUCT EXPERIMENTS', 'Thử nghiệm có kiểm soát', 'Tái sử dụng P28 Experiment Service. Chỉ đo kết quả khi người dùng đã đồng ý telemetry.')}
      <section class="growth-consent section ${consent}"><div><small>PRIVACY STATUS</small><h2>${consent === 'granted' ? 'Đã cho phép đo lường' : consent === 'denied' ? 'Đã tắt đo lường' : 'Chưa có lựa chọn'}</h2><p>Không thu thập password, token, chat, audio hoặc dữ liệu ngoài app.</p></div><button class="btn secondary" data-view="profile">Quản lý trong Hồ sơ</button></section>
      <section class="growth-experiment-list section">${items.map((item) => `<article><header><span>${escapeHtml(item.area)}</span><b>${escapeHtml(item.status)}</b></header><h2>${escapeHtml(item.id)}</h2><p>${escapeHtml(item.goal)}</p><dl><div><dt>Variants</dt><dd>${escapeHtml(item.variants.join(' / '))}</dd></div><div><dt>Assignment</dt><dd>${escapeHtml(item.assignment?.variant || 'Paused')}</dd></div><div><dt>Measurement</dt><dd>${escapeHtml(item.measurement)}</dd></div></dl></article>`).join('')}</section>`;
  }

  const ProductGrowthService = Object.freeze({ content: GrowthContentService, acquisition: AcquisitionService, activation: ActivationService, referrals: ReferralGrowthService, achievements: GrowthAchievementService, retention: GrowthRetentionService, churn: ChurnAnalysisService, reengagement: ReengagementGrowthService, experiments: ProductExperimentService, analytics: GrowthAnalyticsService, admin: GrowthAdminAnalyticsService, store: { read } });
  global.ProductGrowthService = ProductGrowthService;
  global.KLEARN_EXTRA_VIEWS = { ...(global.KLEARN_EXTRA_VIEWS || {}), 'growth-center': centerView, 'invite-friends': inviteView, 'growth-analytics': analyticsView, 'product-experiments': experimentsView };

  const previousAfterRender = global.KLEARN_AFTER_RENDER;
  global.KLEARN_AFTER_RENDER = () => {
    previousAfterRender?.(); if (!state.currentUser || !global.document) return;
    if (routes.has(state.currentView) && !runtime.content) GrowthContentService.load();
    AcquisitionService.capture(); ActivationService.evaluate();
    const root = global.document.getElementById('app');
    if (state.currentView === 'profile' && !global.document.querySelector('[data-growth-profile]')) root?.insertAdjacentHTML('beforeend', `<section class="growth-profile-entry section" data-growth-profile><div><small>P53 · PRODUCT GROWTH</small><h2>Học cùng nhau</h2><p>Mời bạn học, chia sẻ cột mốc và xem hành trình activation–retention.</p></div><button class="btn primary" data-view="growth-center">Mở</button></section>`);
    const reengagement = ReengagementGrowthService.plan(); const activation = ActivationService.status();
    if (state.currentView === 'home' && runtime.content && !global.document.querySelector('[data-growth-home]') && (reengagement || !activation.activated)) global.document.querySelector('.ux-today-strip, .daily-start-panel, .dashboard-hero')?.insertAdjacentHTML('afterend', reengagement ? `<section class="growth-home-card section" data-growth-home><div><small>CHÀO MỪNG QUAY LẠI</small><h2>${escapeHtml(reengagement.title)}</h2><p>Một bước nhẹ là đủ để lấy lại nhịp.</p></div><button class="btn primary" data-growth-reengage="${escapeHtml(reengagement.id)}" data-route="${escapeHtml(reengagement.route)}">Tiếp tục</button></section>` : `<section class="growth-home-card section" data-growth-home><div><small>BƯỚC ĐẦU TIÊN</small><h2>Hoàn thành một hoạt động học</h2><p>Đây là activation có ý nghĩa — không chỉ mở app.</p></div><button class="btn primary" data-view="command-center">Bắt đầu</button></section>`);
    root?.querySelectorAll?.('[data-view]')?.forEach((button) => { if (!button.onclick) button.onclick = () => setView(button.dataset.view); });
    global.document.querySelectorAll('[data-growth-invite]').forEach((button) => { button.onclick = async () => { const result = await ReferralGrowthService.share(button.dataset.growthInvite); toast(result?.status === 'shared' ? 'Đã mở chia sẻ lời mời.' : result?.status === 'cancelled' ? 'Đã hủy chia sẻ.' : 'Không thể chia sẻ lúc này.'); render(); }; });
    global.document.querySelector('[data-growth-code]')?.addEventListener('click', async () => { const result = await ReferralGrowthService.ensureCode(); toast(result.source === 'server' ? 'Đã đồng bộ mã referral.' : 'Đang dùng link mời local.'); });
    global.document.querySelector('[data-growth-attribute]')?.addEventListener('click', async () => { const result = await ReferralGrowthService.attribute(); toast(result.ok ? 'Đã xác nhận nguồn giới thiệu.' : `Chưa thể xác nhận: ${result.reason || 'server unavailable'}`); });
    global.document.querySelectorAll('[data-growth-share-achievement]').forEach((button) => { button.onclick = async () => { const result = await GrowthAchievementService.share(button.dataset.growthShareAchievement); toast(result?.status === 'cancelled' ? 'Đã hủy chia sẻ.' : result ? 'Đã chia sẻ cột mốc.' : 'Cột mốc chưa đủ bằng chứng.'); render(); }; });
    global.document.querySelectorAll('[data-growth-reengage]').forEach((button) => { button.onclick = () => { ReengagementGrowthService.record('started', button.dataset.growthReengage); setView(button.dataset.route); }; });
    global.document.querySelector('[data-growth-admin-refresh]')?.addEventListener('click', () => GrowthAdminAnalyticsService.load());
  };

  let activationTimer = 0;
  global.addEventListener?.('klearn-sync-action', () => { global.clearTimeout?.(activationTimer); activationTimer = global.setTimeout?.(() => ActivationService.evaluate(), 500); });
  GrowthContentService.load(); AcquisitionService.capture(); ActivationService.evaluate();
})(window);
