const cacheName = "Grudge Match Games-Riot Race-1.0";
const contentToCache = [
    "Build/b0f5ee41a30aa918890b6647d993e8f4.loader.js",
    "Build/e8918c44d7abc42dbfa5ca294756c50e.framework.js.unityweb",
    "Build/ce2cffb69581df613646910a4215f58d.data.unityweb",
    "Build/e8e8d2be45a847deb11536aa7974e500.wasm.unityweb",
    "TemplateData/style.css"

];

self.addEventListener('install', function (e) {
    console.log('[Service Worker] Install');
    
    e.waitUntil((async function () {
      const cache = await caches.open(cacheName);
      console.log('[Service Worker] Caching all: app shell and content');
      await cache.addAll(contentToCache);
    })());
});

self.addEventListener('fetch', function (e) {
    e.respondWith((async function () {
      let response = await caches.match(e.request);
      console.log(`[Service Worker] Fetching resource: ${e.request.url}`);
      if (response) { return response; }

      response = await fetch(e.request);
      const cache = await caches.open(cacheName);
      console.log(`[Service Worker] Caching new resource: ${e.request.url}`);
      cache.put(e.request, response.clone());
      return response;
    })());
});
