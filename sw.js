const CACHE_NAME = 'epub-reader-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/reader.html',
  '/js/epub.min.js',
  '/js/jszip.min.js',
  // add any fonts or CSS you want cached
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});
