import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCustomerSession } from "@/lib/auth";
import { geocodeAddress } from "@/lib/googleMapsServer";

type StoredAddress = {
  id: number;
  label: string | null;
  address: string;
  formattedAddress: string | null;
  placeId: string | null;
  latitude: number | null;
  longitude: number | null;
  neighborhood: string | null;
  city: string | null;
  notes: string | null;
  isDefault: boolean;
};

async function resolveStoredAddress(address: StoredAddress) {
  if (
    Number.isFinite(Number(address.latitude)) &&
    Number.isFinite(Number(address.longitude))
  ) {
    return {
      formattedAddress: address.formattedAddress || address.address,
      placeId: address.placeId || "",
      latitude: Number(address.latitude),
      longitude: Number(address.longitude),
    };
  }

  const candidates = [
    [address.address, address.neighborhood, address.city || "Bogotá", "Colombia"],
    [address.address, address.city || "Bogotá", "Colombia"],
    [address.address, "Bogotá", "Colombia"],
    [address.address, "Colombia"],
  ]
    .map((parts) => parts.filter(Boolean).join(", "))
    .filter((value, index, list) => value && list.indexOf(value) === index);

  let lastError: unknown = null;

  for (const candidate of candidates) {
    try {
      const location = await geocodeAddress(candidate);

      await prisma.customerAddress.update({
        where: { id: address.id },
        data: {
          formattedAddress: location.formattedAddress,
          placeId: location.placeId,
          latitude: location.latitude,
          longitude: location.longitude,
        },
      });

      return location;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("No fue posible ubicar esta dirección guardada.");
}

export async function GET() {
  try {
    const session = await getCustomerSession();
    if (!session) {
      return NextResponse.json({ authenticated: false, address: null });
    }

    const addresses = await prisma.customerAddress.findMany({
      where: { customerId: session.customerId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      select: {
        id: true,
        label: true,
        address: true,
        formattedAddress: true,
        placeId: true,
        latitude: true,
        longitude: true,
        neighborhood: true,
        city: true,
        notes: true,
        isDefault: true,
      },
    });

    if (!addresses.length) {
      return NextResponse.json({
        authenticated: true,
        address: null,
        addresses: [],
      });
    }

    const primary = addresses[0];
    let resolvedPrimary = null;

    if (primary?.address?.trim()) {
      const location = await resolveStoredAddress(primary);
      resolvedPrimary = {
        id: primary.id,
        label: primary.label,
        notes: primary.notes,
        isDefault: primary.isDefault,
        ...location,
      };
    }

    return NextResponse.json({
      authenticated: true,
      address: resolvedPrimary,
      addresses,
    });
  } catch (error) {
    console.error("Customer default delivery address error", error);
    return NextResponse.json(
      {
        authenticated: true,
        address: null,
        error: "No fue posible cargar la dirección guardada.",
      },
      { status: 200 },
    );
  }
}


export async function POST(request: Request) {
  try {
    const session = await getCustomerSession();
    if (!session) {
      return NextResponse.json(
        { authenticated: false, error: "Inicia sesión para usar tus direcciones." },
        { status: 401 },
      );
    }

    const body = await request.json();
    const addressId = Number(body?.addressId);

    if (!Number.isInteger(addressId)) {
      return NextResponse.json({ error: "Dirección inválida." }, { status: 400 });
    }

    const address = await prisma.customerAddress.findFirst({
      where: {
        id: addressId,
        customerId: session.customerId,
      },
      select: {
        id: true,
        label: true,
        address: true,
        formattedAddress: true,
        placeId: true,
        latitude: true,
        longitude: true,
        neighborhood: true,
        city: true,
        notes: true,
        isDefault: true,
      },
    });

    if (!address?.address?.trim()) {
      return NextResponse.json({ error: "Dirección no encontrada." }, { status: 404 });
    }

    const location = await resolveStoredAddress(address);

    return NextResponse.json({
      authenticated: true,
      address: {
        id: address.id,
        label: address.label,
        notes: address.notes,
        isDefault: address.isDefault,
        ...location,
      },
    });
  } catch (error) {
    console.error("Customer delivery address resolve error", error);
    return NextResponse.json(
      { error: "No fue posible cargar esa dirección guardada." },
      { status: 500 },
    );
  }
}
