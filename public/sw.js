/* La Quiétude — service worker.
 *
 * Hand-rolled (no build plugin) so it stays robust across Vite versions.
 * Strategy:
 *   • navigations      → network-first, fall back to the cached app shell
 *   • séance clips .mp3 → cache-first  (immutable; this is what makes a sitting
 *                                       available offline once played/downloaded)
 *   • séance .json      → stale-while-revalidate (fresh when online, available off)
 *   • app assets (hashed js/css, icons) → stale-while-revalidate
 *   • Google fonts      → cache-first
 *
 * Bump VERSION to roll all caches on the next visit.
 */

const VERSION = "v1";
const SHELL = `quietude-shell-${VERSION}`;
const SEANCES = `quietude-seances-${VERSION}`;
const FONTS = `quietude-fonts-${VERSION}`;
const KEEP = [SHELL, SEANCES, FONTS];

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => !KEEP.includes(k)).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith(networkFirst(req, SHELL));
    return;
  }

  if (url.origin === self.location.origin && url.pathname.startsWith("/seances/")) {
    if (url.pathname.endsWith(".json")) {
      event.respondWith(staleWhileRevalidate(req, SEANCES));
    } else {
      event.respondWith(cacheFirst(req, SEANCES));
    }
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(req, SHELL));
    return;
  }

  if (url.host === "fonts.googleapis.com" || url.host === "fonts.gstatic.com") {
    event.respondWith(cacheFirst(req, FONTS));
    return;
  }
});

async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    const cached = (await cache.match(req)) || (await caches.match("/index.html")) || (await caches.match("/"));
    return cached || Response.error();
  }
}

async function cacheFirst(req, cacheName) {
  const cached = await caches.match(req);
  if (cached) return cached;
  const res = await fetch(req);
  if (res && (res.ok || res.type === "opaque")) {
    const cache = await caches.open(cacheName);
    cache.put(req, res.clone());
  }
  return res;
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const network = fetch(req)
    .then((res) => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    })
    .catch(() => cached);
  return cached || network;
}
