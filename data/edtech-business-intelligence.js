/* P30 — aggregate business intelligence for the education product. */
(function buildEdtechBusinessIntelligence(global) {
  'use strict';
  const app = global.KLEARN_APP;
  if (!app) return;
  const { state, render, setView, escapeHtml, AccessControlService } = app;
  const routes = new Set(['admin-analytics']);
  const runtime = state.edtechBusinessIntelligence || (state.edtechBusinessIntelligence = { content: null, status: 'idle', error: '', data: null, loading: false });
  const fallbackConfig = { periods: ['daily', 'weekly', 'monthly'], retentionDays: [1, 7, 30] };
  const clean = (value, max = 180) => String(value == null ? '' : value).normalize('NFC').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);
  const number = (value) => Number.isFinite(Number(value)) ? Number(value) : null;
  const integer = (value) => number(value) == null ? null : Math.round(Number(value));
  const percent = (value) => number(value) == null ? null : Math.max(0, Math.min(100, Math.round(Number(value) * 100) / 100));
  const dateValue = (row) => row?.metric_date || row?.period_start || row?.created_at || row?.generated_at || '';
  const sortRecent = (rows) => [...(Array.isArray(rows) ? rows : [])].sort((a, b) => String(dateValue(b)).localeCompare(String(dateValue(a))));
  const latest = (rows) => sortRecent(rows)[0] || null;
  const safeRows = (rows) => Array.isArray(rows) ? rows.filter((row) => row && typeof row === 'object' && !Array.isArray(row)) : [];
  const display = (value, suffix = '') => value == null ? '—' : `${value}${suffix}`;
  const admin = () => AccessControlService?.role?.() === 'admin';
  const cloud = () => global.SupabaseService;
  const contentConfig = () => runtime.content || global.KLEARN_EDTECH_BI_CONTENT || fallbackConfig;

  const BusinessIntelligenceContentService = {
    hydrate(value) { if (value?.verified !== true || value.reviewStatus !== 'approved' || value.privacy?.adminRoleRequired !== true) throw new Error('Business intelligence content quality gate failed'); runtime.content = value; global.KLEARN_EDTECH_BI_CONTENT = value; return value; },
    async load() { if (runtime.content) return runtime.content; try { const response = await fetch('./content/edtech-business-intelligence.json', { cache: 'default' }); if (!response.ok) throw new Error(`BI content ${response.status}`); return this.hydrate(await response.json()); } catch (error) { runtime.error = clean(error?.message || 'BI content unavailable', 240); return null; } }
  };

  const selectFields = {
    daily: 'metric_date,total_users,new_users,active_users,returning_users,churn_users,day_1_retention,day_7_retention,day_30_retention,learning_minutes,learning_value,generated_at,source',
    courses: 'metric_date,course_id,course_title,starts,completions,completion_rate,engagement_score,learning_minutes,source',
    content: 'metric_date,content_id,content_title,content_type,engagements,completions,roi_score,source',
    premium: 'metric_date,free_users,premium_users,conversions,conversion_rate,source',
    support: 'type,status,created_at',
    health: 'metric_date,error_rate,p95_ms,api_success_rate,slow_requests,source',
    reports: 'period_type,period_start,period_end,summary,generated_at,source'
  };
  const tableNames = {
    daily: 'edtech_bi_daily_metrics', courses: 'edtech_bi_course_metrics', content: 'edtech_bi_content_metrics',
    premium: 'edtech_bi_premium_metrics', support: 'support_requests', health: 'edtech_bi_system_health', reports: 'edtech_bi_operation_reports'
  };

  const query = async (key) => {
    const client = cloud()?.client;
    if (!client) return { rows: [], error: 'Supabase aggregate client chưa kết nối.' };
    try {
      let request = client.from(tableNames[key]).select(selectFields[key]);
      if (key !== 'support') request = request.order(key === 'reports' ? 'period_start' : 'metric_date', { ascending: false });
      request = request.limit(key === 'support' ? 500 : 180);
      const result = await request;
      if (result?.error) throw result.error;
      return { rows: safeRows(result?.data) };
    } catch (error) {
      return { rows: [], error: clean(error?.message || `${tableNames[key]} unavailable`, 240) };
    }
  };

  const normalize = (input = {}) => ({
    daily: safeRows(input.daily), courses: safeRows(input.courses), content: safeRows(input.content), premium: safeRows(input.premium),
    support: safeRows(input.support), health: safeRows(input.health), reports: safeRows(input.reports)
  });

  const BusinessIntelligenceService = {
    hydrate(input = {}) { runtime.data = normalize(input); runtime.status = 'ready'; runtime.error = ''; return this.snapshot(); },
    async load() {
      if (!admin()) return null;
      if (runtime.loading) return runtime.loading;
      if (runtime.status === 'ready' && runtime.data) return this.snapshot();
      runtime.status = 'loading';
      runtime.loading = Promise.all([BusinessIntelligenceContentService.load(), ...Object.keys(tableNames).map(async (key) => [key, await query(key)])]).then((entries) => {
        entries = entries.slice(1);
        const data = Object.fromEntries(entries.map(([key, result]) => [key, result.rows]));
        const errors = entries.filter(([, result]) => result.error).map(([key, result]) => `${key}: ${result.error}`);
        const successful = entries.filter(([, result]) => !result.error).length;
        runtime.data = normalize(data); runtime.error = errors.join(' · '); runtime.status = successful ? 'ready' : 'unavailable';
        return this.snapshot();
      }).catch((error) => { runtime.status = 'error'; runtime.error = clean(error?.message || 'Business intelligence unavailable', 240); return this.snapshot(); }).finally(() => { runtime.loading = false; if (routes.has(state.currentView)) render(); });
      return runtime.loading;
    },
    available() { return admin(); },
    status() { return runtime.status; },
    snapshot() {
      if (!runtime.data) return { status: runtime.status, error: runtime.error, source: 'unavailable', piiIncluded: false };
      const data = runtime.data; const daily = latest(data.daily); const premium = latest(data.premium); const health = latest(data.health);
      const courses = sortRecent(data.courses).reduce((result, row) => { const key = clean(row.course_id || row.course_title || 'course', 100); if (!result.some((item) => item.id === key)) result.push({ id: key, title: clean(row.course_title || key, 140), starts: integer(row.starts), completions: integer(row.completions), completionRate: percent(row.completion_rate), engagementScore: percent(row.engagement_score), learningMinutes: integer(row.learning_minutes) }); return result; }, []).sort((a, b) => (b.engagementScore ?? -1) - (a.engagementScore ?? -1)).slice(0, 12);
      const content = sortRecent(data.content).reduce((result, row) => { const key = clean(row.content_id || row.content_title || 'content', 100); if (!result.some((item) => item.id === key)) result.push({ id: key, title: clean(row.content_title || key, 140), type: clean(row.content_type || 'content', 60), engagements: integer(row.engagements), completions: integer(row.completions), roiScore: percent(row.roi_score) }); return result; }, []).sort((a, b) => (b.roiScore ?? -1) - (a.roiScore ?? -1)).slice(0, 12);
      const support = data.support.reduce((result, row) => { const type = clean(row.type || 'other', 40); const status = clean(row.status || 'open', 40); result.total += 1; result.byType[type] = (result.byType[type] || 0) + 1; result.byStatus[status] = (result.byStatus[status] || 0) + 1; return result; }, { total: 0, byType: {}, byStatus: {} });
      return { status: runtime.status, error: runtime.error, source: data.daily.length || data.courses.length || data.content.length ? 'supabase-aggregate' : 'aggregate-schema-empty', piiIncluded: false,
        lifecycle: daily ? { date: dateValue(daily), totalUsers: integer(daily.total_users), newUsers: integer(daily.new_users), activeUsers: integer(daily.active_users), returningUsers: integer(daily.returning_users), churnUsers: integer(daily.churn_users) } : null,
        retention: daily ? { date: dateValue(daily), day1: percent(daily.day_1_retention), day7: percent(daily.day_7_retention), day30: percent(daily.day_30_retention) } : null,
        learningValue: daily ? { date: dateValue(daily), value: number(daily.learning_value), minutes: integer(daily.learning_minutes) } : null,
        courses, content, premium: premium ? { date: dateValue(premium), freeUsers: integer(premium.free_users), premiumUsers: integer(premium.premium_users), conversions: integer(premium.conversions), conversionRate: percent(premium.conversion_rate) } : null,
        support, health: health ? { date: dateValue(health), errorRate: percent(health.error_rate), p95Ms: integer(health.p95_ms), apiSuccessRate: percent(health.api_success_rate), slowRequests: integer(health.slow_requests) } : null,
        reports: sortRecent(data.reports).filter((row) => contentConfig().periods.includes(row.period_type)).slice(0, 12).map((row) => ({ period: clean(row.period_type, 20), start: clean(row.period_start, 30), end: clean(row.period_end, 30), summary: clean(row.summary, 240), generatedAt: clean(row.generated_at, 40) })) };
    }
  };

  const UserLifecycleService = { latest() { return BusinessIntelligenceService.snapshot().lifecycle; }, states() { const value = this.latest(); return value ? { new: value.newUsers, active: value.activeUsers, returning: value.returningUsers, churn: value.churnUsers } : null; } };
  const RetentionDashboardService = { latest() { return BusinessIntelligenceService.snapshot().retention; }, checkpoints() { const value = this.latest(); return value ? [{ day: 1, rate: value.day1 }, { day: 7, rate: value.day7 }, { day: 30, rate: value.day30 }] : []; } };
  const CoursePerformanceService = { all() { return BusinessIntelligenceService.snapshot().courses || []; }, lowest() { return [...this.all()].sort((a, b) => (a.completionRate ?? 101) - (b.completionRate ?? 101)); } };
  const ContentROIService = { all() { return BusinessIntelligenceService.snapshot().content || []; }, top(limit = 10) { return this.all().slice(0, limit); } };
  const PremiumConversionService = { latest() { return BusinessIntelligenceService.snapshot().premium; } };
  const UserValueService = { latest() { return BusinessIntelligenceService.snapshot().learningValue; } };
  const SupportAnalyticsService = { queue() { return BusinessIntelligenceService.snapshot().support; } };
  const SystemHealthService = { latest() { return BusinessIntelligenceService.snapshot().health; } };
  const OperationReportService = { all() { return BusinessIntelligenceService.snapshot().reports || []; }, byPeriod(period) { return this.all().filter((item) => item.period === period); } };

  const AdminControlCenterService = {
    links() { return [{ id: 'content-quality-dashboard', label: 'Chất lượng nội dung', detail: 'Verified, confidence và báo lỗi' }, { id: 'retention-analytics', label: 'Retention', detail: 'Day 1 · Day 7 · Day 30' }, { id: 'support', label: 'Hỗ trợ', detail: 'Bug report, feedback, question' }, { id: 'enterprise-platform', label: 'Nền tảng thương mại', detail: 'Premium, course và tổ chức' }]; },
    privacy() { return { aggregateOnly: true, userIds: false, rawMessages: false, credentials: false }; }
  };

  const metric = (label, value, detail = '') => `<article class="card p30-metric"><small>${escapeHtml(label)}</small><strong>${escapeHtml(String(value))}</strong><span>${escapeHtml(detail)}</span></article>`;
  const heading = (title, description) => `<section class="section page-heading p30-heading"><p class="eyebrow">P30 · EDTECH BUSINESS INTELLIGENCE</p><h1 class="headline">${escapeHtml(title)}</h1><p class="subtle">${escapeHtml(description)}</p></section>`;
  const denied = () => `${heading('Admin Control Center', 'Khu vực này chỉ dành cho role admin được xác thực từ Supabase app metadata.')}<section class="empty-state section"><h2>Không có quyền truy cập</h2><p>Aggregate vận hành không được mở cho tài khoản học viên.</p></section>`;
  const rows = (items, empty, renderer) => items?.length ? items.map(renderer).join('') : `<p class="subtle">${escapeHtml(empty)}</p>`;
  const adminView = () => {
    if (!admin()) return denied();
    const snapshot = BusinessIntelligenceService.snapshot();
    if (['idle', 'loading'].includes(snapshot.status)) { if (snapshot.status === 'idle') setTimeout(() => BusinessIntelligenceService.load(), 0); return `${heading('Admin Control Center', 'Users, content, analytics và system trong một nơi; chỉ aggregate, không dữ liệu cá nhân thô.')}<section class="empty-state section"><h2>Đang tải aggregate vận hành…</h2><p>Không hiển thị số 0 giả khi backend chưa sẵn sàng.</p></section>`; }
    if (snapshot.status !== 'ready') return `${heading('Admin Control Center', 'Users, content, analytics và system trong một nơi; chỉ aggregate, không dữ liệu cá nhân thô.')}<section class="empty-state section"><h2>Chưa kết nối BI backend</h2><p>${escapeHtml(snapshot.error || 'Áp dụng migration P30 để bật aggregate.')}</p><p class="subtle">Source: ${escapeHtml(snapshot.source)}</p></section>`;
    const lifecycle = snapshot.lifecycle; const retention = snapshot.retention; const premium = snapshot.premium; const health = snapshot.health; const value = snapshot.learningValue;
    return `${heading('Admin Control Center', 'Theo dõi vận hành sản phẩm giáo dục bằng aggregate có nguồn và phạm vi rõ ràng.')}<section class="stats stats-four p30-metrics section">${metric('Người dùng mới', display(lifecycle?.newUsers), lifecycle?.date || 'Chưa có dữ liệu')}${metric('Đang hoạt động', display(lifecycle?.activeUsers), `${display(lifecycle?.returningUsers)} quay lại`)}${metric('Day 7 retention', display(retention?.day7, '%'), `Day 1 ${display(retention?.day1, '%')} · Day 30 ${display(retention?.day30, '%')}`)}${metric('Learning value', display(value?.value), `${display(value?.minutes)} phút học`)}</section><section class="p30-control-grid section"><article class="card"><h2>Quản lý nhanh</h2>${rows(AdminControlCenterService.links(), 'Không có module quản trị.', (item) => `<button class="p30-link" data-view="${escapeHtml(item.id)}"><b>${escapeHtml(item.label)}</b><span>${escapeHtml(item.detail)}</span></button>` )}</article><article class="card"><h2>Premium conversion</h2>${premium ? `<p><b>${display(premium.conversionRate, '%')}</b> free → premium</p><p>${display(premium.conversions)} chuyển đổi · ${display(premium.premiumUsers)} premium · ${display(premium.freeUsers)} free</p><small>${escapeHtml(premium.date || '')}</small>` : '<p class="subtle">Chưa có aggregate subscription.</p>'}</article></section><section class="p30-grid section"><article class="card"><h2>User lifecycle</h2>${lifecycle ? `<p>New <b>${display(lifecycle.newUsers)}</b></p><p>Active <b>${display(lifecycle.activeUsers)}</b></p><p>Returning <b>${display(lifecycle.returningUsers)}</b></p><p>Churn <b>${display(lifecycle.churnUsers)}</b></p>` : '<p class="subtle">Chưa có lifecycle aggregate.</p>'}</article><article class="card"><h2>System health</h2>${health ? `<p>Error rate <b>${display(health.errorRate, '%')}</b></p><p>API success <b>${display(health.apiSuccessRate, '%')}</b></p><p>P95 <b>${display(health.p95Ms, ' ms')}</b></p><p>Slow requests <b>${display(health.slowRequests)}</b></p>` : '<p class="subtle">Chưa có health metrics.</p>'}</article><article class="card"><h2>Support queue</h2><p>Tổng request <b>${display(snapshot.support.total)}</b></p>${Object.entries(snapshot.support.byType).map(([type, count]) => `<p>${escapeHtml(type)} <b>${count}</b></p>`).join('') || '<p class="subtle">Chưa có request.</p>'}</article></section><section class="card section"><h2>Course performance</h2><div class="p30-table">${rows(snapshot.courses, 'Chưa có course aggregate.', (course) => `<div><b>${escapeHtml(course.title)}</b><span>${display(course.completionRate, '%')} hoàn thành · ${display(course.engagementScore, '/100')} engagement · ${display(course.completions)} hoàn tất</span></div>`)}</div></section><section class="card section"><h2>Content ROI</h2><div class="p30-table">${rows(snapshot.content, 'Chưa có content engagement aggregate.', (item) => `<div><b>${escapeHtml(item.title)}</b><span>${escapeHtml(item.type)} · ROI ${display(item.roiScore, '/100')} · ${display(item.engagements)} engagement</span></div>`)}</div></section><section class="card section"><h2>Operation reports</h2><div class="p30-table">${rows(snapshot.reports, 'Chưa có báo cáo daily/weekly/monthly.', (report) => `<div><b>${escapeHtml(report.period)}</b><span>${escapeHtml(report.start)} → ${escapeHtml(report.end)} · ${escapeHtml(report.summary || 'Đã tạo aggregate')}</span></div>`)}</div><p class="p30-privacy">🔒 Aggregate only · user IDs: false · raw support message: false · credentials: false</p></section>`;
  };

  Object.assign(global, { BusinessIntelligenceService, BusinessIntelligenceContentService, UserLifecycleService, RetentionDashboardService, CoursePerformanceService, ContentROIService, PremiumConversionService, UserValueService, SupportAnalyticsService, SystemHealthService, OperationReportService, AdminControlCenterService, KLEARN_EDTECH_BI_CONTENT: global.KLEARN_EDTECH_BI_CONTENT || fallbackConfig });
  if (global.AdminAnalyticsService) global.AdminAnalyticsService.businessIntelligence = BusinessIntelligenceService;
  global.KLEARN_EXTRA_VIEWS = { ...(global.KLEARN_EXTRA_VIEWS || {}), 'admin-analytics': adminView };
  const previousAfterRender = global.KLEARN_AFTER_RENDER;
  global.KLEARN_AFTER_RENDER = () => {
    previousAfterRender?.();
    if (!global.document || state.currentView !== 'admin-analytics' || !admin()) return;
    if (!global.document.querySelector('[data-p30-control]')) global.document.getElementById('app')?.insertAdjacentHTML('beforeend', '<span data-p30-control hidden></span>');
    global.document.querySelectorAll('[data-view]').forEach((button) => { if (button.dataset.view) button.onclick = () => setView(button.dataset.view); });
  };
  if (routes.has(state.currentView) && admin()) BusinessIntelligenceService.load();
})(window);
