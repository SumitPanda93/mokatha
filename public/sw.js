// Mo Katha Service Worker — v1
// Cache-first for static assets, network-first for API/Supabase calls.

const CACHE = "mokatha-v1";

const STATIC_ASSETS = [
  "/",
  "/manifest.json",
  "/favicon.svg",
];

// ── Install ──────────────────────────────────────────────────────────────────
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      c.addAll(STATIC_ASSETS).catch(() => {})
    )
  );
  self.skipWaiting();
});

// ── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // Skip non-GET, cross-origin API calls (Supabase), and browser-extension requests
  if (e.request.method !== "GET") return;
  if (url.hostname.includes("supabase.co")) return;
  if (url.hostname.includes("fonts.googleapis.com")) return;
  if (!url.protocol.startsWith("http")) return;

  // Navigation requests → serve cached shell, fall back to network
  if (e.request.mode === "navigate") {
    e.respondWith(
      caches.match("/").then((cached) => cached ?? fetch(e.request)).catch(() => caches.match("/"))
    );
    return;
  }

  // Static assets → cache-first
  if (url.pathname.match(/\.(js|css|png|svg|ico|woff2?|ttf)(\?.*)?$/)) {
    e.respondWith(
      caches.match(e.request).then(
        (cached) => cached ?? fetch(e.request).then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, clone));
          }
          return res;
        })
      )
    );
    return;
  }

  // Everything else → network-first, cache as fallback
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
