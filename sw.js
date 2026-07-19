var CACHE_NAME = 'winelist-cache';
var ASSETS = ['./', './index.html', './styles.css', './app.js', './manifest.json'];

self.addEventListener('install', function (event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('activate', function (event) {
  self.clients.claim();
  event.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(
        names.filter(function (name) { return name !== CACHE_NAME; })
            .map(function (name) { return caches.delete(name); })
      );
    }).then(function () {
      // Purge cross-origin entries cached by older SW versions (e.g. the
      // Google Sheets CSV) — a cached 200 there masked real network failures
      // from the app's staleness detection.
      return caches.open(CACHE_NAME).then(function (cache) {
        return cache.keys().then(function (requests) {
          return Promise.all(
            requests.filter(function (req) { return req.url.indexOf(self.location.origin) !== 0; })
                    .map(function (req) { return cache.delete(req); })
          );
        });
      });
    })
  );
});

self.addEventListener('fetch', function (event) {
  // Same-origin app shell only. The Google Sheets CSV must hit the network
  // directly so failures reach the app and its localStorage fallback /
  // stale banner work as designed.
  if (event.request.url.indexOf(self.location.origin) !== 0) return;
  event.respondWith(
    Promise.race([
      fetch(event.request).then(function (response) {
        if (response.ok) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(event.request, clone);
          });
        }
        return response;
      }),
      new Promise(function (_, reject) {
        setTimeout(function () { reject(new Error('timeout')); }, 7000);
      })
    ]).catch(function () {
      return caches.match(event.request);
    })
  );
});
