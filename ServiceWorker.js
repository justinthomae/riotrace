const cacheName = "Grudge Match Games-Riot Race-1.0";
const contentToCache = [
    "Build/fb3b654f8fc85a9655bd38393f7c3709.loader.js",
    "Build/2c2db9cfa07e9ae506f4d7be9ea7581b.framework.js.unityweb",
    "Build/0008a4aa272a49b209b30c8a2788dad6.data.unityweb",
    "Build/79c3b4e1d64e304b586e0026cb10e0ba.wasm.unityweb",
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
