const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const appSource = read('app.js');
const providerSource = read('data/cloud-sync.js');
const queueSource = read('data/production-stability.js');
const migration = read('supabase/migrations/20260922_learning_record_sync.sql');
const envExample = read('.env.example');

function streakFunction() {
  const source = appSource.match(/function calculateLearningStreak[\s\S]*?(?=\nfunction recordLearningActivity)/)?.[0];
  assert.ok(source, 'streak calculator must be present');
  return vm.runInNewContext(`${source}; calculateLearningStreak`, { Date, Object, Math, Set, String, todayKey: () => '2026-09-22' });
}

function bootQueue() {
  const values = new Map(); const state = { currentUser: { id: 'user-a' }, currentView: 'home' }; let syncResult = false;
  const storage = { get: (key, fallback = null) => values.has(key) ? values.get(key) : fallback, set: (key, value) => { values.set(key, value); return true; } };
  const userScoped = (key) => values.get(key)?.[state.currentUser.id] || [];
  const saveUserScoped = (key, list) => { const all = values.get(key) || {}; all[state.currentUser.id] = list; values.set(key, all); };
  const window = {
    KLEARN_APP: {
      storage, state, STORAGE_KEYS: { productionTelemetry: 'telemetry', backgroundSyncQueue: 'queue', learningBackups: 'backups', recoveryCheckpoint: 'checkpoint' },
      CloudSyncService: { isConfigured: () => true, flush: async () => syncResult }, PrivacyPreferenceService: { allows: () => true },
      getUserProgress: () => ({}), saveUserProgress() {}, getUserSrs: () => [], saveUserSrs() {}, userScoped, saveUserScoped, render() {}, escapeHtml: String, AccessControlService: { role: () => 'student' }
    },
    navigator: { onLine: true }, console, addEventListener() {}
  };
  vm.runInNewContext(queueSource, { window, console, Date, String, Number, Object, Array, Math, Set, Map, RegExp, Promise, JSON });
  return { window, setSyncResult: (value) => { syncResult = value; } };
}

(async () => {
  // Streak is derived from unique calendar days, not event or device count.
  const calculate = streakFunction();
  const days = {
    '2026-09-20': { activityIds: ['device-a:1'] },
    '2026-09-21': { activityIds: ['device-a:2', 'device-b:9'] },
    '2026-09-22': { activityIds: ['device-a:3', 'device-b:10'] }
  };
  const streak = calculate(days, '2026-09-22');
  assert.equal(streak.learningDays, 3); assert.equal(streak.streak, 3); assert.equal(streak.longestStreak, 3);
  assert.equal(calculate({}, '2026-09-22').streak, 0);
  assert.match(appSource, /learningDays:\s*0,\s*streak:\s*0/);
  assert.match(appSource, /activityIds:\s*\[\.\.\.new Set/);
  assert.match(appSource, /mergeSrs\(local = \[\], remote = \[\]\)/);
  assert.match(appSource, /Math\.max\(Number\(previous\.reviewCount\)/);
  assert.match(appSource, /SRSStateService\.hasLearningEvidence\(item\)/);
  assert.match(appSource, /stableSyncJson\(\[body, deletedAt \|\| null\]\)/);
  assert.match(appSource, /recordDeleted/);
  assert.match(appSource, /recordId\.startsWith\('lesson:'\)/);
  assert.match(appSource, /delete progress\.lessonProgress/);

  // Offline actions remain queued, are idempotent, redact credentials and retry.
  const queue = bootQueue();
  const first = queue.window.BackgroundSyncQueueService.enqueue({ type: 'topik_completed', entityId: 'exam-1', score: 80, token: 'must-not-persist' });
  const duplicate = queue.window.BackgroundSyncQueueService.enqueue({ type: 'topik_completed', entityId: 'exam-1', mutationId: first.mutationId });
  assert.equal(duplicate.mutationId, first.mutationId);
  assert.equal(queue.window.BackgroundSyncQueueService.pending(), 1);
  assert.equal(first.payload.token, undefined);
  assert.equal((await queue.window.BackgroundSyncQueueService.flush()).status, 'error');
  assert.equal(queue.window.BackgroundSyncQueueService.all()[0].retryCount, 1);
  queue.setSyncResult(true);
  assert.equal((await queue.window.BackgroundSyncQueueService.flush()).status, 'synced');
  assert.equal(queue.window.BackgroundSyncQueueService.pending(), 0);

  // Supabase is an Auth/RLS boundary; client cannot choose another user_id.
  assert.match(migration, /v_user_id uuid := auth\.uid\(\)/);
  assert.match(migration, /using \(auth\.uid\(\) = user_id\)/);
  assert.match(migration, /revoke insert, update, delete on public\.user_learning_records/);
  assert.match(migration, /security definer/);
  assert.match(migration, /for update/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /learning_record_mutations/);
  assert.match(migration, /duplicate record in batch/);
  assert.match(providerSource, /pullRecords\(options = \{\}\)/);
  assert.match(providerSource, /\.gte\('updated_at', options\.since\)/);
  assert.match(providerSource, /\.order\('updated_at',[\s\S]*\.order\('domain',[\s\S]*\.order\('record_id'/);
  assert.match(providerSource, /apply_learning_record_batch/);
  assert.match(providerSource, /persistSession:\s*true/);
  assert.match(providerSource, /autoRefreshToken:\s*true/);
  assert.match(appSource, /visibilitychange/);
  assert.match(appSource, /recordMigrationBackupAt/);
  assert.match(appSource, /lastSyncedAt/);
  assert.doesNotMatch(`${providerSource}\n${appSource}\n${envExample}`, /SUPABASE_SERVICE_ROLE_KEY\s*=\s*\S+/);
  assert.doesNotMatch(providerSource, /service_role|serviceRole/);

  console.log('Supabase learning sync: RLS isolation, atomic version checks, idempotency, offline retry, refresh session, migration backup and streak integrity passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
