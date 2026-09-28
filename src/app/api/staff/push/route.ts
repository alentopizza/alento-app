import { NextRequest, NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/auth";
import {
  removeStaffPushSubscription,
  staffPushPublicKey,
  upsertStaffPushSubscription,
} from "@/lib/driverPush";

function authError(error: unknown) {
  const forbidden =
    error instanceof Error && error.message === "FORBIDDEN";

  return NextResponse.json(
    { error: forbidden ? "Sin permisos." : "No autorizado." },
    { status: forbidden ? 403 : 401 },
  );
}

export async function GET() {
  try {
    const session = await requireStaffSession();
    const publicKey = staffPushPublicKey();

    return NextResponse.json({
      configured: Boolean(publicKey),
      publicKey,
      user: {
        id: session.userId,
        name: session.name,
        email: session.email,
        roles: session.roles,
      },
    });
  } catch (error) {
    return authError(error);
  }
}

export async function POST(request: NextRequest) {
  let session;
  try {
    session = await requireStaffSession();
  } catch (error) {
    return authError(error);
  }

  const body = await request.json().catch(() => ({}));
  const action = String(body?.action || "").trim().toLowerCase();

  if (action === "unsubscribe") {
    const endpoint = String(body?.endpoint || "").trim();
    if (!endpoint) {
      return NextResponse.json(
        { error: "Suscripción inválida." },
        { status: 400 },
      );
    }

    await removeStaffPushSubscription({
      userId: session.userId,
      endpoint,
    });

    return NextResponse.json({ ok: true });
  }

  if (action !== "subscribe") {
    return NextResponse.json(
      { error: "Acción inválida." },
      { status: 400 },
    );
  }

  if (!staffPushPublicKey()) {
    return NextResponse.json(
      { error: "Web Push no está configurado en el servidor." },
      { status: 503 },
    );
  }

  const endpoint = String(body?.subscription?.endpoint || "").trim();
  const p256dh = String(
    body?.subscription?.keys?.p256dh || "",
  ).trim();
  const auth = String(body?.subscription?.keys?.auth || "").trim();

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json(
      { error: "La suscripción del dispositivo está incompleta." },
      { status: 400 },
    );
  }

  const subscription = await upsertStaffPushSubscription({
    userId: session.userId,
    endpoint,
    p256dh,
    auth,
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json({
    ok: true,
    subscription,
  });
}
