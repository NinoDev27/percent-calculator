const CACHE_NAME = "rangecalc-v9";

// IMPORTANT: use absolute paths for GitHub Pages project sites
// If your site is https://ninodev27.github.io/percent-calculator/ then BASE = "/percent-calculator/"
const BASE = "/percent-calculator/";

const ASSETS = [
  BASE,
  BASE + "index.html",
  BASE + "styles.css",
  BASE + "app.js",
  BASE + "manifest.webmanifest",
  // icons that actually exist in /icons
  BASE + "icons/android-launchericon-192-192.png",
  BASE + "icons/android-launchericon-512-512.png",
];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => (k === CACHE_NAME ? null : caches.delete(k))));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);

  // 1) NEVER cache TwelveData (or any API)
  if (url.hostname.includes("twelvedata.com")) {
    e.respondWith(fetch(req, { cache: "no-store" }));
    return;
  }

  // 2) Only handle GET
  if (req.method !== "GET") return;

  // 3) App-shell navigation: serve cached index.html, but revalidate in background
  // This prevents “old html loads old js” issues.
  if (req.mode === "navigate") {
    e.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(BASE + "index.html");

        const fetchPromise = fetch(req)
          .then((res) => {
            // update cached index.html (and allow it to pull latest app.js)
            cache.put(BASE + "index.html", res.clone());
            return res;
          })
          .catch(() => null);

        // Prefer cached for speed, but if no cache, use network.
        return cached || (await fetchPromise) || Response.error();
      })()
    );
    return;
  }

  // 4) Static assets: cache-first, then network, then nothing
  e.respondWith(
    caches.match(req).then((cached) => cached || fetch(req))
  );
});
