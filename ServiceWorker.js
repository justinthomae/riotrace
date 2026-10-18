const cacheName = "Grudge Match Games-Riot Race-1.0";
const contentToCache = [
    "Build/63654470e8eb39de903b688b4e3a25af.loader.js",
    "Build/ba5cb60a59f9461e908893e4280af6e0.framework.js.unityweb",
    "Build/4bf5cc39b1209a35368f411d4bd69bff.data.unityweb",
    "Build/02492fd106f88b21882e092520eef8b0.wasm.unityweb",
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
