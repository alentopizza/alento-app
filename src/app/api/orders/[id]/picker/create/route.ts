import { NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  pickerBookingPrice,
  pickerCreateBooking,
  pickerFallbackCustomerEmail,
  pickerIntegrationStatus,
  pickerPreCheckout,
} from "@/lib/picker";
import {
  loadPickerOrder,
  pickerBookingNotes,
  pickerExternalBookingId,
  pickerOrderAmount,
  pickerOrderValidation,
  pickerPaymentMethod,
  splitPickerCustomerName,
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
      },
      { status: 503 },
    );
  }

  const order = await loadPickerOrder(id);
  const validationError = pickerOrderValidation(order);
  if (validationError || !order?.address || !order.customer) {
    return NextResponse.json(
      { error: validationError || "Pedido inválido." },
      { status: 409 },
    );
  }

  if (order.driverId) {
    return NextResponse.json(
      {
        error:
          "Este pedido ya tiene un repartidor de Alentó asignado. Desasígnalo antes de solicitar Picker.",
      },
      { status: 409 },
    );
  }

  if (!["PREPARED", "READY"].includes(order.status)) {
    return NextResponse.json(
      {
        error:
          "Picker se solicita cuando el pedido está horneando o listo. Puedes cotizar antes sin crear el envío.",
      },
      { status: 409 },
    );
  }

  if (
    order.pickerDelivery?.bookingId &&
    order.pickerDelivery.status !== "CANCELED"
  ) {
    return NextResponse.json(
      {
        error: "Este pedido ya tiene un envío Picker activo.",
        pickerDelivery: order.pickerDelivery,
      },
      { status: 409 },
    );
  }

  const customerEmail =
    order.customer.email?.trim() || pickerFallbackCustomerEmail();
  if (!customerEmail) {
    return NextResponse.json(
      {
        error:
          "Picker exige correo del cliente. Configura PICKER_FALLBACK_CUSTOMER_EMAIL para clientes que no tienen email.",
      },
      { status: 503 },
    );
  }

  const { firstName, lastName } = splitPickerCustomerName(
    order.customer.name,
  );
  const phone = order.customer.phone.replace(/\D/g, "");
  const countryCode = order.customer.countryCode?.trim() || "+57";
  const paymentMethod = pickerPaymentMethod(order);
  const orderAmount = pickerOrderAmount(order);
  const externalBookingId = pickerExternalBookingId(order);

  try {
    // Se refresca la tarifa justo antes de solicitar el servicio.
    const quote = await pickerPreCheckout({
      latitude: Number(order.address.latitude),
      longitude: Number(order.address.longitude),
      paymentMethod,
      orderAmount,
      carName: integration.vehicle,
      sendTrackingLink: integration.sendTrackingLink,
      tip: 0,
    });

    const booking = await pickerCreateBooking({
      latitude: Number(order.address.latitude),
      longitude: Number(order.address.longitude),
      city: order.address.city || "Bogotá",
      address:
        order.address.formattedAddress ||
        order.address.address,
      reference: order.address.notes || undefined,
      customerName: firstName,
      customerLastName: lastName,
      customerEmail,
      customerCountryCode: countryCode,
      customerMobile: phone,
      sendTrackingLink: integration.sendTrackingLink,
      bookingNotes: pickerBookingNotes(order) || undefined,
      orderAmount,
      externalBookingId,
      paymentMethod,
      cookTime: 0,
      onlyMyFleet: false,
      businessDeliveryFee: Number(order.deliveryFee),
      tipBusiness: 0,
      roundtrip: false,
    });

    const bookingPrice = pickerBookingPrice(booking);
    const saved = await prisma.pickerDelivery.upsert({
      where: { orderId: order.id },
      update: {
        status: "REQUESTED",
        bookingId: booking._id,
        bookingNumericId:
          booking.bookingNumericId == null
            ? null
            : Number(booking.bookingNumericId),
        externalBookingId:
          booking.externalBookingId || externalBookingId,
        quoteAmount: quote.deliveryFee,
        quoteAmountWithTax: quote.deliveryFeeWithTax,
        quoteTax: quote.tax,
        quoteCurrency: quote.currency,
        quoteEtaMinutes: Math.round(Number(quote.eta) || 0),
        quoteDistanceKm: Number(quote.distance) || 0,
        quotedAt: new Date(),
        requestedAt: new Date(),
        canceledAt: null,
        pickerStatus: booking.statusText || "REQUESTED",
        trackingUrl: booking.smrURL || null,
        bookingDetailUrl: booking.bookingDetailUrl || null,
        lastError: null,
        metadata: {
          lastQuote: quote,
          booking,
          bookingPrice,
        },
      },
      create: {
        orderId: order.id,
        status: "REQUESTED",
        bookingId: booking._id,
        bookingNumericId:
          booking.bookingNumericId == null
            ? null
            : Number(booking.bookingNumericId),
        externalBookingId:
          booking.externalBookingId || externalBookingId,
        quoteAmount: quote.deliveryFee,
        quoteAmountWithTax: quote.deliveryFeeWithTax,
        quoteTax: quote.tax,
        quoteCurrency: quote.currency,
        quoteEtaMinutes: Math.round(Number(quote.eta) || 0),
        quoteDistanceKm: Number(quote.distance) || 0,
        quotedAt: new Date(),
        requestedAt: new Date(),
        pickerStatus: booking.statusText || "REQUESTED",
        trackingUrl: booking.smrURL || null,
        bookingDetailUrl: booking.bookingDetailUrl || null,
        metadata: {
          lastQuote: quote,
          booking,
          bookingPrice,
        },
      },
    });

    return NextResponse.json({
      ok: true,
      quote,
      booking,
      pickerDelivery: saved,
      note:
        "El pedido sigue bajo el flujo operativo de Alentó. Picker actúa como proveedor logístico opcional.",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No fue posible crear el envío Picker.";

    await prisma.pickerDelivery.upsert({
      where: { orderId: order.id },
      update: { status: "ERROR", lastError: message },
      create: {
        orderId: order.id,
        status: "ERROR",
        lastError: message,
      },
    });

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
