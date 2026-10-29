"use client";

import GoogleCustomerAddressPicker, {
  type GoogleCustomerAddressSelection,
} from "@/components/GoogleCustomerAddressPicker";

export type CustomerAddressEditorValue = {
  address?: string;
  formattedAddress?: string;
  placeId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  neighborhood?: string;
  city?: string;
  notes?: string;
  covered?: boolean;
  deliveryFee?: number | null;
  distanceMeters?: number | null;
};

export type StrictCustomerAddressEditorValue = {
  address: string;
  formattedAddress: string;
  placeId: string;
  latitude: number | null;
  longitude: number | null;
  neighborhood: string;
  city: string;
  notes: string;
};

export function mergeCustomerAddressEditorValue<
  T extends StrictCustomerAddressEditorValue,
>(
  current: T,
  next: CustomerAddressEditorValue,
): T {
  return {
    ...current,
    address:
      next.address !== undefined ? next.address : current.address,
    formattedAddress:
      next.formattedAddress !== undefined
        ? next.formattedAddress
        : current.formattedAddress,
    placeId:
      typeof next.placeId === "string" ? next.placeId : "",
    latitude:
      next.latitude !== undefined
        ? next.latitude
        : current.latitude,
    longitude:
      next.longitude !== undefined
        ? next.longitude
        : current.longitude,
    neighborhood:
      next.neighborhood !== undefined
        ? next.neighborhood
        : current.neighborhood,
    city:
      next.city !== undefined ? next.city : current.city,
    notes:
      next.notes !== undefined ? next.notes : current.notes,
  } as T;
}

export function isValidatedCustomerAddress(
  value: CustomerAddressEditorValue | null | undefined,
) {
  return Boolean(
    value?.placeId &&
      value.latitude != null &&
      value.longitude != null &&
      Number.isFinite(Number(value.latitude)) &&
      Number.isFinite(Number(value.longitude)),
  );
}

export default function CustomerAddressEditor({
  value,
  onChange,
  eyebrow = "Ubicación",
  title = "Dirección de entrega",
  description = "Revisa el punto en el mapa y deja las indicaciones necesarias para el domiciliario.",
  showDetailsBeforeValidation = false,
}: {
  value: CustomerAddressEditorValue;
  onChange: (next: CustomerAddressEditorValue) => void;
  eyebrow?: string;
  title?: string;
  description?: string;
  showDetailsBeforeValidation?: boolean;
}) {
  const validated = isValidatedCustomerAddress(value);
  const visibleAddress = value.formattedAddress || value.address || "";

  const applySelection = (selection: GoogleCustomerAddressSelection) => {
    onChange({
      ...value,
      address: selection.formattedAddress,
      formattedAddress: selection.formattedAddress,
      placeId: selection.placeId,
      latitude: selection.latitude,
      longitude: selection.longitude,
      neighborhood: selection.neighborhood || value.neighborhood || "",
      city: selection.city || value.city || "Bogotá",
      covered: selection.covered,
      deliveryFee: selection.deliveryFee,
      distanceMeters: selection.distanceMeters,
    });
  };

  return (
    <section className="space-y-4">
      <div className="rounded-[24px] border border-neutral-200 bg-white p-5 shadow-[0_10px_30px_rgba(20,18,16,.04)] sm:p-6">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-neutral-100 pb-4">
          <div>
            <p className="alento-ui-label uppercase text-neutral-400">
              {eyebrow}
            </p>
            <h3 className="mt-1 text-[22px] font-bold tracking-[-0.025em] text-neutral-950">
              {title}
            </h3>
            <p className="mt-1 text-[12px] leading-5 text-neutral-400">
              {description}
            </p>
          </div>

          {validated ? (
            <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[10px] font-bold uppercase text-emerald-700">
              ✓ Validada con Google
            </span>
          ) : (
            <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[10px] font-bold uppercase text-amber-700">
              Requiere validación
            </span>
          )}
        </div>

        <GoogleCustomerAddressPicker
          currentAddress={validated ? visibleAddress || undefined : undefined}
          initialSelection={{
            formattedAddress: visibleAddress || undefined,
            placeId: value.placeId || undefined,
            latitude: value.latitude ?? null,
            longitude: value.longitude ?? null,
            neighborhood: value.neighborhood || undefined,
            city: value.city || undefined,
          }}
          onSelect={applySelection}
        />
      </div>

      {(validated || showDetailsBeforeValidation) && (
        <div className="grid gap-4 md:grid-cols-2">
          <label className="rounded-[20px] border border-neutral-200 bg-white p-4 shadow-[0_8px_24px_rgba(20,18,16,.035)]">
            <span className="mb-1.5 block text-[11px] font-bold text-neutral-600">
              Barrio
            </span>
            <input
              value={value.neighborhood ?? ""}
              onChange={(event) =>
                onChange({
                  ...value,
                  neighborhood: event.target.value,
                })
              }
              className="alento-input h-12 w-full rounded-xl px-3.5"
              placeholder="Ej. Kennedy"
            />
            <span className="mt-2 block text-[10px] leading-4 text-neutral-400">
              Ayuda a identificar rápidamente la zona del domicilio.
            </span>
          </label>

          <label className="rounded-[20px] border border-neutral-200 bg-white p-4 shadow-[0_8px_24px_rgba(20,18,16,.035)]">
            <span className="mb-1.5 block text-[11px] font-bold text-neutral-600">
              Indicaciones para entregar
            </span>
            <textarea
              value={value.notes ?? ""}
              onChange={(event) =>
                onChange({
                  ...value,
                  notes: event.target.value,
                })
              }
              className="alento-input min-h-[82px] w-full resize-none rounded-xl px-3.5 py-3"
              placeholder="Casa, torre, apartamento, portería, referencias..."
            />
          </label>
        </div>
      )}
    </section>
  );
}
