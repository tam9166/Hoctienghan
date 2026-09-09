const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'data', 'product-demo.js'), 'utf8');
const content = JSON.parse(fs.readFileSync(path.join(root, 'content', 'product-demo.json'), 'utf8'));
const appSource = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const routes = fs.readFileSync(path.join(root, 'data', 'route-loader.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const worker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'product-demo.css'), 'utf8');
const docs = fs.readFileSync(path.join(root, 'docs', 'P54_DEMO_PRESENTATION.md'), 'utf8');

function boot() {
  const values = new Map();
  const keys = { users: 'users', session: 'session', progress: 'progress', srs: 'srs', practiceHistory: 'history', errors: 'errors', achievements: 'achievements', milestones: 'milestones', learningOutcomes: 'outcomes', learnerProfile: 'profile', settings: 'settings', productDemo: 'demo-store' };
  const realUser = { id: 'real-user', fullName: 'Real User', email: 'real@example.test', onboardingCompleted: true };
  const realProgress = { stats: { lessonsCompleted: 3 }, marker: 'preserve-me' };
  values.set(keys.users, [realUser]); values.set(keys.session, { userId: realUser.id, createdAt: new Date().toISOString() }); values.set(keys.progress, { [realUser.id]: realProgress }); values.set(keys.settings, { users: { [realUser.id]: { theme: 'dark' } } });
  const storage = { get: (key, fallback = null) => values.has(key) ? structuredClone(values.get(key)) : fallback, set: (key, value) => { values.set(key, structuredClone(value)); return true; }, remove: (key) => values.delete(key) };
  const state = { currentUser: realUser, cloudUser: { id: 'cloud-real' }, currentView: 'home', srsData: [] };
  const document = { documentElement: { dataset: {} }, getElementById: () => null, querySelector: () => null };
  const app = {
    storage, state, STORAGE_KEYS: keys, escapeHtml: String, render: () => {}, toast: () => {},
    setView: (view) => { state.currentView = view; },
    createSessionRecord: (userId, extra = {}) => ({ userId, ...extra, createdAt: new Date().toISOString() }),
    getUserProgress: () => storage.get(keys.progress, {})[state.currentUser?.id] || {},
    getUserSrs: () => storage.get(keys.srs, {})[state.currentUser?.id] || [{ wordId: 'school', status: 'not_started', mastery: 0 }],
    CloudSyncService: { provider: {}, setStatus: () => {} }, CloudAccountService: { restore: async () => {} },
    auth: { restoreSession() { const session = storage.get(keys.session); const user = (storage.get(keys.users, []) || []).find((item) => item.id === session?.userId) || null; state.currentUser = user; return user; } }
  };
  const window = { KLEARN_APP: app, KLEARN_EXTRA_VIEWS: {}, KLEARN_AFTER_RENDER: null, KLEARN_THEORY_LESSONS: [{ id: 'lesson-1' }, { id: 'lesson-2' }], document, fetch: async () => { throw new Error('offline'); }, console };
  const context = { window, document, fetch: window.fetch, console, Date, JSON, Object, Array, String, Number, Math, Set, Map, Promise, structuredClone };
  vm.createContext(context); vm.runInContext(source, context);
  window.DemoModeService.content.hydrate(content);
  return { window, values, keys, realProgress };
}

(() => {
  assert.equal(content.verified, true);
  assert.equal(content.privacy.isolatedUserId, 'demo-p54');
  assert.equal(content.privacy.cloudSync, false);
  assert.equal(content.privacy.storesCredentials, false);
  assert.deepEqual(content.flow.map((step) => step.id), ['home', 'learning', 'ai', 'analytics']);
  assert.ok(content.showcase.every((item) => item.purpose && item.value && item.view));

  const fixture = boot(); const demo = fixture.window.DemoModeService;
  const demoUser = demo.account.activate();
  assert.equal(demoUser.id, 'demo-p54');
  assert.equal(demoUser.isDemo, true);
  assert.equal(demoUser.cloudUserId, null);
  assert.equal(fixture.window.KLEARN_APP.state.cloudUser, null);
  assert.equal(fixture.values.get(fixture.keys.progress)['real-user'].marker, 'preserve-me');
  assert.equal(fixture.values.get(fixture.keys.progress)['demo-p54'].stats.lessonsCompleted, 18);
  assert.equal(fixture.values.get(fixture.keys.practiceHistory)['demo-p54'].length, 4);
  assert.ok(fixture.values.get(fixture.keys.srs)['demo-p54'][0].reviewCount > 0);
  assert.equal(fixture.values.get(fixture.keys.productDemo).previousSession.userId, 'real-user');
  assert.equal(fixture.window.document.documentElement.dataset.presentationMode, 'true');

  demo.account.reset();
  assert.equal(fixture.values.get(fixture.keys.progress)['demo-p54'].stats.wordsLearned, 126);
  const restored = demo.account.exit();
  assert.equal(restored.id, 'real-user');
  assert.equal(fixture.values.get(fixture.keys.session).userId, 'real-user');
  assert.equal(fixture.values.get(fixture.keys.progress)['real-user'].marker, 'preserve-me');
  assert.equal(Object.hasOwn(fixture.values.get(fixture.keys.progress), 'demo-p54'), false);
  assert.equal(fixture.values.get(fixture.keys.users).some((item) => item.id === 'demo-p54'), false);

  assert.match(appSource, /productDemo: 'klearn_product_demo'/);
  assert.match(appSource, /PUBLIC_VIEWS = \['welcome', 'login', 'register', 'demo'\]/);
  assert.doesNotMatch(appSource.match(/const USER_SYNC_KEYS = \[[\s\S]*?\n\];/)?.[0] || '', /STORAGE_KEYS\.productDemo/);
  assert.match(routes, /demo: \{ styles: \['product-demo\.css\?v=1'\]/);
  assert.match(routes, /routes\('demo demo-center', \['demo'\]\)/);
  assert.match(index, /app\.js\?v=63/);
  assert.match(worker, /klearn-v77/);
  assert.match(worker, /content\/product-demo\.json/);
  assert.match(worker, /data\/product-demo\.js\?v=1/);
  assert.match(css, /data-presentation-mode="true"/);
  assert.match(css, /@media\(max-width:767px\)/);
  assert.match(docs, /Kịch bản 5 phút/);
  assert.match(docs, /Kịch bản 10 phút/);
  assert.match(docs, /Kịch bản 20 phút/);
  console.log('P54 demo account isolation, sample data, presentation flow, offline assets and documentation passed');
})();
