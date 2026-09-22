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
import { dispatchOrderStatusNotification } from "@/lib/notifier";
import { findTemplateForEvent, getNotificationTemplates } from "@/lib/notificationTemplates";

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
        sequenceNumber: true,
        customerId: true,
        status: true,
        fulfillmentType: true,
        subtotal: true,
        discount: true,
        discountSource: true,
        total: true,
        customer: {
          select: {
            name: true,
            countryCode: true,
            phone: true,
          },
        },
        payments: {
          where: { status: "PAID" },
          select: { amount: true },
        },
        items: {
          select: {
            id: true,
            quantity: true,
            preparedQuantity: true,
            lineTotal: true,
            product: {
              select: {
                type: true,
                couponEligible: true,
              },
            },
          },
        },
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
    const reviewTemplate = requested === "COMPLETED"
      ? findTemplateForEvent(await getNotificationTemplates(), "order.review", fulfillmentType)
      : null;

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
        const hasOrderDiscount = Number(order.discount) > 0;
        const eligibleClubSubtotal = order.items.reduce((sum, item) => {
          if (!item.product) return sum;

          // Los combos ya incorporan descuento propio y nunca acumulan puntos.
          if (item.product.type === "COMBO") return sum;

          // Si el pedido recibió cupón/descuento manual, los productos elegibles
          // para descuento quedan fuera de la acumulación. Los productos no
          // descontables conservan su valor completo y sí pueden acumular.
          if (hasOrderDiscount && item.product.couponEligible) return sum;

          return sum + Number(item.lineTotal);
        }, 0);

        const points = clubPointsForAmount(
          eligibleClubSubtotal,
          clubSettings.earnRatePercent,
        );

        await tx.clubPointTransaction.upsert({
          where: { orderId: order.id },
          update: {},
          create: {
            customerId: order.customerId,
            orderId: order.id,
            points,
            ratePerThousand: Math.round(clubSettings.earnRatePercent * 10),
            amountBase: eligibleClubSubtotal,
            reason: "PURCHASE",
          },
        });

        if (reviewTemplate) {
          const delayMinutes = reviewTemplate.delayMinutes ?? 60;
          await tx.notificationJob.upsert({
            where: { kind_orderId: { kind: "GOOGLE_REVIEW", orderId: order.id } },
            create: {
              kind: "GOOGLE_REVIEW",
              orderId: order.id,
              runAt: new Date(Date.now() + delayMinutes * 60_000),
              status: "PENDING",
            },
            update: {
              runAt: new Date(Date.now() + delayMinutes * 60_000),
              status: "PENDING",
              attempts: 0,
              lastError: null,
              sentAt: null,
              lockedAt: null,
            },
          });
        }
      }

      return updatedOrder;
    });

    let notification:
      | Awaited<ReturnType<typeof dispatchOrderStatusNotification>>
      | { ok: false; status: "skipped"; reason: string } = {
      ok: false,
      status: "skipped",
      reason: "El pedido no tiene un cliente con teléfono.",
    };

    if (order.customerId && order.customer?.phone) {
      const code = `POS-${String(order.sequenceNumber ?? order.id).padStart(4, "0")}`;
      notification = await dispatchOrderStatusNotification({
        orderId: order.id,
        customerId: order.customerId,
        customerName: order.customer.name,
        phone: `${order.customer.countryCode ?? "+57"}${order.customer.phone}`,
        orderCode: code,
        total: Number(order.total),
        fulfillmentType: order.fulfillmentType,
        previousStatus: current,
        status: requested,
      });

      if (!notification.ok) {
        console.warn("Notifier order status", {
          orderId: order.id,
          from: current,
          to: requested,
          reason: notification.reason,
        });
      }
    }

    return NextResponse.json({ order: updated, notification });
  } catch (error) {
    console.error("Order status update error", error);
    return NextResponse.json({ error: "No fue posible actualizar el estado del pedido." }, { status: 500 });
  }
}
