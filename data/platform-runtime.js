/* Shared web/native endpoint and deep-link policy. Never place credentials in runtime config. */
(() => {
  'use strict';
  const raw = window.__KLEARN_RUNTIME_CONFIG__ && typeof window.__KLEARN_RUNTIME_CONFIG__ === 'object' ? window.__KLEARN_RUNTIME_CONFIG__ : {};
  const nativePlatform = window.Capacitor?.getPlatform?.();
  const native = Boolean(window.Capacitor?.isNativePlatform?.() || ['android', 'ios'].includes(nativePlatform) || raw.platform === 'android' || raw.platform === 'ios');
  const normalizeBase = (value) => {
    const input = String(value || '').trim().replace(/\/$/, '');
    if (!input) return '';
    try {
      const url = new URL(input);
      const local = ['localhost', '127.0.0.1'].includes(url.hostname);
      return url.protocol === 'https:' || (local && url.protocol === 'http:') ? url.origin : '';
    } catch (_) { return ''; }
  };
  const apiBaseUrl = normalizeBase(raw.apiBaseUrl);
  const safePath = (value) => {
    const path = String(value || '');
    if (!path.startsWith('/api/')) throw new Error('Only application API paths are allowed.');
    return path;
  };
  const webRedirect = () => `${window.location?.origin || ''}${window.location?.pathname || '/'}`;
  const configuredRedirect = String(raw.authRedirectUrl || '').trim();
  const authRedirectUrl = () => native && /^[a-z][a-z0-9+.-]*:\/\//i.test(configuredRedirect) ? configuredRedirect : webRedirect();
  window.KLearnPlatform = Object.freeze({
    isNative: () => native,
    platform: () => nativePlatform || raw.platform || 'web',
    apiBaseUrl: () => apiBaseUrl,
    apiUrl: (path) => `${apiBaseUrl}${safePath(path)}`,
    authRedirectUrl,
    release: () => ({ version: String(raw.version || ''), channel: String(raw.channel || ''), build: String(raw.build || '') })
  });
})();
