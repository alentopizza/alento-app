export type DeliveryRoutePoint = {
  latitude: number;
  longitude: number;
};

function haversineMeters(a: DeliveryRoutePoint, b: DeliveryRoutePoint) {
  const radius = 6_371_000;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const deltaLat = toRadians(b.latitude - a.latitude);
  const deltaLng = toRadians(b.longitude - a.longitude);

  const h =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLng / 2) ** 2;

  return 2 * radius * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Ordena paradas con una heurística nearest-neighbor:
 * ubicación actual → parada más cercana → siguiente parada más cercana.
 *
 * Se comparte entre el mapa operativo del administrador y el mapa del
 * repartidor para que ambos muestren el mismo orden.
 */
export function orderDeliveryStopsByProximity<T>(
  origin: DeliveryRoutePoint,
  items: T[],
  pointOf: (item: T) => DeliveryRoutePoint,
) {
  const pending = [...items];
  const ordered: T[] = [];
  let currentPoint = origin;

  while (pending.length > 0) {
    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;

    pending.forEach((item, index) => {
      const distance = haversineMeters(currentPoint, pointOf(item));
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });

    const [nearest] = pending.splice(nearestIndex, 1);
    ordered.push(nearest);
    currentPoint = pointOf(nearest);
  }

  return ordered;
}
