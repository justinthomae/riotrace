const cacheName = "Grudge Match Games-Riot Race-1.0";
const contentToCache = [
    "Build/33a4dfb27025c69897e1d1f9ae43d143.loader.js",
    "Build/a652bac5367938b72471d020b9de5d9e.framework.js.unityweb",
    "Build/c69c9480b568b6740aa6074bdbbb218e.data.unityweb",
    "Build/f2d51ed7a1a53da8ff3110ddea05de3a.wasm.unityweb",
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
