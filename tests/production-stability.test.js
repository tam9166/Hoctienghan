const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'data', 'production-stability.js'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const appSource = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const migration = fs.readFileSync(path.join(root, 'supabase', 'migrations', '20260906_production_stability.sql'), 'utf8');
const contract = JSON.parse(fs.readFileSync(path.join(root, 'content', 'production-stability.json'), 'utf8'));
const healthSource = fs.readFileSync(path.join(root, 'api', 'health.js'), 'utf8');
const chatSource = fs.readFileSync(path.join(root, 'api', 'chat.js'), 'utf8');
const configSource = fs.readFileSync(path.join(root, 'api', 'config.js'), 'utf8');

function boot() {
  const values = new Map();
  const state = { currentUser: { id: 'stability-user' }, currentView: 'admin-analytics' };
  const storage = { get(key, fallback = null) { return values.has(key) ? values.get(key) : fallback; }, set(key, value) { values.set(key, value); return true; } };
  const userScoped = (key) => { const all = values.get(key); return Array.isArray(all?.[state.currentUser.id]) ? all[state.currentUser.id] : []; };
  const saveUserScoped = (key, list) => { const all = values.get(key) || {}; all[state.currentUser.id] = list; values.set(key, all); };
  const progress = { stats: { streak: 3 }, lessonProgress: [{ id: 'l1', completed: true }] };
  const cloud = { isConfigured: () => true, flush: async () => true, schedule: () => {} };
  const window = {
    KLEARN_APP: { storage, state, STORAGE_KEYS: { productionTelemetry: 'telemetry', backgroundSyncQueue: 'queue', learningBackups: 'backups', recoveryCheckpoint: 'checkpoint', learnerProfile: 'profile', settings: 'settings' }, CloudSyncService: cloud, getUserProgress: () => progress, saveUserProgress: (value) => { Object.assign(progress, value); }, getUserSrs: () => [{ wordId: '학교', mastery: 70 }], saveUserSrs: () => {}, userScoped, saveUserScoped, render: () => {}, escapeHtml: (value) => String(value ?? ''), AccessControlService: { role: () => 'admin' }
    },
    navigator: { onLine: true }, performance: { getEntriesByType: () => [{ duration: 120 }] }, console
  };
  const events = {};
  window.addEventListener = (name, fn) => { events[name] = fn; };
  const context = { window, console, Date, String, Number, Object, Array, Math, Set, Map, RegExp, Promise, JSON };
  vm.createContext(context); vm.runInContext(source, context);
  return { window, values, events, state };
}

(async () => {
  const app = boot();
  const w = app.window;
  assert.equal(contract.verified, true);
  assert.equal(contract.reviewStatus, 'approved');
  assert.equal(contract.telemetry.rawPayloads, false);
  assert.deepEqual(contract.backup.periods, ['daily', 'weekly']);
  const first = w.ProductionMonitoringService.captureError({ type: 'frontend', module: 'home', message: 'Render failed' });
  w.ProductionMonitoringService.captureError({ type: 'frontend', module: 'home', message: 'Render failed' });
  assert.ok(first.fingerprint);
  assert.equal(w.ProductionMonitoringService.snapshot().errorCount, 2);
  w.ProductionMonitoringService.recordApi({ endpoint: '/api/chat', status: 500, durationMs: 250 });
  assert.equal(w.ProductionMonitoringService.snapshot().performance.some((item) => item.type === 'ai'), true);
  assert.equal(w.ProductionMonitoringService.snapshot().privacy.rawPayload, false);
  const queued = w.BackgroundSyncQueueService.enqueue({ type: 'completed_lesson', lessonId: 'l1', status: 'completed' });
  assert.equal(queued.entityId, 'l1');
  assert.equal(w.BackgroundSyncQueueService.pending(), 1);
  assert.equal((await w.BackgroundSyncQueueService.flush()).status, 'synced');
  assert.equal(w.BackgroundSyncQueueService.pending(), 0);
  const backup = w.BackupService.create('daily');
  assert.equal(backup.period, 'daily');
  assert.equal(w.RecoveryService.latest().progress.stats.streak, 3);
  assert.equal(w.RecoveryService.restore().restored, true);
  assert.equal(w.ProductionCacheService.isPublicRequest({ method: 'GET', headers: { has: () => false } }, '/content/lesson.json'), true);
  assert.equal(w.ProductionCacheService.isPublicRequest({ method: 'GET', headers: { has: (name) => name === 'authorization' } }, '/content/lesson.json'), false);
  assert.equal(w.ProductionCacheService.policy().privateDataCached, false);
  assert.match(appSource, /productionTelemetry: 'klearn_production_telemetry'/);
  assert.match(index, /production-stability\.css\?v=1/);
  assert.match(index, /data\/production-stability\.js\?v=1/);
  assert.match(sw, /klearn-v57/);
  assert.match(sw, /authorization/);
  assert.match(migration, /production_error_events/);
  assert.match(migration, /production_performance_metrics/);
  assert.match(migration, /learning_sync_updated_at_idx/);
  assert.match(migration, /row level security/i);
  assert.match(healthSource, /database/);
  assert.match(healthSource, /Cache-Control/);
  assert.match(chatSource, /Too many AI requests/);
  assert.match(configSource, /Too many config requests/);
  console.log('production stability: error/performance telemetry, recovery, daily/weekly backup, offline queue, public cache policy, health endpoint, rate limits and admin-safe RLS passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
