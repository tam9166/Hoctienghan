const CACHE = 'klearn-v80';
const OFFLINE_ASSETS = [
  './index.html',
  './styles.css?v=32',
  './global-ai-companion.css?v=1',
  './production-stability.css?v=2',
  './security-privacy.css?v=1',
  './mobile-experience.css?v=1',
  './advanced-voice.css?v=2',
  './realtime-voice-coach.css?v=1',
  './ai-content-creation.css?v=1',
  './monetization-foundation.css?v=1',
  './future-language-platform.css?v=1',
  './global-language-platform.css?v=1',
  './learning-science.css?v=1',
  './career-learning.css?v=1',
  './ai-agent-architecture.css?v=1',
  './ai-language-os.css?v=1',
  './immersive-korean-world.css?v=2',
  './global-education-marketplace.css?v=1',
  './language-mastery.css?v=1',
  './immersion-motivation.css?v=1',
  './education-platform.css?v=1',
  './immersive-world.css?v=1',
  './ecosystem-expansion.css?v=1',
  './learning-analytics.css?v=1',
  './learning-outcomes.css?v=1',
  './product-growth.css?v=1',
  './product-demo.css?v=1',
  './real-world-assistant.css?v=1',
  './advanced-content-platform.css?v=1',
  './community-learning.css?v=1',
  './community-ecosystem.css?v=1',
  './enterprise-platform.css?v=1',
  './product-ux.css?v=1',
  './retention-system.css?v=1',
  './content-quality.css?v=1',
  './data/romanization.js?v=8',
  './data/vocabulary-bank.js?v=8',
  './data/dictionary.js?v=1',
  './data/theory-lessons.js?v=1',
  './data/korean-context-data.js?v=1',
  './data/reading-expansion-data.js?v=1',
  './data/long-term-ecosystem-data.js?v=1',
  './data/learning-intelligence-data.js?v=1',
  './data/language-mastery-data.js?v=1',
  './data/immersion-motivation-data.js?v=1',
  './data/education-platform-data.js?v=1',
  './data/immersive-world-data.js?v=1',
  './data/handwriting.js?v=1',
  './mobile-runtime-config.js?v=1',
  './data/platform-runtime.js?v=1',
  './data/cloud-sync.js?v=4',
  './data/ai-coach.js?v=6',
  './data/learning-memory.js?v=3',
  './data/adaptive-engine.js?v=8',
  './data/personal-intelligence.js?v=3',
  './data/practical-study.js?v=4',
  './data/beginner-foundation.js?v=2',
  './data/ecosystem-scale.js?v=8',
  './data/conversation-scenarios.js?v=1',
  './data/conversation-simulator.js?v=1',
  './data/korean-context-system.js?v=1',
  './data/reading-expansion.js?v=1',
  './data/long-term-ecosystem.js?v=1',
  './data/learning-intelligence.js?v=2',
  './data/daily-learning-experience.js?v=6',
  './data/language-mastery.js?v=1',
  './data/immersion-motivation.js?v=1',
  './data/education-platform.js?v=1',
  './data/immersive-world.js?v=1',
  './data/ecosystem-expansion.js?v=2',
  './data/learning-analytics-engine.js?v=1',
  './data/real-world-assistant.js?v=2',
  './data/advanced-content-platform.js?v=1',
  './data/community-learning.js?v=1',
  './data/enterprise-platform.js?v=1',
  './data/product-ux.js?v=1',
  './data/retention-system.js?v=1',
  './data/content-quality-system.js?v=1',
  './data/learning-modules.js?v=9',
  './data/practice-bank.js?v=8',
  './locales/vi.js?v=4',
  './locales/en.js?v=6',
  './locales/zh-CN.js?v=6',
  './data/content-locales.js?v=1',
  './data/route-loader.js?v=6',
  './app.js?v=66',
  './content/retention-system.json',
  './content/content-quality-system.json',
  './data/resource-library.js?v=1',
  './data/content-review.js?v=2',
  './data/curriculum.js?v=1',
  './data/topik-strategy.js?v=1',
  './content/real-world-assistant.json',
  './content/advanced-content-platform.json',
  './content/community-learning.json',
  './content/enterprise-platform.json',
  './content/ai-infrastructure.json',
  './data/ai-infrastructure.js?v=3',
  './data/global-language-platform.js?v=2',
  './data/ai-agent-architecture.js?v=1',
  './content/ai-agent-architecture.json',
  './data/ai-language-operating-system.js?v=1',
  './content/ai-language-operating-system.json',
  './data/immersive-korean-world.js?v=2',
  './content/immersive-korean-world.json',
  './data/global-education-marketplace.js?v=1',
  './content/global-education-marketplace.json',
  './content/global-language-platform.json',
  './data/user-research.js?v=2',
  './content/user-research-experiments.json',
  './data/advanced-learning-analytics.js?v=1',
  './data/learning-outcomes.js?v=1',
  './data/product-growth.js?v=1',
  './content/product-growth.json',
  './data/product-demo.js?v=1',
  './content/product-demo.json',
  './content/advanced-learning-analytics.json',
  './edtech-business-intelligence.css?v=1',
  './data/edtech-business-intelligence.js?v=1',
  './content/edtech-business-intelligence.json',
  './premium-learning.css?v=1',
  './data/premium-learning-experience.js?v=1',
  './content/premium-learning-experience.json',
  './data/global-ai-language-companion.js?v=1',
  './content/global-ai-language-companion.json',
  './data/production-stability.js?v=5',
  './content/production-stability.json',
  './data/security-privacy.js?v=3',
  './content/security-privacy.json',
  './data/mobile-experience.js?v=3',
  './data/mobile-native.js?v=1',
  './content/mobile-experience.json',
  './data/advanced-voice.js?v=2',
  './data/realtime-voice-coach.js?v=1',
  './data/ai-content-creation.js?v=1',
  './content/ai-content-creation.json',
  './data/community-ecosystem.js?v=1',
  './content/community-ecosystem.json',
  './data/monetization-foundation.js?v=1',
  './content/monetization-foundation.json',
  './data/future-language-platform.js?v=1',
  './content/future-language-platform.json',
  './data/learning-science-engine.js?v=1',
  './content/learning-science-engine.json',
  './data/career-learning-ecosystem.js?v=2',
  './content/career-learning-ecosystem.json',
  './content/advanced-voice.json',
  './mobile/mobile-app.config.json',
  './mobile/mobile-app.schema.json',
  './content/product-ux.json',
  './docs/partner-api-v1.openapi.json',
  './manifest.json',
  './icons/logo-source.svg',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// Install only the app shell and core offline-learning assets. Optional routes are
// cached on first use, so installation no longer downloads the complete platform.
const INSTALL_ASSETS = new Set([
  './index.html', './styles.css?v=32', './product-ux.css?v=1', './production-stability.css?v=2', './security-privacy.css?v=1', './mobile-experience.css?v=1',
  './locales/vi.js?v=4', './locales/en.js?v=6', './locales/zh-CN.js?v=6', './data/content-locales.js?v=1',
  './data/romanization.js?v=8', './data/vocabulary-bank.js?v=8', './data/dictionary.js?v=1', './data/theory-lessons.js?v=1', './data/handwriting.js?v=1',
  './mobile-runtime-config.js?v=1', './data/platform-runtime.js?v=1', './data/cloud-sync.js?v=4', './data/learning-modules.js?v=9', './data/practice-bank.js?v=8', './data/route-loader.js?v=6', './app.js?v=66',
  './data/curriculum.js?v=1', './data/adaptive-engine.js?v=8', './data/beginner-foundation.js?v=2', './data/daily-learning-experience.js?v=6',
  './data/product-ux.js?v=1', './content/product-ux.json', './data/user-research.js?v=2', './content/user-research-experiments.json',
  './data/production-stability.js?v=5', './data/security-privacy.js?v=3', './data/mobile-experience.js?v=3', './data/mobile-native.js?v=1',
  './product-demo.css?v=1', './data/product-demo.js?v=1', './content/product-demo.json',
  './manifest.json', './icons/logo-source.svg', './icons/apple-touch-icon.png', './icons/icon-192.png', './icons/icon-512.png'
]);
const CORE_OFFLINE_ASSETS = OFFLINE_ASSETS.filter((asset) => INSTALL_ASSETS.has(asset));

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => Promise.all(CORE_OFFLINE_ASSETS.map((asset) => cache.add(asset).catch(() => null)))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE && !key.startsWith('klearn-pack-')).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/') || request.headers.has('authorization') || request.headers.has('x-klearn-ai-consent') || /no-store/i.test(request.headers.get('cache-control') || '')) return;
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  const cacheResponse = async (response) => { if (response?.ok) await (await caches.open(CACHE)).put(request, response.clone()); return response; };
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(cacheResponse).catch(() => caches.match(request).then((cached) => cached || caches.match('./index.html'))));
    return;
  }
  if (!/\.(?:html?|css|js|json|svg|png|webp|woff2?|mp3|wav)$/i.test(url.pathname)) return;
  if (url.pathname.startsWith('/content/')) {
    event.respondWith(caches.match(request).then((cached) => { const update = fetch(request).then(cacheResponse).catch(() => null); return cached || update.then((response) => response || Response.error()); }));
    return;
  }
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then(cacheResponse).catch(() => Response.error())));
});

