/* Tiếng Hàn - TamHoanq · P25 Learning Trust and Quality System */
(function buildContentQualitySystem(global) {
  'use strict';
  const app = global.KLEARN_APP;
  if (!app) return;
  const { state, STORAGE_KEYS, render, setView, toast, escapeHtml, userScoped, saveUserScoped, AccessControlService } = app;
  const routes = new Set(['content-platform', 'content-detail', 'content-quality-dashboard']);
  const runtime = state.contentQuality || (state.contentQuality = { content: null, loading: false, error: '' });
  const now = () => new Date().toISOString();
  const locale = () => global.document?.documentElement?.lang === 'en' ? 'en' : global.document?.documentElement?.lang?.startsWith('zh') ? 'zh-CN' : 'vi';
  const localize = (value) => value && typeof value === 'object' && !Array.isArray(value) ? (value[locale()] || value.vi || value.en || '') : String(value || '');
  const copy = (vi, en, zh) => localize({ vi, en, 'zh-CN': zh });
  const clean = (value, limit = 1200) => String(value || '').normalize('NFC').replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, limit);
  const normalize = (value) => clean(value, 300).toLocaleLowerCase('vi').replace(/[\p{P}\p{S}]/gu, '').replace(/\s+/g, '');
  const advanced = global.AdvancedContentService;
  const contentItem = (id) => advanced?.byId?.(id, true) || null;
  const itemTitle = (item) => item?.korean || localize(item?.title) || item?.id || '';
  const itemType = (item) => item?.type || 'content';

  const ContentQualityContentService = {
    async load() {
      if (runtime.content) return runtime.content;
      if (runtime.loading) return runtime.loading;
      runtime.loading = fetch('./content/content-quality-system.json?v=2', { cache: 'default' }).then((response) => { if (!response.ok) throw new Error(`Quality content ${response.status}`); return response.json(); }).then((value) => {
        if (value?.verified !== true || value.reviewStatus !== 'approved' || !Array.isArray(value.reviews) || !Array.isArray(value.reportTypes)) throw new Error('Content quality gate failed');
        runtime.content = value; runtime.error = ''; return value;
      }).catch((error) => { runtime.error = error.message || 'Content quality unavailable'; return null; }).finally(() => { runtime.loading = false; if (routes.has(state.currentView)) render(); });
      return runtime.loading;
    },
    ensure() { return Promise.all([this.load(), advanced?.load?.() || Promise.resolve()]).finally(() => { if (routes.has(state.currentView)) render(); }); },
    hydrate(value) { if (value?.verified !== true || value.reviewStatus !== 'approved' || !Array.isArray(value.reviews)) throw new Error('Content quality gate failed'); runtime.content = value; runtime.error = ''; return value; },
    review(id) { return runtime.content?.reviews?.find((item) => item.contentId === id) || null; },
    reportTypes() { return runtime.content?.reportTypes || []; }
  };

  const DuplicateDetectionService = {
    groups(items = advanced?.raw?.() || []) {
      const buckets = new Map();
      items.forEach((item) => { const value = item.korean || localize(item.title) || localize(item.meaning); const key = normalize(value); if (!key) return; const list = buckets.get(key) || []; list.push({ id: item.id, type: item.type, title: itemTitle(item) }); buckets.set(key, list); });
      return [...buckets.entries()].filter(([, list]) => list.length > 1).map(([key, items]) => ({ key, items }));
    },
    examples(items = advanced?.raw?.() || []) { return this.groups(items.filter((item) => item.type === 'example')); },
    lessons(items = advanced?.raw?.() || []) { return this.groups(items.filter((item) => ['lesson', 'grammar'].includes(item.type))); }
  };

  const AudioQualityService = {
    inspect(item) {
      const review = ContentQualityContentService.review(item?.id); const score = Number(review?.audio?.score ?? item?.quality?.audioQuality);
      const result = (key) => review?.audio?.[key] || (Number.isFinite(score) && score >= 80 ? 'pass' : 'review');
      return { volume: result('volume'), pronunciation: result('pronunciation'), speed: result('speed'), score: Number.isFinite(score) ? score : null, ready: Boolean(review?.audio) || Number.isFinite(score) };
    }
  };

  const ContentQualityService = {
    all() { return advanced?.raw?.() || []; },
    review(id) { return ContentQualityContentService.review(id); },
    confidence(item) { const review = this.review(item?.id); if (review?.accuracyScore !== undefined) return Number(review.accuracyScore); const values = Object.values(item?.quality || {}).map(Number).filter(Number.isFinite); return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null; },
    checks(item) { const review = this.review(item?.id); const audio = AudioQualityService.inspect(item); return { nativeChecked: Boolean(review?.nativeChecked), grammarChecked: Boolean(review?.grammarChecked), exampleChecked: Boolean(review?.exampleChecked), translationNatural: review?.translationNaturalness == null ? null : Number(review.translationNaturalness), difficultyValidated: Boolean(review?.difficultyValidated), audio }; },
    source(item) { return this.review(item?.id)?.source || (item?.type === 'word' ? ['Frequency vocabulary'] : ['TOPIK curriculum']); },
    health() {
      const items = this.all(); const records = items.map((item) => ({ item, review: this.review(item.id), confidence: this.confidence(item), checks: this.checks(item) })); const reviewed = records.filter(({ review }) => review?.reviewStatus === 'approved'); const scores = records.map((row) => row.confidence).filter(Number.isFinite); const issues = records.filter(({ review, confidence, checks }) => !review || review.reviewStatus !== 'approved' || (Number.isFinite(confidence) && confidence < 80) || !checks.nativeChecked || !checks.grammarChecked || !checks.difficultyValidated || (checks.audio.ready && checks.audio.score !== null && checks.audio.score < 80) || checks.translationNatural !== null && checks.translationNatural < 80).map(({ item, review, confidence, checks }) => ({ id: item.id, title: itemTitle(item), type: itemType(item), status: review?.reviewStatus || 'unreviewed', confidence, checks })); const duplicates = DuplicateDetectionService.groups(items); return { total: items.length, reviewed: reviewed.length, awaiting: items.length - reviewed.length, averageConfidence: scores.length ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : null, highConfidence: records.filter(({ confidence }) => confidence >= 90).length, issues, duplicates, duplicateExamples: DuplicateDetectionService.examples(items), duplicateLessons: DuplicateDetectionService.lessons(items), sourceCounts: records.reduce((out, { item }) => { this.source(item).forEach((source) => { out[source] = (out[source] || 0) + 1; }); return out; }, {}) }; 
    }
  };

  const ContentQualityReportService = {
    all() { return userScoped(STORAGE_KEYS.contentFeedback).filter((item) => item.qualitySystem === 'P25'); },
    submit({ contentId, reportType, message }) { const item = contentItem(contentId); const detail = clean(message); if (!item || !ContentQualityContentService.reportTypes().some((type) => type.id === reportType) || !detail) throw new Error(copy('Phản hồi chưa hợp lệ.', 'Invalid quality report.', '质量反馈无效。')); const entry = { id: `quality-report-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, userId: state.currentUser?.id, contentId, contentType: item.type, qualitySystem: 'P25', reportType, message: detail, status: 'received', createdAt: now() }; saveUserScoped(STORAGE_KEYS.contentFeedback, [entry, ...userScoped(STORAGE_KEYS.contentFeedback)], 200); return entry; }
  };

  function heading(back, eyebrow, title, description) { return `<section class="section page-heading p25-heading"><button class="back-link" data-view="${back}">←</button><p class="eyebrow">${escapeHtml(eyebrow)}</p><h1 class="headline">${escapeHtml(title)}</h1><p class="subtle">${escapeHtml(description)}</p></section>`; }
  function badge(label, pass) { return `<span class="p25-check ${pass ? 'pass' : 'pending'}">${pass ? '✓' : '◌'} ${escapeHtml(label)}</span>`; }
  function qualityPanel(id) {
    const item = contentItem(id); if (!item || !runtime.content) return '';
    const review = ContentQualityService.review(id); const checks = ContentQualityService.checks(item); const score = ContentQualityService.confidence(item); const history = [...(review?.versionHistory || []), ...(global.ContentVersionService?.history?.(id) || [])].sort((a, b) => Number(b.version || 0) - Number(a.version || 0));
    return `<section class="p25-trust-panel" data-p25-trust><header><div><small> P25 · LEARNING TRUST</small><h2>${copy('Độ tin cậy nội dung', 'Content trust', '内容可信度')}</h2></div><strong>${score == null ? '—' : `${score}%`}</strong></header><div class="p25-check-grid">${badge('Native checked', checks.nativeChecked)}${badge('Grammar checked', checks.grammarChecked)}${badge('Example checked', checks.exampleChecked)}${badge('Difficulty validated', checks.difficultyValidated)}</div><div class="p25-trust-meta"><p><b>${copy('Nguồn học', 'Learning source', '学习来源')}</b> ${ContentQualityService.source(item).map((source) => `<span>${escapeHtml(source)}</span>`).join('')}</p>${checks.translationNatural !== null ? `<p><b>${copy('Bản dịch tự nhiên', 'Vietnamese naturalness', '越南语自然度')}</b> ${checks.translationNatural}%</p>` : ''}<p><b>${copy('Audio', 'Audio quality', '音频质量')}</b> ${checks.audio.ready ? `${checks.audio.score ?? '—'}/100 · ${checks.audio.volume}/${checks.audio.pronunciation}/${checks.audio.speed}` : copy('Chưa có kiểm tra', 'Not checked', '尚未检查')}</p></div>${history.length ? `<details class="p25-version-history"><summary>${copy('Lịch sử phiên bản', 'Version history', '版本历史')}</summary>${history.map((entry) => `<p><b>v${entry.version || '—'}</b><span>${escapeHtml(entry.change || '')}</span><small>${escapeHtml(entry.changedAt || entry.createdAt || '')}</small></p>`).join('')}</details>` : ''}<form class="p25-report-form" data-p25-report-form><label>${copy('Báo vấn đề với nội dung', 'Report a content issue', '报告内容问题')}<select name="reportType">${ContentQualityContentService.reportTypes().map((type) => `<option value="${escapeHtml(type.id)}">${escapeHtml(localize(type))}</option>`).join('')}</select></label><textarea name="message" maxlength="1200" required placeholder="${copy('Mô tả cụ thể để đội nội dung kiểm tra…', 'Describe the issue for the content team…', '请描述问题以便内容团队检查…')}"></textarea><button class="btn secondary">${copy('Gửi báo cáo chất lượng', 'Submit quality report', '提交质量报告')}</button></form></section>`;
  }
  function dashboardView() {
    if (AccessControlService?.role?.() !== 'admin') return `${heading('content-platform', 'P25 · CONTENT HEALTH', copy('Không có quyền truy cập', 'Access denied', '无权访问'), copy('Chỉ admin mới xem được toàn bộ chất lượng nội dung.', 'Only admins can view the full content health dashboard.', '只有管理员可以查看完整内容质量。'))}<section class="p25-denied section">🔒</section>`;
    if (!runtime.content || !advanced?.raw?.().length) { ContentQualityContentService.ensure(); return `${heading('content-platform', 'P25 · CONTENT HEALTH', copy('Đang tổng hợp chất lượng…', 'Building content health…', '正在整理内容质量…'))}<section class="empty-state section"><h2>${copy('Đang tải dữ liệu kiểm định', 'Loading validation data', '正在加载验证数据')}</h2></section>`; }
    const health = ContentQualityService.health(); const sourceRows = Object.entries(health.sourceCounts); return `${heading('content-platform', 'P25 · CONTENT HEALTH DASHBOARD', copy('Chất lượng nội dung', 'Content health', '内容健康度'), copy('Native validation, confidence, source và lỗi cần xử lý trong một nơi.', 'Native validation, confidence, sources and issues in one place.', '在一个地方查看母语审核、置信度、来源和待处理问题。'))}<section class="p25-metrics section"><article><small>${copy('Tổng nội dung', 'Total content', '内容总数')}</small><b>${health.total}</b></article><article><small>${copy('Đã kiểm định', 'Reviewed', '已审核')}</small><b>${health.reviewed}</b></article><article><small>${copy('Confidence TB', 'Average confidence', '平均置信度')}</small><b>${health.averageConfidence == null ? '—' : `${health.averageConfidence}%`}</b></article><article><small>${copy('Cần xử lý', 'Needs attention', '需要处理')}</small><b>${health.issues.length}</b></article></section><section class="p25-health-grid section"><article><h2>${copy('Nguồn học', 'Learning sources', '学习来源')}</h2>${sourceRows.map(([source, count]) => `<p><span>${escapeHtml(source)}</span><b>${count}</b></p>`).join('')}</article><article><h2>${copy('Kiểm tra trùng', 'Duplicate detection', '重复检测')}</h2><p><span>${copy('Nhóm trùng tổng', 'Duplicate groups', '重复组')}</span><b>${health.duplicates.length}</b></p><p><span>${copy('Ví dụ trùng', 'Duplicate examples', '重复例句')}</span><b>${health.duplicateExamples.length}</b></p><p><span>${copy('Lesson trùng', 'Duplicate lessons', '重复课程')}</span><b>${health.duplicateLessons.length}</b></p></article></section><section class="p25-issues section"><h2>${copy('Hàng đợi chất lượng', 'Quality queue', '质量队列')}</h2>${health.issues.length ? health.issues.slice(0, 30).map((issue) => `<article><div><b>${escapeHtml(issue.title)}</b><small>${escapeHtml(issue.type)} · ${escapeHtml(issue.status)} · ${issue.confidence == null ? '—' : `${issue.confidence}%`}</small></div><button class="btn secondary" data-content-open="${escapeHtml(issue.id)}">${copy('Xem', 'Open', '打开')}</button></article>`).join('') : `<p>${copy('Tất cả nội dung đã qua quality gate.', 'All content passes the quality gate.', '所有内容都通过质量门槛。')}</p>`}</section>`;
  }

  Object.assign(global, { ContentQualityContentService, DuplicateDetectionService, AudioQualityService, ContentQualityService, ContentQualityReportService });
  global.KLEARN_EXTRA_VIEWS = { ...(global.KLEARN_EXTRA_VIEWS || {}), 'content-quality-dashboard': dashboardView };
  const previousSearch = global.GlobalSearchService?.search?.bind(global.GlobalSearchService);
  if (previousSearch) global.GlobalSearchService.search = (query) => { const result = previousSearch(query); if (/quality|trust|confidence|chất lượng|kiểm định|nguồn học/i.test(String(query || ''))) result.studyTools = [...(result.studyTools || []), { id: 'content-quality-dashboard', title: copy('Content Health Dashboard', 'Content Health Dashboard', '内容健康度面板'), description: copy('Native review · confidence · source', 'Native review · confidence · source', '母语审核 · 置信度 · 来源'), view: 'content-quality-dashboard' }]; return result; };
  const previousAfterRender = global.KLEARN_AFTER_RENDER;
  global.KLEARN_AFTER_RENDER = () => {
    previousAfterRender?.(); if (!state.currentUser) return;
    if (routes.has(state.currentView) && (!runtime.content || !advanced?.raw?.().length)) ContentQualityContentService.ensure();
    if (state.currentView === 'content-detail' && runtime.content && !global.document.querySelector('[data-p25-trust]')) global.document.querySelector('.acp-detail article')?.insertAdjacentHTML('afterbegin', qualityPanel(state.advancedContent?.selectedId));
    if (state.currentView === 'content-platform' && AccessControlService?.role?.() === 'admin' && !global.document.querySelector('[data-p25-quality-entry]')) global.document.querySelector('.acp-actions')?.insertAdjacentHTML('beforeend', `<button data-p25-quality-entry data-view="content-quality-dashboard"><b>✓ ${copy('Content Health', 'Content Health', '内容健康度')}</b><span>Native validation · Confidence · Reports</span></button>`);
    global.document.querySelectorAll('[data-p25-quality-entry]').forEach((button) => { button.onclick = () => setView('content-quality-dashboard'); });
    global.document.querySelectorAll('[data-content-open]').forEach((button) => { button.onclick = () => { if (state.advancedContent) state.advancedContent.selectedId = button.dataset.contentOpen; setView('content-detail'); }; });
    const reportForm = global.document.querySelector('[data-p25-report-form]'); if (reportForm) reportForm.onsubmit = (event) => { event.preventDefault(); const form = new FormData(reportForm); try { ContentQualityReportService.submit({ contentId: state.advancedContent?.selectedId, reportType: form.get('reportType'), message: form.get('message') }); toast(copy('Đã gửi báo cáo cho đội nội dung.', 'Quality report sent to the content team.', '质量报告已发送给内容团队。')); reportForm.reset(); } catch (error) { toast(error.message); } };
  };
  if (routes.has(state.currentView)) ContentQualityContentService.ensure();
})(window);
