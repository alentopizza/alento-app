type GoogleGeocodeResult = {
  formatted_address?: string;
  place_id?: string;
  geometry?: {
    location?: {
      lat?: number;
      lng?: number;
    };
  };
};

type GoogleGeocodeResponse = {
  status?: string;
  error_message?: string;
  results?: GoogleGeocodeResult[];
};

function serverKey() {
  const key = process.env.GOOGLE_MAPS_SERVER_API_KEY?.trim();
  if (!key) {
    throw new Error("GOOGLE_MAPS_SERVER_API_KEY no está configurada.");
  }
  return key;
}

export type GeocodedLocation = {
  formattedAddress: string;
  placeId: string;
  latitude: number;
  longitude: number;
};

export async function geocodeAddress(address: string): Promise<GeocodedLocation> {
  const normalized = address.trim();
  if (!normalized) throw new Error("La dirección está vacía.");

  const params = new URLSearchParams({
    address: normalized,
    region: "co",
    language: "es",
    key: serverKey(),
  });

  const response = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`,
    { cache: "no-store" },
  );

  if (!response.ok) {
    throw new Error(`Google Geocoding respondió HTTP ${response.status}.`);
  }

  const data = (await response.json()) as GoogleGeocodeResponse;
  if (data.status !== "OK") {
    throw new Error(
      data.error_message ||
        `Google Geocoding no pudo resolver la dirección (${data.status || "sin estado"}).`,
    );
  }

  const first = data.results?.[0];
  const latitude = Number(first?.geometry?.location?.lat);
  const longitude = Number(first?.geometry?.location?.lng);
  const formattedAddress = first?.formatted_address?.trim() || "";
  const placeId = first?.place_id?.trim() || "";

  if (
    !formattedAddress ||
    !placeId ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    throw new Error("Google devolvió una ubicación incompleta.");
  }

  return {
    formattedAddress,
    placeId,
    latitude,
    longitude,
  };
}


type GoogleRouteResponse = {
  routes?: Array<{
    distanceMeters?: number;
    duration?: string;
  }>;
};

function parseDurationSeconds(value: string | undefined) {
  if (!value) return null;
  const seconds = Number(value.replace(/s$/, ""));
  return Number.isFinite(seconds) ? Math.round(seconds) : null;
}

export async function reverseGeocode(
  latitude: number,
  longitude: number,
): Promise<GeocodedLocation> {
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new Error("Las coordenadas recibidas no son válidas.");
  }

  const params = new URLSearchParams({
    latlng: `${latitude},${longitude}`,
    language: "es",
    region: "co",
    key: serverKey(),
  });

  const response = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`,
    { cache: "no-store" },
  );

  if (!response.ok) {
    throw new Error(`Google Geocoding respondió HTTP ${response.status}.`);
  }

  const data = (await response.json()) as GoogleGeocodeResponse;
  if (data.status !== "OK") {
    throw new Error(
      data.error_message ||
        `Google Geocoding no pudo resolver la ubicación (${data.status || "sin estado"}).`,
    );
  }

  const first = data.results?.[0];
  const resolvedLatitude = Number(first?.geometry?.location?.lat ?? latitude);
  const resolvedLongitude = Number(first?.geometry?.location?.lng ?? longitude);
  const formattedAddress = first?.formatted_address?.trim() || "";
  const placeId = first?.place_id?.trim() || "";

  if (!formattedAddress || !placeId) {
    throw new Error("Google devolvió una dirección incompleta.");
  }

  return {
    formattedAddress,
    placeId,
    latitude: Number.isFinite(resolvedLatitude) ? resolvedLatitude : latitude,
    longitude: Number.isFinite(resolvedLongitude) ? resolvedLongitude : longitude,
  };
}

export async function computeDrivingRoute(input: {
  origin: { latitude: number; longitude: number };
  destination: { latitude: number; longitude: number };
}) {
  const points = [input.origin, input.destination];
  for (const point of points) {
    if (
      !Number.isFinite(point.latitude) ||
      !Number.isFinite(point.longitude) ||
      point.latitude < -90 ||
      point.latitude > 90 ||
      point.longitude < -180 ||
      point.longitude > 180
    ) {
      throw new Error("No fue posible calcular la ruta por coordenadas inválidas.");
    }
  }

  const response = await fetch(
    "https://routes.googleapis.com/directions/v2:computeRoutes",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": serverKey(),
        "X-Goog-FieldMask": "routes.distanceMeters,routes.duration",
      },
      body: JSON.stringify({
        origin: {
          location: {
            latLng: {
              latitude: input.origin.latitude,
              longitude: input.origin.longitude,
            },
          },
        },
        destination: {
          location: {
            latLng: {
              latitude: input.destination.latitude,
              longitude: input.destination.longitude,
            },
          },
        },
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_UNAWARE",
        languageCode: "es-419",
        units: "METRIC",
      }),
      cache: "no-store",
    },
  );

  const text = await response.text();
  if (!response.ok) {
    let message = `Google Routes respondió HTTP ${response.status}.`;
    try {
      const parsed = JSON.parse(text) as { error?: { message?: string } };
      if (parsed.error?.message) message = parsed.error.message;
    } catch {}
    throw new Error(message);
  }

  const data = JSON.parse(text) as GoogleRouteResponse;
  const route = data.routes?.[0];
  const distanceMeters = Number(route?.distanceMeters);

  if (!Number.isFinite(distanceMeters) || distanceMeters < 0) {
    throw new Error("Google Routes no devolvió una ruta válida.");
  }

  return {
    distanceMeters: Math.round(distanceMeters),
    durationSeconds: parseDurationSeconds(route?.duration),
  };
}
