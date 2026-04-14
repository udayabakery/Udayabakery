// ═══════════════════════════════════════════════════════
//  Udaya Bakery — Service Worker (Caching + Offline)
//  Place this file at: /Udayabakery/sw.js on GitHub
// ═══════════════════════════════════════════════════════

const CACHE_NAME = 'udaya-bakery-v1';
const STATIC_CACHE = 'udaya-static-v1';
const IMG_CACHE    = 'udaya-images-v1';

// Core files to pre-cache on install — loads these instantly every visit
const PRE_CACHE = [
  '/Udayabakery/',
  '/Udayabakery/index.html',
  '/Udayabakery/logo.png',
  '/Udayabakery/manifest.json',
];

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

  // Skip non-GET, Firebase, WhatsApp, external APIs
  if (request.method !== 'GET') return;
  if (url.hostname.includes('firebaseio.com')) return;
  if (url.hostname.includes('googleapis.com') && url.pathname.includes('firestore')) return;
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
          return fetch(request, { mode: 'no-cors' })
            .then(response => {
              if (response && response.status === 200) {
                cache.put(request, response.clone());
              }
              return response;
            })
            .catch(() => cached); // return cached if network fails
        })
      )
    );
    return;
  }

  // ── Fonts from Google: Cache-first ──
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(cache =>
        cache.match(request).then(cached => {
          if (cached) return cached;
          return fetch(request).then(response => {
            cache.put(request, response.clone());
            return response;
          }).catch(() => cached);
        })
      )
    );
    return;
  }

  // ── HTML page: Network-first, fall back to cache ──
  // Always tries to get fresh HTML, but serves cache if offline
  if (
    request.destination === 'document' ||
    url.pathname.endsWith('.html') ||
    url.pathname.endsWith('/')
  ) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Update cache with fresh copy
          const clone = response.clone();
          caches.open(STATIC_CACHE).then(cache => cache.put(request, clone));
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

// ── PUSH NOTIFICATIONS (pass through to Firebase SW) ──
// Firebase messaging SW handles its own push — this SW
// only handles caching. Both SWs can coexist.
self.addEventListener('push', event => {
  // Let firebase-messaging-sw.js handle push events
  // This SW is registered on scope /Udayabakery/sw.js
  // Firebase SW is on /Udayabakery/firebase-messaging-sw.js
});
