const EARTH_RADIUS_METERS = 6_371_008.8;

function radians(value: number) {
  return (value * Math.PI) / 180;
}

export function directDistanceMeters(input: {
  origin: { latitude: number; longitude: number };
  destination: { latitude: number; longitude: number };
}) {
  const { origin, destination } = input;

  for (const point of [origin, destination]) {
    if (
      !Number.isFinite(point.latitude) ||
      !Number.isFinite(point.longitude) ||
      point.latitude < -90 ||
      point.latitude > 90 ||
      point.longitude < -180 ||
      point.longitude > 180
    ) {
      throw new Error("No fue posible calcular la distancia por coordenadas inválidas.");
    }
  }

  const originLatitude = radians(origin.latitude);
  const destinationLatitude = radians(destination.latitude);
  const latitudeDelta = destinationLatitude - originLatitude;
  const longitudeDelta = radians(
    destination.longitude - origin.longitude,
  );

  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(originLatitude) *
      Math.cos(destinationLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;

  const centralAngle =
    2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));

  return EARTH_RADIUS_METERS * centralAngle;
}
