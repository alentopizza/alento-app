import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; addressId: string }> },
) {
  const { id, addressId } = await params;
  const customerId = Number(id);
  const targetId = Number(addressId);

  if (!Number.isInteger(customerId) || !Number.isInteger(targetId)) {
    return NextResponse.json({ error: "Dirección inválida." }, { status: 400 });
  }

  const body = await request.json();

  try {
    const customer = await prisma.$transaction(async (tx) => {
      const existing = await tx.customerAddress.findFirst({
        where: { id: targetId, customerId },
      });
      if (!existing) throw new Error("ADDRESS_NOT_FOUND");

      const address =
        typeof body.address === "string" ? clean(body.address) : existing.address;
      const formattedAddress =
        typeof body.formattedAddress === "string"
          ? clean(body.formattedAddress)
          : existing.formattedAddress ?? "";
      const placeId =
        typeof body.placeId === "string" ? clean(body.placeId) : existing.placeId ?? "";
      const latitude =
        body.latitude == null ? existing.latitude : Number(body.latitude);
      const longitude =
        body.longitude == null ? existing.longitude : Number(body.longitude);
      const label =
        typeof body.label === "string" ? clean(body.label) : existing.label ?? "";
      const neighborhood =
        typeof body.neighborhood === "string"
          ? clean(body.neighborhood)
          : existing.neighborhood ?? "";
      const city =
        typeof body.city === "string" ? clean(body.city) : existing.city ?? "Bogotá";
      const notes =
        typeof body.notes === "string" ? clean(body.notes) : existing.notes ?? "";
      const makeDefault =
        body.isDefault === true ? true : body.isDefault === false ? false : existing.isDefault;

      if (!address) throw new Error("ADDRESS_REQUIRED");

      if (makeDefault) {
        await tx.customerAddress.updateMany({
          where: { customerId, id: { not: targetId } },
          data: { isDefault: false },
        });
      }

      await tx.customerAddress.update({
        where: { id: targetId },
        data: {
          address,
          formattedAddress: formattedAddress || null,
          placeId: placeId || null,
          latitude: Number.isFinite(Number(latitude)) ? Number(latitude) : null,
          longitude: Number.isFinite(Number(longitude)) ? Number(longitude) : null,
          label: label || null,
          neighborhood: neighborhood || null,
          city: city || null,
          notes: notes || null,
          isDefault: makeDefault,
        },
      });

      // Si al editar se quitó la principal y ya no queda ninguna, promover la primera.
      const defaults = await tx.customerAddress.count({
        where: { customerId, isDefault: true },
      });
      if (defaults === 0) {
        const first = await tx.customerAddress.findFirst({
          where: { customerId },
          orderBy: { createdAt: "asc" },
          select: { id: true },
        });
        if (first) {
          await tx.customerAddress.update({
            where: { id: first.id },
            data: { isDefault: true },
          });
        }
      }

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

    return NextResponse.json({ customer });
  } catch (error) {
    if (error instanceof Error && error.message === "ADDRESS_NOT_FOUND") {
      return NextResponse.json({ error: "Dirección no encontrada." }, { status: 404 });
    }
    if (error instanceof Error && error.message === "ADDRESS_REQUIRED") {
      return NextResponse.json({ error: "La dirección es obligatoria." }, { status: 400 });
    }

    console.error("Error updating customer address", error);
    return NextResponse.json(
      { error: "No fue posible actualizar la dirección." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; addressId: string }> },
) {
  const { id, addressId } = await params;
  const customerId = Number(id);
  const targetId = Number(addressId);

  if (!Number.isInteger(customerId) || !Number.isInteger(targetId)) {
    return NextResponse.json({ error: "Dirección inválida." }, { status: 400 });
  }

  try {
    const customer = await prisma.$transaction(async (tx) => {
      const existing = await tx.customerAddress.findFirst({
        where: { id: targetId, customerId },
      });
      if (!existing) throw new Error("ADDRESS_NOT_FOUND");

      await tx.customerAddress.delete({ where: { id: targetId } });

      if (existing.isDefault) {
        const first = await tx.customerAddress.findFirst({
          where: { customerId },
          orderBy: { createdAt: "asc" },
          select: { id: true },
        });
        if (first) {
          await tx.customerAddress.update({
            where: { id: first.id },
            data: { isDefault: true },
          });
        }
      }

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

    return NextResponse.json({ customer });
  } catch (error) {
    if (error instanceof Error && error.message === "ADDRESS_NOT_FOUND") {
      return NextResponse.json({ error: "Dirección no encontrada." }, { status: 404 });
    }

    console.error("Error deleting customer address", error);
    return NextResponse.json(
      { error: "No fue posible eliminar la dirección." },
      { status: 500 },
    );
  }
}
