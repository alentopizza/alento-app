import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  CLUB_ALENTO_SETTING_KEY,
  DEFAULT_CLUB_ALENTO_SETTINGS,
  clubPointsForAmount,
  normalizeClubAlentoSettings,
} from "@/lib/clubAlento";
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
        customerId: true,
        status: true,
        fulfillmentType: true,
        total: true,
        payments: {
          where: { status: "PAID" },
          select: { amount: true },
        },
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

    const currentIndex = flow.indexOf(current);
    const requestedIndex = flow.indexOf(requested);

    if (currentIndex >= 0 && requestedIndex < currentIndex) {
      return NextResponse.json(
        { error: "No se puede devolver el pedido a una etapa anterior. Selecciona el estado actual o una etapa posterior." },
        { status: 409 },
      );
    }

    if (requested === "COMPLETED") {
      const paidAmount = order.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
      const pending = Math.max(0, Number(order.total) - paidAmount);

      if (pending > 0) {
        return NextResponse.json(
          { error: `El pedido tiene un saldo pendiente de $${pending.toLocaleString("es-CO")}. Registra el pago completo antes de finalizar.` },
          { status: 409 },
        );
      }
    }

    const preparedIndex = flow.indexOf("PREPARED");

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

      const updatedOrder = await tx.order.update({
        where: { id },
        data: { status: requested },
        select: {
          id: true,
          status: true,
          fulfillmentType: true,
          updatedAt: true,
        },
      });

      if (requested === "COMPLETED" && order.customerId) {
        const savedClubSettings = await tx.appSetting.findUnique({
          where: { key: CLUB_ALENTO_SETTING_KEY },
        });
        const clubSettings = savedClubSettings
          ? normalizeClubAlentoSettings(savedClubSettings.value)
          : DEFAULT_CLUB_ALENTO_SETTINGS;
        const points = clubPointsForAmount(
          Number(order.total),
          clubSettings.pointsPerThousand,
        );

        await tx.clubPointTransaction.upsert({
          where: { orderId: order.id },
          update: {},
          create: {
            customerId: order.customerId,
            orderId: order.id,
            points,
            ratePerThousand: clubSettings.pointsPerThousand,
            amountBase: order.total,
            reason: "PURCHASE",
          },
        });
      }

      return updatedOrder;
    });

    return NextResponse.json({ order: updated });
  } catch (error) {
    console.error("Order status update error", error);
    return NextResponse.json({ error: "No fue posible actualizar el estado del pedido." }, { status: 500 });
  }
}
