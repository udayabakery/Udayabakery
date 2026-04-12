// ═══════════════════════════════════════════════════════
//  🔔 UDAYA BAKERY — Firebase Messaging Service Worker
//  Handles push notifications when Chrome is closed/background
//  Place this file at the ROOT of your GitHub repo
// ═══════════════════════════════════════════════════════

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyDMjm0RW6PgmkGQF3b2id2eCMbgWHdSLbk",
  authDomain: "udaya-bakery-a39f9.firebaseapp.com",
  projectId: "udaya-bakery-a39f9",
  storageBucket: "udaya-bakery-a39f9.firebasestorage.app",
  messagingSenderId: "611650298877",
  appId: "1:611650298877:web:e301677773441bdaa76f94"
});

const messaging = firebase.messaging();

// ── Handle background messages (Chrome closed / minimised) ──
messaging.onBackgroundMessage(payload => {
  console.log('[SW] Background message received:', payload);

  const { title, body, icon } = payload.notification || {};

  // Play sound via a data URL beep (works in background)
  self.registration.showNotification(title || '🔔 New Order — Udaya Bakery', {
    body: body || 'A new order has been placed!',
    icon: icon || 'https://udayabakery.github.io/Udayabakery/logo.png',
    badge: 'https://udayabakery.github.io/Udayabakery/logo.png',
    tag: 'new-order',
    renotify: true,
    requireInteraction: true,   // stays on screen until dismissed
    vibrate: [200, 100, 200, 100, 400],
    actions: [
      { action: 'open', title: '👀 View Order' },
      { action: 'dismiss', title: 'Dismiss' }
    ],
    data: payload.data || {}
  });
});

// ── Notification click: open the admin panel ──
self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  const adminUrl = 'https://udayabakery.github.io/Udayabakery/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // If tab already open, focus it
      for (const client of clientList) {
        if (client.url.includes('udayabakery') && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open new tab
      if (clients.openWindow) return clients.openWindow(adminUrl);
    })
  );
});
