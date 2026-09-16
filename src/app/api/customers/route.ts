import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const normalizedQuery = normalizePhone(query);

  if (query.length < 2) {
    return NextResponse.json({ customers: [] });
  }

  const customers = await prisma.customer.findMany({
    where: {
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { phone: { contains: normalizedQuery || query } },
        { email: { contains: query, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      name: true,
      countryCode: true,
      phone: true,
      email: true,
      notes: true,
      addresses: {
        where: { isDefault: true },
        select: {
          id: true,
          address: true,
          neighborhood: true,
          city: true,
          notes: true,
        },
        take: 1,
      },
    },
    orderBy: { name: "asc" },
    take: 10,
  });

  return NextResponse.json({ customers });
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
          where: { isDefault: true },
          select: {
            id: true,
            address: true,
            neighborhood: true,
            city: true,
            notes: true,
          },
          take: 1,
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
