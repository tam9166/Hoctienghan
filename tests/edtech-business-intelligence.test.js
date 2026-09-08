const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'data', 'edtech-business-intelligence.js'), 'utf8');
const content = JSON.parse(fs.readFileSync(path.join(root, 'content', 'edtech-business-intelligence.json'), 'utf8'));
const stylesheet = fs.readFileSync(path.join(root, 'edtech-business-intelligence.css'), 'utf8');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8') + fs.readFileSync(path.join(root, 'data', 'route-loader.js'), 'utf8');
const workerSource = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const migration = fs.readFileSync(path.join(root, 'supabase', 'migrations', '20260906_edtech_business_intelligence.sql'), 'utf8');

function boot(role = 'admin') {
  const state = { currentUser: { id: 'admin-user' }, currentView: 'admin-analytics' };
  const window = {
    KLEARN_APP: { state, render: () => {}, setView: (view) => { state.currentView = view; }, escapeHtml: String, AccessControlService: { role: () => role } },
    document: null, console
  };
  const context = { window, console, Date, String, Number, Object, Array, Math, Set, Map, RegExp, Promise, JSON };
  vm.createContext(context); vm.runInContext(source, context);
  return { window, state };
}

assert.equal(content.verified, true);
assert.equal(content.reviewStatus, 'approved');
assert.deepEqual(content.retentionDays, [1, 7, 30]);
assert.equal(content.privacy.noUserIds, true);
assert.equal(content.privacy.adminRoleRequired, true);
assert.ok(stylesheet.includes('p30-control-grid'));

const app = boot();
const service = app.window.BusinessIntelligenceService;
assert.equal(service.available(), true);
const snapshot = service.hydrate({
  daily: [{ metric_date: '2026-09-06', total_users: 120, new_users: 12, active_users: 80, returning_users: 35, churn_users: 4, day_1_retention: 62, day_7_retention: 41, day_30_retention: 28, learning_minutes: 2400, learning_value: 78 }],
  courses: [{ metric_date: '2026-09-06', course_id: 'topik-1', course_title: 'TOPIK 1', completions: 40, completion_rate: 72, engagement_score: 86 }, { metric_date: '2026-09-06', course_id: 'business', course_title: 'Business Korean', completions: 5, completion_rate: 20, engagement_score: 60 }],
  content: [{ metric_date: '2026-09-06', content_id: 'lesson-1', content_title: 'Hangul 1', content_type: 'lesson', engagements: 300, roi_score: 91 }],
  premium: [{ metric_date: '2026-09-06', free_users: 90, premium_users: 30, conversions: 8, conversion_rate: 8.8 }],
  support: [{ type: 'bug', status: 'open' }, { type: 'question', status: 'answered' }],
  health: [{ metric_date: '2026-09-06', error_rate: 1.2, p95_ms: 420, api_success_rate: 99.1, slow_requests: 3 }],
  reports: [{ period_type: 'weekly', period_start: '2026-09-01', period_end: '2026-09-06', summary: 'Ổn định' }]
});
assert.equal(snapshot.status, 'ready');
assert.equal(snapshot.lifecycle.activeUsers, 80);
assert.equal(snapshot.retention.day30, 28);
assert.equal(snapshot.courses[0].title, 'TOPIK 1');
assert.equal(snapshot.content[0].roiScore, 91);
assert.equal(snapshot.premium.conversionRate, 8.8);
assert.equal(snapshot.support.total, 2);
assert.equal(snapshot.health.p95Ms, 420);
assert.equal(snapshot.reports[0].period, 'weekly');
assert.equal(app.window.UserLifecycleService.states().active, 80);
assert.equal(app.window.RetentionDashboardService.checkpoints()[2].rate, 28);
assert.equal(app.window.CoursePerformanceService.lowest()[0].title, 'Business Korean');
assert.equal(app.window.ContentROIService.top(1)[0].roiScore, 91);
assert.equal(app.window.PremiumConversionService.latest().conversions, 8);
assert.equal(app.window.UserValueService.latest().value, 78);
assert.equal(app.window.SupportAnalyticsService.queue().total, 2);
assert.equal(app.window.SystemHealthService.latest().apiSuccessRate, 99.1);
assert.equal(app.window.OperationReportService.byPeriod('weekly').length, 1);
const privacy = app.window.AdminControlCenterService.privacy();
assert.equal(privacy.aggregateOnly, true);
assert.equal(privacy.userIds, false);
assert.equal(privacy.rawMessages, false);
assert.equal(privacy.credentials, false);

const student = boot('student');
assert.equal(student.window.BusinessIntelligenceService.available(), false);
assert.equal(student.window.BusinessIntelligenceService.hydrate({ daily: [{ active_users: 999 }] }).lifecycle.activeUsers, 999, 'service can be tested with aggregate fixture but route access remains role-gated');
assert.match(indexSource, /edtech-business-intelligence\.css\?v=1/);
assert.match(indexSource, /data\/edtech-business-intelligence\.js\?v=1/);
assert.match(workerSource, /klearn-v73/);
assert.match(workerSource, /edtech-business-intelligence\.json/);
assert.match(workerSource, /edtech-business-intelligence\.js/);
assert.match(migration, /edtech_bi_daily_metrics/);
assert.match(migration, /edtech_bi_course_metrics/);
assert.match(migration, /edtech_bi_content_metrics/);
assert.match(migration, /edtech_bi_premium_metrics/);
assert.match(migration, /edtech_bi_system_health/);
assert.match(migration, /edtech_bi_operation_reports/);
assert.match(migration, /public\.has_any_role\(array\['admin'\]\)/);
assert.match(migration, /row level security/i);
console.log('edtech BI: lifecycle, retention, course/content performance, premium conversion, learning value, support, health, reports, role gate and aggregate RLS passed');
