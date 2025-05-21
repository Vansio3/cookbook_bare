const CACHE_NAME = 'cookbook-bare-v1';
// Adjust ASSETS_TO_CACHE if your GitHub Pages root is different,
// or if index.html is in a subdirectory.
// For https://Vansio3.github.io/cookbook_bare/, index.html is at /cookbook_bare/index.html
// So, when fetching from the service worker's perspective, it might be just '/index.html'
// if the sw.js is registered with scope '/cookbook_bare/'.
// Let's assume sw.js is at the root of the deployment, and index.html is also effectively at the root from the server's perspective after base path.
const ASSETS_TO_CACHE = [
  '/cookbook_bare/', // This should cache the index.html at the root of your deployment path
  '/cookbook_bare/manifest.json', // Cache the manifest
  // Add other essential local assets here if you have them (e.g., local CSS, local JS files NOT inlined)
  // CDN assets (Tailwind, Google Fonts) will be cached by the browser's regular cache or by the CDN's service workers.
  // We can add them here for more robust offline, but it adds complexity for updates.
  // For now, we'll keep it simple and focus on the app shell.
];

// Install event: cache essential assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        // Add all assets to cache.
        // Using addAll which fetches and caches. If any fetch fails, the entire operation fails.
        return cache.addAll(ASSETS_TO_CACHE).catch(error => {
          console.error('Failed to cache assets during install:', error);
          // You might want to retry or handle this more gracefully
          // For assets like '/' which resolves to index.html, ensure your server serves it correctly.
        });
      })
      .then(() => {
        console.log('All essential assets cached.');
        return self.skipWaiting(); // Activate the new service worker immediately
      })
  );
});

// Activate event: clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
        console.log('Service worker activated and old caches cleaned.');
        return self.clients.claim(); // Take control of uncontrolled clients
    })
  );
});

// Fetch event: serve assets from cache if available, otherwise fetch from network
self.addEventListener('fetch', event => {
  // We only want to handle GET requests for our app's assets
  if (event.request.method !== 'GET') {
    return;
  }

  // For navigation requests (e.g., loading the main page), try network first, then cache.
  // This ensures users get the latest HTML if online.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // If successful, cache the fetched response for future offline use
          if (response.ok) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          // If network fails, try to serve from cache
          return caches.match(event.request)
            .then(cachedResponse => {
              if (cachedResponse) {
                return cachedResponse;
              }
              // If not in cache either (and it's a navigation),
              // you might want to return a specific offline page.
              // For simplicity, we'll just let it fail if not cached for navigate.
              // Or, return the cached root page:
              return caches.match('/cookbook_bare/');
            });
        })
    );
    return;
  }

  // For other requests (CSS, JS, images not handled by navigate strategy), use cache-first
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse; // Serve from cache
        }
        // Not in cache, fetch from network
        return fetch(event.request).then(
          networkResponse => {
            // Optionally, cache the newly fetched resource if it's something you want to cache dynamically
            // Be careful with caching everything, especially third-party resources or large files.
            // For now, we're mainly pre-caching with ASSETS_TO_CACHE.
            return networkResponse;
          }
        ).catch(error => {
            console.error('Fetch failed; returning offline fallback or error', error);
            // You could return a generic offline placeholder for images, etc.
        });
      })
  );
});