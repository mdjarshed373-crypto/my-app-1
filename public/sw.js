// TX TOUR BD - Progressive Web App & Push Notification Service Worker
const CACHE_NAME = 'txtourbd-cache-v9-shield';
const CROWN_ICON_192 = '/pwa-icon-192x192.png?v=20261119b';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((oldKey) => caches.delete(oldKey))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api/')) return;

  // Force fresh network fetch for manifest and PWA icons so stale cached icons never appear
  if (
    url.pathname === '/manifest.json' ||
    url.pathname === '/favicon.ico' ||
    url.pathname === '/apple-touch-icon.png' ||
    url.pathname.startsWith('/pwa-icon-')
  ) {
    event.respondWith(
      fetch(event.request, { cache: 'reload' }).catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {
      title: 'Room Code Chole Asche',
      body: event.data
        ? event.data.text()
        : 'Tomar Match er Room ID & Password deya hoyeche. ROOM button e click kore dekhe nao.',
    };
  }

  const title = payload.title || 'Room Code Chole Asche';
  const body =
    payload.body ||
    'Tomar Match er Room ID & Password deya hoyeche. ROOM button e click kore dekhe nao.';
  const url = payload.url || '/app';
  const tag = payload.tag || 'tx-room-code';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: CROWN_ICON_192,
      badge: '/app-icon-192.png',
      tag,
      renotify: true,
      requireInteraction: true,
      vibrate: [200, 100, 200],
      data: { url },
    })
  );
});

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || data.type !== 'TX_SHOW_NOTIFICATION') return;

  const { title, body, url, tag } = data.payload || {};
  event.waitUntil(
    self.registration.showNotification(title || 'Room Code Chole Asche', {
      body:
        body ||
        'Tomar Match er Room ID & Password deya hoyeche. ROOM button e click kore dekhe nao.',
      icon: CROWN_ICON_192,
      badge: '/app-icon-192.png',
      tag: tag || 'tx-room-code',
      renotify: true,
      requireInteraction: true,
      vibrate: [200, 100, 200],
      data: { url: url || '/app' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl =
    (event.notification.data && event.notification.data.url) || '/app';
  const absoluteUrl = new URL(targetUrl, self.location.origin).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) {
            client.postMessage({
              type: 'TX_NOTIFICATION_NAVIGATE',
              url: targetUrl,
            });
            if ('navigate' in client) {
              return client.navigate(absoluteUrl).then(() => client.focus()).catch(() => client.focus());
            }
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(absoluteUrl);
        }
        return undefined;
      })
  );
});
