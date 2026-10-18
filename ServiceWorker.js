const cacheName = "Grudge Match Games-Riot Race-1.0";
const contentToCache = [
    "Build/8d42fec8d97b7545e8b5616466eaa42b.loader.js",
    "Build/bd9411f5267cda84bb633cafcaf25f26.framework.js.unityweb",
    "Build/60476c277805e43c08d7ee367066c3ec.data.unityweb",
    "Build/beed42caac36173302823a1165e1f9fb.wasm.unityweb",
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
