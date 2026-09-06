const CACHE = 'klearn-v59';
const OFFLINE_ASSETS = [
  './index.html',
  './styles.css?v=31',
  './global-ai-companion.css?v=1',
  './production-stability.css?v=1',
  './security-privacy.css?v=1',
  './mobile-experience.css?v=1',
  './advanced-voice.css?v=1',
  './language-mastery.css?v=1',
  './immersion-motivation.css?v=1',
  './education-platform.css?v=1',
  './immersive-world.css?v=1',
  './ecosystem-expansion.css?v=1',
  './learning-analytics.css?v=1',
  './real-world-assistant.css?v=1',
  './advanced-content-platform.css?v=1',
  './community-learning.css?v=1',
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
  './data/cloud-sync.js?v=2',
  './data/ai-coach.js?v=4',
  './data/learning-memory.js?v=3',
  './data/adaptive-engine.js?v=7',
  './data/personal-intelligence.js?v=3',
  './data/practical-study.js?v=3',
  './data/beginner-foundation.js?v=1',
  './data/ecosystem-scale.js?v=8',
  './data/conversation-scenarios.js?v=1',
  './data/conversation-simulator.js?v=1',
  './data/korean-context-system.js?v=1',
  './data/reading-expansion.js?v=1',
  './data/long-term-ecosystem.js?v=1',
  './data/learning-intelligence.js?v=2',
  './data/daily-learning-experience.js?v=5',
  './data/language-mastery.js?v=1',
  './data/immersion-motivation.js?v=1',
  './data/education-platform.js?v=1',
  './data/immersive-world.js?v=1',
  './data/ecosystem-expansion.js?v=1',
  './data/learning-analytics-engine.js?v=1',
  './data/real-world-assistant.js?v=1',
  './data/advanced-content-platform.js?v=1',
  './data/community-learning.js?v=1',
  './data/enterprise-platform.js?v=1',
  './data/product-ux.js?v=1',
  './data/retention-system.js?v=1',
  './data/content-quality-system.js?v=1',
  './data/learning-modules.js?v=9',
  './data/practice-bank.js?v=8',
  './locales/vi.js?v=2',
  './locales/en.js?v=4',
  './locales/zh-CN.js?v=4',
  './data/content-locales.js?v=1',
  './app.js?v=45',
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
  './data/global-language-platform.js?v=1',
  './content/global-language-platform.json',
  './data/user-research.js?v=1',
  './content/user-research-experiments.json',
  './data/advanced-learning-analytics.js?v=1',
  './content/advanced-learning-analytics.json',
  './edtech-business-intelligence.css?v=1',
  './data/edtech-business-intelligence.js?v=1',
  './content/edtech-business-intelligence.json',
  './premium-learning.css?v=1',
  './data/premium-learning-experience.js?v=1',
  './content/premium-learning-experience.json',
  './data/global-ai-language-companion.js?v=1',
  './content/global-ai-language-companion.json',
  './data/production-stability.js?v=1',
  './content/production-stability.json',
  './data/security-privacy.js?v=1',
  './content/security-privacy.json',
  './data/mobile-experience.js?v=1',
  './content/mobile-experience.json',
  './data/advanced-voice.js?v=1',
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

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(OFFLINE_ASSETS)).then(() => self.skipWaiting()));
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
  if (url.pathname.startsWith('/api/') || request.headers.has('authorization') || /no-store/i.test(request.headers.get('cache-control') || '')) return;
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (!/\.(?:html?|css|js|json|svg|png|webp|woff2?|mp3|wav)$/i.test(url.pathname) && url.pathname !== '/') return;

  event.respondWith(
    fetch(request)
      .then(async (response) => {
        if (response.ok) {
          const copy = response.clone();
          const cache = await caches.open(CACHE);
          await cache.put(request, copy);
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        if (request.mode === 'navigate') return caches.match('./index.html');
        return Response.error();
      })
  );
});

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
