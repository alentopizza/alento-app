import {
  computeDrivingRoute,
  computeTwoWheelerRoute,
  computeWalkingRoute,
  type ComputedGoogleRoute,
} from "@/lib/googleMapsServer";
import {
  normalizeDeliveryTravelMode,
  type DeliveryTravelMode,
} from "@/lib/deliveryTravelMode";

export type DeliveryRouteResult = ComputedGoogleRoute & {
  requestedTravelMode: DeliveryTravelMode;
  routeTravelMode: DeliveryTravelMode;
  fallbackToVehicle: boolean;
};

export async function computeDeliveryRoute(
  input: {
    origin: { latitude: number; longitude: number };
    destination: { latitude: number; longitude: number };
  },
  requestedMode: DeliveryTravelMode | string | null | undefined,
): Promise<DeliveryRouteResult> {
  const normalized =
    normalizeDeliveryTravelMode(requestedMode) ?? "VEHICLE";

  if (normalized === "WALK") {
    const route = await computeWalkingRoute(input);
    return {
      ...route,
      requestedTravelMode: "WALK",
      routeTravelMode: "WALK",
      fallbackToVehicle: false,
    };
  }

  if (normalized === "MOTORCYCLE") {
    try {
      const route = await computeTwoWheelerRoute(input);
      return {
        ...route,
        requestedTravelMode: "MOTORCYCLE",
        routeTravelMode: "MOTORCYCLE",
        fallbackToVehicle: false,
      };
    } catch (error) {
      console.warn(
        "Two-wheeler route unavailable; using vehicle route as fallback",
        error,
      );
      const route = await computeDrivingRoute(input);
      return {
        ...route,
        requestedTravelMode: "MOTORCYCLE",
        routeTravelMode: "VEHICLE",
        fallbackToVehicle: true,
      };
    }
  }

  const route = await computeDrivingRoute(input);
  return {
    ...route,
    requestedTravelMode: "VEHICLE",
    routeTravelMode: "VEHICLE",
    fallbackToVehicle: false,
  };
}
