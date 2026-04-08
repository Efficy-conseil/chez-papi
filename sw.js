const CACHE_NAME = 'chez-papi-v1.2';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './icon-192x192.png',
  './icon-512x512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Add all core assets to cache
      return cache.addAll(ASSETS);
    }).catch(err => console.error('Cache addAll failed:', err))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Cache First Strategy for Offline Access
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cachedResponse => {
      return cachedResponse || fetch(e.request).then(response => {
        return caches.open(CACHE_NAME).then(cache => {
          // Cache new assets for future
          cache.put(e.request, response.clone());
          return response;
        });
      });
    }).catch(() => {
      // Offline fallback handling if needed
    })
  );
});
