const CACHE_NAME = 'qsend-v2';
const URLS_TO_CACHE = [
  './',
  './index.html',
  './icon.svg',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(URLS_TO_CACHE);
      })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Navigation fallback to index.html for SPA behavior
  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.match('./index.html').then((response) => {
        return response || fetch(event.request).catch(() => {
           return caches.match('./index.html');
        });
      })
    );
    return;
  }

  // Use Stale-While-Revalidate for most requests to ensure freshness
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        // Cache successful network responses for CDN assets (esm.sh, tailwind, fonts)
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          networkResponse.type === 'basic' || 
          event.request.url.includes('esm.sh') ||
          event.request.url.includes('tailwindcss.com') ||
          event.request.url.includes('fonts.googleapis.com')
        ) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            try {
              cache.put(event.request, responseToCache);
            } catch (err) {
              // Ignore cache errors (e.g. quota exceeded)
            }
          });
        }
        return networkResponse;
      }).catch(() => {
        // Fallback or just return undefined if network fails and no cache
      });
      return cachedResponse || fetchPromise;
    })
  );
});