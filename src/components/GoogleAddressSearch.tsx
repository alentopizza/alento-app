"use client";

import { useEffect, useRef, useState } from "react";
import {
  loadGoogleMapsClient,
  type GoogleMapsImportRuntime,
} from "@/lib/googleMapsClient";

type PlaceLocationValue = number | (() => number);

type AddressComponent = {
  longText?: string;
  shortText?: string;
  types?: string[];
};

type GooglePlace = {
  id?: string;
  formattedAddress?: string;
  addressComponents?: AddressComponent[];
  location?: {
    lat?: PlaceLocationValue;
    lng?: PlaceLocationValue;
  };
  fetchFields: (options: { fields: string[] }) => Promise<void>;
};

type PlaceSelectEvent = Event & {
  placePrediction: {
    toPlace: () => GooglePlace;
  };
};

type PlaceAutocompleteElementInstance = HTMLElement & {
  placeholder: string;
};

type PlacesRuntime = GoogleMapsImportRuntime & {
  maps: GoogleMapsImportRuntime["maps"];
};

type PlacesLibrary = {
  PlaceAutocompleteElement: new () => PlaceAutocompleteElementInstance;
};

export type GoogleAddressSearchSelection = {
  formattedAddress: string;
  placeId: string;
  latitude: number;
  longitude: number;
  neighborhood: string;
  city: string;
};

function componentValue(
  components: AddressComponent[] | undefined,
  types: string[],
) {
  return (
    components?.find((component) =>
      component.types?.some((type) => types.includes(type)),
    )?.longText?.trim() ?? ""
  );
}

export default function GoogleAddressSearch({
  onSelect,
  placeholder = "Busca la dirección en Google",
}: {
  onSelect:
    | ((selection: GoogleAddressSearchSelection) => void)
    | ((selection: GoogleAddressSearchSelection) => Promise<void>);
  placeholder?: string;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const onSelectRef = useRef(onSelect);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    let cancelled = false;
    let autocomplete: PlaceAutocompleteElementInstance | null = null;
    let listener: EventListener | null = null;

    async function setup() {
      setLoading(true);
      setError("");

      try {
        const google = await loadGoogleMapsClient<PlacesRuntime>();
        const { PlaceAutocompleteElement } =
          (await google.maps.importLibrary("places")) as PlacesLibrary;

        if (cancelled || !hostRef.current) return;

        hostRef.current.innerHTML = "";
        autocomplete = new PlaceAutocompleteElement();
        autocomplete.placeholder = placeholder;
        autocomplete.style.width = "100%";

        listener = (event: Event) => {
          const selected = event as PlaceSelectEvent;

          void (async () => {
            setSelecting(true);
            setError("");

            try {
              const place = selected.placePrediction.toPlace();
              await place.fetchFields({
                fields: [
                  "id",
                  "formattedAddress",
                  "location",
                  "addressComponents",
                ],
              });

              const latitude =
                typeof place.location?.lat === "function"
                  ? place.location.lat()
                  : Number(place.location?.lat);
              const longitude =
                typeof place.location?.lng === "function"
                  ? place.location.lng()
                  : Number(place.location?.lng);

              if (
                !Number.isFinite(latitude) ||
                !Number.isFinite(longitude)
              ) {
                throw new Error(
                  "Google no devolvió una ubicación válida.",
                );
              }

              await onSelectRef.current({
                formattedAddress: place.formattedAddress?.trim() ?? "",
                placeId: place.id?.trim() ?? "",
                latitude,
                longitude,
                neighborhood: componentValue(
                  place.addressComponents,
                  [
                    "neighborhood",
                    "sublocality_level_1",
                    "sublocality",
                  ],
                ),
                city:
                  componentValue(place.addressComponents, [
                    "locality",
                    "administrative_area_level_2",
                  ]) || "Bogotá",
              });
            } catch (selectionError) {
              setError(
                selectionError instanceof Error
                  ? selectionError.message
                  : "No fue posible usar esa dirección.",
              );
            } finally {
              setSelecting(false);
            }
          })();
        };

        autocomplete.addEventListener("gmp-select", listener);
        hostRef.current.appendChild(autocomplete);
      } catch (setupError) {
        setError(
          setupError instanceof Error
            ? setupError.message
            : "No fue posible cargar Google Maps.",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void setup();

    return () => {
      cancelled = true;
      if (autocomplete && listener) {
        autocomplete.removeEventListener("gmp-select", listener);
      }
    };
  }, [placeholder]);

  return (
    <div className="space-y-2">
      <div className="min-h-[48px] rounded-xl border border-neutral-200 bg-white px-2 py-0.5">
        <div ref={hostRef} />
        {(loading || selecting) && (
          <div className="flex h-11 items-center px-2 alento-ui-micro text-neutral-400">
            {selecting
              ? "Validando ubicación..."
              : "Cargando Google Maps..."}
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2">
          <p className="alento-ui-micro font-semibold text-red-700">
            {error}
          </p>
        </div>
      )}
    </div>
  );
}
