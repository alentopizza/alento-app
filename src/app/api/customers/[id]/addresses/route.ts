import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

async function customerWithAddresses(customerId: number) {
  return prisma.customer.findUnique({
    where: { id: customerId },
    select: {
      id: true,
      name: true,
      countryCode: true,
      phone: true,
      email: true,
      notes: true,
      addresses: {
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
      },
    },
  });
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

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
  const address = clean(body.address);
  const formattedAddress = clean(body.formattedAddress);
  const placeId = clean(body.placeId);
  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);
  const label = clean(body.label);
  const neighborhood = clean(body.neighborhood);
  const city = clean(body.city) || "Bogotá";
  const notes = clean(body.notes);
  const makeDefault = body.isDefault === true;

  if (!address) {
    return NextResponse.json(
      { error: "La dirección es obligatoria." },
      { status: 400 },
    );
  }

  try {
    const customer = await prisma.$transaction(async (tx) => {
      const existingCustomer = await tx.customer.findUnique({
        where: { id: customerId },
        select: {
          id: true,
          _count: { select: { addresses: true } },
        },
      });

      if (!existingCustomer) {
        throw new Error("CUSTOMER_NOT_FOUND");
      }

      const shouldBeDefault =
        makeDefault || existingCustomer._count.addresses === 0;

      if (shouldBeDefault) {
        await tx.customerAddress.updateMany({
          where: { customerId },
          data: { isDefault: false },
        });
      }

      await tx.customerAddress.create({
        data: {
          customerId,
          label: label || null,
          address,
          formattedAddress: formattedAddress || null,
          placeId: placeId || null,
          latitude: Number.isFinite(latitude) ? latitude : null,
          longitude: Number.isFinite(longitude) ? longitude : null,
          neighborhood: neighborhood || null,
          city: city || null,
          notes: notes || null,
          isDefault: shouldBeDefault,
        },
      });

      return tx.customer.findUnique({
        where: { id: customerId },
        select: {
          id: true,
          name: true,
          countryCode: true,
          phone: true,
          email: true,
          notes: true,
          addresses: {
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
          },
        },
      });
    });

    return NextResponse.json({ customer }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "CUSTOMER_NOT_FOUND") {
      return NextResponse.json(
        { error: "Cliente no encontrado." },
        { status: 404 },
      );
    }

    console.error("Error creating customer address", error);
    return NextResponse.json(
      { error: "No fue posible guardar la dirección." },
      { status: 500 },
    );
  }
}
