import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rawIds: unknown[] = Array.isArray(body?.ids) ? body.ids : [];
    const ids: number[] = [
      ...new Set(
        rawIds
          .map((value) => Number(value))
          .filter((value): value is number => Number.isInteger(value) && value > 0),
      ),
    ];

    if (ids.length === 0) {
      return NextResponse.json({ error: "Selecciona al menos un cliente." }, { status: 400 });
    }

    if (ids.length > 500) {
      return NextResponse.json({ error: "Puedes eliminar máximo 500 clientes por operación." }, { status: 400 });
    }

    const customers = await prisma.customer.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        name: true,
        _count: { select: { orders: true } },
      },
    });

    const eligible = customers.filter((customer) => customer._count.orders === 0);
    const blocked = customers.filter((customer) => customer._count.orders > 0);

    if (eligible.length > 0) {
      await prisma.customer.deleteMany({
        where: { id: { in: eligible.map((customer) => customer.id) } },
      });
    }

    return NextResponse.json({
      deleted: eligible.length,
      skipped: blocked.length + Math.max(0, ids.length - customers.length),
      deletedIds: eligible.map((customer) => customer.id),
      blocked: blocked.map((customer) => ({
        id: customer.id,
        name: customer.name,
        reason: "Tiene pedidos asociados.",
      })),
    });
  } catch (error) {
    console.error("Bulk customer delete error", error);
    return NextResponse.json({ error: "No fue posible eliminar los clientes seleccionados." }, { status: 500 });
  }
}
