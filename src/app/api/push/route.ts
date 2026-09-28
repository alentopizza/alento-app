import { NextRequest, NextResponse } from "next/server";
import { getCustomerSession, getStaffSession } from "@/lib/auth";
import {
  pushPublicKey,
  removePushSubscription,
  upsertPushSubscription,
} from "@/lib/driverPush";

export async function GET() {
  const publicKey = pushPublicKey();
  return NextResponse.json({
    configured: Boolean(publicKey),
    publicKey,
  });
}

export async function POST(request: NextRequest) {
  const [staffSession, customerSession] = await Promise.all([
    getStaffSession(),
    getCustomerSession(),
  ]);

  const owner = staffSession
    ? ({ kind: "staff", userId: staffSession.userId } as const)
    : ({ kind: "customer", customerId: customerSession?.customerId ?? null } as const);

  const body = await request.json().catch(() => ({}));
  const action = String(body?.action || "").trim().toLowerCase();

  if (action === "unsubscribe") {
    const endpoint = String(body?.endpoint || "").trim();
    if (!endpoint) {
      return NextResponse.json({ error: "Suscripción inválida." }, { status: 400 });
    }

    await removePushSubscription({ endpoint, owner });
    return NextResponse.json({ ok: true });
  }

  if (action !== "subscribe") {
    return NextResponse.json({ error: "Acción inválida." }, { status: 400 });
  }

  if (!pushPublicKey()) {
    return NextResponse.json(
      { error: "Web Push no está configurado en el servidor." },
      { status: 503 },
    );
  }

  const endpoint = String(body?.subscription?.endpoint || "").trim();
  const p256dh = String(body?.subscription?.keys?.p256dh || "").trim();
  const auth = String(body?.subscription?.keys?.auth || "").trim();

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json(
      { error: "La suscripción del dispositivo está incompleta." },
      { status: 400 },
    );
  }

  const subscription = await upsertPushSubscription({
    owner,
    endpoint,
    p256dh,
    auth,
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ ok: true, subscription });
}
