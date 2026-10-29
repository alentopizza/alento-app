import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCustomerSession } from "@/lib/auth";

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function validCoordinate(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function isGoogleValidated(address: {
  formattedAddress: string | null;
  placeId: string | null;
  latitude: number | null;
  longitude: number | null;
}) {
  return Boolean(
    address.formattedAddress?.trim() &&
      address.placeId?.trim() &&
      Number.isFinite(Number(address.latitude)) &&
      Number.isFinite(Number(address.longitude)),
  );
}

export async function GET() {
  try {
    const session = await getCustomerSession();

    if (!session) {
      return NextResponse.json({
        authenticated: false,
        address: null,
        requiresValidation: false,
      });
    }

    const address = await prisma.customerAddress.findFirst({
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

    if (!address) {
      return NextResponse.json({
        authenticated: true,
        address: null,
        requiresValidation: false,
      });
    }

    const validated = isGoogleValidated(address);

    return NextResponse.json({
      authenticated: true,
      requiresValidation: !validated,
      address: validated
        ? {
            ...address,
            formattedAddress: address.formattedAddress!,
            placeId: address.placeId!,
            latitude: Number(address.latitude),
            longitude: Number(address.longitude),
            validated: true,
          }
        : {
            id: address.id,
            label: address.label,
            address: address.address,
            neighborhood: address.neighborhood,
            city: address.city,
            notes: address.notes,
            validated: false,
          },
    });
  } catch (error) {
    console.error("Customer delivery address error", error);
    return NextResponse.json(
      {
        authenticated: true,
        address: null,
        requiresValidation: false,
        error: "No fue posible cargar la dirección guardada.",
      },
      { status: 200 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getCustomerSession();

    if (!session) {
      return NextResponse.json({
        authenticated: false,
        saved: false,
      });
    }

    const body = await request.json();
    const formattedAddress = clean(body.formattedAddress);
    const placeId = clean(body.placeId);
    const latitude = validCoordinate(body.latitude);
    const longitude = validCoordinate(body.longitude);

    if (
      !formattedAddress ||
      !placeId ||
      latitude == null ||
      longitude == null ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return NextResponse.json(
        { error: "Selecciona una dirección válida de Google." },
        { status: 400 },
      );
    }

    const customer = await prisma.customer.findUnique({
      where: { id: session.customerId },
      select: { id: true },
    });

    if (!customer) {
      return NextResponse.json(
        { error: "Cliente no encontrado." },
        { status: 404 },
      );
    }

    const saved = await prisma.$transaction(async (tx) => {
      const existing = await tx.customerAddress.findFirst({
        where: { customerId: session.customerId },
        orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      });

      let addressId: number;

      if (existing) {
        const updated = await tx.customerAddress.update({
          where: { id: existing.id },
          data: {
            address: formattedAddress,
            formattedAddress,
            placeId,
            latitude,
            longitude,
            city: existing.city || "Bogotá",
            isDefault: true,
          },
        });
        addressId = updated.id;

        await tx.customerAddress.deleteMany({
          where: {
            customerId: session.customerId,
            id: { not: existing.id },
          },
        });
      } else {
        const created = await tx.customerAddress.create({
          data: {
            customerId: session.customerId,
            label: "Casa",
            address: formattedAddress,
            formattedAddress,
            placeId,
            latitude,
            longitude,
            city: "Bogotá",
            isDefault: true,
          },
        });
        addressId = created.id;
      }

      return tx.customerAddress.findUnique({
        where: { id: addressId },
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
    });

    return NextResponse.json({
      authenticated: true,
      saved: true,
      address: saved,
    });
  } catch (error) {
    console.error("Customer delivery address update error", error);
    return NextResponse.json(
      { error: "No fue posible actualizar la dirección guardada." },
      { status: 500 },
    );
  }
}
