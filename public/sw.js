const CACHE_VERSION = "alento-pwa-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("alento-pwa-") && key !== CACHE_VERSION)
            .map((key) => caches.delete(key)),
        ),
      ),
    ]),
  );
});

// No interceptamos fetch todavía. El POS siempre usa la versión más reciente
// del servidor y evitamos caché agresivo hasta definir una estrategia offline.
