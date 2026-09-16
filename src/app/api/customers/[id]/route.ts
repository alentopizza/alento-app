import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const customerId = Number(id);
  const body = await request.json();

  if (!Number.isInteger(customerId)) {
    return NextResponse.json({ error: "Cliente inválido." }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const countryCode = typeof body.countryCode === "string" && body.countryCode.trim() ? body.countryCode.trim() : "+57";
  const phone = typeof body.phone === "string" ? normalizePhone(body.phone) : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const address = typeof body.address === "string" ? body.address.trim() : "";
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";

  if (!name || !phone) {
    return NextResponse.json({ error: "Nombre y teléfono son obligatorios." }, { status: 400 });
  }

  try {
    const existingAddress = await prisma.customerAddress.findFirst({
      where: { customerId, isDefault: true },
      select: { id: true },
    });

    const customer = await prisma.$transaction(async (tx) => {
      await tx.customer.update({
        where: { id: customerId },
        data: {
          name,
          countryCode,
          phone,
          email: email || null,
          notes: notes || null,
        },
      });

      if (address) {
        if (existingAddress) {
          await tx.customerAddress.update({
            where: { id: existingAddress.id },
            data: { address },
          });
        } else {
          await tx.customerAddress.create({
            data: { customerId, address, isDefault: true },
          });
        }
      } else if (existingAddress) {
        await tx.customerAddress.delete({ where: { id: existingAddress.id } });
      }

      return tx.customer.findUnique({
        where: { id: customerId },
        include: {
          addresses: { orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] },
          _count: { select: { orders: true } },
        },
      });
    });

    return NextResponse.json({ customer });
  } catch (error) {
    const prismaError = error as { code?: string };
    if (prismaError.code === "P2002") {
      return NextResponse.json({ error: "Ya existe un cliente con ese teléfono o correo." }, { status: 409 });
    }
    if (prismaError.code === "P2025") {
      return NextResponse.json({ error: "Cliente no encontrado." }, { status: 404 });
    }
    console.error("Error updating customer", error);
    return NextResponse.json({ error: "No fue posible actualizar el cliente." }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const customerId = Number(id);

  if (!Number.isInteger(customerId)) {
    return NextResponse.json({ error: "Cliente inválido." }, { status: 400 });
  }

  const orderCount = await prisma.order.count({ where: { customerId } });

  if (orderCount > 0) {
    return NextResponse.json(
      { error: "Este cliente tiene pedidos asociados y no puede eliminarse." },
      { status: 409 },
    );
  }

  try {
    await prisma.customer.delete({ where: { id: customerId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const prismaError = error as { code?: string };
    if (prismaError.code === "P2025") {
      return NextResponse.json({ error: "Cliente no encontrado." }, { status: 404 });
    }
    console.error("Error deleting customer", error);
    return NextResponse.json({ error: "No fue posible eliminar el cliente." }, { status: 500 });
  }
}
