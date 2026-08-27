const VERSION = "sdc-pwa-v3";
const PRECACHE = [
  "/",
  "/login",
  "/offline.html",
  "/manifest.webmanifest",
  "/logo.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(PRECACHE))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(req));
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith(navigate(req));
    return;
  }

  event.respondWith(staleWhileRevalidate(req));
});

function fallback(status = 503) {
  return new Response("", { status, statusText: "offline" });
}

async function networkFirst(req) {
  try {
    const res = await fetch(req);
    if (res.ok) {
      const cache = await caches.open(VERSION);
      await cache.put(req, res.clone());
    }
    return res;
  } catch {
    // Reject so the page can tell offline (navigator.onLine) from a down host.
    throw new TypeError("Failed to fetch");
  }
}

async function navigate(req) {
  try {
    const res = await fetch(req);
    if (res.ok) {
      const cache = await caches.open(VERSION);
      await cache.put(req, res.clone());
    }
    return res;
  } catch {
    const cached = (await caches.match(req)) || (await caches.match("/offline.html"));
    return cached || fallback();
  }
}

async function staleWhileRevalidate(req) {
  const cached = await caches.match(req);
  const fetched = fetch(req)
    .then(async (res) => {
      if (res.ok) {
        const cache = await caches.open(VERSION);
        await cache.put(req, res.clone());
      }
      return res;
    })
    .catch(() => undefined);

  if (cached) {
    void fetched;
    return cached;
  }
  return (await fetched) || fallback();
}
