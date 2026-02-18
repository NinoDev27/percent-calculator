const CACHE_NAME = "rangecalc-v1";
const ASSETS = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => (k === CACHE_NAME ? null : caches.delete(k)))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // Network-first for API calls
  if (url.hostname.includes("twelvedata.com")) {
    e.respondWith(fetch(e.request).catch(() => caches.match("./")));
    return;
  }

  // Cache-first for app shell
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
