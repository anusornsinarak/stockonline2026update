const CACHE_NAME = 'version-6';
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

  // Always go to the network for Supabase API calls.
  // Add a catch block to handle network failures (e.g., offline).
  if (url.hostname === SUPABASE_HOSTNAME) {
    event.respondWith(
      fetch(request).catch(error => {
        console.warn('Service Worker: Supabase API fetch failed, probably offline.', error);
        // Create a synthetic Response to signal an error to the client-side code.
        return new Response(JSON.stringify({ message: 'Network error: The service worker could not connect to the API.' }), {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'application/json' },
        });
      })
    );
    return;
  }
  
  // For other assets (the app shell, etc.), use a Stale-While-Revalidate strategy.
  event.respondWith(
    caches.open(CACHE_NAME).then(cache => {
      return cache.match(request).then(cachedResponse => {
        // Fetch from network in parallel to update the cache for next time.
        const fetchPromise = fetch(request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(error => {
            // If network fails, and we don't have a cache, it's a real error.
            // For navigation requests, we can show an offline page.
            console.error('Fetch failed; returning offline page if available.', error);
            if (request.mode === 'navigate') {
                return caches.match('/index.html');
            }
        });

        // Return cached response if available, otherwise wait for the network response.
        // This makes the app load instantly from cache.
        return cachedResponse || fetchPromise;
      });
    })
  );
});