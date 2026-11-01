import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isInKitchenWindow } from "@/lib/orderScheduling";
import { getStaffSession } from "@/lib/auth";
import { staffAuditActor, writeAuditLog } from "@/lib/auditLog";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; itemId: string }> },
) {
  try {
    const session = await getStaffSession();
    if (!session) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }

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
          sequenceNumber: true,
          source: true,
          fulfillmentType: true,
          status: true,
          scheduledFor: true,
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
      if (!["CONFIRMED", "PREPARING"].includes(order.status)) throw new Error("ORDER_NOT_IN_KITCHEN");
      const kitchenLeadSetting = await tx.appSetting.findUnique({
        where: { key: "kitchen_preparation_settings" },
        select: { value: true },
      });
      const rawKitchenLead = kitchenLeadSetting?.value && typeof kitchenLeadSetting.value === "object"
        ? Number((kitchenLeadSetting.value as { leadMinutes?: unknown }).leadMinutes)
        : 30;
      const kitchenLeadMinutes = [15, 20, 25, 30, 35, 40, 45, 50, 60].includes(rawKitchenLead)
        ? rawKitchenLead
        : 30;

      if (
        order.scheduledFor &&
        !isInKitchenWindow(order.scheduledFor, new Date(), kitchenLeadMinutes)
      ) {
        throw new Error("ORDER_NOT_IN_KITCHEN_WINDOW");
      }

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
      let status = order.status;

      // Convención operativa de Alentó:
      // Cocina solo controla CONFIRMED/PREPARING y prepara las líneas del pedido.
      // Al completar todas las líneas, el pedido cambia a PREPARED.
      // PREPARED es el valor técnico persistido que significa "Horneando".
      // Desde ese momento el pedido sale de /cocina.
      // El hornero/operación realiza después PREPARED -> READY cuando sale del horno.
      if (allPrepared && ["CONFIRMED", "PREPARING"].includes(order.status)) {
        status = "PREPARED";
        await tx.order.update({
          where: { id: order.id },
          data: { status: "PREPARED" },
        });

        await writeAuditLog(tx, {
          actor: staffAuditActor(session),
          action: "ORDER_STATUS_CHANGED",
          entityType: "ORDER",
          entityId: order.id,
          summary: `Pedido #${order.sequenceNumber ?? order.id}: ${order.status} → PREPARED (Horneando) desde Cocina.`,
          before: {
            status: order.status,
          },
          after: {
            status: "PREPARED",
          },
          metadata: {
            sequenceNumber: order.sequenceNumber,
            source: order.source,
            fulfillmentType: order.fulfillmentType,
            transitionOrigin: "KITCHEN_AUTO_PREPARED",
          },
          source: "api/orders/[id]/items/[itemId]/prepared",
        });
      }

      return { preparedQuantity, status, allPrepared };
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "ORDER_NOT_FOUND") return NextResponse.json({ error: "Pedido no encontrado." }, { status: 404 });
      if (error.message === "ITEM_NOT_FOUND") return NextResponse.json({ error: "Producto no encontrado en el pedido." }, { status: 404 });
      if (error.message === "ORDER_NOT_IN_KITCHEN") return NextResponse.json({ error: "El pedido ya no se encuentra en Cocina." }, { status: 409 });
      if (error.message === "ORDER_NOT_IN_KITCHEN_WINDOW") return NextResponse.json({ error: "El pedido programado aún no ha entrado en su ventana de preparación." }, { status: 409 });
    }
    console.error("Kitchen item preparation error", error);
    return NextResponse.json({ error: "No fue posible actualizar la preparación del producto." }, { status: 500 });
  }
}
