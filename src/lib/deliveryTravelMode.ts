export const DELIVERY_TRAVEL_MODES = [
  "WALK",
  "MOTORCYCLE",
  "VEHICLE",
] as const;

export type DeliveryTravelMode = (typeof DELIVERY_TRAVEL_MODES)[number];

export const DELIVERY_TRAVEL_MODE_OPTIONS: Array<{
  value: DeliveryTravelMode;
  label: string;
  shortLabel: string;
  emoji: string;
}> = [
  { value: "WALK", label: "A pie", shortLabel: "Pie", emoji: "🚶" },
  { value: "MOTORCYCLE", label: "Moto", shortLabel: "Moto", emoji: "🛵" },
  { value: "VEHICLE", label: "Vehículo", shortLabel: "Vehículo", emoji: "🚗" },
];

export function normalizeDeliveryTravelMode(
  value: unknown,
): DeliveryTravelMode | null {
  const normalized =
    typeof value === "string" ? value.trim().toUpperCase() : "";

  return DELIVERY_TRAVEL_MODES.includes(
    normalized as DeliveryTravelMode,
  )
    ? (normalized as DeliveryTravelMode)
    : null;
}

export function deliveryTravelModeLabel(
  value: DeliveryTravelMode | string | null | undefined,
) {
  const normalized = normalizeDeliveryTravelMode(value);
  return (
    DELIVERY_TRAVEL_MODE_OPTIONS.find(
      (option) => option.value === normalized,
    )?.label ?? "Vehículo"
  );
}

export function deliveryTravelModeEmoji(
  value: DeliveryTravelMode | string | null | undefined,
) {
  const normalized = normalizeDeliveryTravelMode(value);
  return (
    DELIVERY_TRAVEL_MODE_OPTIONS.find(
      (option) => option.value === normalized,
    )?.emoji ?? "🚗"
  );
}

export function deliveryTravelModeColor(
  value: DeliveryTravelMode | string | null | undefined,
) {
  const normalized = normalizeDeliveryTravelMode(value);
  if (normalized === "WALK") return "#2563eb";
  if (normalized === "MOTORCYCLE") return "#e21a22";
  return "#f59e0b";
}

export function googleMapsUrlTravelMode(
  value: DeliveryTravelMode | string | null | undefined,
) {
  const normalized = normalizeDeliveryTravelMode(value);
  if (normalized === "WALK") return "walking";
  // Google Maps universal direction URLs do not reliably support
  // "two-wheeler". Motorcycle deliveries open as driving externally.
  return "driving";
}
