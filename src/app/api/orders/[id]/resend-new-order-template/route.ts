import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/auth";
import { notifyOrderCreated } from "@/lib/chatwoot";
import { orderCode } from "@/lib/orderCode";

function authError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message === "FORBIDDEN") {
    return NextResponse.json(
      { error: "No tienes permiso para reenviar plantillas." },
      { status: 403 },
    );
  }
  return NextResponse.json(
    { error: "No autorizado." },
    { status: 401 },
  );
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireStaffSession(["ADMIN", "POS", "CASHIER"]);
  } catch (error) {
    return authError(error);
  }

  const { id: rawId } = await context.params;
  const id = Number(rawId);

  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json(
      { error: "Pedido inválido." },
      { status: 400 },
    );
  }

  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      id: true,
      sequenceNumber: true,
      source: true,
      total: true,
      fulfillmentType: true,
      customerId: true,
      customer: {
        select: {
          name: true,
          countryCode: true,
          phone: true,
        },
      },
    },
  });

  if (!order) {
    return NextResponse.json(
      { error: "Pedido no encontrado." },
      { status: 404 },
    );
  }

  if (!order.customerId || !order.customer) {
    return NextResponse.json(
      { error: "Este pedido no tiene un cliente asociado." },
      { status: 409 },
    );
  }

  const localPhone = order.customer.phone?.replace(/\D/g, "") ?? "";
  const countryCode = order.customer.countryCode?.replace(/\D/g, "") ?? "";

  if (!localPhone || !countryCode) {
    return NextResponse.json(
      {
        error:
          "El cliente no tiene un teléfono válido. Corrígelo antes de reenviar la plantilla.",
      },
      { status: 409 },
    );
  }

  const currentPhone = `+${countryCode}${localPhone}`;
  const code = orderCode(
    order.sequenceNumber ?? order.id,
    order.source,
  );

  const result = await notifyOrderCreated(
    {
      customerId: order.customerId,
      customerName: order.customer.name,
      phone: currentPhone,
      orderId: order.id,
      orderCode: code,
      total: Number(order.total),
      fulfillmentType: order.fulfillmentType,
    },
    {
      templateName: "nuevo_pedido_v2",
      requirePhoneMatch: true,
    },
  );

  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.reason,
        template: "nuevo_pedido_v2",
        phone: currentPhone,
      },
      { status: result.status === "skipped" ? 503 : 409 },
    );
  }

  return NextResponse.json({
    ok: true,
    template: "nuevo_pedido_v2",
    phone: currentPhone,
    orderCode: code,
    conversationId: result.conversationId,
    contactId: result.contactId,
  });
}
