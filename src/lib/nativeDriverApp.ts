import type { DeliveryTravelMode } from "@/lib/deliveryTravelMode";

type AlentoNativeBridge = {
  startAvailabilityTracking: () => boolean;
  setOrderTracking: (
    token: string,
    orderCode: string,
    travelMode: string,
  ) => boolean;
  clearOrderTracking: () => void;
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

export function startNativeDriverAvailabilityTracking() {
  if (typeof window === "undefined" || !window.AlentoNative) {
    return false;
  }

  try {
    return Boolean(window.AlentoNative.startAvailabilityTracking());
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
