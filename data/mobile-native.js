/* P56 native bridge. Web remains fully functional when Capacitor plugins are absent. */
(function mobileNativeModule(global) {
  'use strict';
  const app = global.KLEARN_APP;
  if (!app) return;
  const native = Boolean(global.KLearnPlatform?.isNative?.());
  const plugins = () => global.KLearnNativePlugins || {};
  const state = { initialized: false, listeners: [], pushToken: '', installationId: '' };
  const allowedRoutes = new Set(['home', 'review', 'ai-coach', 'speaking-hub', 'topik', 'offline-packs', 'daily-session']);
  const cleanRoute = (value) => allowedRoutes.has(String(value || '').replace(/^#/, '')) ? String(value).replace(/^#/, '') : 'home';
  const safeUrl = (value) => { try { const url = new URL(String(value || '')); return url.protocol === 'https:' ? url.href : ''; } catch (_) { return ''; } };
  const randomId = () => global.crypto?.randomUUID?.() || `mobile-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  async function installationId() {
    if (state.installationId) return state.installationId;
    const Preferences = plugins().Preferences;
    const saved = await Preferences?.get?.({ key: 'klearn_native_installation_id' }).catch(() => null);
    state.installationId = String(saved?.value || randomId()).slice(0, 120);
    if (!saved?.value) await Preferences?.set?.({ key: 'klearn_native_installation_id', value: state.installationId }).catch(() => {});
    return state.installationId;
  }

  const NativeAuthBridge = {
    async open(url) { const target = safeUrl(url); if (!target) throw new Error('OAuth URL không hợp lệ.'); const Browser = plugins().Browser; if (!Browser?.open) throw new Error('Native browser chưa sẵn sàng.'); await Browser.open({ url: target, presentationStyle: 'popover' }); return true; },
    async handleUrl(rawUrl) {
      let url; try { url = new URL(String(rawUrl || '')); } catch (_) { return { status: 'ignored' }; }
      if (url.protocol !== 'com.tamhoanq.korean:' || url.hostname !== 'auth' || url.pathname !== '/callback') return { status: 'ignored' };
      const code = url.searchParams.get('code');
      if (!code || code.length > 2048) return { status: 'invalid-callback' };
      const client = global.SupabaseService?.client;
      if (!client?.auth?.exchangeCodeForSession) return { status: 'auth-unavailable' };
      const result = await client.auth.exchangeCodeForSession(code);
      if (result.error) throw result.error;
      await plugins().Browser?.close?.().catch(() => {});
      return { status: 'authenticated', userId: result.data?.user?.id || null };
    }
  };

  const NativeSyncBridge = {
    async flush(reason = 'native-resume') {
      if (global.navigator?.onLine === false) return { status: 'offline' };
      const queue = await global.BackgroundSyncQueueService?.flush?.();
      const cloud = await app.CloudSyncService?.flush?.(reason);
      return { status: cloud === true ? 'synced' : app.CloudSyncService?.isConfigured?.() ? 'pending' : 'local', queue: queue || null };
    },
    checkpoint(reason = 'native-background') { global.RecoveryService?.capture?.(reason); return true; }
  };

  const NativePushService = {
    policy() { const base = global.MobileNotificationService?.policy?.() || {}; return { ...base, permission: 'user-initiated', tokenInLearningSync: false, rawNotificationStored: false }; },
    async persistRegistration(token) {
      if (!token || token !== state.pushToken) return { status: 'ignored' };
      const client = global.SupabaseService?.client; const user = global.SupabaseService?.session?.user;
      if (!client?.from || !user?.id) return { status: 'awaiting-auth' };
      const payload = { user_id: user.id, installation_id: await installationId(), platform: global.KLearnPlatform?.platform?.() || 'native', push_token: token, locale: String(global.document?.documentElement?.lang || 'vi').slice(0, 16), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', last_seen_at: new Date().toISOString(), revoked_at: null };
      const result = await client.from('mobile_push_devices').upsert(payload, { onConflict: 'user_id,installation_id' });
      if (result.error) throw result.error;
      return { status: 'registered' };
    },
    async register() {
      const Push = plugins().PushNotifications;
      if (!native || !Push?.requestPermissions) return { status: 'unsupported' };
      const permission = await Push.requestPermissions();
      if (permission.receive !== 'granted') return { status: 'denied' };
      await Push.register();
      await NativeReminderService.refresh({ requestPermission: true });
      return { status: 'registering' };
    },
    async revoke() {
      const client = global.SupabaseService?.client; const user = global.SupabaseService?.session?.user;
      if (client?.from && user?.id) await client.from('mobile_push_devices').update({ revoked_at: new Date().toISOString() }).eq('user_id', user.id).eq('installation_id', await installationId());
      state.pushToken = '';
      await plugins().PushNotifications?.unregister?.().catch(() => {});
      return { status: 'revoked' };
    }
  };

  const NativeReminderService = {
    ids: [5601, 5602],
    async refresh({ requestPermission = false } = {}) {
      const Local = plugins().LocalNotifications;
      if (!native || !Local?.schedule) return { status: 'unsupported', scheduled: 0 };
      if (requestPermission) { const permission = await Local.requestPermissions?.(); if (permission && permission.display !== 'granted') return { status: 'denied', scheduled: 0 }; }
      await Local.cancel?.({ notifications: this.ids.map((id) => ({ id })) }).catch(() => {});
      const notices = (global.MobileNotificationService?.pending?.() || []).slice(0, 2); const policy = global.MobileNotificationService?.policy?.() || { quietHours: { start: 22, end: 7 } };
      const base = new Date(); base.setSeconds(0, 0); base.setMinutes(base.getMinutes() + 10);
      if (base.getHours() >= Number(policy.quietHours?.start ?? 22) || base.getHours() < Number(policy.quietHours?.end ?? 7)) { base.setDate(base.getDate() + (base.getHours() >= 22 ? 1 : 0)); base.setHours(Number(policy.quietHours?.end ?? 7), 30, 0, 0); }
      const notifications = notices.map((notice, index) => ({ id: this.ids[index], title: 'Tiếng Hàn - TamHoanq', body: String(notice.text || 'Đến giờ học một bài ngắn.').slice(0, 160), schedule: { at: new Date(base.getTime() + index * 6 * 60 * 60 * 1000), allowWhileIdle: false }, extra: { route: cleanRoute(notice.route) }, autoCancel: true }));
      if (notifications.length) await Local.schedule({ notifications });
      return { status: 'scheduled', scheduled: notifications.length };
    }
  };

  const NativeOfflineBridge = {
    async download(packId) { const result = await global.OfflinePackService?.download?.(packId); if (!result) throw new Error('Offline pack không khả dụng.'); await this.refreshIndex(); return result; },
    async refreshIndex() { const snapshot = { version: 1, updatedAt: new Date().toISOString(), packs: (global.OfflinePackService?.metadata?.() || []).map((item) => ({ id: item.id, version: item.version, downloadedAt: item.downloadedAt })) }; await plugins().Preferences?.set?.({ key: 'klearn_offline_pack_index', value: JSON.stringify(snapshot) }).catch(() => {}); return snapshot; },
    capabilities() { return { lessons: true, vocabulary: true, practice: true, audio: 'downloaded-assets-only', learningProgressOffline: true, syncOnReconnect: true, largeDataInLearningSync: false }; }
  };

  const NativeCameraBridge = {
    async capture(mode = 'text') {
      const Camera = plugins().Camera;
      if (!native || !Camera?.getPhoto) return { status: 'text-fallback', route: 'korean-document-assistant' };
      const photo = await Camera.getPhoto({ quality: 82, allowEditing: false, resultType: 'uri', source: 'camera', saveToGallery: false, correctOrientation: true });
      if (!photo?.webPath) return { status: 'cancelled' };
      const response = await fetch(photo.webPath); const blob = await response.blob();
      const file = new File([blob], `korean-scan.${photo.format || 'jpeg'}`, { type: blob.type || 'image/jpeg' });
      const mapped = mode === 'text' ? 'document' : mode;
      const result = await global.KoreanDocumentAssistantService?.scan?.(file, mapped);
      return result || { status: 'text-fallback', persisted: false };
    }
  };

  const NativeWidgetBridge = {
    async refresh() { const value = global.MobileWidgetService?.snapshot?.() || null; if (!value) return { status: 'unavailable' }; const safe = { generatedAt: value.generatedAt, today: value.today, review: value.review, containsPrivateContent: false }; await plugins().Preferences?.set?.({ key: 'klearn_widget_snapshot', value: JSON.stringify(safe) }).catch(() => {}); return { status: 'updated', snapshot: safe }; }
  };

  const NativeMobileBridge = {
    available: () => native && Boolean(global.KLearnNativePlugins),
    openAuth: (url) => NativeAuthBridge.open(url),
    summary: () => ({ native, platform: global.KLearnPlatform?.platform?.() || 'web', apiConfigured: Boolean(global.KLearnPlatform?.apiBaseUrl?.()), auth: 'supabase-pkce-deep-link', offline: NativeOfflineBridge.capabilities(), push: NativePushService.policy(), backgroundAudio: 'media-session-plus-native-audio-session', camera: 'temporary-on-device', widget: 'privacy-safe-snapshot' }),
    async initialize() {
      if (!this.available() || state.initialized) return this.summary();
      state.initialized = true; await installationId();
      const { App, Network, PushNotifications: Push } = plugins();
      if (App?.addListener) {
        state.listeners.push(await App.addListener('appUrlOpen', ({ url }) => NativeAuthBridge.handleUrl(url).catch(() => {})));
        state.listeners.push(await App.addListener('appStateChange', ({ isActive }) => isActive ? NativeSyncBridge.flush('native-resume').then(() => NativeWidgetBridge.refresh()).catch(() => {}) : NativeSyncBridge.checkpoint('native-background')));
      }
      if (Network?.addListener) state.listeners.push(await Network.addListener('networkStatusChange', ({ connected }) => { if (connected) NativeSyncBridge.flush('native-network-restored').catch(() => {}); }));
      if (Push?.addListener) {
        state.listeners.push(await Push.addListener('registration', ({ value }) => { state.pushToken = String(value || '').slice(0, 4096); NativePushService.persistRegistration(state.pushToken).catch(() => {}); }));
        state.listeners.push(await Push.addListener('registrationError', (error) => global.ProductionMonitoringService?.captureError?.({ type: 'api', module: 'native-push', message: error?.error || 'push-registration' })));
        state.listeners.push(await Push.addListener('pushNotificationActionPerformed', ({ notification }) => app.setView?.(cleanRoute(notification?.data?.route))));
      }
      global.addEventListener?.('klearn-cloud-auth', () => { if (state.pushToken) NativePushService.persistRegistration(state.pushToken).catch(() => {}); });
      await NativeWidgetBridge.refresh();
      return this.summary();
    }
  };

  Object.assign(global, { NativeMobileBridge, NativeAuthBridge, NativeSyncBridge, NativePushService, NativeReminderService, NativeOfflineBridge, NativeCameraBridge, NativeWidgetBridge });
  NativeMobileBridge.initialize().catch((error) => global.ProductionMonitoringService?.captureError?.({ type: 'frontend', module: 'native-mobile', message: error?.message || 'native-init' }));
})(window);
