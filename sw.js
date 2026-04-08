const CACHE_NAME = 'chez-papi-v3';
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
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
      .catch(err => console.error('Cache addAll failed:', err))
  );
  // Ne pas skipWaiting ici : on attend la confirmation de l'utilisateur
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// L'app peut déclencher la mise à jour via ce message
self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  // Network-first pour la page HTML : l'utilisateur reçoit toujours la version fraîche
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          caches.open(CACHE_NAME).then(c => c.put(e.request, res.clone()));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Cache-first pour les ressources statiques (CSS, JS, images)
  e.respondWith(
    caches.match(e.request).then(cached => {
      return cached || fetch(e.request).then(res => {
        caches.open(CACHE_NAME).then(c => c.put(e.request, res.clone()));
        return res;
      });
    }).catch(() => {})
  );
});
