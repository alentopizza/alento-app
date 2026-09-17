import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  canTransition,
  nextStatus,
  type FulfillmentType,
  type OrderStatus,
} from "@/lib/orderWorkflow";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: rawId } = await context.params;
    const id = Number(rawId);
    if (!Number.isInteger(id)) {
      return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        fulfillmentType: true,
        items: { select: { id: true, quantity: true, preparedQuantity: true } },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Pedido no encontrado." }, { status: 404 });
    }

    if (order.status === "CANCELED") {
      return NextResponse.json({ error: "Un pedido cancelado no puede avanzar de estado." }, { status: 409 });
    }

    if (order.status === "COMPLETED") {
      return NextResponse.json({ error: "El pedido ya está finalizado." }, { status: 409 });
    }

    const body = await request.json().catch(() => ({}));
    const requested = String(body?.status ?? "").toUpperCase() as OrderStatus;
    const fulfillmentType = order.fulfillmentType as FulfillmentType;
    const current = order.status as OrderStatus;
    const expected = nextStatus(current, fulfillmentType);

    if (current === "PREPARING" && requested === "PREPARED") {
      const allPrepared = order.items.length > 0 && order.items.every((item) => item.preparedQuantity >= item.quantity);
      if (!allPrepared) {
        return NextResponse.json(
          { error: "Todos los productos deben estar preparados antes de pasar el pedido a PREPARADO." },
          { status: 409 },
        );
      }
    }

    if (!requested || !canTransition(current, requested, fulfillmentType)) {
      return NextResponse.json(
        {
          error: expected
            ? `La siguiente etapa válida es ${expected}.`
            : "Este pedido no tiene una transición disponible.",
        },
        { status: 409 },
      );
    }

    const updated = await prisma.order.update({
      where: { id },
      data: { status: requested },
      select: {
        id: true,
        status: true,
        fulfillmentType: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ order: updated });
  } catch (error) {
    console.error("Order status update error", error);
    return NextResponse.json({ error: "No fue posible actualizar el estado del pedido." }, { status: 500 });
  }
}
