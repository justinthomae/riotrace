const cacheName = "Grudge Match Games-Riot Race-1.0";
const contentToCache = [
    "Build/f4a29452b77633012703a0753f4078ab.loader.js",
    "Build/a652bac5367938b72471d020b9de5d9e.framework.js.unityweb",
    "Build/bd53b33b993bd9dd242f144b59f4f079.data.unityweb",
    "Build/0edb35806e45356814e5771cc0bec172.wasm.unityweb",
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
