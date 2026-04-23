// Cache-first service worker for El Jefé Finance. Bump CACHE_VERSION when
// deploying changes to bust the cache; old caches are purged in activate.
const CACHE_VERSION = 'ejf-v6-2026-04-23';
const CORE_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './js/main.js',
  './js/state.js',
  './js/defaults.js',
  './js/history.js',
  './js/render.js',
  './js/backup.js',
  './js/actions.js',
  './js/utils.js',
  './js/charts.js',
  './js/tabs/overview.js',
  './js/tabs/budget.js',
  './js/tabs/spending.js',
  './js/tabs/networth.js',
  './js/tabs/debt.js',
  './js/tabs/cashapp.js',
  './js/tabs/goals.js',
  './js/tabs/movein.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Only handle same-origin GETs (avoids caching Google Fonts etc.).
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) {
        // Stale-while-revalidate: serve cache, refresh in background.
        fetch(req).then((res) => {
          if (res && res.status === 200) {
            caches.open(CACHE_VERSION).then((cache) => cache.put(req, res.clone())).catch(() => {});
          }
        }).catch(() => {});
        return cached;
      }
      return fetch(req).then((res) => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, clone)).catch(() => {});
        }
        return res;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
