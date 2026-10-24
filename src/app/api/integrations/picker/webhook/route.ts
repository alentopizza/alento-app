import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function numberOrNull(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function payloadObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export async function POST(request: NextRequest) {
  const expected = process.env.PICKER_WEBHOOK_SECRET?.trim() || "";
  if (expected) {
    const received =
      request.nextUrl.searchParams.get("token")?.trim() ||
      request.headers.get("x-picker-webhook-secret")?.trim() ||
      "";
    if (received !== expected) {
      return NextResponse.json({ error: "Webhook no autorizado." }, { status: 401 });
    }
  }

  const body = payloadObject(await request.json().catch(() => ({})));

  const bookingId =
    text(body.bookingID) ||
    text(body.bookingId) ||
    text(body.booking_id) ||
    text(body._id);
  const bookingNumericId =
    numberOrNull(body.bookingNumericId) ??
    numberOrNull(body.booking_numeric_id);
  const externalBookingId =
    text(body.externalBookingId) || text(body.external_booking_id);

  const pickerDelivery = bookingId
    ? await prisma.pickerDelivery.findUnique({ where: { bookingId } })
    : bookingNumericId != null
      ? await prisma.pickerDelivery.findFirst({ where: { bookingNumericId } })
      : externalBookingId
        ? await prisma.pickerDelivery.findFirst({ where: { externalBookingId } })
        : null;

  if (!pickerDelivery) {
    console.warn("Picker webhook ignored: booking not matched", body);
    return NextResponse.json({ ok: true, ignored: true });
  }

  const driverName = text(body.driverName);
  const driverPhone =
    text(body.driverMobile) ||
    text(body.driverPhone) ||
    text(body.driver_mobile);
  const deliveryProvider =
    text(body.deliveryProvider) || text(body.provider);
  const pickerStatus =
    text(body.statusText) ||
    text(body.status) ||
    text(body.bookingStatus) ||
    text(body.currentStatus);
  const trackingUrl =
    text(body.smrURL) ||
    text(body.trackingUrl) ||
    text(body.tracking_url);
  const bookingDetailUrl =
    text(body.bookingDetailUrl) ||
    text(body.booking_detail_url);

  const saved = await prisma.pickerDelivery.update({
    where: { id: pickerDelivery.id },
    data: {
      status: pickerDelivery.status === "CANCELED"
        ? pickerDelivery.status
        : driverName
          ? "ASSIGNED"
          : pickerDelivery.status,
      pickerStatus: pickerStatus || pickerDelivery.pickerStatus,
      externalDriverName: driverName || pickerDelivery.externalDriverName,
      externalDriverPhone: driverPhone || pickerDelivery.externalDriverPhone,
      deliveryProvider: deliveryProvider || pickerDelivery.deliveryProvider,
      trackingUrl: trackingUrl || pickerDelivery.trackingUrl,
      bookingDetailUrl:
        bookingDetailUrl || pickerDelivery.bookingDetailUrl,
      lastWebhookAt: new Date(),
      lastError: null,
      metadata: { lastWebhook: body },
    },
  });

  return NextResponse.json({
    ok: true,
    orderId: saved.orderId,
    pickerDelivery: saved,
  });
}
