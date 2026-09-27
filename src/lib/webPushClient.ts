"use client";

export type WebPushCapability =
  | "loading"
  | "unsupported"
  | "unconfigured"
  | "denied"
  | "off"
  | "on";

export function webPushSupported() {
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function applicationServerKey(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);

  for (let index = 0; index < raw.length; index += 1) {
    output[index] = raw.charCodeAt(index);
  }

  return output;
}

export async function getWebPushRegistration() {
  if (!("serviceWorker" in navigator)) {
    throw new Error("Este navegador no soporta service workers.");
  }

  return navigator.serviceWorker.ready;
}

export async function loadWebPushState(endpoint: string) {
  if (!webPushSupported()) {
    return {
      state: "unsupported" as const,
      publicKey: "",
    };
  }

  const response = await fetch(endpoint, { cache: "no-store" });
  const body = await response.json();

  if (!response.ok) {
    throw new Error(
      body.error || "No fue posible consultar las notificaciones.",
    );
  }

  if (!body.configured || !body.publicKey) {
    return {
      state: "unconfigured" as const,
      publicKey: "",
    };
  }

  const registration = await getWebPushRegistration();
  const subscription =
    await registration.pushManager.getSubscription();

  if (Notification.permission === "denied") {
    return {
      state: "denied" as const,
      publicKey: String(body.publicKey),
    };
  }

  return {
    state: subscription ? ("on" as const) : ("off" as const),
    publicKey: String(body.publicKey),
  };
}

export async function enableWebPush(
  endpoint: string,
  publicKey: string,
) {
  const permission = await Notification.requestPermission();

  if (permission !== "granted") {
    return {
      enabled: false,
      denied: permission === "denied",
    };
  }

  const registration = await getWebPushRegistration();
  let subscription =
    await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey(publicKey),
    });
  }

  const payload = subscription.toJSON();
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "subscribe",
      subscription: payload,
    }),
  });
  const body = await response.json();

  if (!response.ok) {
    await subscription.unsubscribe().catch(() => undefined);
    throw new Error(
      body.error || "No fue posible guardar este dispositivo.",
    );
  }

  return { enabled: true, denied: false };
}

export async function disableWebPush(endpoint: string) {
  const registration = await getWebPushRegistration();
  const subscription =
    await registration.pushManager.getSubscription();

  if (!subscription) return;

  await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "unsubscribe",
      endpoint: subscription.endpoint,
    }),
  });

  await subscription.unsubscribe();
}
