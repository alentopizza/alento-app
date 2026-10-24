import { NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pickerCancelBooking } from "@/lib/picker";

function idFrom(value: string) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function POST(
  request: Request,
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

  const body = await request.json().catch(() => ({}));
  const pickerDelivery = await prisma.pickerDelivery.findUnique({
    where: { orderId: id },
  });

  if (!pickerDelivery?.bookingId) {
    return NextResponse.json(
      { error: "Este pedido no tiene un envío Picker activo." },
      { status: 409 },
    );
  }

  try {
    const result = await pickerCancelBooking(
      pickerDelivery.bookingId,
      typeof body?.reason === "string"
        ? body.reason
        : "CANCELADO_DESDE_ALENTO",
    );

    const saved = await prisma.pickerDelivery.update({
      where: { orderId: id },
      data: {
        status: "CANCELED",
        pickerStatus: "CANCELED",
        canceledAt: new Date(),
        lastError: null,
        metadata: {
          ...(pickerDelivery.metadata &&
          typeof pickerDelivery.metadata === "object"
            ? pickerDelivery.metadata as Record<string, unknown>
            : {}),
          cancelResult: result,
        },
      },
    });

    return NextResponse.json({ ok: true, pickerDelivery: saved, result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No fue posible cancelar Picker.";

    await prisma.pickerDelivery.update({
      where: { orderId: id },
      data: { lastError: message },
    });

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
