import { prisma } from "@/lib/prisma";
import { orderCode } from "@/lib/orderCode";
import type { PickerPaymentMethod } from "@/lib/picker";

export async function loadPickerOrder(orderId: number) {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: {
      customer: true,
      address: true,
      driver: {
        select: { id: true, name: true },
      },
      payments: true,
      pickerDelivery: true,
    },
  });
}

export function pickerPaymentMethod(
  order: NonNullable<Awaited<ReturnType<typeof loadPickerOrder>>>,
): PickerPaymentMethod {
  const active = order.payments.filter(
    (payment) => payment.status !== "CANCELED",
  );
  const pending = active.find(
    (payment) =>
      payment.status === "PENDING" || payment.status === "PARTIAL",
  );
  const method = (pending?.method || "").trim().toLowerCase();

  return method === "efectivo" || method === "cash"
    ? "CASH"
    : "CARD";
}

export function pickerOrderAmount(
  order: NonNullable<Awaited<ReturnType<typeof loadPickerOrder>>>,
) {
  return Math.max(
    0,
    Math.round(Number(order.subtotal) - Number(order.discount)),
  );
}

export function pickerExternalBookingId(
  order: NonNullable<Awaited<ReturnType<typeof loadPickerOrder>>>,
) {
  return orderCode(order.sequenceNumber ?? order.id, order.source);
}

export function splitPickerCustomerName(value: string) {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return { firstName: "Cliente", lastName: "Alentó" };
  }

  const parts = normalized.split(" ");
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "Alentó" };
  }

  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts.at(-1) || "Alentó",
  };
}

export function pickerOrderValidation(
  order: Awaited<ReturnType<typeof loadPickerOrder>>,
) {
  if (!order) return "Pedido no encontrado.";
  if (order.fulfillmentType !== "DELIVERY") {
    return "Picker solo está disponible para pedidos a domicilio.";
  }
  if (!order.customer) {
    return "El pedido no tiene cliente.";
  }
  if (!order.address) {
    return "El pedido no tiene dirección de entrega.";
  }
  if (
    order.address.latitude == null ||
    order.address.longitude == null ||
    !Number.isFinite(Number(order.address.latitude)) ||
    !Number.isFinite(Number(order.address.longitude))
  ) {
    return "La dirección debe estar validada con Google antes de cotizar Picker.";
  }
  if (!order.customer.phone) {
    return "El cliente no tiene teléfono.";
  }
  return null;
}

export function pickerBookingNotes(
  order: NonNullable<Awaited<ReturnType<typeof loadPickerOrder>>>,
) {
  return [order.address?.notes, order.notes]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(" · ")
    .slice(0, 250);
}
