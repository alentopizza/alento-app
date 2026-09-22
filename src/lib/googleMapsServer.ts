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
