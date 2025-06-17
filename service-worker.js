const CACHE_NAME = 'progress-pwa-v6'; // Update the cache version here to ensure a fresh start
const APP_SHELL = [
  '/papas-muscle-machine/',
  '/papas-muscle-machine/index.html',
  '/papas-muscle-machine/app.js',
  '/papas-muscle-machine/manifest.json',
  '/papas-muscle-machine/icons/icon-192.png',
  '/papas-muscle-machine/icons/icon-512.png'
];


self.addEventListener('install', evt =>
  evt.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return Promise.allSettled(APP_SHELL.map(url => cache.add(url)));
      })
      .then(() => self.skipWaiting())
      .catch(err => {
        console.warn("⚠️ Cache error during install:", err);
      })
  )
);

self.addEventListener('activate', evt =>
  evt.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  )
);

self.addEventListener('fetch', evt => {
  const url = new URL(evt.request.url);

  // 0. Navigation: Network-first, fall back to cache if network is down
  if (evt.request.mode === 'navigate') {
    evt.respondWith(
      fetch(evt.request)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put('/index.html', copy)); // Always cache the latest HTML
          return res;
        })
        .catch(() => caches.match('/index.html')) // Serve from cache if network fails
    );
    return;
  }

  // 1. Don’t cache Google Script calls (write-only API)
  if (
    url.hostname === 'script.google.com' &&
    url.pathname.startsWith('/macros/s/')
  ) {
    evt.respondWith(fetch(evt.request));
    return;
  }

  // 2. Network-first for Google Sheets API reads
  if (
    url.hostname.includes('docs.google.com') ||
    url.hostname.includes('sheets.googleapis.com')
  ) {
    evt.respondWith(
      fetch(evt.request)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(evt.request, copy)); // Cache the read requests too
          return res;
        })
        .catch(() => caches.match(evt.request))
    );
    return;
  }

  // 3. Cache-first for everything else
  evt.respondWith(
    caches.match(evt.request).then(r => r || fetch(evt.request)) // Serve from cache if available, else fetch
  );
});
