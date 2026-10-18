const cacheName = "Grudge Match Games-Riot Race-1.0";
const contentToCache = [
    "Build/2389f4c3f722c7c76b4136c57a748120.loader.js",
    "Build/6f9523cbae4ba3ba7490661cef2d608d.framework.js.unityweb",
    "Build/0d88543076e4b571d67ee5de7b6cc204.data.unityweb",
    "Build/9e3b6042fef94e37def1f6c1138aaa65.wasm.unityweb",
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
