import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const listAll = request.nextUrl.searchParams.get("all") === "1";
  const normalizedQuery = normalizePhone(query);

  if (!listAll && query.length < 2) {
    return NextResponse.json({ customers: [] });
  }

  const customers = await prisma.customer.findMany({
    where: query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { phone: { contains: normalizedQuery || query } },
            { email: { contains: query, mode: "insensitive" } },
          ],
        }
      : undefined,
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
          neighborhood: true,
          city: true,
          notes: true,
          isDefault: true,
        },
      },
      createdAt: true,
      orders: {
        where: { status: { not: "CANCELED" } },
        select: {
          total: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      },
      _count: {
        select: { orders: true },
      },
    },
    orderBy: { name: "asc" },
    take: listAll ? 1000 : 10,
  });

  const enrichedCustomers = customers.map(({ orders, ...customer }) => {
    const purchaseCount = orders.length;
    const totalSpent = orders.reduce((sum, order) => sum + Number(order.total), 0);
    const averageTicket = purchaseCount > 0 ? totalSpent / purchaseCount : 0;
    const firstOrderAt = purchaseCount > 0 ? orders[0].createdAt : null;
    const lastOrderAt = purchaseCount > 0 ? orders[purchaseCount - 1].createdAt : null;
    const frequencyDays = purchaseCount > 1 && firstOrderAt && lastOrderAt
      ? Math.max(
          1,
          Math.round(
            (lastOrderAt.getTime() - firstOrderAt.getTime())
            / 86400000
            / (purchaseCount - 1),
          ),
        )
      : null;

    return {
      ...customer,
      metrics: {
        purchaseCount,
        totalSpent,
        averageTicket,
        firstOrderAt,
        lastOrderAt,
        frequencyDays,
      },
    };
  });

  return NextResponse.json({ customers: enrichedCustomers });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const countryCode = typeof body.countryCode === "string" && body.countryCode.trim() ? body.countryCode.trim() : "+57";
  const phone = typeof body.phone === "string" ? normalizePhone(body.phone) : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const address = typeof body.address === "string" ? body.address.trim() : "";
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";

  if (!name) {
    return NextResponse.json({ error: "El nombre es obligatorio." }, { status: 400 });
  }

  if (!phone) {
    return NextResponse.json({ error: "El teléfono es obligatorio." }, { status: 400 });
  }

  try {
    const customer = await prisma.customer.create({
      data: {
        name,
        countryCode,
        phone,
        email: email || null,
        notes: notes || null,
        ...(address
          ? {
              addresses: {
                create: {
                  address,
                  isDefault: true,
                },
              },
            }
          : {}),
      },
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
            neighborhood: true,
            city: true,
            notes: true,
            isDefault: true,
          },
        },
        _count: {
          select: { orders: true },
        },
      },
    });

    return NextResponse.json({ customer }, { status: 201 });
  } catch (error) {
    const prismaError = error as { code?: string };

    if (prismaError.code === "P2002") {
      return NextResponse.json(
        { error: "Ya existe un cliente con ese teléfono o correo." },
        { status: 409 },
      );
    }

    console.error("Error creating customer", error);
    return NextResponse.json({ error: "No fue posible crear el cliente." }, { status: 500 });
  }
}
