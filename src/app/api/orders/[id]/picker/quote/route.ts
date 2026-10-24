import { NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pickerIntegrationStatus, pickerPreCheckout } from "@/lib/picker";
import {
  loadPickerOrder,
  pickerOrderAmount,
  pickerOrderValidation,
  pickerPaymentMethod,
} from "@/lib/pickerOrder";

function idFrom(value: string) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireStaffSession(["ADMIN", "POS", "DISPATCH"]);
  } catch {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const { id: rawId } = await context.params;
  const id = idFrom(rawId);
  if (!id) {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const integration = pickerIntegrationStatus();
  if (!integration.enabled || !integration.configured) {
    return NextResponse.json(
      {
        error: !integration.enabled
          ? "Picker está desactivado."
          : `Picker no está configurado. Falta: ${integration.missing.join(", ")}.`,
        picker: integration,
      },
      { status: 503 },
    );
  }

  const order = await loadPickerOrder(id);
  const validationError = pickerOrderValidation(order);
  if (validationError || !order?.address) {
    return NextResponse.json(
      { error: validationError || "Pedido inválido." },
      { status: 409 },
    );
  }

  try {
    const quote = await pickerPreCheckout({
      latitude: Number(order.address.latitude),
      longitude: Number(order.address.longitude),
      paymentMethod: pickerPaymentMethod(order),
      orderAmount: pickerOrderAmount(order),
      carName: integration.vehicle,
      sendTrackingLink: integration.sendTrackingLink,
      tip: 0,
    });

    const saved = await prisma.pickerDelivery.upsert({
      where: { orderId: order.id },
      update: {
        status: order.pickerDelivery?.bookingId ? order.pickerDelivery.status : "QUOTED",
        quoteAmount: quote.deliveryFee,
        quoteAmountWithTax: quote.deliveryFeeWithTax,
        quoteTax: quote.tax,
        quoteCurrency: quote.currency,
        quoteEtaMinutes: Math.round(Number(quote.eta) || 0),
        quoteDistanceKm: Number(quote.distance) || 0,
        quotedAt: new Date(),
        lastError: null,
        metadata: { lastQuote: quote },
      },
      create: {
        orderId: order.id,
        status: "QUOTED",
        quoteAmount: quote.deliveryFee,
        quoteAmountWithTax: quote.deliveryFeeWithTax,
        quoteTax: quote.tax,
        quoteCurrency: quote.currency,
        quoteEtaMinutes: Math.round(Number(quote.eta) || 0),
        quoteDistanceKm: Number(quote.distance) || 0,
        quotedAt: new Date(),
        metadata: { lastQuote: quote },
      },
    });

    return NextResponse.json({
      quote,
      pickerDelivery: saved,
      alento: {
        deliveryFee: Number(order.deliveryFee),
        driverAssigned: Boolean(order.driverId),
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No fue posible cotizar Picker.";

    await prisma.pickerDelivery.upsert({
      where: { orderId: order.id },
      update: { lastError: message },
      create: {
        orderId: order.id,
        status: "ERROR",
        lastError: message,
      },
    });

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
