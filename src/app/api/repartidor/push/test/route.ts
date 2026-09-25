import { NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/auth";
import { sendDriverPush } from "@/lib/driverPush";

export async function POST() {
  let session;
  try {
    session = await requireStaffSession(["DRIVER", "DISPATCH"]);
  } catch (error) {
    const forbidden =
      error instanceof Error && error.message === "FORBIDDEN";
    return NextResponse.json(
      { error: forbidden ? "Sin permisos." : "No autorizado." },
      { status: forbidden ? 403 : 401 },
    );
  }

  const result = await sendDriverPush({
    driverId: session.userId,
    title: "Alentó · Push activo 🍕",
    body: "Las notificaciones del repartidor están funcionando correctamente.",
    url: "/repartidor",
    tag: "alento-driver-push-test",
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        error:
          result.reason ||
          "No fue posible enviar la notificación de prueba.",
        result,
      },
      { status: 409 },
    );
  }

  return NextResponse.json({ ok: true, result });
}
