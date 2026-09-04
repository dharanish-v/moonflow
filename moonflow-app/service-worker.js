// service-worker.js — offline caching. Bump CACHE_VERSION on every deploy that
// changes any cached file (see README "Shipping an update") — this is what makes
// old cached versions actually get replaced instead of silently persisting.

const CACHE_VERSION = 'moonflow-v10';

const PRECACHE_FILES = [
  './',
  './index.html',
  './planner.html',
  './manifest.json',
  './manifest-discreet.json',
  './css/tokens.css',
  './css/components.css',
  './js/app.js',
  './js/store.js',
  './js/db.js',
  './js/constants.js',
  './js/cycle-math.js',
  './js/moon-phase.js',
  './js/icons.js',
  './js/pin-auth.js',
  './js/export.js',
  './js/gestures.js',
  './js/vendor/dexie.mjs',
  './js/screens/onboarding.js',
  './js/screens/home.js',
  './js/screens/calendar.js',
  './js/screens/log-entry.js',
  './js/screens/insights.js',
  './js/screens/settings.js',
  './js/screens/pin-lock.js',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-discreet-180.png',
  './icons/icon-discreet-192.png',
  './icons/icon-discreet-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      // {cache: 'reload'} bypasses the browser's own HTTP cache for each
      // precache fetch — without it, a file served with no explicit
      // Cache-Control (like this project's plain python3 -m http.server dev
      // setup) can be served stale from Chrome's heuristic HTTP cache even
      // though CACHE_VERSION was bumped, silently re-caching old bytes.
      cache.addAll(PRECACHE_FILES.map((url) => new Request(url, { cache: 'reload' })))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

// Cache-first: this is a fully local app with no dynamic server content, so a
// cache hit is always correct and always fastest — no need for network-first
// or stale-while-revalidate here.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
