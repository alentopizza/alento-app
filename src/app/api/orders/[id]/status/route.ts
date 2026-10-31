import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStaffSession } from "@/lib/auth";
import { staffAuditActor, writeAuditLog } from "@/lib/auditLog";
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
import { calculateDriverEarning } from "@/lib/driverCompensation";
import { sendKitchenOrderCreatedPush } from "@/lib/kitchenPush";
import { sendCustomerOrderStatusPush } from "@/lib/customerOrderPush";
import { orderCode } from "@/lib/orderCode";
import { isInKitchenWindow } from "@/lib/orderScheduling";
import { orderNetReceived } from "@/lib/orderPaymentFinancials";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getStaffSession();
    if (!session) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }
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
        source: true,
        customerId: true,
        status: true,
        scheduledFor: true,
        fulfillmentType: true,
        subtotal: true,
        discount: true,
        discountSource: true,
        total: true,
        driverId: true,
        deliveryFee: true,
        deliveredAt: true,
        driverEarningAmount: true,
        driverEarningCreditedAt: true,
        customer: {
          select: {
            name: true,
            countryCode: true,
            phone: true,
          },
        },
        payments: {
          where: { status: { not: "CANCELED" } },
          select: {
            status: true,
            amount: true,
            refunds: {
              select: { amount: true },
            },
          },
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

    if (
      order.scheduledFor &&
      !isInKitchenWindow(order.scheduledFor)
    ) {
      return NextResponse.json(
        {
          error:
            "Este pedido está programado y todavía no entra en su ventana operativa de 30 minutos.",
        },
        { status: 409 },
      );
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
      const paidAmount = orderNetReceived(order.payments);
      const pending = Math.max(0, Number(order.total) - paidAmount);

      if (pending > 0) {
        return NextResponse.json(
          { error: `El pedido tiene un saldo pendiente de $${pending.toLocaleString("es-CO")}. Registra el pago completo antes de finalizar.` },
          { status: 409 },
        );
      }
    }

    const preparedIndex = flow.indexOf("PREPARED");
    const deliveredIndex = flow.indexOf("DELIVERED");
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

      let earningData: {
        deliveredAt?: Date;
        driverEarningAmount?: number;
        driverEarningBase?: number;
        driverEarningRatePercent?: number | null;
        driverEarningKind?: string;
        driverEarningCreditedAt?: Date;
      } = {};

      if (
        fulfillmentType === "DELIVERY" &&
        order.driverId != null &&
        order.driverEarningCreditedAt == null &&
        deliveredIndex >= 0 &&
        requestedIndex >= deliveredIndex
      ) {
        const savedSettings = await tx.appSetting.findUnique({
          where: { key: "pos_settings" },
          select: { value: true },
        });
        const earning = calculateDriverEarning(
          Number(order.deliveryFee),
          savedSettings?.value,
        );
        const deliveredAt = order.deliveredAt ?? new Date();

        earningData = {
          deliveredAt,
          driverEarningAmount: earning.amount,
          driverEarningBase: earning.base,
          driverEarningRatePercent: earning.ratePercent,
          driverEarningKind: earning.kind,
          driverEarningCreditedAt: deliveredAt,
        };
      }

      const updatedOrder = await tx.order.update({
        where: { id },
        data: {
          status: requested,
          ...earningData,
        },
        select: {
          id: true,
          status: true,
          fulfillmentType: true,
          deliveredAt: true,
          driverEarningAmount: true,
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

        if (clubSettings.enabled) {
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
        }

        if (reviewTemplate) {
          // La reseña es exclusivamente para la primera compra del cliente.
          // Se excluyen pedidos cancelados del historial válido.
          const previousValidOrders = await tx.order.count({
            where: {
              customerId: order.customerId,
              id: { not: order.id },
              status: { not: "CANCELED" },
            },
          });

          if (previousValidOrders === 0) {
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
      }

      await writeAuditLog(tx, {
        actor: staffAuditActor(session),
        action: "ORDER_STATUS_CHANGED",
        entityType: "ORDER",
        entityId: order.id,
        summary: `Pedido #${order.sequenceNumber ?? order.id}: ${current} → ${requested}.`,
        before: {
          status: current,
          deliveredAt: order.deliveredAt,
          driverEarningAmount:
            order.driverEarningAmount == null
              ? null
              : Number(order.driverEarningAmount),
        },
        after: {
          status: updatedOrder.status,
          deliveredAt: updatedOrder.deliveredAt,
          driverEarningAmount:
            updatedOrder.driverEarningAmount == null
              ? null
              : Number(updatedOrder.driverEarningAmount),
        },
        metadata: {
          sequenceNumber: order.sequenceNumber,
          source: order.source,
          fulfillmentType: order.fulfillmentType,
          driverId: order.driverId,
        },
        source: "api/orders/[id]/status",
      });

      return updatedOrder;
    });

    if (requested === "PREPARING") {
      try {
        const kitchenPush = await sendKitchenOrderCreatedPush({
          orderId: order.id,
          orderCode: orderCode(
            order.sequenceNumber ?? order.id,
            order.source,
          ),
          fulfillmentType: order.fulfillmentType,
        });

        if (!kitchenPush.ok) {
          console.warn("Kitchen preparing push", {
            orderId: order.id,
            reason: kitchenPush.reason,
          });
        }
      } catch (pushError) {
        console.warn("Kitchen preparing push failed", {
          orderId: order.id,
          error:
            pushError instanceof Error
              ? pushError.message
              : "Unknown push error",
        });
      }
    }

    let notification:
      | Awaited<ReturnType<typeof dispatchOrderStatusNotification>>
      | { ok: false; status: "skipped"; reason: string } = {
      ok: false,
      status: "skipped",
      reason: "El pedido no tiene un cliente con teléfono.",
    };

    const code = `POS-${String(order.sequenceNumber ?? order.id).padStart(4, "0")}`;

    if (order.customerId) {
      try {
        const customerPush = await sendCustomerOrderStatusPush({
          customerId: order.customerId,
          orderId: order.id,
          orderCode: code,
          status: requested,
          fulfillmentType: order.fulfillmentType,
        });

        if (!customerPush.ok && customerPush.targeted > 0) {
          console.warn("Customer order status push", {
            orderId: order.id,
            customerId: order.customerId,
            from: current,
            to: requested,
            reason: customerPush.reason,
          });
        }
      } catch (pushError) {
        console.warn("Customer order status push failed", {
          orderId: order.id,
          customerId: order.customerId,
          from: current,
          to: requested,
          error:
            pushError instanceof Error
              ? pushError.message
              : "Unknown push error",
        });
      }
    }

    if (order.customerId && order.customer?.phone) {
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
