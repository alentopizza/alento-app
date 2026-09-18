import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const SETTINGS_KEY = "integrations_settings";

type StoreOption = {
  id: string;
  name: string;
  address: string;
};

type IntegrationSettings = Record<string, unknown> & {
  RAPPI?: Record<string, unknown>;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const sessionId = typeof body?.sessionId === "string" ? body.sessionId.trim() : "";
    const storeId = typeof body?.storeId === "string" ? body.storeId.trim() : "";

    if (!sessionId || !storeId) {
      return NextResponse.json({ error: "Falta la sesión de Rappi o la tienda seleccionada." }, { status: 400 });
    }

    const sessionKey = `rappi_oauth_session:${sessionId}`;
    const session = await prisma.appSetting.findUnique({ where: { key: sessionKey } });

    if (!session?.value || typeof session.value !== "object" || Array.isArray(session.value)) {
      return NextResponse.json({ error: "La sesión de conexión expiró. Intenta nuevamente." }, { status: 410 });
    }

    const sessionValue = session.value as {
      stores?: StoreOption[];
      createdAt?: string;
    };

    const createdAt = sessionValue.createdAt ? new Date(sessionValue.createdAt) : null;
    const ageMs = createdAt ? Date.now() - createdAt.getTime() : Number.POSITIVE_INFINITY;

    if (!createdAt || !Number.isFinite(ageMs) || ageMs > 15 * 60 * 1000) {
      await prisma.appSetting.deleteMany({ where: { key: sessionKey } });
      return NextResponse.json({ error: "La sesión de conexión expiró. Intenta nuevamente." }, { status: 410 });
    }

    const stores = Array.isArray(sessionValue.stores) ? sessionValue.stores : [];
    const selectedStore = stores.find((store) => String(store.id) === storeId);

    if (!selectedStore) {
      return NextResponse.json({ error: "La tienda seleccionada no pertenece a esta sesión de Rappi." }, { status: 400 });
    }

    const savedSettings = await prisma.appSetting.findUnique({ where: { key: SETTINGS_KEY } });
    const current =
      savedSettings?.value && typeof savedSettings.value === "object" && !Array.isArray(savedSettings.value)
        ? savedSettings.value as IntegrationSettings
        : {};

    const checkedAt = new Date().toISOString();
    const next: IntegrationSettings = {
      ...current,
      RAPPI: {
        ...(current.RAPPI ?? {}),
        enabled: true,
        accountLinked: true,
        storeId: selectedStore.id,
        storeName: selectedStore.name,
        storeAddress: selectedStore.address,
        status: "ACTIVE",
        connectedAt: checkedAt,
        lastCheckedAt: checkedAt,
        lastError: null,
      },
    };

    await prisma.$transaction([
      prisma.appSetting.upsert({
        where: { key: SETTINGS_KEY },
        update: { value: next as Prisma.InputJsonValue },
        create: { key: SETTINGS_KEY, value: next as Prisma.InputJsonValue },
      }),
      prisma.appSetting.deleteMany({ where: { key: sessionKey } }),
    ]);

    return NextResponse.json({
      connected: true,
      store: selectedStore,
      connectedAt: checkedAt,
    });
  } catch (error) {
    console.error("Rappi OAuth complete error", error);
    return NextResponse.json({ error: "No fue posible vincular la tienda de Rappi." }, { status: 500 });
  }
}
