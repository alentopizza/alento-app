import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendCustomerContactWebhook } from "@/lib/customerContactWebhook";

function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const customerId = Number(id);

  if (!Number.isInteger(customerId)) {
    return NextResponse.json({ error: "Cliente inválido." }, { status: 400 });
  }

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: {
      id: true,
      name: true,
      countryCode: true,
      phone: true,
      email: true,
      notes: true,
      createdAt: true,
      addresses: {
        orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
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
      orders: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          sequenceNumber: true,
          source: true,
          status: true,
          fulfillmentType: true,
          total: true,
          createdAt: true,
          items: {
            select: {
              id: true,
              productName: true,
              quantity: true,
              unitPrice: true,
              lineTotal: true,
              configuration: true,
              notes: true,
            },
          },
        },
      },
      _count: { select: { orders: true } },
    },
  });

  if (!customer) {
    return NextResponse.json({ error: "Cliente no encontrado." }, { status: 404 });
  }

  const validOrders = customer.orders.filter((order) => order.status !== "CANCELED");
  const canceledCount = customer.orders.length - validOrders.length;
  const purchaseCount = validOrders.length;
  const totalSpent = validOrders.reduce((sum, order) => sum + Number(order.total), 0);
  const averageTicket = purchaseCount > 0 ? totalSpent / purchaseCount : 0;
  const chronological = [...validOrders].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const firstOrderAt = chronological[0]?.createdAt ?? null;
  const lastOrderAt = chronological.at(-1)?.createdAt ?? null;
  const cancellationRate =
    customer.orders.length > 0
      ? Math.round((canceledCount / customer.orders.length) * 100)
      : 0;
  const frequencyDays = purchaseCount > 1 && firstOrderAt && lastOrderAt
    ? Math.max(1, Math.round((lastOrderAt.getTime() - firstOrderAt.getTime()) / 86400000 / (purchaseCount - 1)))
    : null;

  return NextResponse.json({
    customer: {
      ...customer,
      metrics: {
        purchaseCount,
        totalSpent,
        averageTicket,
        firstOrderAt,
        lastOrderAt,
        frequencyDays,
        canceledCount,
        cancellationRate,
      },
    },
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const customerId = Number(id);
  const body = await request.json();

  if (!Number.isInteger(customerId)) {
    return NextResponse.json({ error: "Cliente inválido." }, { status: 400 });
  }

  try {
    const existing = await prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        name: true,
        countryCode: true,
        phone: true,
        email: true,
        notes: true,
        contactWebhookPending: true,
        contactWebhookSentAt: true,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Cliente no encontrado." }, { status: 404 });
    }

    const name = typeof body.name === "string" ? body.name.trim() : existing.name;
    const countryCode = typeof body.countryCode === "string" && body.countryCode.trim()
      ? body.countryCode.trim()
      : existing.countryCode || "+57";
    const phone = typeof body.phone === "string"
      ? normalizePhone(body.phone)
      : existing.phone ?? "";
    const email = typeof body.email === "string"
      ? body.email.trim().toLowerCase()
      : existing.email ?? "";
    const notes = typeof body.notes === "string"
      ? body.notes.trim()
      : existing.notes ?? "";
    const hasAddressChange = typeof body.address === "string";
    const address = hasAddressChange ? body.address.trim() : "";

    if (!name || !phone) {
      return NextResponse.json({ error: "Nombre y teléfono son obligatorios." }, { status: 400 });
    }

    const existingAddress = hasAddressChange
      ? await prisma.customerAddress.findFirst({
          where: { customerId, isDefault: true },
          select: { id: true },
        })
      : null;


    const becameNamedCustomer =
      existing.name.trim().toLocaleUpperCase("es") === "NUEVO" &&
      name.trim().toLocaleUpperCase("es") !== "NUEVO";

    const customer = await prisma.$transaction(async (tx) => {
      await tx.customer.update({
        where: { id: customerId },
        data: {
          name,
          countryCode,
          phone,
          email: email || null,
          notes: notes || null,
          ...(becameNamedCustomer && !existing.contactWebhookSentAt
            ? { contactWebhookPending: true }
            : {}),
        },
      });

      if (hasAddressChange) {
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
      }

      return tx.customer.findUnique({
        where: { id: customerId },
        include: {
          addresses: { orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] },
          _count: { select: { orders: true } },
        },
      });
    });

    const contactWebhook = await sendCustomerContactWebhook({
      customerId,
      source: "STAFF",
    });

    return NextResponse.json({ customer, contactWebhook });
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
