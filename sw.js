/* ============================================================
   SOKO HURU — Service Worker  (sw.js)
   Cache-first strategy | offline fallback | Serem, Vihiga
   ============================================================ */

const CACHE_NAME    = 'soko-huru-v3';
const OFFLINE_URL   = './index.html';

const PRECACHE = [
  './',
  './index.html',
];

/* ── Install: pre-cache shell ── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

/* ── Activate: remove old caches ── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

/* ── Fetch: cache-first, fallback to network, fallback to shell ── */
self.addEventListener('fetch', event => {
  /* Only handle GET requests for same-origin / CDN resources */
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  /* Always hit the network for Firebase, PayHero, EmailJS */
  const networkOnly = [
    'firebaseio.com',
    'firebaseapp.com',
    'googleapis.com',
    'payhero.co.ke',
    'emailjs.com',
    'api.anthropic.com',
  ];
  if (networkOnly.some(h => url.hostname.includes(h))) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request)
        .then(response => {
          /* Cache successful responses for images, fonts, CDN scripts */
          if (
            response &&
            response.status === 200 &&
            (response.type === 'basic' || response.type === 'cors')
          ) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() =>
          /* Offline fallback: serve cached shell */
          caches.match(OFFLINE_URL)
        );
    })
  );
});

/* ── Push notifications ── */
self.addEventListener('push', event => {
  let data = { title: 'SOKO HURU', body: 'Fresh deals waiting for you! 🛒' };
  try { Object.assign(data, event.data.json()); } catch (_) {}

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body:    data.body,
      icon:    data.icon  || './icons/icon-192.png',
      badge:   data.badge || './icons/badge-72.png',
      vibrate: [200, 100, 200],
      data:    { url: data.url || './' },
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || './';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(list => {
        const existing = list.find(c => c.url === target && 'focus' in c);
        return existing ? existing.focus() : clients.openWindow(target);
      })
  );
});
