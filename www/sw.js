const CACHE_NAME = "sahaya-v24";
const CACHE_FILES = [
  "/",
  "/index.html",
  "/share.html",
  "/track.html",
  "/user.html",
  // NOTE: driver.html intentionally excluded — it requires auth, not suitable for offline cache
  "/style.css",
  "/modern-style.css",
  "/script.js",
  "/modern-script.js",
  "/manifest.json",
  // Leaflet CDN files (if you want offline map UI shell)
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet-src.js",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CACHE_FILES))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  // NETWORK-FIRST STRATEGY: Always get the freshest file from the server
  // Only fallback to the offline cache if the network fails (no internet)
  e.respondWith(
    fetch(e.request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, responseToCache));
        }
        return response;
      })
      .catch(() => {
        return caches.match(e.request);
      })
  );
});