const CACHE_NAME = 'progress-pwa-v1';
const APP_SHELL = [
  '/', '/index.html', '/app.js', '/manifest.json',
  '/icons/icon-192.png', '/icons/icon-512.png'
];

self.addEventListener('install', evt =>
  evt.waitUntil(
    caches.open(CACHE_NAME)
          .then(cache => cache.addAll(APP_SHELL))
          .then(() => self.skipWaiting())
  )
);

self.addEventListener('activate', evt =>
  evt.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
    .then(() => self.clients.claim())  // Claim control of all clients immediately
  )
);

self.addEventListener('fetch', evt => {
  const url = new URL(evt.request.url);

  // 1. Bypass your Web-App writes entirely (so CORS isn’t blocked)
  if (
    url.hostname === 'script.google.com' &&
    url.pathname.startsWith('/macros/s/AKfycbxI6ZSAearvsukTH2Jo-oiJv1SR2htEn2EqrqoY8t3mm0tFdlNLS1cQOy7a4vEORkQSPw/exec')
  ) {
    evt.respondWith(fetch(evt.request));
    return;
  }

  // 2. Network-first for sheet reads
  if (
    url.hostname.includes('docs.google.com') ||
    url.hostname.includes('sheets.googleapis.com')
  ) {
    evt.respondWith(
      fetch(evt.request)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(evt.request, copy));
          return res;
        })
        .catch(() => caches.match(evt.request))
    );
    return;
  }

  // 3. Cache-first for everything else (app shell)
  evt.respondWith(
    caches.match(evt.request).then(r => r || fetch(evt.request))
  );
});
