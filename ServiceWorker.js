const cacheName = "Grudge Match Games-Riot Race-1.0";
const contentToCache = [
    "Build/f14a35d26f9833dd66c9ff1edf6a70cd.loader.js",
    "Build/a652bac5367938b72471d020b9de5d9e.framework.js.unityweb",
    "Build/1ea1ce28540f9ca1ce1e6b05a5e91c0d.data.unityweb",
    "Build/1197c1f33a60bac1f577a95ba382b5d8.wasm.unityweb",
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
