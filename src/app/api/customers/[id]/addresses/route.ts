import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function numberOrNull(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

const customerSelect = {
  id: true,
  name: true,
  countryCode: true,
  phone: true,
  email: true,
  notes: true,
  addresses: {
    orderBy: [{ isDefault: "desc" as const }, { createdAt: "asc" as const }],
    take: 1,
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
  },
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const customerId = Number(id);

  if (!Number.isInteger(customerId)) {
    return NextResponse.json({ error: "Cliente inválido." }, { status: 400 });
  }

  const body = await request.json();
  const formattedAddress = clean(body.formattedAddress || body.address);
  const placeId = clean(body.placeId);
  const latitude = numberOrNull(body.latitude);
  const longitude = numberOrNull(body.longitude);
  const label = clean(body.label) || "Casa";
  const neighborhood = clean(body.neighborhood);
  const city = clean(body.city) || "Bogotá";
  const notes = clean(body.notes);

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
      { error: "Selecciona y valida la dirección con Google Maps." },
      { status: 400 },
    );
  }

  try {
    const customer = await prisma.$transaction(async (tx) => {
      const exists = await tx.customer.findUnique({
        where: { id: customerId },
        select: { id: true },
      });
      if (!exists) throw new Error("CUSTOMER_NOT_FOUND");

      const existing = await tx.customerAddress.findFirst({
        where: { customerId },
        orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      });

      let keepId: number;

      if (existing) {
        const updated = await tx.customerAddress.update({
          where: { id: existing.id },
          data: {
            label,
            address: formattedAddress,
            formattedAddress,
            placeId,
            latitude,
            longitude,
            neighborhood: neighborhood || null,
            city,
            notes: notes || null,
            isDefault: true,
          },
        });
        keepId = updated.id;
      } else {
        const created = await tx.customerAddress.create({
          data: {
            customerId,
            label,
            address: formattedAddress,
            formattedAddress,
            placeId,
            latitude,
            longitude,
            neighborhood: neighborhood || null,
            city,
            notes: notes || null,
            isDefault: true,
          },
        });
        keepId = created.id;
      }

      await tx.customerAddress.deleteMany({
        where: {
          customerId,
          id: { not: keepId },
        },
      });

      return tx.customer.findUnique({
        where: { id: customerId },
        select: customerSelect,
      });
    });

    return NextResponse.json({ customer }, { status: 200 });
  } catch (error) {
    if (error instanceof Error && error.message === "CUSTOMER_NOT_FOUND") {
      return NextResponse.json(
        { error: "Cliente no encontrado." },
        { status: 404 },
      );
    }

    console.error("Error saving customer address", error);
    return NextResponse.json(
      { error: "No fue posible guardar la dirección." },
      { status: 500 },
    );
  }
}
