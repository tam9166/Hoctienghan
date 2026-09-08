const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'data', 'mobile-experience.js'), 'utf8');
const content = JSON.parse(fs.readFileSync(path.join(root, 'content', 'mobile-experience.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const nativeConfig = JSON.parse(fs.readFileSync(path.join(root, 'mobile', 'mobile-app.config.json'), 'utf8'));
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'mobile-experience.css'), 'utf8');
const worker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const appSource = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

function boot() {
  const values = new Map(); const opened = []; const notifications = [];
  const state = { currentUser: { id: 'mobile-user' }, currentView: 'home', srsData: [{ wordId: 'school', status: 'review', reviewCount: 1, nextReview: '2026-01-01T00:00:00.000Z' }] };
  const storage = { get(key, fallback) { return values.has(key) ? values.get(key) : fallback; }, set(key, value) { values.set(key, value); return true; } };
  function Notification(title, options) { notifications.push({ title, options }); }
  Notification.permission = 'granted'; Notification.requestPermission = async () => 'granted';
  const window = {
    KLEARN_APP: { storage, state, STORAGE_KEYS: { mobileExperience: 'mobile' }, setView: (route) => { state.currentView = route; opened.push(route); }, render: () => {}, toast: () => {}, escapeHtml: String, VocabularyService: { dueCards: () => state.srsData } },
    OfflinePackService: { metadata: () => [{ id: 'beginner-pack' }], status: () => 'downloaded', download: async (id) => ({ id }), remove: async (id) => ({ id }) },
    NotificationService: { pending: () => [{ id: 'srs-due', text: '1 từ đến hạn.' }] },
    DailyKoreanFeedService: { today: () => ({ id: 'daily-1', phrase: ['안녕하세요', 'Xin chào'] }) },
    KoreanDocumentAssistantService: { scan: async () => ({ supported: true, persisted: false }) },
    Notification,
    navigator: { userAgent: 'Mozilla/5.0 (Linux; Android 14)', maxTouchPoints: 5, deviceMemory: 2, hardwareConcurrency: 2, connection: { saveData: true, effectiveType: '2g' }, serviceWorker: { ready: Promise.resolve({ showNotification: async (title, options) => notifications.push({ title, options }) }) } },
    caches: {}, location: { hash: '' }, console
  };
  const context = { window, console, Date, String, Number, Object, Array, Math, Set, Map, RegExp, Promise, JSON };
  vm.createContext(context); vm.runInContext(source, context); return { window, state, values, opened, notifications };
}

(async () => {
  assert.equal(content.verified, true);
  assert.equal(content.reviewStatus, 'approved');
  assert.deepEqual(content.native.platforms.map((item) => item.id), ['android', 'ios']);
  assert.deepEqual(content.offline.contentTypes, ['lesson', 'audio', 'vocabulary']);
  assert.equal(content.camera.uploads, false);
  assert.equal(content.backgroundAudio.speechSynthesisFallbackIsBackgroundCapable, false);
  assert.equal(content.notifications.maximumPerDay, 2);
  assert.equal(nativeConfig.platforms.android.enabled, true);
  assert.equal(nativeConfig.platforms.ios.enabled, true);
  assert.equal(nativeConfig.platforms.android.status, 'wrapper-not-generated');

  const app = boot(); const w = app.window;
  assert.equal(w.MobilePlatformService.detect().platform, 'android');
  assert.equal(w.MobilePlatformService.architecture().appId, 'com.tamhoanq.korean');
  assert.equal(w.MobileOfflineService.capabilities().available, true);
  assert.equal((await w.MobileOfflineService.download('beginner-pack')).id, 'beginner-pack');
  assert.equal(w.LowPerformanceModeService.recommended(), true);
  assert.equal(w.LowPerformanceModeService.enabled(), true);
  w.LowPerformanceModeService.set('off'); assert.equal(w.LowPerformanceModeService.enabled(), false);
  assert.equal(w.MobileGestureService.interpret({ x: 10, y: 100 }, { x: 100, y: 104 }), 'edge-back');
  assert.equal(w.MobileGestureService.interpret({ x: 60, y: 100 }, { x: 140, y: 104 }), 'none');
  assert.equal(w.MobileWidgetService.snapshot().today.korean, '안녕하세요');
  assert.equal(w.MobileWidgetService.snapshot().review.dueCount, 1);
  assert.equal(w.MobileWidgetService.contract().containsPrivateContent, false);
  assert.equal(w.AppShortcutService.open('speaking'), true);
  assert.equal(app.state.currentView, 'speaking-hub');
  assert.equal(w.BackgroundAudioService.capabilities().speechSynthesisFallbackIsBackgroundCapable, false);
  assert.equal((await w.BackgroundAudioService.play({})).status, 'audio-asset-required');
  assert.equal(w.MobileCameraService.privacy().uploads, false);
  assert.equal((await w.MobileCameraService.scanFile({ type: 'image/png' }, 'menu')).persisted, false);

  const normalTime = new Date('2026-09-06T12:00:00.000Z');
  assert.equal(w.MobileNotificationService.eligibility(normalTime).eligible, true);
  assert.equal((await w.MobileNotificationService.showNext(normalTime)).status, 'sent');
  assert.equal(w.MobileNotificationService.eligibility(new Date(normalTime.getTime() + 60 * 60 * 1000)).reason, 'minimum-interval');
  assert.equal(app.notifications.length, 1);

  assert.deepEqual(manifest.shortcuts.map((item) => item.url), ['./#speaking-hub', './#review', './#topik']);
  assert.match(index, /mobile-experience\.css\?v=1/);
  assert.match(index, /data\/mobile-experience\.js\?v=2/);
  assert.match(css, /min-height: 48px/);
  assert.match(css, /safe-area-inset-bottom/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(worker, /klearn-v72/);
  assert.match(worker, /addEventListener\('push'/);
  assert.match(worker, /addEventListener\('notificationclick'/);
  assert.match(worker, /maximumPerDay: 2/);
  assert.match(worker, /minimumIntervalMs: 6 \* 60 \* 60 \* 1000/);
  assert.match(worker, /indexedDB\.open\('klearn-mobile-system'/);
  assert.match(worker, /mobile-experience\.json/);
  assert.match(appSource, /mobileExperience: 'klearn_mobile_experience'/);
  console.log('mobile experience: Android/iOS contract, touch UX, offline bridge, notification throttle, Media Session, camera privacy, widget, shortcuts, low performance and store preparation passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
