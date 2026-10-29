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
    tag: payload.tag || "alento-staff",
    image: payload.image || undefined,
    data: {
      url: payload.url || null,
      kind: payload.kind || null,
      orderId: payload.orderId || null,
      campaignId: payload.campaignId || null,
      recipientKey: payload.recipientKey || null,
    },
    renotify: true,
    requireInteraction: Boolean(payload.requireInteraction),
    silent: false,
  };

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      self.clients
        .matchAll({ type: "window", includeUncontrolled: true })
        .then((clients) =>
          Promise.all(
            clients.map((client) =>
              client.postMessage({
                type: "ALENTO_PUSH",
                payload,
              }),
            ),
          ),
        ),
    ]),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const data = event.notification?.data || {};
  const rawUrl = data.url || null;
  const target = rawUrl
    ? new URL(rawUrl, self.location.origin).href
    : null;

  const recordOpen =
    data.campaignId && data.recipientKey
      ? fetch(
          `/api/push-campaigns/${encodeURIComponent(
            data.campaignId,
          )}/open`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              channel: "WEB",
              recipientKey: data.recipientKey,
            }),
          },
        ).catch(() => undefined)
      : Promise.resolve();

  const openTarget = self.clients
    .matchAll({ type: "window", includeUncontrolled: true })
    .then(async (clients) => {
      const externalTarget =
        target && new URL(target).origin !== self.location.origin;

      if (externalTarget && self.clients.openWindow) {
        return self.clients.openWindow(target);
      }

      for (const client of clients) {
        if (!client.url.startsWith(self.location.origin)) continue;

        if (target && "navigate" in client) {
          try {
            await client.navigate(target);
          } catch {}
        }

        if ("focus" in client) {
          return client.focus();
        }
      }

      if (target && self.clients.openWindow) {
        return self.clients.openWindow(target);
      }

      return undefined;
    });

  event.waitUntil(Promise.all([recordOpen, openTarget]));
});
