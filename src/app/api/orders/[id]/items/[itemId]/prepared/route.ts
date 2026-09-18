import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; itemId: string }> },
) {
  try {
    const { id: rawOrderId, itemId: rawItemId } = await context.params;
    const orderId = Number(rawOrderId);
    const itemId = Number(rawItemId);
    if (!Number.isInteger(orderId) || !Number.isInteger(itemId)) {
      return NextResponse.json({ error: "Pedido o producto inválido." }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const requestedQuantity = Math.floor(Number(body?.preparedQuantity));
    if (!Number.isFinite(requestedQuantity) || requestedQuantity < 0) {
      return NextResponse.json({ error: "Cantidad preparada inválida." }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          status: true,
          items: {
            select: {
              id: true,
              quantity: true,
              preparedQuantity: true,
              product: { select: { category: { select: { slug: true } } } },
            },
          },
        },
      });
      if (!order) throw new Error("ORDER_NOT_FOUND");
      if (!["PREPARING", "PREPARED"].includes(order.status)) throw new Error("ORDER_NOT_IN_KITCHEN");

      const item = order.items.find((candidate) => candidate.id === itemId);
      if (!item) throw new Error("ITEM_NOT_FOUND");

      const preparedQuantity = Math.min(requestedQuantity, item.quantity);
      await tx.orderItem.update({
        where: { id: item.id },
        data: { preparedQuantity },
      });

      const refreshedItems = order.items.map((candidate) =>
        candidate.id === item.id ? { ...candidate, preparedQuantity } : candidate,
      );
      const kitchenItems = refreshedItems.filter((candidate) => candidate.product?.category?.slug !== "bebidas");
      const allPrepared = kitchenItems.length > 0 && kitchenItems.every((candidate) => candidate.preparedQuantity >= candidate.quantity);
      const anyIncomplete = kitchenItems.some((candidate) => candidate.preparedQuantity < candidate.quantity);

      let status = order.status;
      if (allPrepared && order.status === "PREPARING") {
        status = "PREPARED";
        await tx.order.update({ where: { id: order.id }, data: { status: "PREPARED" } });
      } else if (anyIncomplete && order.status === "PREPARED") {
        status = "PREPARING";
        await tx.order.update({ where: { id: order.id }, data: { status: "PREPARING" } });
      }

      return { preparedQuantity, status, allPrepared };
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "ORDER_NOT_FOUND") return NextResponse.json({ error: "Pedido no encontrado." }, { status: 404 });
      if (error.message === "ITEM_NOT_FOUND") return NextResponse.json({ error: "Producto no encontrado en el pedido." }, { status: 404 });
      if (error.message === "ORDER_NOT_IN_KITCHEN") return NextResponse.json({ error: "El pedido ya no se encuentra en Cocina." }, { status: 409 });
    }
    console.error("Kitchen item preparation error", error);
    return NextResponse.json({ error: "No fue posible actualizar la preparación del producto." }, { status: 500 });
  }
}
