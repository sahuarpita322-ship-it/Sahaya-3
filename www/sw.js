// ☢️ NUCLEAR CACHE WIPE - Forces browsers to delete corrupted offline files
self.addEventListener("install", (e) => {
  self.skipWaiting(); // Force active immediately
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => caches.delete(k))) // DELETE ALL CACHES
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  // BYPASS CACHE COMPLETELY - Always fetch directly from Render
  e.respondWith(fetch(e.request));
});