/* P34 — security, privacy and account control foundation. */
(() => {
  'use strict';
  const global = window;
  const app = global.KLEARN_APP;
  if (!app) return;
  const { storage, state, STORAGE_KEYS, CloudSyncService, PrivacyPreferenceService: CorePrivacyPreferenceService, userScoped, saveUserScoped, getUserProgress, getUserSrs, NotesService, VocabularyService, escapeHtml, render, toast } = app;
  const now = () => new Date().toISOString();
  const uid = () => state.currentUser?.id || '';
  const clean = (value, limit = 400) => String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, limit);
  const object = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const array = (value) => Array.isArray(value) ? value : [];
  const key = (name, fallback) => STORAGE_KEYS?.[name] || fallback;
  const privacyKey = key('privacyPreferences', 'klearn_privacy_preferences');
  const deviceKey = key('deviceRegistry', 'klearn_device_registry');
  const auditKey = key('securityAudit', 'klearn_security_audit');
  const memory = (storeKey) => object(storage?.get?.(storeKey, {}));
  const localUser = (storeKey) => memory(storeKey)[uid()];
  const putLocalUser = (storeKey, value) => { if (!uid() || !storage?.set) return value; const all = memory(storeKey); all[uid()] = value; storage.set(storeKey, all); return value; };
  const supportedProviders = new Set(['google', 'apple']);
  const authClient = () => global.SupabaseService?.client;
  const cloudSession = () => global.SupabaseService?.session?.user || null;
  const redirectUrl = () => `${global.location?.origin || ''}${global.location?.pathname || '/'}`;

  const SecurityAuthService = {
    providers() { return ['google', 'apple', 'passwordless']; },
    async signInWithProvider(provider) { const value = clean(provider, 20).toLowerCase(); if (!supportedProviders.has(value)) throw new Error('Provider đăng nhập chưa được hỗ trợ.'); const client = authClient(); if (!client?.auth?.signInWithOAuth) throw new Error('Cloud Auth chưa được cấu hình.'); return client.auth.signInWithOAuth({ provider: value, options: { redirectTo: redirectUrl() } }); },
    async requestPasswordless(email) { const address = clean(email, 160).toLowerCase(); if (!/^\S+@\S+\.\S+$/.test(address)) throw new Error('Email passwordless chưa hợp lệ.'); const client = authClient(); if (!client?.auth?.signInWithOtp) throw new Error('Cloud Auth chưa được cấu hình.'); return client.auth.signInWithOtp({ email: address, options: { emailRedirectTo: redirectUrl() } }); },
    async factors() { const client = authClient(); if (!client?.auth?.mfa?.listFactors) return { all: [], verified: [], status: 'unavailable' }; const result = await client.auth.mfa.listFactors(); if (result.error) throw result.error; return { ...result.data, status: 'ready' }; },
    async enroll({ friendlyName = 'TamHoanq device' } = {}) { const client = authClient(); if (!client?.auth?.mfa?.enroll) throw new Error('MFA chưa được bật trong Supabase Auth.'); const result = await client.auth.mfa.enroll({ factorType: 'totp', friendlyName: clean(friendlyName, 80) }); if (result.error) throw result.error; return result.data; },
    async challengeAndVerify(factorId, code) { const client = authClient(); if (!client?.auth?.mfa?.challenge || !client?.auth?.mfa?.verify) throw new Error('MFA chưa được bật trong Supabase Auth.'); const challenge = await client.auth.mfa.challenge({ factorId: clean(factorId, 120) }); if (challenge.error) throw challenge.error; const result = await client.auth.mfa.verify({ factorId: clean(factorId, 120), challengeId: challenge.data.id, code: clean(code, 20) }); if (result.error) throw result.error; return result.data; },
    async unenroll(factorId) { const client = authClient(); if (!client?.auth?.mfa?.unenroll) throw new Error('MFA chưa được bật trong Supabase Auth.'); const result = await client.auth.mfa.unenroll({ factorId: clean(factorId, 120) }); if (result.error) throw result.error; return result.data; }
  };

  const PrivacyCenterService = {
    defaults() { return { cloudSync: true, aiUsage: true, telemetry: false, preciseLocation: false, updatedAt: null }; },
    get() { return CorePrivacyPreferenceService?.get?.() || { ...this.defaults(), ...object(localUser(privacyKey)) }; },
    update(changes = {}) { const previous = this.get(); const next = CorePrivacyPreferenceService?.update?.(changes) || { ...previous, ...Object.fromEntries(['cloudSync', 'aiUsage', 'telemetry', 'preciseLocation'].filter((field) => changes[field] !== undefined).map((field) => [field, Boolean(changes[field])])), updatedAt: now() }; if (!CorePrivacyPreferenceService) putLocalUser(privacyKey, next); const client = authClient(); const table = client?.from?.('user_privacy_preferences'); if (table?.upsert && cloudSession()) table.upsert({ user_id: cloudSession().id, cloud_sync_enabled: next.cloudSync, ai_usage_enabled: next.aiUsage, telemetry_enabled: next.telemetry, precise_location_enabled: next.preciseLocation, updated_at: next.updatedAt }).then(() => {}, () => {}); if (next.cloudSync && changes.cloudSync !== false) CloudSyncService?.schedule?.('privacy-preferences'); return next; },
    summary() { const value = this.get(); return { ...value, storedLocally: true, cloudLinked: Boolean(cloudSession()), aiContext: value.aiUsage ? 'enabled-by-choice' : 'disabled', telemetry: value.telemetry ? 'enabled-by-choice' : 'off' }; }
  };

  const deviceFingerprint = () => { const source = `${global.navigator?.userAgent || 'browser'}|${global.screen?.width || 0}x${global.screen?.height || 0}`; let hash = 0; for (const char of source) hash = (hash << 5) - hash + char.charCodeAt(0) | 0; return `device-${Math.abs(hash).toString(36)}`; };
  const DeviceManagementService = {
    list() { return array(localUser(deviceKey)); },
    registerCurrent(input = {}) { if (!uid()) return null; const id = deviceFingerprint(); const list = this.list(); const entry = { id, label: clean(input.label || 'Trình duyệt hiện tại', 80), lastSeenAt: now(), locationHint: PrivacyCenterService.get().preciseLocation ? clean(input.locationHint || 'unknown', 80) : null, current: true, revokedAt: null }; putLocalUser(deviceKey, [entry, ...list.filter((item) => item.id !== id)].slice(0, 10)); return entry; },
    async logout(id = '') { const target = this.list().find((item) => item.id === clean(id, 120)); if (!target) return false; putLocalUser(deviceKey, this.list().map((item) => item.id === target.id ? { ...item, revokedAt: now(), current: false } : item)); if (target.current) await global.AuthService?.signOut?.(); return true; },
    async logoutAll() { putLocalUser(deviceKey, this.list().map((item) => ({ ...item, revokedAt: item.revokedAt || now(), current: false }))); const client = authClient(); if (client?.auth?.signOut) await client.auth.signOut({ scope: 'global' }); return true; }
  };

  const safeHistory = () => array(userScoped?.(STORAGE_KEYS?.practiceHistory || 'klearn_practice_history')).slice(0, 500).map((item) => ({ id: item.id, setId: item.setId, completedAt: item.completedAt, percentage: item.percentage, score: item.score, total: item.total, skillBreakdown: item.skillBreakdown }));
  const exportPayload = () => ({ schemaVersion: 1, exportedAt: now(), user: { id: uid(), level: state.currentUser?.level || null, goals: array(state.currentUser?.goals) }, progress: getUserProgress?.() || {}, vocabulary: array(getUserSrs?.() || []).map((item) => ({ wordId: item.wordId || item.id, korean: item.korean, meaning: item.meaning, mastery: item.mastery, status: item.status, nextReview: item.nextReview })), learningHistory: safeHistory(), notes: array(NotesService?.all?.()).map((item) => ({ sourceType: item.sourceType, sourceId: item.sourceId, content: item.content, updatedAt: item.updatedAt })), privacy: { passwords: false, tokens: false, secrets: false } });
  const csv = (rows) => { const list = array(rows); if (!list.length) return ''; const columns = [...new Set(list.flatMap((row) => Object.keys(object(row))))]; const escape = (value) => `"${String(value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : value).replace(/"/g, '""')}"`; return [columns.join(','), ...list.map((row) => columns.map((column) => escape(row[column])).join(','))].join('\n'); };
  const DataExportService = {
    payload() { return exportPayload(); },
    format(type = 'json') { const value = exportPayload(); if (type === 'csv') { const progressRows = Object.entries(object(value.progress)).map(([field, entry]) => ({ section: 'progress', field, value: typeof entry === 'object' ? JSON.stringify(entry) : entry })); const historyRows = value.learningHistory.map((entry) => ({ section: 'learningHistory', ...entry })); const vocabularyRows = value.vocabulary.map((entry) => ({ section: 'vocabulary', ...entry })); return csv([...progressRows, ...historyRows, ...vocabularyRows]); } if (type === 'pdf') return JSON.stringify(value, null, 2); return JSON.stringify(value, null, 2); },
    download(type = 'json') { const safeType = ['json', 'csv', 'pdf'].includes(type) ? type : 'json'; const value = this.format(safeType); if (safeType === 'pdf') { global.print?.(); return { format: 'pdf', status: 'print-dialog', value }; } if (global.document && global.Blob && global.URL?.createObjectURL) { const blob = new Blob([value], { type: safeType === 'csv' ? 'text/csv' : 'application/json' }); const link = global.document.createElement('a'); link.href = global.URL.createObjectURL(blob); link.download = `tamhoanq-learning-export-${new Date().toISOString().slice(0, 10)}.${safeType}`; link.click(); global.URL.revokeObjectURL(link.href); } return { format: safeType, status: 'downloaded', value }; }
  };

  const AuditLogService = {
    local() { return array(localUser(auditKey)); },
    record({ event = 'security_event', target = '', metadata = {} } = {}) { const safe = { event: clean(event, 80), target: clean(target, 120), metadata: Object.fromEntries(Object.entries(object(metadata)).filter(([key]) => !/(password|token|secret|key|cookie|message|content)/i.test(key)).slice(0, 12).map(([key, value]) => [clean(key, 40), clean(value, 120)])), actorId: uid(), createdAt: now() }; if (uid()) putLocalUser(auditKey, [safe, ...this.local()].slice(0, 100)); const client = authClient(); if (client?.from && cloudSession()) client.from('security_audit_logs').insert({ actor_id: cloudSession().id, event: safe.event, target: safe.target, metadata: safe.metadata }).then(() => {}, () => {}); return safe; },
    all() { return this.local(); }
  };

  const RolePermissionService = {
    roles() { return ['student', 'teacher', 'admin', 'content_editor']; },
    role() { const role = clean(cloudSession()?.app_metadata?.role || cloudSession()?.user_metadata?.role || 'student', 40).toLowerCase(); return role === 'reviewer' ? 'content_editor' : this.roles().includes(role) ? role : 'student'; },
    permissions() { return { student: ['learn', 'export_own_data', 'manage_privacy'], teacher: ['learn', 'export_own_data', 'manage_privacy', 'review_students'], content_editor: ['learn', 'export_own_data', 'manage_privacy', 'review_content'], admin: ['learn', 'export_own_data', 'manage_privacy', 'review_students', 'review_content', 'view_audit', 'view_system'] }; },
    can(action) { return this.permissions()[this.role()]?.includes(action) || false; }
  };

  const AccountDeletionService = {
    async request({ confirmation = '' } = {}) { if (confirmation !== 'DELETE MY ACCOUNT') return { status: 'confirmation-required' }; const request = { id: `deletion-${Date.now()}`, requestedAt: now(), cloudUserId: cloudSession()?.id || null, status: 'pending-backend-deletion' }; putLocalUser('klearn_deletion_requests', request); AuditLogService.record({ event: 'account_deletion_requested', target: request.cloudUserId || 'local-account' }); const client = authClient(); if (client?.from && cloudSession()) { const result = await client.from('privacy_deletion_requests').insert({ user_id: cloudSession().id, requested_at: request.requestedAt }); if (result.error) return { ...request, status: 'request-failed', error: clean(result.error.message, 160) }; } return request; },
    wipeLocal() { if (!uid()) return false; const users = array(storage.get(STORAGE_KEYS?.users || 'klearn_users', [])); const next = users.filter((user) => user.id !== uid()); storage.set(STORAGE_KEYS?.users || 'klearn_users', next); storage.set(STORAGE_KEYS?.session || 'klearn_session', null); return true; }
  };

  const SecurityScannerService = {
    scanConfig() { const suspicious = []; const config = object(global.KLEARN_PUBLIC_CONFIG); Object.keys(config).forEach((keyName) => { if (/(secret|private|service.?role|password|token)/i.test(keyName)) suspicious.push(keyName); }); return { status: suspicious.length ? 'review' : 'pass', secretLeak: suspicious.length ? 'review' : 'pass', exposedKeys: suspicious, dependencyVulnerability: 'ci-required', apiExposure: 'public-config-only', checkedAt: now() }; },
    scan() { const result = this.scanConfig(); AuditLogService.record({ event: 'security_scan', metadata: { status: result.status, dependency: result.dependencyVulnerability } }); return result; }
  };

  const privacyPanel = () => { if (!state.currentUser || state.currentView !== 'profile') return ''; const privacy = PrivacyCenterService.summary(); const devices = DeviceManagementService.registerCurrent(); return `<section class="card section p34-privacy-panel" data-p34-privacy><div class="section-heading"><div><p class="eyebrow">P34 · PRIVACY CENTER</p><h2 class="section-title">Bảo mật & dữ liệu</h2></div><span class="sync-status">${privacy.cloudLinked ? 'Cloud linked' : 'Local-first'}</span></div><p class="subtle">Bạn kiểm soát cloud sync, AI usage và telemetry. Không thu thập vị trí chính xác.</p><div class="p34-privacy-grid"><label><input type="checkbox" data-p34-pref="cloudSync" ${privacy.cloudSync ? 'checked' : ''}> Cloud Sync</label><label><input type="checkbox" data-p34-pref="aiUsage" ${privacy.aiUsage ? 'checked' : ''}> AI usage</label><label><input type="checkbox" data-p34-pref="telemetry" ${privacy.telemetry ? 'checked' : ''}> Telemetry</label></div><div class="p34-security-actions"><button class="btn secondary" data-p34-oauth="google">Đăng nhập Google</button><button class="btn secondary" data-p34-oauth="apple">Đăng nhập Apple</button><form data-p34-passwordless><input name="email" type="email" placeholder="Email passwordless" required><button class="btn secondary" type="submit">Gửi magic link</button></form><button class="btn secondary" data-p34-mfa>Thiết lập 2FA</button></div><div class="action-row"><button class="btn secondary" data-p34-export="json">Tải JSON</button><button class="btn secondary" data-p34-export="csv">Tải CSV</button><button class="btn secondary" data-p34-export="pdf">In PDF</button></div><p class="subtle">Thiết bị hiện tại: ${escapeHtml(devices?.label || 'Trình duyệt')} · ${escapeHtml(devices?.lastSeenAt || '')}</p><div class="p34-device-list">${DeviceManagementService.list().map((device) => `<span>${escapeHtml(device.label)} · ${escapeHtml(device.lastSeenAt)} <button class="link-button" data-p34-device-logout="${escapeHtml(device.id)}">Đăng xuất</button></span>`).join('')}</div></section>`; };

  Object.assign(global, { SecurityAuthService, PrivacyCenterService, DeviceManagementService, DataExportService, AccountDeletionService, AuditLogService, RolePermissionService, SecurityScannerService });
  const previousAfterRender = global.KLEARN_AFTER_RENDER;
  global.KLEARN_AFTER_RENDER = () => { previousAfterRender?.(); if (!global.document || !state.currentUser || state.currentView !== 'profile' || global.document.querySelector('[data-p34-privacy]')) return; global.document.getElementById('app')?.insertAdjacentHTML('afterbegin', privacyPanel()); global.document.querySelectorAll('[data-p34-pref]').forEach((input) => { input.onchange = () => { PrivacyCenterService.update({ [input.dataset.p34Pref]: input.checked }); AuditLogService.record({ event: 'privacy_preference_updated', target: input.dataset.p34Pref, metadata: { enabled: input.checked } }); }; }); global.document.querySelectorAll('[data-p34-export]').forEach((button) => { button.onclick = () => DataExportService.download(button.dataset.p34Export); }); global.document.querySelectorAll('[data-p34-oauth]').forEach((button) => { button.onclick = async () => { try { await SecurityAuthService.signInWithProvider(button.dataset.p34Oauth); } catch (error) { toast?.(clean(error.message || 'OAuth chưa sẵn sàng', 160)); } }; }); global.document.querySelector('[data-p34-passwordless]')?.addEventListener('submit', async (event) => { event.preventDefault(); try { await SecurityAuthService.requestPasswordless(new FormData(event.currentTarget).get('email')); toast?.('Đã gửi magic link nếu email hợp lệ.'); } catch (error) { toast?.(clean(error.message || 'Passwordless chưa sẵn sàng', 160)); } }); global.document.querySelector('[data-p34-mfa]')?.addEventListener('click', async () => { try { await SecurityAuthService.enroll(); toast?.('Đã tạo secret 2FA. Hãy hoàn tất verify trong Auth flow.'); } catch (error) { toast?.(clean(error.message || 'MFA chưa sẵn sàng', 160)); } }); global.document.querySelectorAll('[data-p34-device-logout]').forEach((button) => { button.onclick = async () => { await DeviceManagementService.logout(button.dataset.p34DeviceLogout); render?.(); }; }); };
  if (uid()) DeviceManagementService.registerCurrent();
})();
