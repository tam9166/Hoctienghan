#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const config = JSON.parse(read('content/mobile-native-platform.json'));
const source = read('data/mobile-native-platform.js');

function boot({ native = false, microphone = true } = {}) {
  const records = new Map(); const views = []; const cacheRows = new Map(); const secure = new Map(); let audio = null; let captureActive = false;
  const state = { currentUser: { id: 'p78-user', onboardingCompleted: true }, currentView: 'home', selectedLessonPreview: '' };
  const storage = { get(key, fallback) { return records.has(key) ? structuredClone(records.get(key)) : structuredClone(fallback); }, set(key, value) { records.set(key, structuredClone(value)); return true; } };
  const cache = { async put(key, value) { cacheRows.set(key, value); }, async match(key) { return cacheRows.get(key) || null; } };
  const document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener() {} };
  const window = {
    document, innerWidth: 390, location: { href: 'https://app.test/index.html' }, URL: Object.assign(URL, { createObjectURL: () => 'blob:offline-audio', revokeObjectURL() {} }),
    KLEARN_APP: { state, storage, render() {}, setView(route) { state.currentView = route; views.push(route); }, toast() {}, escapeHtml: String },
    KLearnPlatform: { isNative: () => native, platform: () => native ? 'android' : 'web' },
    KLearnNativePlugins: {
      BiometricAuth: { checkBiometry: async () => ({ isAvailable: true, deviceIsSecure: true, biometryType: 3 }), authenticate: async () => undefined },
      SecureStorage: { get: async (key) => secure.get(key) ?? null, set: async (key, value) => secure.set(key, value), remove: async (key) => secure.delete(key) },
      SplashScreen: { hide: async () => true }, StatusBar: { setStyle: async () => true, setOverlaysWebView: async () => true }, StatusBarStyle: { Light: 'LIGHT' },
      Haptics: { impact: async () => true }, ImpactStyle: { Light: 'LIGHT' }
    },
    BackgroundAudioService: { async play(track) { audio = { src: track.src, playbackRate: 1 }; return { status: 'playing', backgroundCapable: true }; }, current: () => audio, pause: () => Boolean(audio), stop: () => { audio = null; return true; } },
    VoiceCaptureService: { supported: () => ({ microphone, recorder: microphone, recognition: microphone, audioSignals: microphone }), active: () => captureActive, start: async (callbacks) => { if (!microphone) return { status: 'text-fallback' }; captureActive = true; callbacks.onSignal?.({ rms: .05 }); return { status: 'recording' }; }, stop: async () => { captureActive = false; return { status: 'stopped', transcript: '안녕하세요', audioStored: false }; } },
    MobileNotificationService: { requestPermission: async () => 'granted' }, NativeReminderService: { refresh: async ({ disabled }) => ({ status: disabled ? 'disabled' : 'scheduled', scheduled: disabled ? 0 : 1 }) },
    MobileOfflineService: { metadata: () => [{ id: 'core-pack' }], download: async (id) => ({ id, status: 'downloaded' }), remove: async (id) => ({ id, status: 'removed' }) },
    BackgroundSyncQueueService: { pending: () => 2 },
    UserResearchService: { track: () => ({ ok: true }) },
    caches: { open: async () => cache, delete: async () => { cacheRows.clear(); return true; } },
    navigator: { storage: { estimate: async () => ({ usage: 12 * 1024 * 1024, quota: 100 * 1024 * 1024 }) }, permissions: { query: async () => ({ state: microphone ? 'granted' : 'denied' }) } },
    performance: { getEntriesByType: () => [{ duration: 321 }] },
    fetch: async (url) => url.includes('mobile-native-platform.json') ? ({ ok: true, json: async () => config }) : ({ ok: true, headers: { get: () => '1024' }, clone() { return this; }, blob: async () => ({ size: 1024 }) }),
    addEventListener() {}, getComputedStyle: () => ({ display: 'block' }), console
  };
  window.window = window;
  const context = { window, document, console, Date, Intl, Math, JSON, Object, Array, Number, String, Boolean, RegExp, Set, Map, Promise, Symbol, structuredClone, setTimeout, clearTimeout, URL, fetch: window.fetch, FormData: class {} };
  vm.runInNewContext(source, context); window.P78MobileConfigService.hydrate(config);
  return { window, state, records, views, secure, cacheRows };
}

