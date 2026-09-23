import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCustomerSession } from "@/lib/auth";
import { geocodeAddress } from "@/lib/googleMapsServer";

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
      const query = [
        primary.address.trim(),
        primary.neighborhood?.trim(),
        primary.city?.trim() || "Bogotá",
        "Colombia",
      ]
        .filter(Boolean)
        .join(", ");

      const location = await geocodeAddress(query);
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
        neighborhood: true,
        city: true,
        notes: true,
        isDefault: true,
      },
    });

    if (!address?.address?.trim()) {
      return NextResponse.json({ error: "Dirección no encontrada." }, { status: 404 });
    }

    const query = [
      address.address.trim(),
      address.neighborhood?.trim(),
      address.city?.trim() || "Bogotá",
      "Colombia",
    ]
      .filter(Boolean)
      .join(", ");

    const location = await geocodeAddress(query);

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
