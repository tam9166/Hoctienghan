const CACHE = 'klearn-v48';
const OFFLINE_ASSETS = [
  './index.html',
  './styles.css?v=31',
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
  './app.js?v=42',
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
  if (url.pathname === '/api/chat' || url.pathname.startsWith('/api/')) return;
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

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
