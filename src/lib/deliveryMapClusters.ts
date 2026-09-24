export type DeliveryClusterPoint = {
  latitude: number;
  longitude: number;
};

export type DeliveryLocationCluster<T> = {
  key: string;
  center: DeliveryClusterPoint;
  items: T[];
};

const EARTH_RADIUS_METERS = 6_371_000;

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function metersBetween(
  a: DeliveryClusterPoint,
  b: DeliveryClusterPoint,
) {
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const deltaLat = toRadians(b.latitude - a.latitude);
  const deltaLng = toRadians(b.longitude - a.longitude);

  const h =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLng / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Agrupa domicilios que visualmente representan la misma entrada/conjunto.
 * El umbral es intencionalmente pequeño para no fusionar casas cercanas.
 */
export function groupDeliveryLocations<T>(
  items: T[],
  pointOf: (item: T) => DeliveryClusterPoint,
  keyOf: (item: T) => string | number,
  thresholdMeters = 12,
): DeliveryLocationCluster<T>[] {
  const clusters: Array<{
    items: T[];
    points: DeliveryClusterPoint[];
  }> = [];

  items.forEach((item) => {
    const point = pointOf(item);
    const cluster = clusters.find((candidate) => {
      const center = {
        latitude:
          candidate.points.reduce((sum, value) => sum + value.latitude, 0) /
          candidate.points.length,
        longitude:
          candidate.points.reduce((sum, value) => sum + value.longitude, 0) /
          candidate.points.length,
      };

      return metersBetween(center, point) <= thresholdMeters;
    });

    if (cluster) {
      cluster.items.push(item);
      cluster.points.push(point);
      return;
    }

    clusters.push({
      items: [item],
      points: [point],
    });
  });

  return clusters.map((cluster) => ({
    key: cluster.items
      .map((item) => String(keyOf(item)))
      .sort((a, b) => a.localeCompare(b, "es", { numeric: true }))
      .join("-"),
    center: {
      latitude:
        cluster.points.reduce((sum, value) => sum + value.latitude, 0) /
        cluster.points.length,
      longitude:
        cluster.points.reduce((sum, value) => sum + value.longitude, 0) /
        cluster.points.length,
    },
    items: cluster.items,
  }));
}

/**
 * Separa solo la representación visual de los pedidos alrededor del punto real.
 * No altera la coordenada guardada ni la usada para rutas/tarifas.
 */
export function spreadDeliveryClusterPoint(
  center: DeliveryClusterPoint,
  index: number,
  count: number,
  radiusMeters = 30,
): DeliveryClusterPoint {
  if (count <= 1) return center;

  const safeIndex = Math.max(0, Math.min(index, count - 1));
  const angle =
    count === 2
      ? safeIndex === 0
        ? Math.PI
        : 0
      : -Math.PI / 2 + (Math.PI * 2 * safeIndex) / count;

  const northMeters = Math.sin(angle) * radiusMeters;
  const eastMeters = Math.cos(angle) * radiusMeters;
  const latDelta = northMeters / 111_320;
  const cosine = Math.max(
    0.2,
    Math.cos((center.latitude * Math.PI) / 180),
  );
  const lngDelta = eastMeters / (111_320 * cosine);

  return {
    latitude: center.latitude + latDelta,
    longitude: center.longitude + lngDelta,
  };
}
