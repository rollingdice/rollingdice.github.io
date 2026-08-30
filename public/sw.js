// Service worker for the BIP39 dice demo.
// Cache-only by design (ADR-0004: zero network calls — this worker never
// fetches the network; it serves the precached app shell so the demo runs
// offline and survives a reboot). The precache list is generated at build
// time by scripts/generate-precache.mjs into public/sw-precache.json, so the
// hashed /_astro/* bundles are captured exactly.

const CACHE = 'dice-v2';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      fetch('/sw-precache.json')
        .then((res) => res.json())
        .then((assets) => cache.addAll(assets))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Serve only from cache; never touch the network.
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return caches.match('/dice/');
    })
  );
});
