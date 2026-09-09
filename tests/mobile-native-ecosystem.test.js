const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const packageJson = JSON.parse(read('mobile/package.json'));
const capacitor = JSON.parse(read('mobile/capacitor.config.json'));
const nativeContract = JSON.parse(read('mobile/mobile-app.config.json'));
const experience = JSON.parse(read('content/mobile-experience.json'));
const version = JSON.parse(read('version.json'));
const configHandler = require(path.join(root, 'api', 'config.js'));

function responseRecorder() {
  const result = { statusCode: 200, body: null, headers: {}, ended: false };
  return { result, response: { status(code) { result.statusCode = code; return this; }, json(body) { result.body = body; return this; }, setHeader(name, value) { result.headers[name] = value; }, end() { result.ended = true; } } };
}

function bootPlatform() {
  const window = {
    __KLEARN_RUNTIME_CONFIG__: { platform: 'native', apiBaseUrl: 'https://learn.example.test/', authRedirectUrl: 'com.tamhoanq.korean://auth/callback', version: '1.2.0-rc.1', channel: 'beta' },
    Capacitor: { isNativePlatform: () => true, getPlatform: () => 'android' },
    location: { origin: 'capacitor://localhost', pathname: '/' }
  };
  window.window = window;
  vm.runInNewContext(read('data/platform-runtime.js'), { window, URL, Error, Object, String, Boolean });
  return window;
}

function bootNative(platform) {
  const listeners = {}; const views = []; const preferences = new Map(); const tableWrites = [];
  const plugin = (name) => ({ addListener: async (event, callback) => { listeners[`${name}:${event}`] = callback; return { remove() {} }; } });
  const window = {
    KLEARN_APP: { setView: (route) => views.push(route), CloudSyncService: { flush: async () => true, isConfigured: () => true } },
    KLearnPlatform: platform.KLearnPlatform,
    KLearnNativePlugins: {
      App: plugin('App'), Network: plugin('Network'),
      Browser: { open: async ({ url }) => ({ url }), close: async () => true },
      PushNotifications: { ...plugin('Push'), requestPermissions: async () => ({ receive: 'granted' }), register: async () => true, unregister: async () => true },
      Preferences: { get: async ({ key }) => ({ value: preferences.get(key) || null }), set: async ({ key, value }) => { preferences.set(key, value); } }
    },
    SupabaseService: {
      session: { user: { id: 'cloud-user' } },
      client: {
        auth: { exchangeCodeForSession: async (code) => ({ data: { user: { id: `user-${code}` } }, error: null }) },
        from: (table) => ({ upsert: async (value) => { tableWrites.push({ table, value }); return { error: null }; }, update: () => ({ eq: () => ({ eq: async () => ({ error: null }) }) }) })
      }
    },
    BackgroundSyncQueueService: { flush: async () => ({ status: 'synced' }) },
    RecoveryService: { capture: () => true },
    MobileNotificationService: { policy: () => ({ maximumPerDay: 2, minimumIntervalHours: 6, quietHours: { start: 22, end: 7 } }) },
    MobileWidgetService: { snapshot: () => ({ generatedAt: '2026-09-09T00:00:00Z', today: { korean: '안녕하세요', meaning: 'Xin chào' }, review: { dueCount: 3 }, userId: 'must-not-copy' }) },
    OfflinePackService: { download: async (id) => ({ id }), metadata: () => [{ id: 'beginner-pack', version: 2, downloadedAt: 'now', private: 'omit' }] },
    navigator: { onLine: true }, document: { documentElement: { lang: 'vi' } }, crypto: { randomUUID: () => 'installation-1234' },
    addEventListener: () => {}, console, Intl, URL, Math, Date, String, Object, Boolean, Promise
  };
  window.window = window;
  vm.createContext(window); vm.runInContext(read('data/mobile-native.js'), window);
  return { window, listeners, views, preferences, tableWrites };
}

