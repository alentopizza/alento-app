import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyDriverLocationToken } from "@/lib/driverLocationToken";
import { upsertNativePushDevice } from "@/lib/nativePush";

export async function POST(request: NextRequest) {
  const nativeToken = request.headers
    .get("x-alento-driver-location-token")
    ?.trim();
  const payload = verifyDriverLocationToken(nativeToken);

  if (!payload) {
    return NextResponse.json(
      { error: "Token nativo inválido o vencido." },
      { status: 401 },
    );
  }

  const user = await prisma.user.findFirst({
    where: {
      id: payload.userId,
      active: true,
      roles: { hasSome: ["DRIVER", "DISPATCH"] },
    },
    select: { id: true },
  });

  if (!user) {
    return NextResponse.json(
      { error: "Repartidor no disponible." },
      { status: 404 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const deviceKey = String(body?.deviceKey || "").trim();
  const fcmToken = String(body?.fcmToken || "").trim();
  const appVersion = String(body?.appVersion || "").trim();

  if (!deviceKey || !fcmToken) {
    return NextResponse.json(
      { error: "El registro Android está incompleto." },
      { status: 400 },
    );
  }

  const device = await upsertNativePushDevice({
    userId: user.id,
    deviceKey,
    fcmToken,
    appVersion,
  });

  return NextResponse.json({
    ok: true,
    device: {
      id: device.id,
      platform: device.platform,
      appVersion: device.appVersion,
      lastSeenAt: device.lastSeenAt,
    },
  });
}
