// Minimal Y-app service worker.
//
// Goals:
//   1. Make the app shell load offline (so users see SOMETHING instead of
//      Chrome's "no internet" page when their signal drops).
//   2. NEVER cache anything authenticated. /api/* is the encrypted-vault
//      bridge plus the per-instance ERPNext proxy — those responses are
//      user-specific and security-sensitive. Always go to network for them.
//   3. Stay tiny and dependency-free. No Workbox.
//
// Strategy:
//   - Static assets (JS/CSS/img/font from same origin): cache-first.
//   - Navigation requests (HTML): network-first, fall back to cached
//     index.html so offline boot still renders the shell.
//   - Anything else: pass through.

const CACHE_NAME = "y-app-shell-v1";
const SHELL_URLS = ["/", "/index.html", "/y-logo.svg", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Auth-sensitive: never cache, always network.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/ws/")) return;

  // Navigation requests (top-level HTML): network-first with cached
  // index.html as offline fallback.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put("/index.html", copy));
          return res;
        })
        .catch(() => caches.match("/index.html"))
    );
    return;
  }

  // Static assets: cache-first, populate on miss.
  if (/\.(?:js|css|svg|png|jpg|jpeg|webp|woff2?|ttf|ico)$/i.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then((hit) => {
        if (hit) return hit;
        return fetch(req).then((res) => {
          if (res.ok && res.type === "basic") {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        });
      })
    );
  }
});
