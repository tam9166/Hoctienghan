/* P31 — premium learning layer; core learning remains available to every tier. */
(function buildPremiumLearningExperience(global) {
  'use strict';
  const app = global.KLEARN_APP;
  if (!app) return;
  const { state, STORAGE_KEYS, render, setView, toast, escapeHtml, userScoped, saveUserScoped, PracticeService, startTopikExam, getUserProgress, LearnerProfileService, NotesService, VocabularyService, SupportService } = app;
  const STORE_KEY = STORAGE_KEYS.premiumLearning || 'klearn_premium_learning';
  const routes = new Set(['premium-features']);
  const runtime = state.premiumLearningRuntime || (state.premiumLearningRuntime = { content: null, loading: false, error: '', report: null });
  const fallback = { plans: [], mockExams: [], contentPacks: [], exportFormats: ['notes', 'vocabulary', 'print-pdf'], family: { maxLearners: 4, status: 'architecture-only', roles: ['owner', 'learner'] } };
  const clean = (value, max = 500) => String(value == null ? '' : value).normalize('NFC').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);
  const now = () => new Date().toISOString();
  const number = (value) => Number.isFinite(Number(value)) ? Number(value) : null;
  const average = (values) => values.length ? Math.round(values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length) : null;
  const localize = (value) => value && typeof value === 'object' ? (value.vi || value.en || '') : String(value || '');
  const content = () => runtime.content || global.KLEARN_PREMIUM_LEARNING_CONTENT || fallback;
  const isPremium = () => global.SubscriptionService?.activeTier?.() === 'premium';
  const requirePremium = (feature = 'premium feature') => isPremium() ? true : (toast?.(`${feature} cần gói Premium. Tính năng học cơ bản vẫn luôn được giữ nguyên.`), false);
  const emptyStore = () => ({ version: 1, activePlan: null, openedPacks: [], reports: [], curriculum: null, exports: [], family: { role: 'owner', status: 'architecture-only', members: [] } });
  const store = () => { const saved = userScoped(STORE_KEY)[0]; return saved && typeof saved === 'object' && !Array.isArray(saved) ? { ...emptyStore(), ...saved, openedPacks: Array.isArray(saved.openedPacks) ? saved.openedPacks : [], reports: Array.isArray(saved.reports) ? saved.reports : [], exports: Array.isArray(saved.exports) ? saved.exports : [], family: { ...emptyStore().family, ...(saved.family || {}) } } : emptyStore(); };
  const save = (value) => { const next = { ...emptyStore(), ...value, version: 1, updatedAt: now() }; saveUserScoped(STORE_KEY, [next], 1); return next; };
  const update = (mutator) => save(mutator(store()) || store());

  const PremiumLearningContentService = {
    hydrate(value) { if (value?.verified !== true || value.reviewStatus !== 'approved' || !Array.isArray(value.plans) || !Array.isArray(value.contentPacks)) throw new Error('Premium learning content quality gate failed'); runtime.content = value; global.KLEARN_PREMIUM_LEARNING_CONTENT = value; return value; },
    async load() { if (runtime.content) return runtime.content; if (runtime.loading) return runtime.loading; if (typeof fetch !== 'function') { runtime.error = 'Premium content loader unavailable.'; return null; } runtime.loading = fetch('./content/premium-learning-experience.json', { cache: 'default' }).then((response) => { if (!response.ok) throw new Error(`Premium content ${response.status}`); return response.json(); }).then((value) => this.hydrate(value)).catch((error) => { runtime.error = error.message || 'Premium learning content unavailable'; return null; }).finally(() => { runtime.loading = false; if (routes.has(state.currentView)) render(); }); return runtime.loading; }
  };

  const PremiumEntitlementService = {
    tier() { return global.SubscriptionService?.activeTier?.() || 'free'; },
    status() { return global.SubscriptionService?.status?.() || { tier: this.tier(), status: 'unknown', source: 'unavailable' }; },
    has(feature) { return this.tier() === 'premium' && (global.SubscriptionService?.can?.(feature) !== false); },
    isPremium: isPremium
  };

  const PremiumStudyPlanService = {
    all() { return content().plans || []; },
    get(id) { return this.all().find((item) => item.id === clean(id, 80)) || null; },
    active() { return store().activePlan; },
    preview(id) { return this.get(id); },
    activate(id) { const plan = this.get(id); if (!plan || !requirePremium('Premium Study Plan')) return null; const active = { id: plan.id, title: localize(plan.title), goal: plan.goal, durationMonths: plan.durationMonths, milestones: plan.milestones || [], startedAt: now(), progress: 0 }; update((value) => ({ ...value, activePlan: active })); return active; }
  };

  const AdvancedMockExamService = {
    catalog() { return content().mockExams || []; },
    get(id) { return this.catalog().find((item) => item.id === clean(id, 80)) || null; },
    available() { return requirePremium('Advanced Mock Exam'); },
    start(id) { const exam = this.get(id); if (!exam || !this.available()) return null; const session = { id: exam.id, level: exam.level, mode: 'premium-real-environment', startedAt: now(), durationMinutes: exam.durationMinutes, questionCount: exam.questionCount }; update((value) => ({ ...value, mockExam: session })); if (startTopikExam) startTopikExam(exam.level, exam.questionCount); else if (PracticeService?.startRandom) PracticeService.startRandom({ level: `TOPIK_${exam.level}`, count: exam.questionCount, skill: 'mixed', difficulty: 'mixed' }); return session; }
  };

  const PremiumContentPackService = {
    all() { return content().contentPacks || []; },
    get(id) { return this.all().find((item) => item.id === clean(id, 80)) || null; },
    open(id) { const pack = this.get(id); if (!pack || !requirePremium('Premium Content Pack')) return null; update((value) => ({ ...value, openedPacks: [...new Set([pack.id, ...value.openedPacks])].slice(0, 20) })); return pack; },
    opened() { return store().openedPacks; }
  };

  const PrivateLearningReportService = {
    generate() { if (!requirePremium('Private Learning Report')) return null; const profile = LearnerProfileService?.get?.() || {}; const report = global.AdvancedReportService?.report?.('monthly'); const insight = global.PersonalInsightService?.report?.() || global.LearningAnalyticsEngine?.analyze?.()?.report; const result = { id: `premium-report-${Date.now()}`, generatedAt: now(), weakness: (profile.weakSkills || []).slice(0, 5), frequentErrors: (profile.frequentErrors || []).slice(0, 5), prediction: report?.summary || report?.efficiency || global.LearningForecastService?.forecast?.() || null, recommendation: insight?.nextAction || insight?.progressReason || 'Duy trì nhịp học và ưu tiên kỹ năng yếu.', source: 'personal-learning-data-only' }; runtime.report = result; update((value) => ({ ...value, reports: [result, ...value.reports].slice(0, 12) })); return result; },
    latest() { return runtime.report || store().reports[0] || null; },
    all() { return store().reports; }
  };

  const AdvancedSpeakingReviewService = {
    summary() { const progress = getUserProgress?.() || {}; const attempts = Array.isArray(progress.pronunciationAttempts) ? progress.pronunciationAttempts : []; const profile = LearnerProfileService?.get?.() || {}; const scores = attempts.map((item) => number(item.score)).filter((value) => value != null); return { attempts: attempts.length, fluency: average(scores), pronunciation: average(scores), vocabulary: number(profile.skillScores?.vocabulary), source: attempts.length ? 'pronunciation-attempts-and-learner-profile' : 'insufficient-data', disclaimer: 'Đây là phản hồi hỗ trợ học tập, không phải chấm âm vị chuyên sâu.' }; }
  };

  const PersonalCurriculumService = {
    current() { return store().curriculum; },
    generate(planId = 'topik-6-months') { if (!requirePremium('Personal Curriculum')) return null; const plan = PremiumStudyPlanService.get(planId) || PremiumStudyPlanService.all()[0]; if (!plan) return null; const profile = LearnerProfileService?.get?.() || {}; const modules = (plan.milestones || []).map((title, index) => ({ id: `${plan.id}-${index + 1}`, title, focus: profile.weakSkills?.[index] || (plan.goal === 'conversation' ? 'speaking' : 'TOPIK foundation'), status: index === 0 ? 'next' : 'planned' })); const curriculum = { id: `personal-curriculum-${Date.now()}`, planId: plan.id, title: `${localize(plan.title)} · lộ trình riêng`, modules, generatedAt: now(), source: 'existing-progress-and-premium-plan' }; update((value) => ({ ...value, curriculum })); return curriculum; }
  };

  const MaterialExportService = {
    payload(kind = 'notes') { const safeKind = ['notes', 'vocabulary', 'print-pdf'].includes(kind) ? kind : 'notes'; const notes = NotesService?.all?.() || []; const vocabulary = (VocabularyService?.all?.() || []).slice(0, 300).map((item) => ({ korean: item.korean, meaning: item.meaning?.vi || item.meaning || '', mastery: item.mastery, topic: item.topic })); return { kind: safeKind, createdAt: now(), notes: safeKind === 'notes' || safeKind === 'print-pdf' ? notes.map((item) => ({ sourceType: item.sourceType, sourceId: item.sourceId, content: item.content })) : [], vocabulary: safeKind === 'vocabulary' || safeKind === 'print-pdf' ? vocabulary : [] }; },
    download(kind = 'notes') { if (kind === 'print-pdf' && !requirePremium('PDF export')) return null; const payload = this.payload(kind); const text = JSON.stringify(payload, null, 2); if (kind === 'print-pdf') { global.print?.(); return { ...payload, status: 'print-dialog', format: 'pdf-ready' }; } if (global.document && global.Blob && global.URL?.createObjectURL) { const blob = new Blob([text], { type: 'application/json' }); const link = global.document.createElement('a'); link.href = global.URL.createObjectURL(blob); link.download = `tamhoanq-${kind}-${new Date().toISOString().slice(0, 10)}.json`; link.click(); global.URL.revokeObjectURL(link.href); } update((value) => ({ ...value, exports: [{ kind, createdAt: payload.createdAt }, ...value.exports].slice(0, 20) })); return { ...payload, status: 'downloaded', format: 'json' }; }
  };

  const PremiumCertificateService = {
    definitions() { return global.CertificationService?.definitions?.() || []; },
    issue(id) { if (!requirePremium('Premium Certificate')) return null; return global.CertificationService?.issue?.(id) || null; }
  };
  const PremiumSupportService = {
    async request({ type = 'teacher_feedback', sourceId = '', message = '' } = {}) { if (!requirePremium('Premium Support')) return null; return SupportService?.submit?.({ type, sourceId, message }); }
  };
  const FamilyAccountService = { status() { const value = store().family || {}; return { role: value.role || 'owner', status: value.status || 'architecture-only', members: Array.isArray(value.members) ? value.members.length : 0, maxLearners: Number(content().family?.maxLearners || 4), source: 'architecture-only' }; }, addLocalPlaceholder() { if (!requirePremium('Family Account')) return null; const value = this.status(); update((current) => ({ ...current, family: { ...current.family, members: [...(current.family.members || []), { status: 'pending-backend', createdAt: now() }].slice(0, value.maxLearners - 1) } })); return this.status(); } };

  const PremiumLearningService = { entitlement: PremiumEntitlementService, plans: PremiumStudyPlanService, mockExams: AdvancedMockExamService, contentPacks: PremiumContentPackService, privateReport: PrivateLearningReportService, speakingReview: AdvancedSpeakingReviewService, curriculum: PersonalCurriculumService, exports: MaterialExportService, certificates: PremiumCertificateService, support: PremiumSupportService, family: FamilyAccountService, version: 'p31-v1' };

  const heading = (title, description) => `<section class="section page-heading p31-heading"><button class="back-link" data-view="enterprise-platform">← Nền tảng thương mại</button><p class="eyebrow">P31 · PREMIUM LEARNING EXPERIENCE</p><h1 class="headline">${escapeHtml(title)}</h1><p class="subtle">${escapeHtml(description)}</p></section>`;
  const gate = (label) => `<span class="p31-gate">${isPremium() ? 'Premium đã mở' : `${escapeHtml(label)} · xem trước`}</span>`;
  const premiumView = () => {
    if (!runtime.content) { PremiumLearningContentService.load(); return `${heading('Trải nghiệm học cao cấp', 'Đang tải các gói học và công cụ Premium…')}<section class="empty-state section"><h2>Đang tải nội dung</h2></section>`; }
    const tier = PremiumEntitlementService.tier(); const active = PremiumStudyPlanService.active(); const speaking = AdvancedSpeakingReviewService.summary(); const report = PrivateLearningReportService.latest(); const curriculum = PersonalCurriculumService.current(); const family = FamilyAccountService.status();
    return `${heading('Trải nghiệm học cao cấp', 'Thêm chiều sâu cho hành trình học; các bài học, SRS và công cụ cơ bản vẫn mở cho mọi người.')}<section class="p31-status section"><div><small>GÓI HIỆN TẠI</small><strong>${escapeHtml(tier === 'premium' ? 'Premium' : 'Free')}</strong><span>${isPremium() ? 'Đã xác thực từ cloud metadata' : 'Chưa có entitlement Premium'}</span></div><div><small>STUDY PLAN</small><strong>${escapeHtml(active?.title || 'Chưa chọn')}</strong><span>${active ? `${active.progress || 0}% tiến độ` : 'Chọn kế hoạch phù hợp'}</span></div><div><small>FAMILY</small><strong>${family.members}/${family.maxLearners}</strong><span>Architecture only</span></div></section><section class="p31-grid section"><article class="card p31-card"><header><div><p class="eyebrow">01 · STUDY PLAN</p><h2>Kế hoạch học Premium</h2></div>${gate('Premium Study Plan')}</header>${PremiumStudyPlanService.all().map((plan) => `<div class="p31-option"><div><b>${escapeHtml(localize(plan.title))}</b><small>${plan.durationMonths} tháng · ${(plan.milestones || []).length} cột mốc</small></div><button class="btn ${active?.id === plan.id ? 'secondary' : 'primary'}" data-premium-plan="${escapeHtml(plan.id)}">${active?.id === plan.id ? 'Đang học' : 'Chọn kế hoạch'}</button></div>`).join('')}</article><article class="card p31-card"><header><div><p class="eyebrow">02 · MOCK EXAM</p><h2>Thi thử nâng cao</h2></div>${gate('Advanced Mock Exam')}</header>${content().mockExams.map((exam) => `<div class="p31-option"><div><b>TOPIK ${exam.level} · Real environment</b><small>${exam.questionCount} câu · ${exam.durationMinutes} phút · timer</small></div><button class="btn primary" data-premium-mock="${escapeHtml(exam.id)}">Bắt đầu</button></div>`).join('')}</article></section><section class="p31-grid section"><article class="card p31-card"><header><div><p class="eyebrow">03 · CONTENT PACK</p><h2>Premium Content Pack</h2></div>${gate('Premium Content Pack')}</header><div class="p31-pack-grid">${PremiumContentPackService.all().map((pack) => `<button data-premium-pack="${escapeHtml(pack.id)}"><b>${escapeHtml(pack.title)}</b><small>${pack.topics.map(escapeHtml).join(' · ')}</small></button>`).join('')}</div></article><article class="card p31-card"><header><div><p class="eyebrow">04 · PRIVATE REPORT</p><h2>Báo cáo riêng của tôi</h2></div>${gate('Private Learning Report')}</header><p class="subtle">Weakness · prediction · recommendation, chỉ dùng dữ liệu học của tài khoản này.</p><button class="btn primary" data-premium-report>Tạo báo cáo sâu</button>${report ? `<div class="p31-report"><b>Gợi ý tiếp theo</b><p>${escapeHtml(report.recommendation || '')}</p><small>${report.weakness?.length ? `Điểm yếu: ${report.weakness.map(escapeHtml).join(', ')}` : 'Chưa đủ dữ liệu điểm yếu'}</small></div>` : ''}</article></section><section class="p31-grid section"><article class="card p31-card"><header><div><p class="eyebrow">05 · SPEAKING REVIEW</p><h2>Advanced Speaking Review</h2></div>${gate('Advanced Speaking Review')}</header><div class="p31-score-row"><span>Fluency <b>${speaking.fluency ?? '—'}</b></span><span>Pronunciation <b>${speaking.pronunciation ?? '—'}</b></span><span>Vocabulary <b>${speaking.vocabulary ?? '—'}</b></span></div><small>${speaking.attempts} lượt · ${escapeHtml(speaking.disclaimer)}</small></article><article class="card p31-card"><header><div><p class="eyebrow">06 · CURRICULUM</p><h2>Personal Curriculum</h2></div>${gate('Personal Curriculum')}</header><button class="btn primary" data-premium-curriculum>Tạo khóa học riêng</button>${curriculum ? `<div class="p31-curriculum"><b>${escapeHtml(curriculum.title)}</b>${curriculum.modules.map((item) => `<p>${escapeHtml(item.title)} · ${escapeHtml(item.focus)} · ${escapeHtml(item.status)}</p>`).join('')}</div>` : '<p class="subtle">Lộ trình dựa trên mục tiêu và kỹ năng yếu hiện tại.</p>'}</article></section><section class="p31-grid section"><article class="card p31-card"><header><div><p class="eyebrow">07 · MATERIALS</p><h2>Downloadable Material</h2></div><span class="p31-gate">Notes/Vocabulary mở</span></header><div class="action-row"><button class="btn secondary" data-premium-export="notes">Xuất Notes</button><button class="btn secondary" data-premium-export="vocabulary">Xuất Vocabulary</button><button class="btn primary" data-premium-export="print-pdf">In / PDF</button></div><small>PDF dùng print dialog của trình duyệt; không upload dữ liệu riêng tư.</small></article><article class="card p31-card"><header><div><p class="eyebrow">08 · CERTIFICATE</p><h2>Course Completion</h2></div>${gate('Premium Certificate')}</header><p class="subtle">Chứng nhận chỉ tạo từ course completion có bằng chứng; preview hiện tại dùng CertificationService.</p><button class="btn secondary" data-view="certification-center">Mở chứng nhận</button></article></section><section class="p31-grid section"><article class="card p31-card"><header><div><p class="eyebrow">09 · SUPPORT</p><h2>Premium Support</h2></div>${gate('Premium Support')}</header><p class="subtle">Gửi bài writing/speaking để teacher feedback qua Support hiện có, chịu RLS.</p><button class="btn primary" data-view="support">Gửi yêu cầu giáo viên</button></article><article class="card p31-card"><header><div><p class="eyebrow">10 · FAMILY</p><h2>Family Account</h2></div><span class="p31-gate">Architecture only</span></header><p class="subtle">Chuẩn bị nhiều learner trong một gói; chưa tự gửi lời mời hoặc tạo tài khoản phụ.</p><p>${family.members}/${family.maxLearners} learner slots · ${escapeHtml(family.status)}</p></article></section>`;
  };

  Object.assign(global, { PremiumLearningContentService, PremiumEntitlementService, PremiumStudyPlanService, AdvancedMockExamService, PremiumContentPackService, PrivateLearningReportService, AdvancedSpeakingReviewService, PersonalCurriculumService, MaterialExportService, PremiumCertificateService, PremiumSupportService, FamilyAccountService, PremiumLearningService });
  global.KLEARN_EXTRA_VIEWS = { ...(global.KLEARN_EXTRA_VIEWS || {}), 'premium-features': premiumView };
  const previousAfterRender = global.KLEARN_AFTER_RENDER;
  global.KLEARN_AFTER_RENDER = () => {
    previousAfterRender?.();
    if (!global.document || state.currentView !== 'premium-features' || !state.currentUser) return;
    global.document.querySelectorAll('[data-premium-plan]').forEach((button) => { button.onclick = () => { if (PremiumStudyPlanService.activate(button.dataset.premiumPlan)) render(); }; });
    global.document.querySelectorAll('[data-premium-mock]').forEach((button) => { button.onclick = () => AdvancedMockExamService.start(button.dataset.premiumMock); });
    global.document.querySelectorAll('[data-premium-pack]').forEach((button) => { button.onclick = () => { if (PremiumContentPackService.open(button.dataset.premiumPack)) { toast?.('Đã mở content pack Premium.'); render(); } }; });
    global.document.querySelector('[data-premium-report]')?.addEventListener('click', () => { if (PrivateLearningReportService.generate()) render(); });
    global.document.querySelector('[data-premium-curriculum]')?.addEventListener('click', () => { if (PersonalCurriculumService.generate()) render(); });
    global.document.querySelectorAll('[data-premium-export]').forEach((button) => { button.onclick = () => { const result = MaterialExportService.download(button.dataset.premiumExport); if (result) toast?.(result.status === 'print-dialog' ? 'Đã mở hộp thoại in/PDF.' : 'Đã chuẩn bị file xuất.'); }; });
  };
  if (routes.has(state.currentView)) PremiumLearningContentService.load();
})(window);
