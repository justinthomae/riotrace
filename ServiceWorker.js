const cacheName = "Grudge Match Games-Riot Race-1.0";
const contentToCache = [
    "Build/384e0a5415b4c41f3287c4e28ce1f8bf.loader.js",
    "Build/d81a7f469dc0dfbaab83c91c5295b6ac.framework.js.unityweb",
    "Build/c6063b2056462a94f3be0b4b68ae38f5.data.unityweb",
    "Build/9de240b185e778950de96ae920c6ddce.wasm.unityweb",
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
