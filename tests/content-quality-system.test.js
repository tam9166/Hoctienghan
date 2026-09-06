const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const content = JSON.parse(fs.readFileSync(path.join(root, 'content', 'content-quality-system.json'), 'utf8'));
const source = fs.readFileSync(path.join(root, 'data', 'content-quality-system.js'), 'utf8');
const appSource = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const workerSource = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const migration = fs.readFileSync(path.join(root, 'supabase', 'migrations', '20260906_content_quality_system.sql'), 'utf8');

function boot(role = 'admin') {
  const values = new Map();
  const state = { currentUser: { id: 'quality-user', fullName: 'Quality User' }, currentView: 'content-quality-dashboard', advancedContent: { selectedId: 'grammar-topic-particle' } };
  const items = [
    { id: 'grammar-topic-particle', type: 'grammar', title: { vi: 'Trợ từ chủ đề 은/는' }, level: 'Beginner', quality: { grammarAccuracy: 98, exampleQuality: 96, audioQuality: 90 } },
    { id: 'freq-학교', type: 'word', korean: '학교', meaning: { vi: 'trường học' }, quality: { audioQuality: 78 } },
    { id: 'ex-topic-beginner', type: 'example', korean: '저는 학생이에요.', meaning: { vi: 'Tôi là sinh viên.' } }
  ];
  const advanced = { raw: () => items, byId: (id) => items.find((item) => item.id === id), load: async () => items };
  const document = { documentElement: { lang: 'vi' }, querySelector: () => null, querySelectorAll: () => [], getElementById: () => null };
  const window = { KLEARN_APP: { state, STORAGE_KEYS: { contentFeedback: 'contentFeedback' }, render: () => {}, setView: (view) => { state.currentView = view; }, toast: () => {}, escapeHtml: (value) => String(value ?? ''), userScoped: (key) => values.get(key)?.[state.currentUser.id] || [], saveUserScoped: (key, list) => { const all = values.get(key) || {}; all[state.currentUser.id] = list; values.set(key, all); }, AccessControlService: { role: () => role } }, AdvancedContentService: advanced, ContentVersionService: { history: () => [] }, KLEARN_EXTRA_VIEWS: {}, KLEARN_AFTER_RENDER: null, document };
  const context = { window, document, console, Date, Intl, String, Number, Object, Array, Math, Set, Map, RegExp, Promise, fetch: () => Promise.reject(new Error('offline')), setTimeout, clearTimeout };
  vm.createContext(context); vm.runInContext(source, context); window.ContentQualityContentService.hydrate(content);
  return { window, state, values, items };
}

assert.equal(content.verified, true);
assert.equal(content.reviewStatus, 'approved');
assert.ok(content.reviews.every((item) => item.accuracyScore >= 0 && item.accuracyScore <= 100));
assert.equal(content.reportTypes.length, 5);

const admin = boot('admin');
const quality = admin.window.ContentQualityService;
const grammar = admin.window.ContentQualityContentService.review('grammar-topic-particle');
assert.equal(grammar.nativeChecked, true);
assert.equal(quality.confidence(admin.items[0]), 98);
assert.deepEqual(quality.source(admin.items[0]), ['TOPIK curriculum', 'Native-reviewed examples']);
assert.equal(quality.checks(admin.items[0]).difficultyValidated, true);
assert.equal(admin.window.AudioQualityService.inspect(admin.items[1]).speed, 'review');
const health = quality.health();
assert.equal(health.total, 3);
assert.equal(health.reviewed, 2);
assert.ok(health.averageConfidence >= 90);
assert.ok(health.issues.some((item) => item.id === 'freq-학교'));
assert.equal(admin.window.DuplicateDetectionService.groups([{ id: 'a', type: 'example', korean: '학교에 가요.' }, { id: 'b', type: 'example', korean: '학교에 가요.' }]).length, 1);

const report = admin.window.ContentQualityReportService.submit({ contentId: 'grammar-topic-particle', reportType: 'meaning', message: 'Bản dịch cần tự nhiên hơn.' });
assert.equal(report.qualitySystem, 'P25');
assert.equal(admin.window.ContentQualityReportService.all().length, 1);
assert.match(admin.window.KLEARN_EXTRA_VIEWS['content-quality-dashboard'](), /Chất lượng nội dung/);
const student = boot('student');
assert.match(student.window.KLEARN_EXTRA_VIEWS['content-quality-dashboard'](), /Không có quyền truy cập/);
assert.equal(student.window.ContentQualityService.all().length, 3);

assert.match(appSource, /content-quality-dashboard/);
assert.match(indexSource, /content-quality\.css\?v=1/);
assert.match(indexSource, /data\/content-quality-system\.js\?v=1/);
assert.match(workerSource, /klearn-v63/);
assert.match(workerSource, /content-quality-system\.json/);
assert.match(migration, /content_quality_reviews/);
assert.match(migration, /content_quality_reports/);
assert.match(migration, /row level security/i);
assert.match(migration, /app_metadata/);
console.log('content quality: native validation, confidence, source, audio, translation, difficulty, duplicates, reports, dashboard and RLS passed');
