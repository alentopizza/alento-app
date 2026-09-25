import type { DeliveryTravelMode } from "@/lib/deliveryTravelMode";

type AlentoNativeBridge = {
  startTracking: (
    token: string,
    orderCode: string,
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

export function startNativeDriverTracking(input: {
  token: string;
  orderCode: string;
  travelMode: DeliveryTravelMode;
}) {
  if (typeof window === "undefined" || !window.AlentoNative) {
    return false;
  }

  try {
    return Boolean(
      window.AlentoNative.startTracking(
        input.token,
        input.orderCode,
        input.travelMode,
      ),
    );
  } catch (error) {
    console.warn("Native driver tracking could not start", error);
    return false;
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
