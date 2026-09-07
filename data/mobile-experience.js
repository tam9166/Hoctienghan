/* Tiếng Hàn - TamHoanq · P35 mobile application experience */
(function mobileExperienceModule(global) {
  'use strict';
  const app = global.KLEARN_APP;
  if (!app) return;

  const { storage, state, STORAGE_KEYS, setView, render, toast, escapeHtml } = app;
  const STORAGE_KEY = STORAGE_KEYS.mobileExperience || 'klearn_mobile_experience';
  const HOUR = 60 * 60 * 1000;
  const DAY = 24 * HOUR;
  const DEFAULT_CONTRACT = Object.freeze({
    id: 'p35-mobile-experience', version: 1, verified: true, reviewStatus: 'approved',
    native: { strategy: 'web-first-native-bridge', appId: 'com.tamhoanq.korean', platforms: [{ id: 'android', status: 'foundation-ready' }, { id: 'ios', status: 'foundation-ready' }] },
    offline: { service: 'OfflinePackService', contentTypes: ['lesson', 'audio', 'vocabulary'], largeDataInLocalStorage: false, privateDataInPublicCache: false },
    notifications: { quietHours: { start: 22, end: 7 }, minimumIntervalHours: 6, maximumPerDay: 2, permission: 'user-initiated' },
    backgroundAudio: { api: 'MediaSession', requiresAudioAsset: true, speechSynthesisFallbackIsBackgroundCapable: false },
    camera: { modes: ['text', 'menu', 'sign'], processing: 'on-device', uploads: false, imageStored: false, textStored: false, fallback: 'text-input' },
    widget: { status: 'native-bridge-contract', items: ['todays-korean', 'review-words'], containsPrivateContent: false },
    shortcuts: [{ id: 'speaking', name: 'Luyện nói', route: 'speaking-hub' }, { id: 'review', name: 'Ôn từ', route: 'review' }, { id: 'topik', name: 'Luyện TOPIK', route: 'topik' }],
    lowPerformance: { automaticSignals: ['saveData', 'slow-2g', '2g', 'deviceMemory<=2', 'hardwareConcurrency<=2'], effects: ['reduce-motion', 'reduce-effects', 'avoid-prefetch', 'compact-media'] }
  });
  const runtime = { contract: DEFAULT_CONTRACT, loading: null, audio: null, cameraStream: null, gestureBound: false };
  const safeObject = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const userId = () => state.currentUser?.id || 'guest';
  const readAll = () => safeObject(storage.get(STORAGE_KEY, {}));
  const readDevice = () => safeObject(readAll()[userId()]);
  const saveDevice = (patch) => { const all = readAll(); all[userId()] = { ...readDevice(), ...patch, updatedAt: new Date().toISOString() }; storage.set(STORAGE_KEY, all); return all[userId()]; };
  const dayKey = (date = new Date()) => date.toISOString().slice(0, 10);
  const cleanRoute = (route) => DEFAULT_CONTRACT.shortcuts.some((item) => item.route === route) ? route : 'home';

  const MobileContentService = {
    contract() { return runtime.contract; },
    hydrate(value) { if (!value?.verified || value.reviewStatus !== 'approved') throw new Error('Mobile experience contract is not approved'); runtime.contract = value; return value; },
    load() { if (runtime.loading || runtime.contract !== DEFAULT_CONTRACT || typeof global.fetch !== 'function') return runtime.loading || Promise.resolve(runtime.contract); runtime.loading = global.fetch('./content/mobile-experience.json', { cache: 'default' }).then((response) => { if (!response.ok) throw new Error(`Mobile contract ${response.status}`); return response.json(); }).then((value) => this.hydrate(value)).catch(() => DEFAULT_CONTRACT).finally(() => { runtime.loading = null; }); return runtime.loading; }
  };

  const MobilePlatformService = {
    detect() {
      const ua = String(global.navigator?.userAgent || '');
      const capacitorPlatform = global.Capacitor?.getPlatform?.();
      const platform = capacitorPlatform && capacitorPlatform !== 'web' ? capacitorPlatform : /android/i.test(ua) ? 'android' : /iphone|ipad|ipod/i.test(ua) ? 'ios' : 'web';
      const standalone = Boolean(global.matchMedia?.('(display-mode: standalone)')?.matches || global.navigator?.standalone);
      return { platform, native: platform === 'android' || platform === 'ios' ? Boolean(capacitorPlatform && capacitorPlatform !== 'web') : false, standalone, touch: Number(global.navigator?.maxTouchPoints || 0) > 0 || 'ontouchstart' in global };
    },
    architecture() { const contract = MobileContentService.contract(); return { strategy: contract.native.strategy, appId: contract.native.appId, platforms: contract.native.platforms, dataOwnership: contract.native.dataOwnership || 'existing-local-and-cloud-services', detected: this.detect() }; }
  };

  const MobileOfflineService = {
    capabilities() { return { ...MobileContentService.contract().offline, available: Boolean(global.OfflinePackService && 'caches' in global) }; },
    metadata() { return global.OfflinePackService?.metadata?.() || []; },
    status(pack) { return global.OfflinePackService?.status?.(pack) || 'unavailable'; },
    download(packId) { if (!global.OfflinePackService?.download) return Promise.reject(new Error('Offline packs are unavailable on this device.')); return global.OfflinePackService.download(packId); },
    remove(packId) { if (!global.OfflinePackService?.remove) return Promise.reject(new Error('Offline packs are unavailable on this device.')); return global.OfflinePackService.remove(packId); }
  };

  const MobileNotificationService = {
    policy() { return MobileContentService.contract().notifications; },
    permission() { return global.Notification?.permission || 'unsupported'; },
    async requestPermission() { if (!global.Notification?.requestPermission) return 'unsupported'; return global.Notification.requestPermission(); },
    history() { return Array.isArray(readDevice().notificationHistory) ? readDevice().notificationHistory : []; },
    pending() { return (global.NotificationService?.pending?.() || []).map((notice) => ({ ...notice, route: notice.id === 'srs-due' ? 'review' : 'home' })); },
    eligibility(date = new Date()) {
      const policy = this.policy(); const hour = date.getHours(); const history = this.history(); const today = dayKey(date);
      if (this.permission() !== 'granted') return { eligible: false, reason: 'permission-required' };
      if (hour >= policy.quietHours.start || hour < policy.quietHours.end) return { eligible: false, reason: 'quiet-hours' };
      const todayCount = history.filter((item) => item.day === today).length;
      if (todayCount >= policy.maximumPerDay) return { eligible: false, reason: 'daily-limit' };
      const latest = history[0]?.sentAt ? new Date(history[0].sentAt).getTime() : 0;
      if (latest && date.getTime() - latest < policy.minimumIntervalHours * HOUR) return { eligible: false, reason: 'minimum-interval' };
      if (!this.pending().length) return { eligible: false, reason: 'nothing-due' };
      return { eligible: true, reason: 'ready' };
    },
    async showNext(date = new Date()) {
      const eligible = this.eligibility(date); if (!eligible.eligible) return { status: 'skipped', reason: eligible.reason };
      const notice = this.pending()[0]; const options = { body: notice.text, tag: `klearn-${notice.id}`, renotify: false, data: { route: cleanRoute(notice.route) }, icon: './icons/icon-192.png', badge: './icons/icon-192.png' };
      const registration = await global.navigator?.serviceWorker?.ready?.catch?.(() => null);
      if (registration?.showNotification) await registration.showNotification('Tiếng Hàn - TamHoanq', options);
      else if (global.Notification) new global.Notification('Tiếng Hàn - TamHoanq', options);
      else return { status: 'skipped', reason: 'unsupported' };
      const entry = { id: notice.id, day: dayKey(date), sentAt: date.toISOString() };
      saveDevice({ notificationHistory: [entry, ...this.history()].filter((item) => date.getTime() - new Date(item.sentAt).getTime() < 30 * DAY).slice(0, 60) });
      return { status: 'sent', notice };
    }
  };

  const BackgroundAudioService = {
    capabilities() { return { supported: typeof global.Audio === 'function', mediaSession: Boolean(global.navigator?.mediaSession), ...MobileContentService.contract().backgroundAudio }; },
    current() { return runtime.audio; },
    async play(track = {}) {
      if (!track.src) return { status: 'audio-asset-required', backgroundCapable: false };
      if (typeof global.Audio !== 'function') return { status: 'unsupported', backgroundCapable: false };
      this.stop(); const audio = new global.Audio(track.src); audio.preload = 'metadata'; runtime.audio = audio;
      if (global.navigator?.mediaSession) {
        if (typeof global.MediaMetadata === 'function') global.navigator.mediaSession.metadata = new global.MediaMetadata({ title: track.title || 'Bài nghe tiếng Hàn', artist: track.artist || 'Tiếng Hàn - TamHoanq', album: track.album || 'Luyện nghe' });
        const actions = { play: () => audio.play(), pause: () => audio.pause(), seekbackward: (event) => { audio.currentTime = Math.max(0, audio.currentTime - Number(event?.seekOffset || 10)); }, seekforward: (event) => { audio.currentTime = Math.min(Number.isFinite(audio.duration) ? audio.duration : audio.currentTime + 10, audio.currentTime + Number(event?.seekOffset || 10)); } };
        Object.entries(actions).forEach(([name, handler]) => { try { global.navigator.mediaSession.setActionHandler(name, handler); } catch (_) {} });
      }
      await audio.play(); return { status: 'playing', backgroundCapable: Boolean(global.navigator?.mediaSession), src: track.src };
    },
    pause() { runtime.audio?.pause?.(); return Boolean(runtime.audio); },
    stop() { if (!runtime.audio) return false; runtime.audio.pause?.(); runtime.audio.removeAttribute?.('src'); runtime.audio.load?.(); runtime.audio = null; return true; }
  };

  const MobileCameraService = {
    privacy() { return { ...MobileContentService.contract().camera, getUserMedia: Boolean(global.navigator?.mediaDevices?.getUserMedia), onDeviceOcr: Boolean(global.TextDetector && global.createImageBitmap) }; },
    async start(videoElement, options = {}) {
      if (!videoElement || !global.navigator?.mediaDevices?.getUserMedia) return { status: 'text-fallback', route: 'korean-document-assistant' };
      this.stop(); runtime.cameraStream = await global.navigator.mediaDevices.getUserMedia({ video: { facingMode: options.facingMode || { ideal: 'environment' } }, audio: false }); videoElement.srcObject = runtime.cameraStream; await videoElement.play?.(); return { status: 'camera-ready', persisted: false };
    },
    stop() { runtime.cameraStream?.getTracks?.().forEach((track) => track.stop()); runtime.cameraStream = null; return true; },
    async scanFile(file, mode = 'text') { const mapped = mode === 'text' ? 'document' : mode; if (!['document', 'menu', 'sign'].includes(mapped)) throw new Error('Unsupported camera mode'); if (!global.KoreanDocumentAssistantService?.scan) return { supported: false, persisted: false, fallback: 'text-input' }; return global.KoreanDocumentAssistantService.scan(file, mapped); }
  };

  const MobileWidgetService = {
    snapshot() {
      const feed = global.DailyKoreanFeedService?.today?.();
      const due = app.VocabularyService?.dueCards?.().length || 0;
      return { generatedAt: new Date().toISOString(), today: feed ? { id: feed.id || dayKey(), korean: Array.isArray(feed.phrase) ? feed.phrase[0] : feed.ko || '오늘의 한국어', meaning: Array.isArray(feed.phrase) ? feed.phrase[1] : feed.meaning || '' } : { id: dayKey(), korean: '오늘도 한 걸음', meaning: 'Hôm nay thêm một bước' }, review: { dueCount: due, route: 'review' }, containsPrivateContent: false };
    },
    contract() { return { ...MobileContentService.contract().widget, refreshPolicy: 'timeline-or-app-event', snapshot: this.snapshot() }; }
  };

  const AppShortcutService = {
    all() { return MobileContentService.contract().shortcuts.map((item) => ({ ...item, url: `./#${item.route}` })); },
    open(id) { const shortcut = this.all().find((item) => item.id === id); if (!shortcut) return false; setView(shortcut.route); return true; },
    routeFromUrl(hash = global.location?.hash || '') { const route = String(hash).replace(/^#/, ''); return this.all().some((item) => item.route === route) ? route : null; }
  };

  const LowPerformanceModeService = {
    signals() { const connection = global.navigator?.connection || global.navigator?.mozConnection || global.navigator?.webkitConnection || {}; return { saveData: Boolean(connection.saveData), effectiveType: connection.effectiveType || 'unknown', deviceMemory: Number(global.navigator?.deviceMemory || 0), hardwareConcurrency: Number(global.navigator?.hardwareConcurrency || 0) }; },
    recommended() { const value = this.signals(); return value.saveData || ['slow-2g', '2g'].includes(value.effectiveType) || (value.deviceMemory > 0 && value.deviceMemory <= 2) || (value.hardwareConcurrency > 0 && value.hardwareConcurrency <= 2); },
    mode() { return ['on', 'off', 'auto'].includes(readDevice().performanceMode) ? readDevice().performanceMode : 'auto'; },
    enabled() { return this.mode() === 'on' || (this.mode() === 'auto' && this.recommended()); },
    set(mode) { if (!['on', 'off', 'auto'].includes(mode)) throw new Error('Invalid performance mode'); saveDevice({ performanceMode: mode }); this.apply(); return this.mode(); },
    apply() { const root = global.document?.documentElement; if (!root) return this.enabled(); root.classList.toggle('low-performance', this.enabled()); root.dataset.mobilePerformance = this.mode(); root.dataset.networkQuality = this.signals().effectiveType; return this.enabled(); }
  };

  const MobileGestureService = {
    interpret(start, end) { const dx = Number(end?.x || 0) - Number(start?.x || 0); const dy = Number(end?.y || 0) - Number(start?.y || 0); if (Number(start?.x || 0) <= 24 && dx >= 72 && Math.abs(dx) > Math.abs(dy) * 1.5) return 'edge-back'; return 'none'; },
    bind() {
      if (runtime.gestureBound || !global.document?.addEventListener) return false; let start = null;
      global.document.addEventListener('touchstart', (event) => { const touch = event.changedTouches?.[0]; start = touch ? { x: touch.clientX, y: touch.clientY } : null; }, { passive: true });
      global.document.addEventListener('touchend', (event) => { const touch = event.changedTouches?.[0]; if (!start || !touch || this.interpret(start, { x: touch.clientX, y: touch.clientY }) !== 'edge-back') return; if (global.history?.length > 1) global.history.back(); else setView('home'); start = null; }, { passive: true });
      runtime.gestureBound = true; return true;
    }
  };

  const MobileExperienceService = {
    summary() { return { platform: MobilePlatformService.detect(), offline: MobileOfflineService.capabilities(), notifications: { permission: MobileNotificationService.permission(), policy: MobileNotificationService.policy() }, audio: BackgroundAudioService.capabilities(), camera: MobileCameraService.privacy(), widget: MobileWidgetService.contract(), shortcuts: AppShortcutService.all(), lowPerformance: { enabled: LowPerformanceModeService.enabled(), mode: LowPerformanceModeService.mode(), signals: LowPerformanceModeService.signals() } }; },
    initialize() { MobileContentService.load(); LowPerformanceModeService.apply(); MobileGestureService.bind(); const route = AppShortcutService.routeFromUrl(); if (route && state.currentUser && state.currentView !== route) setView(route); return this.summary(); }
  };

  function profilePanel() {
    const summary = MobileExperienceService.summary(); const installed = MobileOfflineService.metadata().length; const mode = summary.lowPerformance.mode;
    return `<section class="card section mobile-experience-panel" data-mobile-experience data-mobile-swipe-zone><div class="section-heading"><div><p class="eyebrow">P35 · MOBILE</p><h2 class="section-title">Trải nghiệm trên điện thoại</h2></div><span class="mobile-platform-badge">${escapeHtml(summary.platform.platform.toUpperCase())}${summary.platform.standalone ? ' · APP' : ''}</span></div><p class="subtle">Điều khiển cảm ứng, học ngoại tuyến và các capability Android/iOS dùng chung dữ liệu hiện tại.</p><div class="mobile-capability-grid"><button data-view="offline-packs"><b>${installed}</b><span>Gói ngoại tuyến</span></button><button data-view="korean-document-assistant"><b>📷</b><span>Quét chữ Hàn</span></button><button data-mobile-shortcut="speaking"><b>🎙</b><span>Luyện nói</span></button><button data-mobile-shortcut="review"><b>↻</b><span>Ôn từ</span></button></div><div class="mobile-setting-row"><div><b>Chế độ máy/mạng yếu</b><small>Tự giảm chuyển động và hiệu ứng khi cần.</small></div><select data-mobile-performance aria-label="Chế độ hiệu năng"><option value="auto" ${mode === 'auto' ? 'selected' : ''}>Tự động</option><option value="on" ${mode === 'on' ? 'selected' : ''}>Bật</option><option value="off" ${mode === 'off' ? 'selected' : ''}>Tắt</option></select></div><div class="mobile-setting-row"><div><b>Nhắc học thông minh</b><small>Tối đa 2 lần/ngày · im lặng 22:00–07:00.</small></div><button class="btn secondary" data-mobile-notification>${summary.notifications.permission === 'granted' ? 'Đã cho phép' : summary.notifications.permission === 'unsupported' ? 'Không hỗ trợ' : 'Cho phép'}</button></div><p class="mobile-foundation-note">Android/iOS foundation sẵn sàng để nối native wrapper; chưa phát hành binary trên store.</p></section>`;
  }

  Object.assign(global, { MobileContentService, MobilePlatformService, MobileOfflineService, MobileNotificationService, BackgroundAudioService, MobileCameraService, MobileWidgetService, AppShortcutService, LowPerformanceModeService, MobileGestureService, MobileExperienceService });
  const previousAfterRender = global.KLEARN_AFTER_RENDER;
  global.KLEARN_AFTER_RENDER = () => {
    previousAfterRender?.(); LowPerformanceModeService.apply(); MobileGestureService.bind();
    if (!global.document || !state.currentUser || state.currentView !== 'profile' || global.document.querySelector('[data-mobile-experience]')) return;
    global.document.getElementById('app')?.insertAdjacentHTML('afterbegin', profilePanel());
    global.document.querySelectorAll('[data-mobile-shortcut]').forEach((button) => { button.onclick = () => AppShortcutService.open(button.dataset.mobileShortcut); });
    global.document.querySelector('[data-mobile-performance]')?.addEventListener('change', (event) => { LowPerformanceModeService.set(event.currentTarget.value); toast?.('Đã cập nhật chế độ hiệu năng.'); });
    global.document.querySelector('[data-mobile-notification]')?.addEventListener('click', async (event) => { const permission = await MobileNotificationService.requestPermission(); event.currentTarget.textContent = permission === 'granted' ? 'Đã cho phép' : permission === 'denied' ? 'Đã từ chối' : 'Không hỗ trợ'; if (permission === 'granted') toast?.('Đã bật quyền nhắc học. Ứng dụng vẫn tuân thủ giờ yên lặng.'); });
  };
  MobileExperienceService.initialize();
  if (global.document && state.currentUser) render();
})(window);
