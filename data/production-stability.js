/* P33 — production observability, recovery and offline resilience. */
(() => {
  'use strict';
  const global = window;
  const app = global.KLEARN_APP;
  if (!app) return;
  const { storage, state, STORAGE_KEYS, CloudSyncService, getUserProgress, saveUserProgress, getUserSrs, saveUserSrs, userScoped, saveUserScoped, render, escapeHtml, AccessControlService } = app;
  const now = () => new Date().toISOString();
  const uid = () => state.currentUser?.id || 'anonymous';
  const clean = (value, limit = 240) => String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, limit);
  const object = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const array = (value) => Array.isArray(value) ? value : [];
  const key = (name, fallback) => STORAGE_KEYS?.[name] || fallback;
  const telemetryKey = key('productionTelemetry', 'klearn_production_telemetry');
  const queueKey = key('backgroundSyncQueue', 'klearn_background_sync_queue');
  const backupKey = key('learningBackups', 'klearn_learning_backups');
  const checkpointKey = key('recoveryCheckpoint', 'klearn_recovery_checkpoint');
  const telemetryAllowed = () => app.PrivacyPreferenceService?.allows?.('telemetry') !== false;
  const hash = (value) => { let h = 2166136261; for (const char of String(value)) { h ^= char.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
  const readUser = (storeKey, fallback) => object(storage?.get?.(storeKey, {}))[uid()] ?? fallback;
  const writeUser = (storeKey, value) => { if (!storage?.get || !storage?.set || uid() === 'anonymous') return value; const all = object(storage.get(storeKey, {})); all[uid()] = value; storage.set(storeKey, all); return value; };
  const safeError = (input = {}) => {
    const error = input.error instanceof Error ? input.error : object(input.error);
    const type = ['frontend', 'backend', 'api', 'database', 'ai', 'sync', 'cache', 'unknown'].includes(input.type) ? input.type : 'frontend';
    const module = clean(input.module || input.source || 'app', 80).replace(/[^\w./:-]/g, '_') || 'app';
    const code = clean(input.code || error.code || input.status || '', 40);
    const message = clean(input.message || error.message || 'Unexpected error', 180).replace(/(password|token|secret|api[_ -]?key|authorization)\s*[:=]?\s*\S+/ig, '$1:[redacted]');
    const fingerprint = hash(`${type}|${module}|${code}|${message}`);
    return { fingerprint, type, module, code, message, timestamp: now() };
  };
  const defaultTelemetry = () => ({ version: 1, errors: [], performance: [], updatedAt: now() });
  const readTelemetry = () => { const value = readUser(telemetryKey, defaultTelemetry()); return { ...defaultTelemetry(), ...object(value), errors: array(value.errors), performance: array(value.performance) }; };
  const saveTelemetry = (value) => writeUser(telemetryKey, { ...value, version: 1, updatedAt: now(), errors: array(value.errors).slice(0, 100), performance: array(value.performance).slice(0, 100) });

  const ProductionMonitoringService = {
    captureError(input = {}) {
      if (!telemetryAllowed()) return null;
      const event = safeError(input); const telemetry = readTelemetry(); const existing = telemetry.errors.find((item) => item.fingerprint === event.fingerprint);
      if (existing) { existing.frequency = Math.max(1, Number(existing.frequency || 1) + 1); existing.timestamp = event.timestamp; existing.message = event.message; }
      else telemetry.errors.unshift({ ...event, frequency: 1 });
      saveTelemetry(telemetry); return existing || telemetry.errors[0];
    },
    recordPerformance(input = {}) {
      if (!telemetryAllowed()) return null;
      const duration = Math.max(0, Math.round(Number(input.durationMs ?? input.duration ?? 0))); const module = clean(input.module || input.type || 'page', 80); const type = ['page_load', 'api', 'database', 'ai', 'cache', 'sync'].includes(input.type) ? input.type : 'page_load'; const status = clean(input.status || 'ok', 30);
      const telemetry = readTelemetry(); const keyValue = `${type}|${module}`; const existing = telemetry.performance.find((item) => item.key === keyValue);
      if (existing) { existing.count += 1; existing.totalMs += duration; existing.lastMs = duration; existing.maxMs = Math.max(existing.maxMs, duration); existing.statuses[status] = Number(existing.statuses[status] || 0) + 1; }
      else telemetry.performance.unshift({ key: keyValue, type, module, count: 1, totalMs: duration, lastMs: duration, maxMs: duration, statuses: { [status]: 1 }, updatedAt: now() });
      saveTelemetry(telemetry); return telemetry.performance.find((item) => item.key === keyValue);
    },
    recordApi(input = {}) { const endpoint = clean(input.endpoint || input.url || 'unknown', 160).replace(/^https?:\/\/[^/]+/i, ''); const module = /\/api\/chat|chat/i.test(endpoint) ? 'ai' : /supabase|rest\/v1/i.test(endpoint) ? 'database' : 'api'; if (Number(input.status || 0) >= 400) this.captureError({ type: module === 'ai' ? 'ai' : 'api', module, code: input.status, message: `${module} request failed` }); return this.recordPerformance({ type: module, module: endpoint || module, durationMs: input.durationMs, status: Number(input.status || 0) >= 400 ? 'error' : 'ok' }); },
    snapshot() { const telemetry = readTelemetry(); const errors = telemetry.errors.map((item) => ({ type: item.type, module: item.module, code: item.code, message: item.message, frequency: item.frequency, timestamp: item.timestamp })); const performance = telemetry.performance.map((item) => ({ type: item.type, module: item.module, count: item.count, averageMs: item.count ? Math.round(item.totalMs / item.count) : 0, lastMs: item.lastMs, maxMs: item.maxMs, errorCount: Number(item.statuses?.error || 0) })); return { errors, performance, errorCount: errors.reduce((sum, item) => sum + Number(item.frequency || 0), 0), updatedAt: telemetry.updatedAt, privacy: { rawStack: false, rawPayload: false, secrets: false } }; },
    clearLocal() { if (uid() !== 'anonymous') writeUser(telemetryKey, defaultTelemetry()); }
  };

  const RecoveryService = {
    capture() {
      if (uid() === 'anonymous') return null;
      const snapshot = { version: 1, userId: uid(), capturedAt: now(), view: clean(state.currentView || 'home', 80), practiceSession: state.practiceSession || null, progress: getUserProgress?.() || {}, srs: getUserSrs?.() || [], profile: object(storage.get(key('learnerProfile', 'klearn_learner_profile'), {}))[uid()] || null, settings: object(storage.get(key('settings', 'klearn_settings'), {})).users?.[uid()] || null };
      writeUser(checkpointKey, snapshot); return snapshot;
    },
    latest() { return readUser(checkpointKey, null); },
    restore(snapshot = this.latest()) {
      if (!snapshot || snapshot.userId !== uid()) return { restored: false, reason: 'no-checkpoint' };
      if (snapshot.practiceSession) state.practiceSession = snapshot.practiceSession; if (snapshot.progress) saveUserProgress?.(snapshot.progress); if (Array.isArray(snapshot.srs)) saveUserSrs?.(snapshot.srs);
      if (snapshot.profile) { const profileKey = key('learnerProfile', 'klearn_learner_profile'); const all = object(storage.get(profileKey, {})); all[uid()] = snapshot.profile; storage.set(profileKey, all); }
      if (snapshot.settings) { const settingsKey = key('settings', 'klearn_settings'); const all = object(storage.get(settingsKey, {})); all.users = { ...object(all.users), [uid()]: snapshot.settings }; storage.set(settingsKey, all); }
      CloudSyncService?.schedule?.('recovery-restore'); render?.(); return { restored: true, capturedAt: snapshot.capturedAt };
    }
  };

  const BackupService = {
    payload() { const checkpoint = RecoveryService.capture(); return checkpoint ? { ...checkpoint, backupId: `backup-${Date.now()}` } : null; },
    create(period = 'daily', reference = new Date()) { const safePeriod = ['daily', 'weekly'].includes(period) ? period : 'daily'; const payload = this.payload(); if (!payload) return null; const all = object(storage.get(backupKey, {})); const list = array(all[uid()]); const weekKey = `${reference.getUTCFullYear()}-W${String(Math.ceil((reference.getUTCDate() + new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), 1)).getUTCDay()) / 7)).padStart(2, '0')}`; const entry = { ...payload, period: safePeriod, weekKey }; all[uid()] = [entry, ...list].filter((item, index, rows) => rows.findIndex((candidate) => candidate.period === item.period && (candidate.period === 'weekly' ? candidate.weekKey === item.weekKey : String(candidate.capturedAt).slice(0, 10) === String(item.capturedAt).slice(0, 10))) === index).sort((a, b) => String(b.capturedAt).localeCompare(String(a.capturedAt))).slice(0, safePeriod === 'daily' ? 14 : 12); storage.set(backupKey, all); return entry; },
    run(reference = new Date()) { const last = array(object(storage.get(backupKey, {}))[uid()]); const date = reference.toISOString().slice(0, 10); const weekKey = `${reference.getUTCFullYear()}-W${String(Math.ceil((reference.getUTCDate() + new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), 1)).getUTCDay()) / 7)).padStart(2, '0')}`; const hasDaily = last.some((item) => item.period === 'daily' && String(item.capturedAt).slice(0, 10) === date); const hasWeekly = last.some((item) => item.period === 'weekly' && item.weekKey === weekKey); return { daily: hasDaily ? null : this.create('daily', reference), weekly: hasWeekly ? null : this.create('weekly', reference) }; },
    all() { return array(object(storage.get(backupKey, {}))[uid()]); }
  };

  const queueAliases = Object.freeze({ updated_vocabulary: 'vocabulary_updated', finished_quiz: 'practice_completed' });
  const allowedQueueActions = new Set(['completed_lesson', 'vocabulary_updated', 'srs_updated', 'mastery_updated', 'practice_completed']);
  const BackgroundSyncQueueService = {
    all() { return array(userScoped?.(queueKey)); },
    enqueue(input = {}) { const requestedType = clean(input.type, 40); const type = queueAliases[requestedType] || requestedType; if (!allowedQueueActions.has(type) || !uid() || uid() === 'anonymous') return null; const entityId = clean(input.entityId || input.lessonId || input.wordId || input.quizId, 100); if (!entityId) return null; const mutationId = clean(input.mutationId || input.id || `${type}:${uid()}:${entityId}:${Date.now().toString(36)}`, 180); const existing = this.all().find((entry) => entry.mutationId === mutationId || entry.id === mutationId); if (existing) return existing; const item = { id: mutationId, mutationId, type, entityId, status: clean(input.status || 'pending', 30), score: Number.isFinite(Number(input.score)) ? Number(input.score) : null, queuedAt: now() }; saveUserScoped?.(queueKey, [item, ...this.all()].slice(0, 100), 100); return item; },
    async flush() { const items = this.all(); if (!items.length || global.navigator?.onLine === false) return { flushed: 0, pending: items.length, status: 'offline' }; if (!CloudSyncService?.isConfigured?.()) return { flushed: 0, pending: items.length, status: 'local' }; try { const synced = await CloudSyncService.flush?.('background-queue'); if (synced !== true) return { flushed: 0, pending: items.length, status: 'error' }; saveUserScoped?.(queueKey, [], 100); return { flushed: items.length, pending: 0, status: 'synced' }; } catch (error) { ProductionMonitoringService.captureError({ type: 'sync', module: 'background-queue', error }); return { flushed: 0, pending: items.length, status: 'error' }; } },
    pending() { return this.all().length; }
  };

  function updateConnectivityBanner() {
    const banner = global.document?.getElementById?.('connectivityBanner'); if (!banner) return;
    const offline = global.navigator?.onLine === false; const pending = BackgroundSyncQueueService.pending();
    banner.classList.toggle('hidden', !offline);
    banner.innerHTML = offline ? `<strong>Đang học ngoại tuyến</strong><span>Bài học cốt lõi, luyện tập và SRS vẫn dùng được · ${pending} thay đổi chờ đồng bộ</span>` : '';
  }

  const ProductionCacheService = {
    isPublicRequest(request, url = '') { const target = String(url || request?.url || ''); const headers = request?.headers; if (headers?.has?.('authorization') || /\/api\/|supabase|private|user-data/i.test(target)) return false; return request?.method === 'GET' || !request?.method; },
    policy() { return { strategy: 'app-shell-cache-first-content-stale-while-revalidate-navigation-network-first', publicAssetsOnly: true, privateDataCached: false, audio: 'cacheable-public-only', lesson: 'cacheable-public-only', vocabulary: 'cacheable-public-only' }; }
  };

  const HealthCheckService = {
    async check() { const start = Date.now(); try { const response = await global.fetch('/api/health', { cache: 'no-store', headers: { Accept: 'application/json' } }); const value = await response.json().catch(() => ({})); return { ...value, frontend: 'ok', latencyMs: Date.now() - start }; } catch (error) { ProductionMonitoringService.captureError({ type: 'api', module: 'health', error }); return { status: 'degraded', backend: 'unreachable', frontend: 'ok', database: 'unknown', ai: 'unknown', latencyMs: Date.now() - start }; } }
  };

  const monitoringPanel = () => { if (state.currentView !== 'admin-analytics' || AccessControlService?.role?.() !== 'admin') return ''; const value = ProductionMonitoringService.snapshot(); const queue = BackgroundSyncQueueService.pending(); const backups = BackupService.all().length; return `<section class="card section p33-status-panel" data-p33-status><div class="section-heading"><div><p class="eyebrow">P33 · PRODUCTION STABILITY</p><h2 class="section-title">System status</h2></div><span class="sync-status">Local telemetry</span></div><div class="stats stats-four"><div class="stat"><b>${value.errorCount}</b><small>Error events</small></div><div class="stat"><b>${value.performance.length}</b><small>Performance metrics</small></div><div class="stat"><b>${queue}</b><small>Sync pending</small></div><div class="stat"><b>${backups}</b><small>Backups</small></div></div><p class="subtle">Không hiển thị stack trace, payload riêng tư hoặc secret. Aggregate production backend được đọc qua RLS admin.</p></section>`; };

  Object.assign(global, { ProductionMonitoringService, RecoveryService, BackupService, BackgroundSyncQueueService, ProductionCacheService, HealthCheckService });
  if (typeof global.addEventListener === 'function') {
    global.addEventListener('error', (event) => ProductionMonitoringService.captureError({ type: 'frontend', module: event?.filename || 'window', message: event?.message || 'Unhandled error' }));
    global.addEventListener('unhandledrejection', (event) => ProductionMonitoringService.captureError({ type: 'frontend', module: 'promise', error: event?.reason }));
    global.addEventListener('online', () => { BackgroundSyncQueueService.flush().finally(updateConnectivityBanner); updateConnectivityBanner(); });
    global.addEventListener('offline', updateConnectivityBanner);
    global.addEventListener('klearn-sync-action', (event) => { BackgroundSyncQueueService.enqueue(event?.detail || {}); updateConnectivityBanner(); });
    global.addEventListener('pagehide', () => { RecoveryService.capture(); BackupService.run(); });
  }
  if (telemetryAllowed() && global.performance?.getEntriesByType) { const navigation = global.performance.getEntriesByType('navigation')[0]; if (navigation?.duration) ProductionMonitoringService.recordPerformance({ type: 'page_load', module: 'navigation', durationMs: navigation.duration }); }
  if (typeof global.fetch === 'function' && !global.fetch.__klearnProductionWrapped) {
    const originalFetch = global.fetch.bind(global);
    const wrappedFetch = async (...args) => { const started = Date.now(); const request = args[0]; const endpoint = typeof request === 'string' ? request : request?.url || ''; try { const response = await originalFetch(...args); ProductionMonitoringService.recordApi({ endpoint, status: response.status, durationMs: Date.now() - started }); return response; } catch (error) { ProductionMonitoringService.captureError({ type: /\/api\/chat/i.test(endpoint) ? 'ai' : 'api', module: endpoint || 'fetch', error }); ProductionMonitoringService.recordPerformance({ type: 'api', module: endpoint || 'fetch', durationMs: Date.now() - started, status: 'error' }); throw error; } };
    wrappedFetch.__klearnProductionWrapped = true; global.fetch = wrappedFetch;
  }
  const previousAfterRender = global.KLEARN_AFTER_RENDER;
  global.KLEARN_AFTER_RENDER = () => { previousAfterRender?.(); if (!global.document || !state.currentUser || state.currentView !== 'admin-analytics' || AccessControlService?.role?.() !== 'admin' || global.document.querySelector('[data-p33-status]')) return; global.document.getElementById('app')?.insertAdjacentHTML('beforeend', monitoringPanel()); };
  if (state.currentUser) { RecoveryService.capture(); BackupService.run(); }
  updateConnectivityBanner();
  if (typeof global.setInterval === 'function') global.setInterval(() => { if (state.currentUser) { RecoveryService.capture(); BackupService.run(); } }, 60 * 60 * 1000);
})();
