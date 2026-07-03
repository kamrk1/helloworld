const CACHE = "networth-v1";
const ASSETS = ["/", "/index.html", "/styles.css", "/app.js", "/calc.js", "/storage.js", "/config.json", "/manifest.json", "/icon.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (e) => {
  if (e.request.url.includes("/api/") || e.request.url.includes("/.netlify/functions/")) return;
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request))
  );
});
