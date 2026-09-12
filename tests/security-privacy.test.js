const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'data', 'security-privacy.js'), 'utf8');
const content = JSON.parse(fs.readFileSync(path.join(root, 'content', 'security-privacy.json'), 'utf8'));
const migration = fs.readFileSync(path.join(root, 'supabase', 'migrations', '20260906_security_privacy.sql'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const worker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const appSource = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

function boot() {
  const values = new Map();
  const state = { currentUser: { id: 'privacy-user', level: 'Beginner', goals: ['TOPIK 2'] }, currentView: 'profile' };
  const storage = { get(key, fallback = null) { return values.has(key) ? values.get(key) : fallback; }, set(key, value) { values.set(key, value); return true; } };
  const userScoped = (key) => { const all = values.get(key); return Array.isArray(all?.[state.currentUser.id]) ? all[state.currentUser.id] : []; };
  const saveUserScoped = (key, list) => { const all = values.get(key) || {}; all[state.currentUser.id] = list; values.set(key, all); };
  const calls = [];
  const client = { auth: { signInWithOAuth: async (value) => { calls.push(['oauth', value]); return { data: { provider: value.provider } }; }, signInWithOtp: async (value) => { calls.push(['otp', value]); return { data: { sent: true } }; }, mfa: { enroll: async () => ({ data: { id: 'factor-1' } }), challenge: async () => ({ data: { id: 'challenge-1' } }), verify: async () => ({ data: { verified: true } }), listFactors: async () => ({ data: { all: [], verified: [] } }), unenroll: async () => ({ data: { id: 'factor-1' } }) }, signOut: async () => {} }, from: () => ({ insert: async () => ({ error: null }) }) };
  const window = { KLEARN_APP: { storage, state, STORAGE_KEYS: { privacyPreferences: 'privacy', deviceRegistry: 'devices', securityAudit: 'audit', users: 'users', session: 'session', practiceHistory: 'history' }, CloudSyncService: { schedule: () => {} }, userScoped, saveUserScoped, getUserProgress: () => ({ stats: { streak: 2 } }), getUserSrs: () => [{ wordId: '학교', korean: '학교', mastery: 80 }], NotesService: { all: () => [{ sourceType: 'lesson', sourceId: 'l1', content: 'note', updatedAt: 'today' }] }, escapeHtml: String, render: () => {}, toast: () => {} }, SupabaseService: { client, session: { user: { id: 'cloud-user', app_metadata: { role: 'content_editor' } } } }, AuthService: { signOut: async () => {} }, navigator: { userAgent: 'test', onLine: true }, console };
  const context = { window, console, Date, String, Number, Object, Array, Math, Set, Map, RegExp, Promise, JSON };
  vm.createContext(context); vm.runInContext(source, context); return { window, values, calls };
}

(async () => {
  assert.equal(content.verified, true);
  assert.equal(content.reviewStatus, 'approved');
  assert.deepEqual(content.providers, ['google', 'apple', 'passwordless']);
  assert.equal(content.privacy.preciseLocation, false);
  assert.deepEqual(content.privacy.exportFormats, ['json', 'csv', 'pdf']);
  const app = boot(); const w = app.window;
  await w.SecurityAuthService.signInWithProvider('google');
  await w.SecurityAuthService.requestPasswordless('learner@example.com');
  assert.deepEqual(app.calls.map((item) => item[0]), ['oauth', 'otp']);
  assert.equal(Array.from(w.SecurityAuthService.providers()).join(','), 'google,apple,passwordless');
  assert.equal((await w.SecurityAuthService.enroll()).id, 'factor-1');
  assert.equal((await w.SecurityAuthService.challengeAndVerify('factor-1', '123456')).verified, true);
  assert.equal(w.PrivacyCenterService.update({ telemetry: true, preciseLocation: true }).telemetry, true);
  assert.equal(w.PrivacyCenterService.summary().aiContext, 'enabled-by-choice');
  assert.equal(w.DeviceManagementService.registerCurrent({ locationHint: 'Hanoi' }).locationHint, 'Hanoi');
  assert.equal(w.DeviceManagementService.list().length, 1);
  assert.match(w.DataExportService.format('json'), /learningHistory/);
  assert.match(w.DataExportService.format('csv'), /wordId/);
  assert.equal(w.DataExportService.download('pdf').status, 'print-dialog');
  assert.equal(w.RolePermissionService.role(), 'content_editor');
  assert.equal(w.RolePermissionService.can('review_content'), true);
  assert.equal(w.SecurityScannerService.scan().status, 'pass');
  assert.equal((await w.AccountDeletionService.request({ confirmation: 'no' })).status, 'confirmation-required');
  assert.equal((await w.AccountDeletionService.request({ confirmation: 'DELETE MY ACCOUNT' })).status, 'pending-backend-deletion');
  assert.match(migration, /user_privacy_preferences/);
  assert.match(migration, /user_devices/);
  assert.match(migration, /privacy_deletion_requests/);
  assert.match(migration, /security_audit_logs/);
  assert.match(migration, /row level security/i);
  assert.match(migration, /has_any_role/);
  assert.match(index, /security-privacy\.css\?v=1/);
  assert.match(index, /data\/security-privacy\.js\?v=3/);
  assert.match(worker, /klearn-v81/);
  assert.match(worker, /security-privacy\.json/);
  assert.match(appSource, /privacyPreferences: 'klearn_privacy_preferences'/);
  console.log('security privacy: OAuth/passwordless/MFA facade, privacy center, devices, export, deletion workflow, audit, roles, scanner and RLS passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
