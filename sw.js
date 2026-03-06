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
    })
  );
});

self.addEventListener('fetch', function (event) {
  event.respondWith(
    fetch(event.request)
      .then(function (response) {
        var clone = response.clone();
        caches.open(CACHE_NAME).then(function (cache) {
          cache.put(event.request, clone);
        });
        return response;
      })
      .catch(function () {
        return caches.match(event.request);
      })
  );
});
