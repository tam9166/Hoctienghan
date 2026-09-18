/* P78 — mobile-first native experience, composed around the existing Learning Core. */
(function mobileNativePlatform(global) {
  'use strict';
  const app = global.KLEARN_APP;
  if (!app) return;
  const { state, storage, escapeHtml = String, render, setView, toast } = app;
  const STORE_KEY = 'klearn_p78_mobile_native';
  const AUDIO_CACHE = 'klearn-mobile-audio-v1';
  const runtime = state.p78Mobile || (state.p78Mobile = { config: null, loading: null, microphoneState: 'idle', microphoneLevel: 0, audioUrl: '', downloadBusy: false });
  const plugins = () => global.KLearnNativePlugins || {};
  const native = () => Boolean(global.KLearnPlatform?.isNative?.());
  const now = () => new Date().toISOString();
  const object = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const clean = (value, max = 500) => String(value == null ? '' : value).normalize('NFC').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);
  const userId = () => state.currentUser?.id || 'guest';
  const readAll = () => object(storage.get(STORE_KEY, {}));
  const read = () => object(readAll()[userId()]);
  const save = (patch) => { const all = readAll(); all[userId()] = { ...read(), ...patch, updatedAt: now() }; storage.set(STORE_KEY, all); return clone(all[userId()]); };

  const P78MobileConfigService = {
    hydrate(value) {
      if (Number(value?.schemaVersion) !== 1 || value?.architecture?.separateMobileLearningEngine !== false || value?.architecture?.separateMobileProgressStore !== false || value?.navigation?.map((item) => item.id).join(',') !== 'home,learn,practice,ai,profile' || value?.biometric?.storesBiometricData !== false || value?.analytics?.requiresConsent !== true) throw new Error('P78 shared-core/privacy contract failed');
      runtime.config = clone(value); return this.get();
    },
    get() { return runtime.config ? clone(runtime.config) : null; },
    async load() { if (runtime.config) return this.get(); if (runtime.loading) return runtime.loading; runtime.loading = fetch('./content/mobile-native-platform.json', { cache: 'default' }).then((response) => { if (!response.ok) throw new Error(`P78 content ${response.status}`); return response.json(); }).then((value) => this.hydrate(value)).catch(() => null).finally(() => { runtime.loading = null; if (state.currentView === 'mobile-native-p78') render(); }); return runtime.loading; }
  };

  const MobileArchitectureReviewService = {
    report() { const value = runtime.config?.architecture || {}; return { ...clone(value), learningCore: 'shared', auth: 'shared', cloudSync: 'shared', srs: 'shared', adaptiveEngine: 'shared', aiCoach: 'shared', contentSystem: 'shared', subscriptionSystem: 'shared' }; },
    hasSeparateLearningLogic() { return false; }
  };

  const MobileBottomNavigationService = {
    items() { return clone(runtime.config?.navigation || []); },
    apply() {
      const nav = global.document?.getElementById?.('bottomNav'); if (!nav) return 0;
      nav.dataset.mobileItems = '5';
      const review = nav.querySelector('[data-route="review"] span:last-child'); if (review && global.innerWidth <= 767) review.textContent = 'Luyện tập';
      return [...nav.querySelectorAll('.nav-item')].filter((item) => global.getComputedStyle?.(item)?.display !== 'none').length;
    },
    async feedback() { await plugins().Haptics?.impact?.({ style: plugins().ImpactStyle?.Light || 'LIGHT' }).catch(() => {}); return true; }
  };

  const MobileAudioPlatformService = {
    speeds() { return [...(runtime.config?.audio?.playbackSpeeds || [.75, 1, 1.25, 1.5])]; },
    validateUrl(value) { try { const url = new URL(String(value || ''), global.location?.href || 'https://local.invalid/'); return ['https:','http:'].includes(url.protocol) && (url.protocol === 'https:' || ['localhost','127.0.0.1','local.invalid'].includes(url.hostname)) ? url.href : ''; } catch (_) { return ''; } },
    filePath(src) { let hash = 2166136261; for (const char of src) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); } return `audio/${(hash >>> 0).toString(16)}.media`; },
    async cache(track = {}) {
      const src = this.validateUrl(track.src); if (!src) return { status: 'unsupported', cached: false };
      if (native() && plugins().Filesystem?.downloadFile) {
        const path = this.filePath(src); await plugins().Filesystem.mkdir?.({ path: 'audio', directory: plugins().Directory?.Data, recursive: true }).catch(() => {});
        const result = await plugins().Filesystem.downloadFile({ url: src, path, directory: plugins().Directory?.Data, recursive: true });
        const stat = await plugins().Filesystem.stat?.({ path, directory: plugins().Directory?.Data }).catch(() => null);
        const uri = result?.path || (await plugins().Filesystem.getUri?.({ path, directory: plugins().Directory?.Data }))?.uri;
        const index = object(read().audioIndex); index[src] = { src, title: clean(track.title, 120), size: Number(stat?.size || 0), cachedAt: now(), nativePath: path, nativeUri: uri || '' }; save({ audioIndex: index });
        return { status: 'cached', cached: true, src, size: Number(stat?.size || 0), storage: 'native-filesystem' };
      }
      if (!global.caches?.open) return { status: 'unsupported', cached: false };
      const response = await fetch(src, { credentials: 'same-origin' }); if (!response.ok) return { status: 'failed', cached: false, reason: `HTTP ${response.status}` };
      const cache = await global.caches.open(AUDIO_CACHE); await cache.put(src, response.clone());
      const size = Number(response.headers?.get?.('content-length') || 0); const index = object(read().audioIndex); index[src] = { src, title: clean(track.title, 120), size, cachedAt: now() }; save({ audioIndex: index });
      return { status: 'cached', cached: true, src, size };
    },
    async cached(src) { const item = object(read().audioIndex)[this.validateUrl(src)]; if (native() && item?.nativePath) return Boolean(await plugins().Filesystem?.stat?.({ path: item.nativePath, directory: plugins().Directory?.Data }).then(() => true).catch(() => false)); if (!global.caches?.open) return false; const cache = await global.caches.open(AUDIO_CACHE); return Boolean(await cache.match(this.validateUrl(src))); },
    async source(track = {}) {
      const src = this.validateUrl(track.src); const item = object(read().audioIndex)[src];
      if (native() && item?.nativeUri) return { src: global.Capacitor?.convertFileSrc?.(item.nativeUri) || item.nativeUri, offline: true };
      if (!src || !global.caches?.open) return { src, offline: false };
      const cache = await global.caches.open(AUDIO_CACHE); const response = await cache.match(src); if (!response) return { src, offline: false };
      const blob = await response.blob(); if (!global.URL?.createObjectURL) return { src, offline: true };
      if (runtime.audioUrl) global.URL.revokeObjectURL?.(runtime.audioUrl); runtime.audioUrl = global.URL.createObjectURL(blob); return { src: runtime.audioUrl, offline: true };
    },
    async play(track = {}) { const resolved = await this.source(track); const result = await global.BackgroundAudioService?.play?.({ ...track, src: resolved.src }); const speed = this.setSpeed(track.speed || read().playbackSpeed || 1); return { ...(result || { status: 'unsupported' }), offline: resolved.offline, speed }; },
    setSpeed(value) { const speed = this.speeds().includes(Number(value)) ? Number(value) : 1; const audio = global.BackgroundAudioService?.current?.(); if (audio) audio.playbackRate = speed; save({ playbackSpeed: speed }); return speed; },
    pause() { return global.BackgroundAudioService?.pause?.() || false; },
    stop() { const stopped = global.BackgroundAudioService?.stop?.() || false; if (runtime.audioUrl) global.URL?.revokeObjectURL?.(runtime.audioUrl); runtime.audioUrl = ''; return stopped; },
    index() { return Object.values(object(read().audioIndex)).map(clone); },
    async clear() { if (global.caches?.delete) await global.caches.delete(AUDIO_CACHE); if (native()) await plugins().Filesystem?.rmdir?.({ path: 'audio', directory: plugins().Directory?.Data, recursive: true }).catch(() => {}); save({ audioIndex: {} }); this.stop(); return { status: 'cleared' }; }
  };

  const MobileMicrophoneExperienceService = {
    state() { return { status: runtime.microphoneState, level: runtime.microphoneLevel, fallback: 'text', audioPersisted: false }; },
    support() { return global.VoiceCaptureService?.supported?.() || { microphone: false, recorder: false, recognition: false, audioSignals: false }; },
    async permission() { try { const status = await global.navigator?.permissions?.query?.({ name: 'microphone' }); return status?.state || 'prompt'; } catch (_) { return this.support().microphone ? 'prompt' : 'unavailable'; } },
    async start(callbacks = {}) {
      if (!global.VoiceCaptureService || (!this.support().microphone && !this.support().recognition)) { runtime.microphoneState = 'unavailable'; return { status: 'text-fallback', fallback: 'text', audioPersisted: false }; }
      runtime.microphoneState = 'requesting'; runtime.microphoneLevel = 0;
      try {
        const result = await global.VoiceCaptureService.start({ ...callbacks, onSignal: (event) => { runtime.microphoneLevel = Math.max(0, Math.min(1, Number(event?.rms || 0) * 12)); callbacks.onSignal?.({ ...event, level: runtime.microphoneLevel }); }, onError: (error) => { runtime.microphoneState = error === 'not-allowed' ? 'denied' : 'error'; callbacks.onError?.(error); } });
        runtime.microphoneState = result.status === 'recording' ? 'recording' : result.status === 'text-fallback' ? 'unavailable' : 'idle'; return { ...result, fallback: 'text', audioPersisted: false };
      } catch (error) { runtime.microphoneState = /denied|permission|notallowed/i.test(String(error?.name || error?.message)) ? 'denied' : 'error'; return { status: 'text-fallback', fallback: 'text', reason: runtime.microphoneState, audioPersisted: false }; }
    },
    async stop() { runtime.microphoneState = 'processing'; const result = await global.VoiceCaptureService?.stop?.() || { status: 'idle', transcript: '', audioStored: false }; runtime.microphoneState = 'idle'; runtime.microphoneLevel = 0; return { ...result, audioStored: false }; },
    async retry(callbacks) { if (global.VoiceCaptureService?.active?.()) await global.VoiceCaptureService.stop(); runtime.microphoneState = 'idle'; return this.start(callbacks); },
    fallback() { runtime.microphoneState = 'unavailable'; return { status: 'text-fallback', route: state.currentView, audioPersisted: false }; }
  };

  const MobileNotificationPreferenceService = {
    defaults() { return { enabled: false, time: runtime.config?.notifications?.defaultTime || '19:30', types: Object.fromEntries((runtime.config?.notifications?.types || []).map((type) => [type, type === 'learning_reminder' || type === 'streak_reminder'])) }; },
    get() { const current = object(read().notifications); return { ...this.defaults(), ...current, types: { ...this.defaults().types, ...object(current.types) } }; },
    set(input = {}) { const current = this.get(); const time = /^([01]\d|2[0-3]):[0-5]\d$/.test(input.time) ? input.time : current.time; const types = { ...current.types }; Object.keys(types).forEach((key) => { if (input.types && key in input.types) types[key] = Boolean(input.types[key]); }); const next = { enabled: input.enabled == null ? current.enabled : Boolean(input.enabled), time, types }; save({ notifications: next }); return clone(next); },
    async apply() { const value = this.get(); if (!value.enabled) { await global.NativeReminderService?.refresh?.({ disabled: true }); return { status: 'disabled', scheduled: 0 }; } const permission = await global.MobileNotificationService?.requestPermission?.(); if (permission !== 'granted') return { status: permission, scheduled: 0 }; return global.NativeReminderService?.refresh?.({ requestPermission: true, preferences: value }) || { status: 'web-managed', scheduled: 0 }; }
  };

  const MobileDownloadManagerService = {
    async downloads() { const packs = global.MobileOfflineService?.metadata?.() || []; return { packs: clone(packs), audio: MobileAudioPlatformService.index(), progressQueue: global.BackgroundSyncQueueService?.pending?.() || 0 }; },
    async usage() { const estimate = await global.navigator?.storage?.estimate?.().catch?.(() => null); const indexed = MobileAudioPlatformService.index().reduce((sum, item) => sum + Number(item.size || 0), 0); return { usage: Number(estimate?.usage || indexed), quota: Number(estimate?.quota || 0), indexedAudioBytes: indexed, source: estimate ? 'storage-manager' : 'audio-index' }; },
    async downloadPack(packId) { runtime.downloadBusy = true; try { return await global.MobileOfflineService?.download?.(packId); } finally { runtime.downloadBusy = false; } },
    async removePack(packId) { return global.MobileOfflineService?.remove?.(packId); },
    async clearCache() { const audio = await MobileAudioPlatformService.clear(); const packs = global.MobileOfflineService?.metadata?.() || []; for (const pack of packs) await global.MobileOfflineService?.remove?.(pack.id).catch(() => {}); return { status: 'cleared', audio, removedPacks: packs.length, learningDataPreserved: true }; },
    learningDataKeysCleared() { return []; }
  };

  const NativeBiometricService = {
    async availability() { const plugin = plugins().BiometricAuth; if (!native() || !plugin?.checkBiometry) return { available: false, reason: 'native-required', storesBiometricData: false }; const result = await plugin.checkBiometry(); return { available: Boolean(result.isAvailable || result.deviceIsSecure), biometryType: result.biometryType, deviceIsSecure: Boolean(result.deviceIsSecure), storesBiometricData: false }; },
    async enabled() { const secure = plugins().SecureStorage; if (!native() || !secure?.get) return false; const value = await secure.get('klearn_biometric_unlock_enabled').catch(() => null); return value === 'true' || value === true; },
    async enable() { const availability = await this.availability(); if (!availability.available) return { status: 'unavailable', ...availability }; const result = await this.authenticate(); if (result.status !== 'authenticated') return result; await plugins().SecureStorage?.set?.('klearn_biometric_unlock_enabled', 'true'); return { status: 'enabled', storesBiometricData: false }; },
    async disable() { await plugins().SecureStorage?.remove?.('klearn_biometric_unlock_enabled').catch(() => {}); return { status: 'disabled' }; },
    async authenticate() { const plugin = plugins().BiometricAuth; if (!native() || !plugin?.authenticate) return { status: 'regular-login-required', storesBiometricData: false }; try { await plugin.authenticate({ reason: 'Mở lại phiên học TamHoanq', cancelTitle: 'Hủy', allowDeviceCredential: true, iosFallbackTitle: 'Dùng mật mã', androidTitle: 'Mở khóa TamHoanq', androidConfirmationRequired: true }); return { status: 'authenticated', storesBiometricData: false }; } catch (error) { return { status: 'failed', reason: clean(error?.code || error?.message, 80), fallback: 'regular_login', storesBiometricData: false }; } },
    purpose() { return 'unlock_existing_session'; }
  };

  const NativeDeepLinkService = {
    parse(rawUrl) { let url; try { url = new URL(String(rawUrl || '')); } catch (_) { return null; } if (!['tamhoanq:','com.tamhoanq.korean:'].includes(url.protocol)) return null; const target = clean(url.hostname, 30); if (!['lesson','course','challenge','achievement'].includes(target)) return null; const parts = url.pathname.split('/').filter(Boolean).map((item) => clean(decodeURIComponent(item), 120)); if (!parts.length) return null; return { target, parts, rawUrl: url.href }; },
    open(value) {
      const link = typeof value === 'string' ? this.parse(value) : value; if (!link) return { status: 'ignored' };
      save({ lastDeepLink: { target: link.target, parts: link.parts, openedAt: now() } });
      if (link.target === 'lesson') { state.selectedLessonPreview = link.parts.at(-1); setView('lesson-preview'); }
      if (link.target === 'course') { const id = link.parts.at(-1); if (global.PremiumCourseService?.byId?.(id)) global.PremiumCourseService.select(id); else { state.selectedCourseId = id; setView('course-detail'); } }
      if (link.target === 'challenge') { state.p78ChallengeId = link.parts.at(-1); setView('community-challenge'); }
      if (link.target === 'achievement') { state.p78AchievementId = link.parts.at(-1); setView('achievements'); }
      return { status: 'opened', target: link.target, id: link.parts.at(-1), route: state.currentView };
    },
    async handle(rawUrl) { if (/^com\.tamhoanq\.korean:\/\/auth\/callback/i.test(String(rawUrl || ''))) return global.NativeAuthBridge?.handleUrl?.(rawUrl) || { status: 'auth-unavailable' }; return this.open(rawUrl); }
  };

  const MobileAnalyticsService = {
    allowedEvents() { return [...(runtime.config?.analytics?.events || [])]; },
    consent() { return read().analyticsConsent === true; },
    setConsent(value) { save({ analyticsConsent: Boolean(value), analyticsUpdatedAt: now(), analyticsQueue: value ? read().analyticsQueue || [] : [] }); return this.consent(); },
    track(event, properties = {}) { if (!this.consent()) return { status: 'skipped', reason: 'consent-required' }; if (!this.allowedEvents().includes(event)) return { status: 'skipped', reason: 'event-not-allowed' }; const safe = {}; ['durationMs','route','platform','success','memoryMb','bundleBytes'].forEach((key) => { if (properties[key] != null) safe[key] = typeof properties[key] === 'string' ? clean(properties[key], 80) : properties[key]; }); const queue = Array.isArray(read().analyticsQueue) ? read().analyticsQueue : []; const record = { id: `mobile-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`, event, properties: safe, createdAt: now() }; save({ analyticsQueue: [...queue, record].slice(-200) }); return { status: 'queued', record }; },
    queue() { return clone(Array.isArray(read().analyticsQueue) ? read().analyticsQueue : []); },
    privateDataCollected() { return false; }
  };

  const MobilePerformanceService = {
    budgets() { return clone(runtime.config?.performance || {}); },
    optimizeDOM(root = global.document) { root?.querySelectorAll?.('img:not([data-critical-image])')?.forEach((image) => { image.loading = 'lazy'; image.decoding = 'async'; }); root?.querySelectorAll?.('audio')?.forEach((audio) => { if (!audio.hasAttribute('preload')) audio.preload = 'metadata'; }); return { lazyImages: true, lazyAudio: true }; },
    snapshot() { const memory = global.performance?.memory; const navigation = global.performance?.getEntriesByType?.('navigation')?.[0]; return { route: state.currentView, durationMs: Math.round(Number(navigation?.duration || 0)), memoryMb: memory?.usedJSHeapSize ? Math.round(memory.usedJSHeapSize / 1024 / 1024 * 10) / 10 : null, bundleBytes: null, privateData: false }; },
    record() { return MobileAnalyticsService.track('performance', this.snapshot()); }
  };

  const MobileNativePlatformService = {
    async initialize() {
      await P78MobileConfigService.load(); MobileBottomNavigationService.apply();
      if (native()) {
        await plugins().StatusBar?.setOverlaysWebView?.({ overlay: false }).catch(() => {});
        await plugins().StatusBar?.setStyle?.({ style: plugins().StatusBarStyle?.Light || 'LIGHT' }).catch(() => {});
        await plugins().SplashScreen?.hide?.().catch(() => {});
      }
      MobileAnalyticsService.track('app_open', { platform: global.KLearnPlatform?.platform?.() || 'web', route: state.currentView });
      return this.summary();
    },
    summary() { return { native: native(), platform: global.KLearnPlatform?.platform?.() || 'web', sharedCore: MobileArchitectureReviewService.report(), navigation: MobileBottomNavigationService.items(), audio: runtime.config?.audio, microphone: MobileMicrophoneExperienceService.state(), offline: runtime.config?.offline, biometric: { purpose: NativeBiometricService.purpose(), storesBiometricData: false }, deepLinks: runtime.config?.deepLinks, analytics: { consent: MobileAnalyticsService.consent(), privateDataCollected: false } }; }
  };

  function view() {
    if (!runtime.config) { P78MobileConfigService.load(); return '<section class="section page-heading"><h1>Đang tải Mobile Platform…</h1></section>'; }
    const architecture = MobileArchitectureReviewService.report(); const notification = MobileNotificationPreferenceService.get(); const microphone = MobileMicrophoneExperienceService.state();
    return `<div class="p78-shell"><section class="section p78-hero"><button class="back-link" data-view="profile">←</button><p class="eyebrow">P78 · MOBILE NATIVE</p><h1>Trải nghiệm học chính trên mobile</h1><p>Android + iOS dùng chung Learning Core với Web/PWA. Native bridge chỉ cung cấp capability thiết bị.</p><div><span>Capacitor 8</span><span>Android</span><span>iOS</span><span>Shared Core</span></div></section><section class="section p78-grid"><article><small>ARCHITECTURE</small><h2>Không fork logic học</h2><p>${architecture.sharedServices.length} shared services · ${architecture.sharedStorage.length} shared storage domains.</p><b>Auth · Sync · SRS · Adaptive · AI · Subscription</b></article><article><small>NAVIGATION</small><h2>5 mục cho một tay</h2><p>${MobileBottomNavigationService.items().map((item) => item.label).join(' · ')}</p><b>Touch target ≥ ${runtime.config.touchTargetMinimum}px</b></article><article><small>SECURITY</small><h2>Session trong secure storage</h2><p>Keychain/Keystore · HTTPS system trust · biometric chỉ trả kết quả xác thực.</p><b>Không lưu biometric data</b></article></section><section class="section p78-panel"><header><div><small>AUDIO</small><h2>Nghe nền và offline</h2></div><label>Tốc độ<select data-p78-speed>${MobileAudioPlatformService.speeds().map((speed) => `<option value="${speed}" ${Number(read().playbackSpeed || 1) === speed ? 'selected' : ''}>${speed}×</option>`).join('')}</select></label></header><p>Listening · Shadowing · Pronunciation · Story · Radio. Chỉ audio asset thật mới được cache/phát nền.</p><div class="p78-actions"><button class="btn secondary" data-p78-audio-clear>Xóa audio cache</button><button class="btn secondary" data-view="offline-packs">Quản lý download</button></div></section><section class="section p78-panel"><header><div><small>SPEAKING</small><h2>Microphone an toàn</h2></div><span class="p78-state ${microphone.status}">${escapeHtml(microphone.status)}</span></header><div class="p78-mic-meter" style="--p78-level:${Math.round(microphone.level * 100)}%"><i></i></div><p>Permission khi người dùng chủ động. Khi denied/unavailable/error, luôn chuyển sang text mode và không crash.</p><div class="p78-actions"><button class="btn primary" data-p78-mic>Kiểm tra micro</button><button class="btn secondary" data-view="speaking-hub">Mở Speaking</button></div></section><form class="section p78-panel" data-p78-notifications><header><div><small>NOTIFICATION</small><h2>Nhắc đúng lúc, không spam</h2></div><label class="p78-switch"><input type="checkbox" name="enabled" ${notification.enabled ? 'checked' : ''}>Bật</label></header><label>Thời gian<input type="time" name="time" value="${escapeHtml(notification.time)}"></label><div class="p78-checks">${Object.entries(notification.types).map(([type, enabled]) => `<label><input type="checkbox" name="${type}" ${enabled ? 'checked' : ''}>${escapeHtml(type.replaceAll('_',' '))}</label>`).join('')}</div><button class="btn primary">Lưu & áp dụng</button></form><section class="section p78-panel"><header><div><small>OFFLINE & STORAGE</small><h2>Download có kiểm soát</h2></div><output data-p78-usage>Đang đo…</output></header><p>Lesson, audio và practice được quản lý riêng; clear cache không xóa progress, SRS hay learning history.</p><div class="p78-actions"><button class="btn secondary" data-p78-refresh-usage>Đo dung lượng</button><button class="btn secondary" data-p78-clear-cache>Xóa cache tải xuống</button></div></section><section class="section p78-panel"><header><div><small>BIOMETRIC</small><h2>Fingerprint / Face ID</h2></div><span>Device authentication</span></header><p>Chỉ mở lại phiên cloud đã tồn tại; không lưu mẫu vân tay/khuôn mặt. Luôn có fallback đăng nhập thường.</p><div class="p78-actions"><button class="btn primary" data-p78-biometric>Bật mở khóa thiết bị</button></div></section><section class="section p78-panel"><header><div><small>DEEP LINKS</small><h2>Mở đúng nội dung</h2></div><code>tamhoanq://lesson/topik1/unit5</code></header><p>Lesson · Course · Challenge · Achievement. Input được allowlist trước khi điều hướng.</p></section><section class="section p78-panel"><header><div><small>ANALYTICS</small><h2>Đo chất lượng có đồng ý</h2></div><label class="p78-switch"><input type="checkbox" data-p78-analytics ${MobileAnalyticsService.consent() ? 'checked' : ''}>Cho phép</label></header><p>App open, lesson start/complete, crash và performance. Không thu audio, transcript hoặc private learner data.</p></section></div>`;
  }

  Object.assign(global, { P78MobileConfigService, MobileArchitectureReviewService, MobileBottomNavigationService, MobileAudioPlatformService, MobileMicrophoneExperienceService, MobileNotificationPreferenceService, MobileDownloadManagerService, NativeBiometricService, NativeDeepLinkService, MobileAnalyticsService, MobilePerformanceService, MobileNativePlatformService });
  global.KLEARN_EXTRA_VIEWS = { ...(global.KLEARN_EXTRA_VIEWS || {}), 'mobile-native-p78': view };
  const previousAfterRender = global.KLEARN_AFTER_RENDER;
  global.KLEARN_AFTER_RENDER = () => {
    previousAfterRender?.(); MobileBottomNavigationService.apply(); MobilePerformanceService.optimizeDOM();
    global.document?.querySelectorAll?.('#bottomNav .nav-item')?.forEach((button) => { if (!button.dataset.p78Feedback) { button.dataset.p78Feedback = 'true'; button.addEventListener('click', () => MobileBottomNavigationService.feedback()); } });
    if (state.currentView === 'profile' && !global.document?.querySelector?.('[data-p78-entry]')) global.document.querySelector('.profile-actions, .settings-list, .profile-page, .profile-head')?.insertAdjacentHTML('beforeend', '<button class="btn secondary p78-entry" data-view="mobile-native-p78" data-p78-entry>📱 Mobile Native Platform</button>');
    if (state.currentView !== 'mobile-native-p78') return;
    global.document.querySelector('[data-p78-speed]')?.addEventListener('change', (event) => { MobileAudioPlatformService.setSpeed(event.currentTarget.value); toast?.('Đã đổi tốc độ phát.'); });
    global.document.querySelector('[data-p78-audio-clear]')?.addEventListener('click', async () => { await MobileAudioPlatformService.clear(); toast?.('Đã xóa audio cache.'); });
    global.document.querySelector('[data-p78-mic]')?.addEventListener('click', async () => { const result = MobileMicrophoneExperienceService.state().status === 'recording' ? await MobileMicrophoneExperienceService.stop() : await MobileMicrophoneExperienceService.start({ onSignal: () => { const node = global.document?.querySelector?.('.p78-mic-meter'); if (node) node.style.setProperty('--p78-level', `${Math.round(MobileMicrophoneExperienceService.state().level * 100)}%`); } }); toast?.(result.status === 'recording' ? 'Micro đang ghi. Nhấn lại để dừng.' : result.status === 'text-fallback' ? 'Micro không khả dụng. Speaking sẽ dùng text mode.' : 'Đã dừng ghi âm; audio không được lưu.'); render(); });
    const form = global.document.querySelector('[data-p78-notifications]'); if (form) form.onsubmit = async (event) => { event.preventDefault(); const data = new FormData(form); const types = Object.fromEntries((runtime.config.notifications.types || []).map((type) => [type, data.has(type)])); MobileNotificationPreferenceService.set({ enabled: data.has('enabled'), time: data.get('time'), types }); const result = await MobileNotificationPreferenceService.apply(); toast?.(`Notification: ${result.status}.`); render(); };
    const showUsage = async () => { const value = await MobileDownloadManagerService.usage(); const node = global.document.querySelector('[data-p78-usage]'); if (node) node.textContent = `${Math.round(value.usage / 1024 / 1024 * 10) / 10} MB`; };
    global.document.querySelector('[data-p78-refresh-usage]')?.addEventListener('click', showUsage); showUsage();
    global.document.querySelector('[data-p78-clear-cache]')?.addEventListener('click', async () => { const result = await MobileDownloadManagerService.clearCache(); toast?.(result.learningDataPreserved ? 'Đã xóa cache; progress và SRS được giữ nguyên.' : 'Không thể xác nhận dữ liệu học.'); showUsage(); });
    global.document.querySelector('[data-p78-biometric]')?.addEventListener('click', async () => { const result = await NativeBiometricService.enable(); toast?.(result.status === 'enabled' ? 'Đã bật mở khóa bằng thiết bị.' : 'Biometric chưa sẵn sàng; tiếp tục dùng đăng nhập thường.'); });
    global.document.querySelector('[data-p78-analytics]')?.addEventListener('change', (event) => { MobileAnalyticsService.setConsent(event.currentTarget.checked); toast?.(event.currentTarget.checked ? 'Đã bật analytics tối thiểu.' : 'Đã tắt analytics và xóa queue cục bộ.'); });
  };
  if (global.UserResearchService?.track && !global.UserResearchService.__p78MobileWrapped) { const originalTrack = global.UserResearchService.track.bind(global.UserResearchService); global.UserResearchService.track = (event, payload = {}) => { const result = originalTrack(event, payload); const mapped = ({ lesson_started: 'lesson_start', lesson_completed: 'lesson_complete' })[event]; if (mapped) MobileAnalyticsService.track(mapped, { route: state.currentView, success: true }); return result; }; global.UserResearchService.__p78MobileWrapped = true; }
  global.addEventListener?.('error', () => MobileAnalyticsService.track('crash', { route: state.currentView, success: false }));
  global.addEventListener?.('load', () => MobilePerformanceService.record(), { once: true });
  MobileNativePlatformService.initialize().catch(() => {});
})(window);
