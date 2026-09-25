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


self.addEventListener("push", (event) => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {
      title: "Alentó Pizza",
      body: event.data ? event.data.text() : "Tienes una nueva actualización.",
    };
  }

  const title = payload.title || "Alentó Pizza";
  const options = {
    body: payload.body || "Tienes una nueva actualización.",
    icon:
      payload.icon ||
      "https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/ka91FhewP8WCQ2jD9VzF/pub/esHVvv9U23OXjH5ATQqA.png",
    badge:
      payload.icon ||
      "https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/ka91FhewP8WCQ2jD9VzF/pub/esHVvv9U23OXjH5ATQqA.png",
    tag: payload.tag || "alento-driver",
    data: {
      url: payload.url || "/repartidor",
    },
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const target = new URL(
    event.notification?.data?.url || "/repartidor",
    self.location.origin,
  ).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(async (clients) => {
        for (const client of clients) {
          if (!client.url.startsWith(self.location.origin)) continue;

          if ("navigate" in client) {
            try {
              await client.navigate(target);
            } catch {}
          }

          if ("focus" in client) {
            return client.focus();
          }
        }

        if (self.clients.openWindow) {
          return self.clients.openWindow(target);
        }

        return undefined;
      }),
  );
});
