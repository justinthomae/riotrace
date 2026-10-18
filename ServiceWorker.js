const cacheName = "Grudge Match Games-Riot Race-1.0";
const contentToCache = [
    "Build/4fe19ee57e9cbf26c5bba7e477da31c1.loader.js",
    "Build/a652bac5367938b72471d020b9de5d9e.framework.js.unityweb",
    "Build/f10a392bc8f6ca2dc82d5a21b7fa7adc.data.unityweb",
    "Build/d0eb7d2766875febbb02db72fd629e10.wasm.unityweb",
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
