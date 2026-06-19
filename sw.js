const CACHE_NAME = 'chez-papi-v2.25';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './apple-touch-icon.png',
  './icon-192x192.png',
  './icon-512x512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
      .catch(err => console.error('Cache addAll failed:', err))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── IndexedDB helpers (partagé avec la page principale) ─────────────────────

function swOpenDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('chez-papi-sw', 1);
    req.onupgradeneeded = e => {
      e.target.result.createObjectStore('state', { keyPath: 'key' });
    };
    req.onsuccess  = e => resolve(e.target.result);
    req.onerror    = e => reject(e.target.error);
  });
}

async function swDbGet(key) {
  try {
    const db = await swOpenDB();
    return new Promise((resolve, reject) => {
      const req = db.transaction('state', 'readonly').objectStore('state').get(key);
      req.onsuccess = e => resolve(e.target.result?.value ?? null);
      req.onerror   = e => reject(e.target.error);
    });
  } catch { return null; }
}

async function swDbSet(key, value) {
  try {
    const db = await swOpenDB();
    return new Promise((resolve, reject) => {
      const req = db.transaction('state', 'readwrite').objectStore('state').put({ key, value });
      req.onsuccess = () => resolve();
      req.onerror   = e => reject(e.target.error);
    });
  } catch {}
}

// ── Polling en arrière-plan ──────────────────────────────────────────────────

async function pollForNewEvents() {
  const creds = await swDbGet('credentials');
  if (!creds?.url || !creds?.user) return;

  try {
    const res  = await fetch(creds.url, {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'list',
        auth: { user: creds.user, pass: creds.pass }
      })
    });
    const data = await res.json();
    const rows = data?.ok === true ? data.data?.rows : data?.rows;
    if (!rows) return;

    // Demandes au statut "Nouvelle demande" uniquement
    const newLeads = rows.filter(r => {
      const s = String(r.statut || '').trim().toLowerCase();
      return s === 'nouvelle demande' || s === 'nouveau';
    });

    // Comparaison avec les lignes déjà vues (stockées par _row)
    const seenRaw = await swDbGet('seen_rows');
    const seen    = new Set(Array.isArray(seenRaw) ? seenRaw : []);
    const eventKey = r => String(r.id_demande || r._row || '').trim();
    const unseen  = newLeads.filter(r => !seen.has(eventKey(r)));

    if (unseen.length > 0) {
      const first = unseen[0];
      const title = unseen.length === 1
        ? 'Nouvelle demande 🔔'
        : `${unseen.length} nouvelles demandes 🔔`;
      const body  = unseen.length === 1
        ? `${first.nom_client || 'Client'} · ${first.type_evenement || ''}`
        : unseen.map(r => r.nom_client || 'Client').join(', ');

      await self.registration.showNotification(title, {
        body,
        icon:  './icon-192x192.png',
        badge: './icon-192x192.png',
        tag:   'new-demand-' + Date.now(),
        data:  { url: './' }
      });

      // Marquer comme vues
      unseen.forEach(r => seen.add(eventKey(r)));
      await swDbSet('seen_rows', [...seen]);
    }
  } catch (err) {
    console.error('[SW] pollForNewEvents error:', err);
  }
}

// ── Periodic Background Sync (Chrome Android avec PWA installée) ─────────────

self.addEventListener('periodicsync', e => {
  if (e.tag === 'poll-new-events') {
    e.waitUntil(pollForNewEvents());
  }
});

// ── Messages depuis app.js ───────────────────────────────────────────────────

self.addEventListener('message', e => {
  // Notification manuelle (déclenchée par l'app ouverte)
  if (e.data?.type === 'SHOW_NOTIFICATION') {
    self.registration.showNotification(e.data.title, {
      body:  e.data.body,
      icon:  './icon-192x192.png',
      badge: './icon-192x192.png',
      tag:   e.data.tag || 'chez-papi'
    }).catch(() => {});
  }

  // Synchronisation des credentials depuis la page (après login)
  if (e.data?.type === 'SYNC_CREDENTIALS') {
    swDbSet('credentials', {
      user: e.data.user,
      pass: e.data.pass,
      url:  e.data.url
    });
  }

  // Synchronisation des demandes déjà vues (évite les doublons)
  if (e.data?.type === 'SYNC_SEEN_ROWS') {
    swDbSet('seen_rows', e.data.rows);
  }
});

// ── Clic sur notification → ouvrir l'app ────────────────────────────────────

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
      const existing = cs.find(c => c.url.includes('chez-papi'));
      if (existing) return existing.focus();
      return clients.openWindow(e.notification.data?.url || './');
    })
  );
});

// ── Fetch handler ────────────────────────────────────────────────────────────

self.addEventListener('fetch', e => {
  if (!e.request.url.startsWith(self.location.origin)) return;

  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request, { cache: 'no-store' })
        .then(res => {
          if (res.ok) caches.open(CACHE_NAME).then(c => c.put(e.request, res.clone()));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // JS et CSS : toujours depuis le réseau
  if (/\.(js|css)(\?.*)?$/.test(e.request.url)) {
    e.respondWith(
      fetch(e.request, { cache: 'no-store' })
        .then(res => {
          if (res.ok) caches.open(CACHE_NAME).then(c => c.put(e.request, res.clone()));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(cached => {
      return cached || fetch(e.request).then(res => {
        if (res.ok) caches.open(CACHE_NAME).then(c => c.put(e.request, res.clone()));
        return res;
      });
    }).catch(() => {})
  );
});