(async () => {
  const platform = bootPlatform();
  assert.equal(platform.KLearnPlatform.isNative(), true);
  assert.equal(platform.KLearnPlatform.apiUrl('/api/chat'), 'https://learn.example.test/api/chat');
  assert.equal(platform.KLearnPlatform.authRedirectUrl(), 'com.tamhoanq.korean://auth/callback');
  assert.throws(() => platform.KLearnPlatform.apiUrl('/private/data'));

  const preflight = responseRecorder();
  configHandler({ method: 'OPTIONS', headers: { origin: 'capacitor://localhost' } }, preflight.response);
  assert.equal(preflight.result.statusCode, 204);
  assert.equal(preflight.result.headers['Access-Control-Allow-Origin'], 'capacitor://localhost');
  const rejectedOrigin = responseRecorder();
  configHandler({ method: 'OPTIONS', headers: { origin: 'https://attacker.test' } }, rejectedOrigin.response);
  assert.equal(rejectedOrigin.result.statusCode, 403);

  const native = bootNative(platform);
  await native.window.NativeMobileBridge.initialize();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(native.window.NativeMobileBridge.summary().auth, 'supabase-pkce-deep-link');
  assert.equal(native.window.NativeOfflineBridge.capabilities().practice, true);
  assert.equal((await native.window.NativePushService.register()).status, 'registering');
  assert.equal((await native.window.NativeAuthBridge.handleUrl('com.tamhoanq.korean://auth/callback?code=pkce-code')).status, 'authenticated');
  assert.equal((await native.window.NativeAuthBridge.handleUrl('https://attacker.test/?code=x')).status, 'ignored');
  const widget = await native.window.NativeWidgetBridge.refresh();
  assert.equal(widget.snapshot.containsPrivateContent, false);
  assert.equal('userId' in widget.snapshot, false);
  native.listeners['Push:pushNotificationActionPerformed']({ notification: { data: { route: 'review' } } });
  native.listeners['Push:pushNotificationActionPerformed']({ notification: { data: { route: 'admin-analytics' } } });
  assert.deepEqual(native.views, ['review', 'home']);

  assert.equal(packageJson.dependencies['@capacitor/core'], '8.5.1');
  assert.equal(packageJson.dependencies['@supabase/supabase-js'], '2.116.0');
  assert.equal(capacitor.appId, 'com.tamhoanq.korean');
  assert.equal(capacitor.android.allowMixedContent, false);
  assert.deepEqual(nativeContract.releaseChannels, ['internal', 'beta', 'production']);
  assert.equal(nativeContract.identity.sharedWithWeb, true);
  assert.equal(experience.authSync.separateMobileProgressStore, false);
  assert.ok(experience.offline.contentTypes.includes('practice'));
  assert.equal(version.version, '1.2.0-rc.1');
  const nativeBundle = path.join(root, 'mobile', 'www', 'mobile-native-plugins.js');
  if (fs.existsSync(nativeBundle)) assert.ok(fs.statSync(nativeBundle).size < 350 * 1024, 'native plugin bundle exceeds 350 KB budget');
  assert.match(read('data/cloud-sync.js'), /flowType: 'pkce'/);
  assert.match(read('data/cloud-sync.js'), /createSupabaseClient/);
  assert.match(read('api/_cors.js'), /capacitor:\/\/localhost/);
  assert.match(read('app.js'), /!window\.KLearnPlatform\?\.isNative/);
  assert.match(read('supabase/migrations/20260909_mobile_native_ecosystem.sql'), /row level security/i);
  assert.match(read('supabase/migrations/20260909_mobile_native_ecosystem.sql'), /revoke all on public\.mobile_notification_deliveries/);
  assert.match(read('.github/workflows/mobile-native.yml'), /options: \[internal, beta, production\]/);
  assert.match(read('.github/workflows/mobile-native.yml'), /CODE_SIGNING_ALLOWED=NO/);
  assert.match(read('mobile/native/ios/PrivacyInfo.xcprivacy'), /NSPrivacyTracking/);
  assert.match(read('docs/privacy-policy-draft.md'), /Trạng thái: draft/);
  console.log('P56: native API boundary, shared Supabase PKCE identity, offline sync, push policy, safe widget, camera/store/release contracts and RLS passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
