// ═══════════════════════════════════════════════════════
//  Udaya Bakery — Service Worker (Caching + Offline)
//  Place this file at: /Udayabakery/sw.js on GitHub
// ═══════════════════════════════════════════════════════

// FIX: Removed unused CACHE_NAME — only STATIC_CACHE and IMG_CACHE are used
const STATIC_CACHE = 'udaya-static-v2';
const IMG_CACHE    = 'udaya-images-v2';
const IMG_CACHE_MAX = 50; // FIX: Limit image cache to avoid unbounded growth

// Core files to pre-cache on install — loads these instantly every visit
const PRE_CACHE = [
  '/Udayabakery/',
  '/Udayabakery/index.html',
  '/Udayabakery/logo.png',
  '/Udayabakery/manifest.json',
];

// ── LRU trim: keep image cache bounded ────────────────
async function trimCache(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxItems) {
    await cache.delete(keys[0]);
    await trimCache(cacheName, maxItems);
  }
}

// ── INSTALL: pre-cache core files ──────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => {
      return cache.addAll(PRE_CACHE).catch(err => {
        console.warn('[SW] Pre-cache failed for some files:', err);
      });
    })
  );
  self.skipWaiting(); // activate immediately
});

// ── ACTIVATE: clean up old caches ──────────────────────
self.addEventListener('activate', event => {
  const validCaches = [STATIC_CACHE, IMG_CACHE];
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => !validCaches.includes(k))
          .map(k => {
            console.log('[SW] Deleting old cache:', k);
            return caches.delete(k);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: smart caching strategy ──────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // FIX: Skip ALL Google APIs (covers Firebase Auth, FCM, Firestore, etc.)
  if (url.hostname.includes('googleapis.com')) return;
  if (url.hostname.includes('gstatic.com')) return;
  if (url.hostname.includes('firebaseio.com')) return;
  if (url.hostname.includes('wa.me')) return;
  if (url.hostname.includes('accounts.google.com')) return;

  // ── Images: Cache-first (fast load, store for offline) ──
  if (
    request.destination === 'image' ||
    url.pathname.match(/\.(png|jpg|jpeg|webp|gif|svg|ico)$/i)
  ) {
    event.respondWith(
      caches.open(IMG_CACHE).then(cache =>
        cache.match(request).then(cached => {
          if (cached) return cached;
          // FIX: Removed mode:'no-cors' — opaque responses have status 0, not 200
          return fetch(request)
            .then(response => {
              // FIX: Accept opaque responses (cross-origin images) too
              if (response && (response.ok || response.type === 'opaque')) {
                cache.put(request, response.clone());
                // FIX: Trim cache after adding new entry
                trimCache(IMG_CACHE, IMG_CACHE_MAX);
              }
              return response;
            })
            .catch(() => cached);
        })
      )
    );
    return;
  }

  // ── Fonts: Cache-first (already excluded by googleapis.com rule above,
  //    but handle gstatic font files explicitly just in case) ──
  if (url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(cache =>
        cache.match(request).then(cached => {
          if (cached) return cached;
          return fetch(request).then(response => {
            if (response && response.ok) cache.put(request, response.clone());
            return response;
          }).catch(() => cached);
        })
      )
    );
    return;
  }

  // ── HTML page: Network-first, fall back to cache ──
  // FIX: Only cache the shell index.html, not all HTML (avoids caching
  //      auth-sensitive or admin HTML and serving it to wrong users)
  if (
    request.destination === 'document' ||
    url.pathname.endsWith('.html') ||
    url.pathname.endsWith('/')
  ) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // FIX: Only cache the main shell page, not auth-sensitive pages
          if (response.ok && url.pathname === '/Udayabakery/') {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then(cache => cache.put(request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then(cached =>
            cached || caches.match('/Udayabakery/index.html')
          )
        )
    );
    return;
  }

  // ── Everything else: Network-first with cache fallback ──
  event.respondWith(
    fetch(request)
      .then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(STATIC_CACHE).then(cache => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});

// FIX: Removed empty push handler — it was catching and discarding push events,
//      silently preventing Firebase SW from receiving them. Firebase messaging SW
//      handles push on its own narrower scope.
