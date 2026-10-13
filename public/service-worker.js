const CACHE_NAME = 'version-11-clean';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/apple-touch-icon.png'
];
const SUPABASE_HOSTNAME = 'olfabhkhyfibanhsxwpg.supabase.co';

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache and caching essential assets');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => Promise.all(
      cacheNames.map(cacheName => {
        if (!cacheWhitelist.includes(cacheName)) {
          console.log('Deleting old cache:', cacheName);
          return caches.delete(cacheName);
        }
      })
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Never intercept or cache Vite internal assets, node_modules, HMR, or chunks with version hashes
  if (
    url.pathname.includes('/node_modules/') || 
    url.pathname.includes('/.vite/') || 
    url.pathname.startsWith('/@') || 
    url.search.includes('?v=') ||
    url.search.includes('&v=') ||
    url.pathname.endsWith('.tsx') ||
    url.pathname.endsWith('.ts')
  ) {
    return;
  }

  // Always go to the network for Supabase API calls.
  if (url.hostname === SUPABASE_HOSTNAME) {
    event.respondWith(
      fetch(request).catch(error => {
        console.warn('Service Worker: Supabase API fetch failed, probably offline.', error);
        return new Response(JSON.stringify({ message: 'Network error: The service worker could not connect to the API.' }), {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'application/json' },
        });
      })
    );
    return;
  }

  // Network-First for HTML navigation and JS/CSS bundles to prevent chunk mismatch and duplicate React issues
  if (request.mode === 'navigate' || request.destination === 'document' || url.pathname.includes('/assets/')) {
    event.respondWith(
      fetch(request)
        .then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(request).then(cached => {
            if (cached) return cached;
            if (request.mode === 'navigate') {
              return caches.match('/index.html');
            }
          });
        })
    );
    return;
  }
  
  // For static assets (images, icons, fonts), use Stale-While-Revalidate
  event.respondWith(
    caches.open(CACHE_NAME).then(cache => {
      return cache.match(request).then(cachedResponse => {
        const fetchPromise = fetch(request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(() => {});

        return cachedResponse || fetchPromise;
      });
    })
  );
});