self.addEventListener('message', (event) => { if (event.data?.type === 'SKIP_WAITING') self.skipWaiting(); });

const MOBILE_NOTIFICATION_POLICY = Object.freeze({ quietStart: 22, quietEnd: 7, minimumIntervalMs: 6 * 60 * 60 * 1000, maximumPerDay: 2 });
function openNotificationHistoryDb() {
  if (!self.indexedDB) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('klearn-mobile-system', 1);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains('notification-history')) request.result.createObjectStore('notification-history', { keyPath: 'sentAt' }); };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}
async function notificationHistory() {
  const db = await openNotificationHistoryDb(); if (!db) return [];
  return new Promise((resolve) => { const request = db.transaction('notification-history').objectStore('notification-history').getAll(); request.onerror = () => resolve([]); request.onsuccess = () => resolve(request.result || []); });
}
async function notificationAllowed(date = new Date()) {
  const hour = date.getHours(); if (hour >= MOBILE_NOTIFICATION_POLICY.quietStart || hour < MOBILE_NOTIFICATION_POLICY.quietEnd) return false;
  const history = (await notificationHistory()).sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt)); const today = date.toISOString().slice(0, 10);
  if (history.filter((item) => item.day === today).length >= MOBILE_NOTIFICATION_POLICY.maximumPerDay) return false;
  return !history[0] || date.getTime() - new Date(history[0].sentAt).getTime() >= MOBILE_NOTIFICATION_POLICY.minimumIntervalMs;
}
async function recordNotification(date = new Date()) {
  const db = await openNotificationHistoryDb(); if (!db) return;
  await new Promise((resolve) => { const request = db.transaction('notification-history', 'readwrite').objectStore('notification-history').put({ sentAt: date.toISOString(), day: date.toISOString().slice(0, 10) }); request.onerror = resolve; request.onsuccess = resolve; });
}
self.addEventListener('push', (event) => {
  event.waitUntil((async () => {
    const date = new Date(); if (!(await notificationAllowed(date))) return;
    let payload = {};
    try { payload = event.data?.json?.() || {}; } catch (_) { payload = { body: event.data?.text?.() || '' }; }
    const allowedRoutes = new Set(['home', 'review', 'speaking-hub', 'topik']);
    const route = allowedRoutes.has(payload.route) ? payload.route : 'home';
    const options = {
      body: String(payload.body || 'Đến giờ học một phiên ngắn.').slice(0, 180),
      icon: './icons/icon-192.png', badge: './icons/icon-192.png',
      tag: String(payload.tag || 'klearn-study-reminder').slice(0, 80), renotify: false,
      data: { route }
    };
    await self.registration.showNotification('Tiếng Hàn - TamHoanq', options); await recordNotification(date);
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const allowedRoutes = new Set(['home', 'review', 'speaking-hub', 'topik']);
  const requested = event.notification.data?.route;
  const route = allowedRoutes.has(requested) ? requested : 'home';
  const targetUrl = new URL(`./#${route}`, self.registration.scope).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    const existing = clients.find((client) => new URL(client.url).origin === self.location.origin);
    if (existing) return existing.navigate(targetUrl).then(() => existing.focus());
    return self.clients.openWindow(targetUrl);
  }));
});