(async () => {
  assert.equal(config.architecture.separateMobileLearningEngine, false);
  assert.equal(config.architecture.separateMobileProgressStore, false);
  assert.deepEqual(config.mobileWidths, [320,360,390,430]);
  assert.deepEqual(config.navigation.map((item) => item.id), ['home','learn','practice','ai','profile']);
  assert.deepEqual(config.audio.playbackSpeeds, [.75,1,1.25,1.5]);
  assert.equal(config.microphone.fallback, 'text');
  assert.deepEqual(config.notifications.types, ['learning_reminder','goal_reminder','milestone_celebration','streak_reminder']);
  assert.equal(config.biometric.storesBiometricData, false);
  assert.equal(config.analytics.requiresConsent, true);
  assert.equal(config.analytics.privateDataCollected, false);

  const web = boot(); const w = web.window;
  ['MobileArchitectureReviewService','MobileBottomNavigationService','MobileAudioPlatformService','MobileMicrophoneExperienceService','MobileNotificationPreferenceService','MobileDownloadManagerService','NativeBiometricService','NativeDeepLinkService','MobileAnalyticsService','MobilePerformanceService','MobileNativePlatformService'].forEach((name) => assert.ok(w[name], `${name} missing`));
  assert.equal(w.MobileArchitectureReviewService.hasSeparateLearningLogic(), false);
  assert.equal(w.MobileArchitectureReviewService.report().srs, 'shared');
  assert.equal(w.MobileBottomNavigationService.items().length, 5);
  assert.equal(w.MobileAudioPlatformService.validateUrl('javascript:alert(1)'), '');
  const cached = await w.MobileAudioPlatformService.cache({ src: 'https://app.test/audio/story.mp3', title: 'Story' });
  assert.equal(cached.cached, true); assert.equal(await w.MobileAudioPlatformService.cached(cached.src), true);
  const playing = await w.MobileAudioPlatformService.play({ src: cached.src, speed: 1.25 });
  assert.equal(playing.status, 'playing'); assert.equal(playing.offline, true); assert.equal(playing.speed, 1.25);
  assert.equal(w.BackgroundAudioService.current().playbackRate, 1.25);

  assert.equal((await w.MobileMicrophoneExperienceService.start()).status, 'recording');
  assert.ok(w.MobileMicrophoneExperienceService.state().level > 0);
  const stopped = await w.MobileMicrophoneExperienceService.stop(); assert.equal(stopped.audioStored, false); assert.equal(stopped.transcript, '안녕하세요');
  const fallback = boot({ microphone: false }); assert.equal((await fallback.window.MobileMicrophoneExperienceService.start()).status, 'text-fallback'); assert.equal(fallback.window.MobileMicrophoneExperienceService.state().status, 'unavailable');

  const prefs = w.MobileNotificationPreferenceService.set({ enabled: true, time: '20:15', types: { goal_reminder: true, milestone_celebration: false } });
  assert.equal(prefs.time, '20:15'); assert.equal(prefs.types.goal_reminder, true); assert.equal((await w.MobileNotificationPreferenceService.apply()).status, 'scheduled');
  assert.equal((await w.MobileDownloadManagerService.usage()).usage, 12 * 1024 * 1024);
  const cleared = await w.MobileDownloadManagerService.clearCache(); assert.equal(cleared.learningDataPreserved, true); assert.equal(w.MobileDownloadManagerService.learningDataKeysCleared().length, 0);

  assert.deepEqual(JSON.parse(JSON.stringify(w.NativeDeepLinkService.parse('tamhoanq://lesson/topik1/unit5'))), { target: 'lesson', parts: ['topik1','unit5'], rawUrl: 'tamhoanq://lesson/topik1/unit5' });
  assert.equal(w.NativeDeepLinkService.open('tamhoanq://lesson/topik1/unit5').route, 'lesson-preview'); assert.equal(web.state.selectedLessonPreview, 'unit5');
  assert.equal(w.NativeDeepLinkService.open('https://attacker.test/lesson/unit5').status, 'ignored');
  assert.equal(w.MobileAnalyticsService.track('app_open').reason, 'consent-required');
  w.MobileAnalyticsService.setConsent(true); assert.equal(w.MobileAnalyticsService.track('lesson_start', { route: 'lesson', transcript: 'private' }).status, 'queued');
  assert.equal('transcript' in w.MobileAnalyticsService.queue()[0].properties, false); assert.equal(w.MobileAnalyticsService.privateDataCollected(), false);
  assert.equal(w.MobilePerformanceService.snapshot().durationMs, 321);

  const native = boot({ native: true });
  assert.equal((await native.window.NativeBiometricService.availability()).available, true);
  assert.equal((await native.window.NativeBiometricService.enable()).status, 'enabled');
  assert.equal(await native.window.NativeBiometricService.enabled(), true);
  assert.equal(native.window.NativeBiometricService.purpose(), 'unlock_existing_session');
  assert.equal((await native.window.NativeBiometricService.authenticate()).storesBiometricData, false);

  const packageJson = JSON.parse(read('mobile/package.json')); const capacitor = JSON.parse(read('mobile/capacitor.config.json')); const mobileContract = JSON.parse(read('mobile/mobile-app.config.json'));
  assert.equal(packageJson.dependencies['@aparajita/capacitor-biometric-auth'], '10.0.0');
  assert.equal(packageJson.dependencies['@aparajita/capacitor-secure-storage'], '8.0.0');
  assert.equal(packageJson.dependencies['@capacitor/splash-screen'], '8.0.2');
  assert.equal(capacitor.plugins.SplashScreen.backgroundColor, '#F7FFD1');
  assert.equal(mobileContract.contractVersion, 3); assert.equal(mobileContract.security.authSessionStorage, 'native-keychain-or-keystore');
  assert.match(read('mobile/src/native-plugins.js'), /SecureStorageAdapter/); assert.match(read('data/cloud-sync.js'), /storage: nativeAuthStorage/);
  assert.match(read('mobile/scripts/configure-generated.mjs'), /NSFaceIDUsageDescription/); assert.match(read('mobile/scripts/configure-generated.mjs'), /android\.permission\.USE_BIOMETRIC/); assert.match(read('mobile/scripts/configure-generated.mjs'), /android:scheme="tamhoanq"/);
  assert.match(read('data/route-loader.js'), /p78Mobile: \{ styles: \['p78-mobile-native\.css\?v=2'\], scripts: \['data\/mobile-native-platform\.js\?v=2'\]/);
  assert.ok(read('mobile/scripts/build-web.mjs').includes('data/mobile-native-platform.js?v=2'));
  assert.match(read('sw.js'), /content\/mobile-native-platform\.json/); assert.match(read('p78-mobile-native.css'), /max-width:\s*340px/); assert.match(read('mobile-experience.css'), /repeat\(5,\s*minmax\(0,\s*1fr\)\)/);
  assert.doesNotMatch([source, read('mobile/src/native-plugins.js'), read('mobile/mobile-app.config.json')].join('\n'), /(service_role|private_key|client_secret|card_number)\s*[:=]/i);
  console.log('P78 unit: shared Learning Core, five-item navigation, cached/background audio, microphone fallback, notification preferences, offline storage, biometric session unlock, deep links, consent analytics, performance and security passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
