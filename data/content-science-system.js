/* P71C — content trust and evidence-based learning science. */
(function buildContentScienceSystem(global) {
  'use strict';
  const app = global.KLEARN_APP;
  if (!app) return;
  const { state, STORAGE_KEYS, userScoped, saveUserScoped, getUserProgress, getUserSrs, PracticeService, LearnerProfileService, CloudSyncService, AccessControlService, setView, render, toast, escapeHtml } = app;
  const STORE_KEY = STORAGE_KEYS.contentScience || 'klearn_content_science';
  const FEEDBACK_KEY = STORAGE_KEYS.contentFeedback || 'klearn_content_feedback';
  const routes = new Set(['content-science', 'content-science-feedback']);
  const runtime = state.contentScience || (state.contentScience = { content: null, loading: null, error: '', selectedContentId: '' });
  const now = () => new Date().toISOString();
  const day = 86400000;
  const clean = (value, limit = 600) => String(value == null ? '' : value).normalize('NFC').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, limit);
  const clamp = (value) => Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
  const dateMs = (value) => { const result = new Date(value || '').getTime(); return Number.isFinite(result) ? result : 0; };
  const average = (values) => values.length ? Math.round(values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length) : null;
  const records = () => userScoped(STORE_KEY);
  const write = (items, reason = 'content-science') => { saveUserScoped(STORE_KEY, items, 600); CloudSyncService?.schedule?.(reason); return items; };
  const saveRecord = (record, reason = 'content-science-evidence') => {
    const value = { id: record.id || `p71c-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, ...record, updatedAt: now(), createdAt: record.createdAt || now() };
    write([value, ...records().filter((item) => item.id !== value.id)], reason); return value;
  };
  const qualityNames = { accuracy: 'Độ chính xác', naturalness: 'Tự nhiên', difficulty: 'Đúng độ khó', completeness: 'Đầy đủ' };
  const eventNames = new Set(['studied', 'remembered', 'used', 'improved']);

  const ContentScienceContentService = {
    hydrate(value) {
      if (!value || value.schemaVersion !== 1 || value.status !== 'approved' || value.verified !== true || !Array.isArray(value.reviews) || !value.qualityModel || !value.research) throw new Error('P71C content trust gate failed');
      runtime.content = Object.freeze(value); runtime.error = ''; return runtime.content;
    },
    load() {
      if (runtime.content) return Promise.resolve(runtime.content); if (runtime.loading) return runtime.loading; if (typeof global.fetch !== 'function') return Promise.resolve(null);
      runtime.loading = global.fetch('./content/content-science-system.json', { cache: 'default' }).then((response) => { if (!response.ok) throw new Error(`Content science ${response.status}`); return response.json(); }).then((value) => this.hydrate(value)).catch((error) => { runtime.error = clean(error.message); toast?.('Không thể tải dữ liệu kiểm duyệt nội dung.'); return null; }).finally(() => { runtime.loading = null; if (routes.has(state.currentView)) render(); });
      return runtime.loading;
    },
    get: () => runtime.content,
    reviews: () => runtime.content?.reviews || [],
    feedbackTypes: () => runtime.content?.feedbackTypes || []
  };

  const VerifiedContentService = {
    review(contentId) { return ContentScienceContentService.reviews().find((item) => item.contentId === contentId) || null; },
    score(contentId) {
      const review = this.review(contentId); if (!review) return { status: 'unverified', score: null, dimensions: {}, confidence: 'none' };
      const weights = runtime.content?.qualityModel?.weights || {}; const dimensions = Object.fromEntries(Object.keys(qualityNames).map((key) => [key, clamp(review.quality?.[key])]));
      const score = Math.round(Object.entries(dimensions).reduce((sum, [key, value]) => sum + value * Number(weights[key] || .25), 0));
      return { status: review.status, score, dimensions, confidence: review.evidence?.length >= 3 ? 'documented-review' : 'limited-review', rule: runtime.content.qualityModel.rule };
    },
    metadata(contentId) {
      const review = this.review(contentId); const quality = this.score(contentId);
      if (!review) return { contentId, verified: false, status: 'unverified', createdBy: null, reviewedBy: null, reviewDate: null, quality, disclosure: 'Chưa có hồ sơ giáo viên kiểm duyệt; không hiển thị nhãn Verified.' };
      const verified = review.status === 'approved' && Boolean(review.createdBy?.displayName && review.reviewedBy?.displayName && review.reviewDate) && quality.score >= Number(runtime.content?.qualityModel?.publishThreshold || 80);
      return { ...review, verified, quality, disclosure: `${review.reviewedBy.scope}. Điểm số hỗ trợ quy trình và không tự phê duyệt nội dung.` };
    },
    all() { return ContentScienceContentService.reviews().map((item) => this.metadata(item.contentId)); },
    verified() { return this.all().filter((item) => item.verified); }
  };

  const ContentEffectivenessService = {
    record(contentId, evidenceType, input = {}) {
      const type = clean(evidenceType, 30); const id = clean(contentId, 120); if (!id || !eventNames.has(type) || !state.currentUser) return null;
      const score = Number.isFinite(Number(input.score)) ? clamp(input.score) : null; const outcome = ['remembered', 'forgot', 'partial', 'completed'].includes(input.outcome) ? input.outcome : null;
      const signature = clean(input.signature || `${type}:${id}:${String(input.at || now()).slice(0, 10)}:${outcome || score || 'event'}`, 220);
      return saveRecord({ id: `effect-${signature.replace(/[^a-zA-Z0-9가-힣_-]/g, '-').slice(0, 180)}`, recordType: 'effectiveness_evidence', contentId: id, contentType: clean(input.contentType || this.contentType(id), 40), evidenceType: type, outcome, score, source: clean(input.source || 'learning-action', 80), occurredAt: input.at || now() });
    },
    contentType(id) { const review = VerifiedContentService.review(id); if (review) return review.contentType; if (/grammar/i.test(id)) return 'grammar'; if (/word|vocab|freq/i.test(id)) return 'vocabulary'; if (/lesson/i.test(id)) return 'lesson'; return 'practice'; },
    events(contentId = '') { return records().filter((item) => item.recordType === 'effectiveness_evidence' && (!contentId || item.contentId === contentId)); },
    bootstrap() {
      if (!state.currentUser) return [];
      const progress = getUserProgress?.() || {}; const lessons = Object.entries(progress.lessonProgress || {}).filter(([, item]) => item?.completed).slice(0, 200);
      lessons.forEach(([id, item]) => { this.record(id, 'studied', { score: item.score ?? item.masteryScore, outcome: 'completed', at: item.completedAt || item.updatedAt || now(), source: 'existing-lesson-progress', signature: `bootstrap-studied:${id}` }); if (Number(item.masteryScore || item.score) > 0) this.record(id, 'improved', { score: item.masteryScore ?? item.score, at: item.updatedAt || item.completedAt || now(), source: 'existing-mastery', signature: `bootstrap-improved:${id}` }); });
      (getUserSrs?.() || state.srsData || []).filter((card) => Number(card.reviewCount || 0) > 0).slice(0, 250).forEach((card) => { const attempts = Number(card.correctCount || 0) + Number(card.wrongCount || 0); const score = attempts ? Number(card.correctCount || 0) / attempts * 100 : Number(card.mastery || 0); this.record(card.wordId || card.id, 'remembered', { contentType: 'vocabulary', score, outcome: score >= 60 ? 'remembered' : 'forgot', at: card.lastReviewed || card.updatedAt || now(), source: 'existing-srs', signature: `bootstrap-recall:${card.wordId || card.id}:${card.reviewCount}` }); });
      return this.events();
    },
    summary(contentId = '') {
      const events = this.events(contentId); const count = (type) => events.filter((item) => item.evidenceType === type).length; const recalls = events.filter((item) => item.evidenceType === 'remembered'); const scores = events.filter((item) => Number.isFinite(item.score)).sort((a, b) => dateMs(a.occurredAt) - dateMs(b.occurredAt)); const first = scores[0]?.score ?? null; const last = scores.at(-1)?.score ?? null;
      return { contentId: contentId || null, status: events.length ? 'measured' : 'collecting', studied: count('studied'), remembered: count('remembered'), used: count('used'), improved: count('improved'), retention: recalls.length ? Math.round(recalls.filter((item) => item.outcome !== 'forgot').length / recalls.length * 100) : null, firstScore: first, latestScore: last, improvement: first != null && last != null && scores.length > 1 ? last - first : null, sampleSize: events.length };
    },
    byContent() { return [...new Set(this.events().map((item) => item.contentId))].map((id) => this.summary(id)).sort((a, b) => b.sampleSize - a.sampleSize); }
  };

  const ContentRetentionAnalyticsService = {
    vocabulary() {
      const cards = (getUserSrs?.() || state.srsData || []).filter((card) => Number(card.reviewCount || 0) > 0); const scores = cards.map((card) => { const attempts = Number(card.correctCount || 0) + Number(card.wrongCount || 0); return attempts ? Number(card.correctCount || 0) / attempts * 100 : Number(card.mastery || 0); });
      return { status: cards.length ? 'measured' : 'collecting', score: average(scores), sampleSize: cards.length, method: 'SRS recall evidence' };
    },
    grammar() { const events = ContentEffectivenessService.events().filter((item) => item.contentType === 'grammar' && ['remembered', 'improved', 'used'].includes(item.evidenceType)); return { status: events.length ? 'measured' : 'collecting', score: average(events.map((item) => item.score).filter(Number.isFinite)), sampleSize: events.length, method: 'Grammar recall and usage evidence' }; },
    skills() {
      const external = global.SkillGrowthService?.calculate?.(90); if (external) return external;
      const values = LearnerProfileService?.get?.()?.skillScores || getUserProgress?.()?.skills || {}; return Object.fromEntries(Object.entries(values).map(([skill, score]) => [skill, { skill, current: clamp(score), previous: null, delta: null, series: [] }]));
    },
    report() { return { vocabulary: this.vocabulary(), grammar: this.grammar(), skills: this.skills(), generatedAt: now(), scope: 'current-user-learning-evidence' }; }
  };

  const LearningCurveService = {
    points() {
      const cards = getUserSrs?.() || state.srsData || []; const events = ContentEffectivenessService.events(); const dates = [...cards.map((card) => dateMs(card.activatedAt || card.createdAt || card.firstReviewed)).filter(Boolean), ...events.map((item) => dateMs(item.occurredAt)).filter(Boolean)].sort((a, b) => a - b); if (!dates.length) return [];
      const start = dates[0]; const currentDay = Math.max(1, Math.ceil((Date.now() - start) / day)); const checkpoints = [...new Set([1, 7, 30, 90, currentDay].filter((value) => value <= currentDay))].sort((a, b) => a - b);
      return checkpoints.map((dayNumber) => { const end = start + dayNumber * day; const vocabulary = cards.filter((card) => dateMs(card.activatedAt || card.createdAt || card.firstReviewed) <= end).length; const studied = events.filter((item) => item.evidenceType === 'studied' && dateMs(item.occurredAt) <= end).length; const used = events.filter((item) => item.evidenceType === 'used' && dateMs(item.occurredAt) <= end).length; return { day: dayNumber, vocabulary, studied, used, evidence: vocabulary + studied + used }; });
    }
  };

  const ContentScienceFeedbackService = {
    types: () => ContentScienceContentService.feedbackTypes(),
    all() { return userScoped(FEEDBACK_KEY).filter((item) => item.qualitySystem === 'P71C'); },
    submit(input = {}) {
      const type = this.types().find((item) => item.id === clean(input.reportType, 40)); const contentId = clean(input.contentId, 120); const message = clean(input.message, 1000); if (!state.currentUser || !type || !contentId || !message) throw new Error('Báo cáo nội dung chưa hợp lệ.');
      const known = VerifiedContentService.review(contentId) || global.AdvancedContentService?.byId?.(contentId, true); if (!known) throw new Error('Không tìm thấy nội dung cần báo cáo.');
      const item = { id: `p71c-report-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, qualitySystem: 'P71C', userId: state.currentUser.id, contentId, contentType: known.contentType || known.type || 'content', reportType: type.id, message, status: 'received', createdAt: now(), updatedAt: now() };
      saveUserScoped(FEEDBACK_KEY, [item, ...userScoped(FEEDBACK_KEY)], 250); CloudSyncService?.schedule?.('p71c-content-feedback'); global.UserResearchService?.track?.('feedback_submitted', { feature: 'content-science', contentId }); return item;
    }
  };

  const AnonymousLearningStatisticsService = {
    allowed() { return global.UserResearchService?.consent?.enabled?.() === true && app.PrivacyPreferenceService?.allows?.('telemetry') !== false; },
    band(value) { const score = Number(value); if (!Number.isFinite(score)) return 'insufficient'; return score < 50 ? '0-49' : score < 70 ? '50-69' : score < 85 ? '70-84' : '85-100'; },
    payload(contentId = '') {
      if (!this.allowed()) return { status: 'disabled', reason: 'consent-required', payload: null };
      const knownContent = contentId && (VerifiedContentService.review(contentId) || global.AdvancedContentService?.byId?.(contentId, true)); const aggregateContentId = knownContent ? clean(contentId, 120) : 'all';
      const effectiveness = ContentEffectivenessService.summary(knownContent ? contentId : ''); const retention = ContentRetentionAnalyticsService.report(); const level = Number(state.currentUser?.currentTopikLevel || 0); const payload = { dateBucket: now().slice(0, 7), segment: clean(global.UserResearchService?.segment?.() || 'unclassified', 40), levelBand: level <= 0 ? 'foundation' : level <= 2 ? 'topik-1-2' : level <= 4 ? 'topik-3-4' : 'topik-5-6', contentId: aggregateContentId, contentType: knownContent ? ContentEffectivenessService.contentType(contentId) : 'aggregate', studiedCount: effectiveness.studied, rememberedCount: effectiveness.remembered, usedCount: effectiveness.used, improvedCount: effectiveness.improved, retentionBand: this.band(effectiveness.retention ?? retention.vocabulary.score), scoreBand: this.band(effectiveness.latestScore) };
      const allowed = new Set(runtime.content?.research?.allowedFields || []); return { status: 'ready', payload: Object.fromEntries(Object.entries(payload).filter(([key]) => allowed.has(key))) };
    },
    async submit(contentId = '') {
      const projected = this.payload(contentId); if (!projected.payload) return projected; const client = global.SupabaseService?.client; if (!client?.rpc) return { ...projected, status: 'local-ready', submitted: false };
      const { error } = await client.rpc('submit_anonymous_content_science', { p_payload: projected.payload }); return error ? { ...projected, status: 'failed', submitted: false } : { ...projected, status: 'submitted', submitted: true };
    }
  };

  function observeLearningMutation(event) {
    if (!state.currentUser || !event?.detail) return; const detail = event.detail; const contentId = clean(detail.entityId, 120); if (!contentId) return;
    if (detail.type === 'completed_lesson') ContentEffectivenessService.record(contentId, 'studied', { contentType: 'lesson', score: detail.score, outcome: 'completed', source: 'learning-mutation', signature: detail.mutationId || detail.id });
    if (detail.type === 'srs_updated') ContentEffectivenessService.record(contentId, 'remembered', { contentType: 'vocabulary', outcome: detail.rating === 'forgot' ? 'forgot' : detail.rating ? 'remembered' : 'partial', source: 'learning-mutation', signature: detail.mutationId || detail.id });
    if (detail.type === 'practice_completed') ContentEffectivenessService.record(contentId, 'used', { contentType: 'practice', score: detail.score, outcome: 'completed', source: 'learning-mutation', signature: detail.mutationId || detail.id });
    if (detail.type === 'mastery_updated') ContentEffectivenessService.record(contentId, 'improved', { score: detail.mastery, source: 'learning-mutation', signature: detail.mutationId || detail.id });
  }

  const heading = (back, eyebrow, title, description) => `<section class="section page-heading p71c-heading"><button class="back-link" data-view="${back}" aria-label="Quay lại">←</button><p class="eyebrow">${escapeHtml(eyebrow)}</p><h1 class="headline">${escapeHtml(title)}</h1><p class="subtle">${escapeHtml(description)}</p></section>`;
  const metric = (label, value, detail) => `<article><small>${escapeHtml(label)}</small><strong>${escapeHtml(value)}</strong><span>${escapeHtml(detail)}</span></article>`;
  const loading = () => { ContentScienceContentService.load(); return `${heading('analytics', 'P71C', 'Đang tải hồ sơ kiểm duyệt…', 'Chỉ nội dung có đủ bằng chứng mới được gắn nhãn Verified.')}<section class="section p71c-loading"></section>`; };
  function dashboardView() {
    if (!runtime.content) return loading(); ContentEffectivenessService.bootstrap(); const verified = VerifiedContentService.verified(); const retention = ContentRetentionAnalyticsService.report(); const effectiveness = ContentEffectivenessService.summary(); const curve = LearningCurveService.points(); const research = AnonymousLearningStatisticsService.payload(); const maxEvidence = Math.max(1, ...curve.map((item) => item.evidence));
    return `${heading('analytics', 'P71C · CONTENT TRUST', 'Nội dung đáng tin, kết quả có bằng chứng', 'Biết ai tạo, ai duyệt, chất lượng từng chiều và nội dung có thật sự giúp bạn nhớ hay không.')}<section class="section p71c-metrics">${metric('Nội dung đã xác minh', String(verified.length), 'Đủ tác giả · người duyệt · ngày duyệt')}${metric('Đã học', String(effectiveness.studied), 'Bằng chứng hoàn thành')}${metric('Đã nhớ', effectiveness.retention == null ? 'Đang đo' : `${effectiveness.retention}%`, `${effectiveness.remembered} lượt recall`)}${metric('Đã sử dụng', String(effectiveness.used), 'Bài luyện có ngữ cảnh')}</section><section class="section p71c-two-col"><article class="p71c-panel"><header><div><p class="eyebrow">LEARNING CURVE</p><h2>Đường cong học tập</h2></div><span>${curve.length ? `${curve.at(-1).evidence} bằng chứng` : 'Đang thu thập'}</span></header>${curve.length ? `<div class="p71c-curve">${curve.map((point) => `<div><i style="height:${Math.max(8, Math.round(point.evidence / maxEvidence * 100))}%"></i><b>Ngày ${point.day}</b><small>${point.vocabulary} từ · ${point.studied} bài · ${point.used} lượt dùng</small></div>`).join('')}</div>` : '<div class="empty-state"><b>Chưa đủ dữ liệu</b><p>Hoàn thành bài và ôn SRS để tạo đường cong thật.</p></div>'}</article><article class="p71c-panel"><header><div><p class="eyebrow">RETENTION</p><h2>Khả năng ghi nhớ</h2></div></header><div class="p71c-retention"><p><span>Từ vựng</span><b>${retention.vocabulary.score == null ? 'Đang đo' : `${retention.vocabulary.score}%`}</b><small>${retention.vocabulary.sampleSize} mẫu SRS</small></p><p><span>Ngữ pháp</span><b>${retention.grammar.score == null ? 'Đang đo' : `${retention.grammar.score}%`}</b><small>${retention.grammar.sampleSize} bằng chứng</small></p></div><p class="p71c-note">Chỉ số dùng recall và usage evidence; không dùng số lần mở app thay cho kết quả học.</p></article></section><section class="section p71c-panel"><header><div><p class="eyebrow">VERIFIED CONTENT</p><h2>Hồ sơ kiểm duyệt</h2></div><button class="btn secondary" data-view="content-science-feedback">Báo vấn đề</button></header><div class="p71c-review-list">${verified.map((item) => `<article><div><span class="p71c-verified">✓ Verified</span><h3>${escapeHtml(item.contentId)}</h3><p>Tạo bởi <b>${escapeHtml(item.createdBy.displayName)}</b></p><p>Duyệt bởi <b>${escapeHtml(item.reviewedBy.displayName)}</b> · ${escapeHtml(item.reviewDate)}</p></div><strong>${item.quality.score}<small>/100</small></strong><details><summary>Xem bốn chiều chất lượng</summary>${Object.entries(item.quality.dimensions).map(([key, value]) => `<p><span>${escapeHtml(qualityNames[key])}</span><b>${value}</b></p>`).join('')}<small>${escapeHtml(item.disclosure)}</small></details></article>`).join('')}</div></section><section class="section p71c-research"><div><p class="eyebrow">RESEARCH DATA</p><h2>Thống kê học tập ẩn danh</h2><p>${research.status === 'ready' || research.status === 'local-ready' ? 'Đã được phép: chỉ gửi nhóm level, nhóm điểm và số đếm tổng hợp.' : 'Đang tắt. Chỉ hoạt động khi bạn đồng ý trong Hồ sơ; việc học không bị ảnh hưởng.'}</p></div><button class="btn secondary" data-p71c-research ${research.payload ? '' : 'disabled'}>Gửi mẫu tổng hợp</button></section>`;
  }
  function feedbackView() {
    if (!runtime.content) return loading(); const reports = ContentScienceFeedbackService.all(); const selected = runtime.selectedContentId || VerifiedContentService.verified()[0]?.contentId || '';
    return `${heading('content-science', 'CONTENT FEEDBACK LOOP', 'Báo vấn đề nội dung', 'Báo sai nghĩa, ví dụ khó hiểu hoặc audio lỗi. Báo cáo thuộc riêng tài khoản của bạn và đội kiểm duyệt.')}<form id="p71cFeedbackForm" class="section p71c-feedback"><label>Nội dung<select name="contentId">${VerifiedContentService.all().map((item) => `<option value="${escapeHtml(item.contentId)}" ${item.contentId === selected ? 'selected' : ''}>${escapeHtml(item.contentId)}</option>`).join('')}</select></label><label>Loại vấn đề<select name="reportType">${ContentScienceFeedbackService.types().map((item) => `<option value="${item.id}">${escapeHtml(item.label)}</option>`).join('')}</select></label><label class="wide">Mô tả<textarea name="message" maxlength="1000" required placeholder="Mô tả vị trí và điều bạn thấy chưa đúng…"></textarea></label><button class="btn primary wide">Gửi Content Issue Report</button></form><section class="section p71c-report-list"><h2>Báo cáo của bạn</h2>${reports.length ? reports.map((item) => `<article><div><b>${escapeHtml(ContentScienceFeedbackService.types().find((type) => type.id === item.reportType)?.label || item.reportType)}</b><small>${escapeHtml(item.contentId)}</small></div><p>${escapeHtml(item.message)}</p><span>${escapeHtml(item.status)}</span></article>`).join('') : '<div class="empty-state"><b>Chưa có báo cáo</b><p>Nếu nội dung đúng và rõ, bạn không cần làm gì.</p></div>'}</section>`;
  }
  function bind() {
    const form = global.document?.getElementById('p71cFeedbackForm'); if (form) form.onsubmit = (event) => { event.preventDefault(); try { ContentScienceFeedbackService.submit(Object.fromEntries(new FormData(form))); toast?.('Đã gửi Content Issue Report.'); form.reset(); render(); } catch (error) { toast?.(error.message); } };
    global.document?.querySelector('[data-p71c-research]')?.addEventListener('click', async () => { const result = await AnonymousLearningStatisticsService.submit(); toast?.(result.submitted ? 'Đã gửi thống kê tổng hợp ẩn danh.' : result.status === 'local-ready' ? 'Mẫu tổng hợp đã sẵn sàng; sẽ gửi khi dịch vụ cloud khả dụng.' : 'Thống kê đang tắt hoặc chưa thể gửi.'); });
  }

  Object.assign(global, { ContentScienceContentService, VerifiedContentService, ContentQualityScoreService: VerifiedContentService, ContentEffectivenessService, ContentRetentionAnalyticsService, LearningCurveService, ContentScienceFeedbackService, AnonymousLearningStatisticsService, ContentScienceSystem: { content: ContentScienceContentService, verified: VerifiedContentService, effectiveness: ContentEffectivenessService, retention: ContentRetentionAnalyticsService, curve: LearningCurveService, feedback: ContentScienceFeedbackService, research: AnonymousLearningStatisticsService, version: 'p71c-v1' } });
  global.KLEARN_EXTRA_VIEWS = { ...(global.KLEARN_EXTRA_VIEWS || {}), 'content-science': dashboardView, 'content-science-feedback': feedbackView };
  global.addEventListener?.('klearn-sync-action', observeLearningMutation);
  const previousAfterRender = global.KLEARN_AFTER_RENDER;
  global.KLEARN_AFTER_RENDER = () => { previousAfterRender?.(); if (!state.currentUser) return; if (['analytics', 'content-platform'].includes(state.currentView) && !global.document?.querySelector('.p71c-entry')) global.document?.querySelector('.page-heading')?.insertAdjacentHTML('afterend', `<section class="section p71c-entry"><div><small>P71C · CONTENT SCIENCE</small><h2>Nội dung đáng tin, tiến bộ đo được</h2><p>Hồ sơ giáo viên kiểm duyệt · chất lượng bốn chiều · retention thật</p></div><button class="btn primary" data-view="content-science">Mở Content Science</button></section>`); bind(); };
  ContentScienceContentService.load();
})(window);
