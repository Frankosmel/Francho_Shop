// Francho Shop & Web Stores - High Performance Local Image & Asset Service Worker
const CACHE_NAME_IMAGES = 'fs-images-v6';
const CACHE_NAME_STATIC = 'fs-static-v6';
const CACHE_NAME_SHELL = 'fs-shell-v6';

// Core assets to pre-cache on install
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/franchoshop.jpg?v=2',
  '/logo-512.png?v=2'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME_SHELL).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Precache asset error (non-fatal):', err);
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) => {
        return Promise.all(
          keys.map((key) => {
            if (
              key !== CACHE_NAME_IMAGES &&
              key !== CACHE_NAME_STATIC &&
              key !== CACHE_NAME_SHELL
            ) {
              console.log('[SW] Eliminando caché antigua:', key);
              return caches.delete(key);
            }
          })
        );
      })
    ])
  );
});

// Helper: Check if request is an image
function isImageRequest(request, url) {
  if (request.destination === 'image') return true;
  if (url.pathname.startsWith('/api/icons/')) return true;
  if (url.pathname.startsWith('/api/image-cache')) return true;
  if (url.pathname.startsWith('/api/image-proxy')) return true;
  if (url.hostname.includes('simpleicons.org')) return true;
  if (url.hostname.includes('flagcdn.com')) return true;
  if (url.hostname.includes('jsdelivr.net')) return true;
  if (url.hostname.includes('unpkg.com')) return true;
  if (url.hostname.includes('fazercards.com')) return true;
  if (url.hostname.includes('cloudinary.com')) return true;
  if (/\.(png|jpg|jpeg|webp|svg|gif|ico)(\?.*)?$/i.test(url.pathname)) return true;
  return false;
}

// Helper: Check if request is static bundle
function isStaticAsset(url) {
  if (url.pathname.startsWith('/assets/')) return true;
  if (/\.(woff|woff2|ttf|eot|css|js)(\?.*)?$/i.test(url.pathname)) return true;
  return false;
}

// Helper: Check if request is dynamic API that must NOT be cached
function isDynamicApi(url) {
  if (url.pathname.startsWith('/api/')) {
    // Icons & Image Caches ARE cacheable
    if (url.pathname.startsWith('/api/icons/')) return false;
    if (url.pathname.startsWith('/api/image-cache')) return false;
    if (url.pathname.startsWith('/api/image-proxy')) return false;
    return true;
  }
  return false;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // 1. DYNAMIC API -> Network Only (never cache balance, orders, auth)
  if (isDynamicApi(url)) {
    return;
  }

  // 2. IMAGES -> True Cache-First (0ms local latency, zero network overhead)
  if (isImageRequest(request, url)) {
    event.respondWith(
      caches.open(CACHE_NAME_IMAGES).then(async (cache) => {
        const cachedResponse = await cache.match(request);
        if (cachedResponse) {
          return cachedResponse;
        }

        try {
          const networkResponse = await fetch(request);
          if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        } catch (err) {
          return new Response(
            '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect fill="#16181f" width="100" height="100"/><text fill="#64748b" font-family="sans-serif" font-size="12" dy="50" dx="50" text-anchor="middle">Offline</text></svg>',
            { headers: { 'Content-Type': 'image/svg+xml' } }
          );
        }
      })
    );
    return;
  }

  // 3. STATIC ASSETS (.js, .css, .woff2) -> Cache First
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.open(CACHE_NAME_STATIC).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;

        try {
          const response = await fetch(request);
          if (response && response.status === 200) {
            cache.put(request, response.clone());
          }
          return response;
        } catch (err) {
          return cached || Response.error();
        }
      })
    );
    return;
  }

  // 4. HTML Navigation -> Network First, fallback to cached shell
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          if (response && response.status === 200) {
            const cache = await caches.open(CACHE_NAME_SHELL);
            cache.put(request, response.clone());
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const fallback = await caches.match('/index.html');
          return fallback || Response.error();
        })
    );
    return;
  }
});
