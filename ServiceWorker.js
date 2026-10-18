const cacheName = "Grudge Match Games-Riot Race-1.0";
const contentToCache = [
    "Build/7695a82ce9f9223815231fad870bce87.loader.js",
    "Build/7a4aaa14df79895471403e5048700e42.framework.js.unityweb",
    "Build/cbb77554c8e142a466908fa5b9f00489.data.unityweb",
    "Build/b037ca897a034c50d6d38febe7b4356b.wasm.unityweb",
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
