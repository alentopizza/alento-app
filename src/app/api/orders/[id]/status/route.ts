import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  workflowFor,
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
      return NextResponse.json({ error: "Un pedido cancelado no puede cambiar de estado operativo." }, { status: 409 });
    }

    const body = await request.json().catch(() => ({}));
    const requested = String(body?.status ?? "").toUpperCase() as OrderStatus;
    const fulfillmentType = order.fulfillmentType as FulfillmentType;
    const current = order.status as OrderStatus;
    const flow = workflowFor(fulfillmentType);

    if (!requested || !flow.includes(requested)) {
      return NextResponse.json(
        { error: "El estado seleccionado no pertenece al flujo de este tipo de pedido." },
        { status: 409 },
      );
    }

    if (requested === current) {
      return NextResponse.json({
        order: {
          id: order.id,
          status: current,
          fulfillmentType: order.fulfillmentType,
        },
      });
    }

    const preparedIndex = flow.indexOf("PREPARED");
    const requestedIndex = flow.indexOf(requested);

    const updated = await prisma.$transaction(async (tx) => {
      if (requested === "PREPARING") {
        await tx.orderItem.updateMany({
          where: { orderId: order.id },
          data: { preparedQuantity: 0 },
        });
      } else if (preparedIndex >= 0 && requestedIndex >= preparedIndex) {
        for (const item of order.items) {
          if (item.preparedQuantity !== item.quantity) {
            await tx.orderItem.update({
              where: { id: item.id },
              data: { preparedQuantity: item.quantity },
            });
          }
        }
      }

      return tx.order.update({
        where: { id },
        data: { status: requested },
        select: {
          id: true,
          status: true,
          fulfillmentType: true,
          updatedAt: true,
        },
      });
    });

    return NextResponse.json({ order: updated });
  } catch (error) {
    console.error("Order status update error", error);
    return NextResponse.json({ error: "No fue posible actualizar el estado del pedido." }, { status: 500 });
  }
}
