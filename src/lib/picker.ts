type PickerEnvironment = "production" | "development";
export type PickerPaymentMethod = "CARD" | "CASH" | "TERMINAL";
export type PickerVehicle = "BIKE" | "LITE";

export type PickerPreCheckoutRequest = {
  latitude: number;
  longitude: number;
  paymentMethod: PickerPaymentMethod;
  orderAmount: number;
  sendTrackingLink?: boolean;
  carName?: PickerVehicle;
  tip?: number;
};

export type PickerPreCheckoutResponse = {
  deliveryFee: number;
  deliveryFeeWithTax: number;
  tax: number;
  taxPercentage: number;
  currency: string;
  eta: number;
  distance: number;
};

export type PickerCreateBookingRequest = {
  longitude: number;
  latitude: number;
  city?: string;
  zipCode?: string;
  address: string;
  reference?: string;
  customerName: string;
  customerLastName: string;
  customerEmail: string;
  customerCountryCode: string;
  customerMobile: string;
  sendTrackingLink?: boolean;
  bookingNotes?: string;
  orderAmount: number;
  externalBookingId: string;
  paymentMethod: PickerPaymentMethod;
  cookTime?: number;
  onlyMyFleet?: boolean;
  businessDeliveryFee?: number;
  tipBusiness?: number;
  roundtrip?: boolean;
};

export type PickerCreateBookingResponse = {
  _id: string;
  bookingNumericId?: number;
  externalBookingId?: string;
  currentStatus?: number;
  statusText?: string;
  currency?: string;
  publicBookingToken?: string;
  bookingDetailUrl?: string;
  smrURL?: string;
  priceBreakUp?: {
    baseFare?: number;
    perKmCharge?: number;
    [key: string]: unknown;
  };
  distanceBreakUp?: Record<string, unknown>;
  [key: string]: unknown;
};

export type PickerIntegrationStatus = {
  enabled: boolean;
  configured: boolean;
  environment: PickerEnvironment;
  baseUrl: string;
  sendTrackingLink: boolean;
  vehicle: PickerVehicle;
  missing: string[];
};

const DEFAULT_PRODUCTION_URL = "https://external-api.pickerexpress.com";
const DEFAULT_DEVELOPMENT_URL = "https://dev-external-api.pickerexpress.com";

function bool(value: string | undefined, fallback = false) {
  if (value == null || value.trim() === "") return fallback;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function pickerIntegrationStatus(): PickerIntegrationStatus {
  const environment: PickerEnvironment =
    process.env.PICKER_ENVIRONMENT?.trim().toLowerCase() === "development"
      ? "development"
      : "production";
  const defaultBase =
    environment === "development"
      ? DEFAULT_DEVELOPMENT_URL
      : DEFAULT_PRODUCTION_URL;
  const baseUrl =
    process.env.PICKER_API_BASE_URL?.trim().replace(/\/$/, "") || defaultBase;
  const apiKey = process.env.PICKER_API_KEY?.trim() || "";
  const enabled = bool(process.env.PICKER_ENABLED, false);
  const missing: string[] = [];

  if (!apiKey) missing.push("PICKER_API_KEY");

  return {
    enabled,
    configured: missing.length === 0,
    environment,
    baseUrl,
    sendTrackingLink: bool(process.env.PICKER_SEND_TRACKING_LINK, false),
    vehicle:
      process.env.PICKER_DEFAULT_VEHICLE?.trim().toUpperCase() === "LITE"
        ? "LITE"
        : "BIKE",
    missing,
  };
}

export function pickerFallbackCustomerEmail() {
  return process.env.PICKER_FALLBACK_CUSTOMER_EMAIL?.trim() || "";
}

function pickerConfig() {
  const status = pickerIntegrationStatus();
  const apiKey = process.env.PICKER_API_KEY?.trim() || "";

  if (!status.enabled) {
    throw new Error("La integración con Picker está desactivada.");
  }
  if (!status.configured || !apiKey) {
    throw new Error(
      `Picker no está configurado. Falta: ${status.missing.join(", ") || "PICKER_API_KEY"}.`,
    );
  }

  return { ...status, apiKey };
}

async function pickerFetch<T>(
  path: string,
  init: RequestInit,
): Promise<T> {
  const config = pickerConfig();
  const response = await fetch(`${config.baseUrl}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
      ...(init.headers || {}),
    },
    cache: "no-store",
  });

  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }

  if (!response.ok) {
    const candidate =
      payload && typeof payload === "object"
        ? payload as Record<string, unknown>
        : null;
    const message =
      typeof candidate?.message === "string"
        ? candidate.message
        : typeof candidate?.error === "string"
          ? candidate.error
          : typeof payload === "string" && payload.trim()
            ? payload.trim()
            : `Picker respondió HTTP ${response.status}.`;
    throw new Error(message);
  }

  return payload as T;
}

export async function pickerPreCheckout(
  input: PickerPreCheckoutRequest,
): Promise<PickerPreCheckoutResponse> {
  const config = pickerConfig();
  return pickerFetch<PickerPreCheckoutResponse>("/pre-checkout", {
    method: "POST",
    body: JSON.stringify({
      ...input,
      sendTrackingLink:
        input.sendTrackingLink ?? config.sendTrackingLink,
      carName: input.carName ?? config.vehicle,
    }),
  });
}

export async function pickerCreateBooking(
  input: PickerCreateBookingRequest,
): Promise<PickerCreateBookingResponse> {
  const config = pickerConfig();
  const path =
    process.env.PICKER_CREATE_BOOKING_PATH?.trim() || "/bookings";

  return pickerFetch<PickerCreateBookingResponse>(path, {
    method: "POST",
    body: JSON.stringify({
      ...input,
      sendTrackingLink:
        input.sendTrackingLink ?? config.sendTrackingLink,
      cookTime: Math.max(0, Math.round(numberValue(input.cookTime))),
      onlyMyFleet: input.onlyMyFleet === true,
      roundtrip: input.roundtrip === true,
    }),
  });
}

export async function pickerCancelBooking(
  bookingId: string,
  cancelReason: string,
) {
  if (!bookingId.trim()) throw new Error("El envío Picker no tiene bookingId.");
  return pickerFetch<{ message?: string; messageKey?: string }>(
    `/bookings/${encodeURIComponent(bookingId)}/cancel`,
    {
      method: "POST",
      body: JSON.stringify({
        cancelReason: cancelReason.trim() || "CANCELADO_DESDE_ALENTO",
      }),
    },
  );
}

export function pickerBookingPrice(response: PickerCreateBookingResponse) {
  const base = numberValue(response.priceBreakUp?.baseFare);
  const distance = numberValue(response.priceBreakUp?.perKmCharge);
  return Math.max(0, base + distance);
}
