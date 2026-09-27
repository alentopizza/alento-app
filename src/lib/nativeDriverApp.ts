import type { DeliveryTravelMode } from "@/lib/deliveryTravelMode";

type AlentoNativeBridge = {
  startAvailabilityTracking: (nativeToken: string) => boolean;
  setOrderTracking: (
    token: string,
    orderCode: string,
    travelMode: string,
  ) => boolean;
  clearOrderTracking: () => void;
  configurePush?: (
    nativeToken: string,
    apiKey: string,
    appId: string,
    projectId: string,
    senderId: string,
  ) => boolean;
  unregisterPush?: () => void;
  openExternalNavigation?: (
    latitude: number,
    longitude: number,
    travelMode: string,
  ) => boolean;
  stopTracking: () => void;
  isTracking: () => boolean;
  platform: () => string;
};

declare global {
  interface Window {
    AlentoNative?: AlentoNativeBridge;
  }
}

export function isAlentoNativeDriverApp() {
  if (typeof window === "undefined") return false;

  try {
    return window.AlentoNative?.platform?.() === "android";
  } catch {
    return false;
  }
}

type NativeDriverAuthorization = {
  token: string;
  push?: {
    configured?: boolean;
    apiKey?: string;
    appId?: string;
    projectId?: string;
    senderId?: string;
  };
};

async function nativeDriverAuthorization(): Promise<NativeDriverAuthorization> {
  const response = await fetch(
    "/api/repartidor/native-location-token",
    {
      method: "POST",
      cache: "no-store",
    },
  );
  const payload = await response.json();

  if (!response.ok || !payload.token) {
    throw new Error(
      payload.error || "No fue posible autorizar la APK.",
    );
  }

  return {
    token: String(payload.token),
    push:
      payload.push && typeof payload.push === "object"
        ? payload.push
        : undefined,
  };
}

function configurePushFromAuthorization(
  authorization: NativeDriverAuthorization,
) {
  if (
    typeof window === "undefined" ||
    !window.AlentoNative?.configurePush ||
    !authorization.push?.configured
  ) {
    return false;
  }

  const push = authorization.push;

  try {
    return Boolean(
      window.AlentoNative.configurePush(
        authorization.token,
        String(push.apiKey || ""),
        String(push.appId || ""),
        String(push.projectId || ""),
        String(push.senderId || ""),
      ),
    );
  } catch (error) {
    console.warn("Native Android push could not configure", error);
    return false;
  }
}

export async function configureNativeDriverPush() {
  if (typeof window === "undefined" || !window.AlentoNative) {
    return false;
  }

  try {
    const authorization = await nativeDriverAuthorization();
    return configurePushFromAuthorization(authorization);
  } catch (error) {
    console.warn("Native Android push authorization failed", error);
    return false;
  }
}

export async function startNativeDriverAvailabilityTracking() {
  if (typeof window === "undefined" || !window.AlentoNative) {
    return false;
  }

  try {
    const authorization = await nativeDriverAuthorization();
    configurePushFromAuthorization(authorization);

    return Boolean(
      window.AlentoNative.startAvailabilityTracking(
        authorization.token,
      ),
    );
  } catch (error) {
    console.warn(
      "Native driver availability tracking could not start",
      error,
    );
    return false;
  }
}

export function setNativeDriverOrderTracking(input: {
  token: string;
  orderCode: string;
  travelMode: DeliveryTravelMode;
}) {
  if (typeof window === "undefined" || !window.AlentoNative) {
    return false;
  }

  try {
    return Boolean(
      window.AlentoNative.setOrderTracking(
        input.token,
        input.orderCode,
        input.travelMode,
      ),
    );
  } catch (error) {
    console.warn("Native driver order tracking could not start", error);
    return false;
  }
}

export function openNativeDriverExternalNavigation(input: {
  latitude: number;
  longitude: number;
  travelMode: DeliveryTravelMode;
}) {
  if (
    typeof window === "undefined" ||
    !window.AlentoNative?.openExternalNavigation
  ) {
    return false;
  }

  try {
    return Boolean(
      window.AlentoNative.openExternalNavigation(
        input.latitude,
        input.longitude,
        input.travelMode,
      ),
    );
  } catch (error) {
    console.warn("Native external navigation could not open", error);
    return false;
  }
}

export function unregisterNativeDriverPush() {
  if (
    typeof window === "undefined" ||
    !window.AlentoNative?.unregisterPush
  ) {
    return;
  }

  try {
    window.AlentoNative.unregisterPush();
  } catch (error) {
    console.warn("Native Android push could not unregister", error);
  }
}

export function clearNativeDriverOrderTracking() {
  if (typeof window === "undefined" || !window.AlentoNative) {
    return;
  }

  try {
    window.AlentoNative.clearOrderTracking();
  } catch (error) {
    console.warn("Native driver order tracking could not clear", error);
  }
}

export function stopNativeDriverTracking() {
  if (typeof window === "undefined" || !window.AlentoNative) {
    return;
  }

  try {
    window.AlentoNative.stopTracking();
  } catch (error) {
    console.warn("Native driver tracking could not stop", error);
  }
}

export function nativeDriverTrackingActive() {
  if (typeof window === "undefined" || !window.AlentoNative) {
    return false;
  }

  try {
    return Boolean(window.AlentoNative.isTracking());
  } catch {
    return false;
  }
}
