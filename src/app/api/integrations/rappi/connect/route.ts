import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const SETTINGS_KEY = "integrations_settings";

type IntegrationSettings = {
  RAPPI?: {
    enabled?: boolean;
    storeId?: string;
    autoAccept?: boolean;
    status?: string;
    connectedAt?: string | null;
    lastCheckedAt?: string | null;
    lastError?: string | null;
  };
  DIDI?: Record<string, unknown>;
};

function readJsonObject(value: unknown): IntegrationSettings {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as IntegrationSettings
    : {};
}

export async function POST() {
  const checkedAt = new Date().toISOString();

  const clientId = process.env.RAPPI_CLIENT_ID?.trim();
  const clientSecret = process.env.RAPPI_CLIENT_SECRET?.trim();
  const apiBaseUrl = process.env.RAPPI_API_BASE_URL?.trim();

  const saved = await prisma.appSetting.findUnique({ where: { key: SETTINGS_KEY } });
  const current = readJsonObject(saved?.value);
  const rappi = current.RAPPI ?? {};

  if (!rappi.storeId?.trim()) {
    const message = "Configura primero el ID de tienda de Rappi.";
    const next = {
      ...current,
      RAPPI: {
        ...rappi,
        enabled: true,
        status: "ERROR",
        lastCheckedAt: checkedAt,
        lastError: message,
      },
    };
    await prisma.appSetting.upsert({
      where: { key: SETTINGS_KEY },
      update: { value: next as Prisma.InputJsonValue },
      create: { key: SETTINGS_KEY, value: next as Prisma.InputJsonValue },
    });
    return NextResponse.json({ connected: false, error: message, status: "ERROR" }, { status: 400 });
  }

  if (!clientId || !clientSecret || !apiBaseUrl) {
    const message = "Faltan las credenciales técnicas de Rappi Open Orders en el servidor.";
    const next = {
      ...current,
      RAPPI: {
        ...rappi,
        enabled: true,
        status: "PENDING",
        lastCheckedAt: checkedAt,
        lastError: message,
      },
    };
    await prisma.appSetting.upsert({
      where: { key: SETTINGS_KEY },
      update: { value: next as Prisma.InputJsonValue },
      create: { key: SETTINGS_KEY, value: next as Prisma.InputJsonValue },
    });
    return NextResponse.json({
      connected: false,
      status: "PENDING",
      error: message,
      missing: [
        ...(!clientId ? ["RAPPI_CLIENT_ID"] : []),
        ...(!clientSecret ? ["RAPPI_CLIENT_SECRET"] : []),
        ...(!apiBaseUrl ? ["RAPPI_API_BASE_URL"] : []),
      ],
    }, { status: 409 });
  }

  try {
    const response = await fetch(
      `${apiBaseUrl.replace(/\/$/, "")}/restaurants/auth/v1/token/login/integrations`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
        }),
        cache: "no-store",
      },
    );

    const data = await response.json().catch(() => null);
    const token =
      data && typeof data === "object"
        ? String((data as { access_token?: unknown; token?: unknown }).access_token ?? (data as { token?: unknown }).token ?? "")
        : "";

    if (!response.ok || !token) {
      const message =
        data && typeof data === "object" && "message" in data
          ? String((data as { message?: unknown }).message ?? "Rappi rechazó las credenciales técnicas.")
          : "Rappi rechazó las credenciales técnicas.";

      const next = {
        ...current,
        RAPPI: {
          ...rappi,
          enabled: true,
          status: "ERROR",
          connectedAt: null,
          lastCheckedAt: checkedAt,
          lastError: message,
        },
      };

      await prisma.appSetting.upsert({
        where: { key: SETTINGS_KEY },
        update: { value: next as Prisma.InputJsonValue },
        create: { key: SETTINGS_KEY, value: next as Prisma.InputJsonValue },
      });

      return NextResponse.json({ connected: false, status: "ERROR", error: message }, { status: 502 });
    }

    const next = {
      ...current,
      RAPPI: {
        ...rappi,
        enabled: true,
        status: "ACTIVE",
        connectedAt: checkedAt,
        lastCheckedAt: checkedAt,
        lastError: null,
      },
    };

    await prisma.appSetting.upsert({
      where: { key: SETTINGS_KEY },
      update: { value: next as Prisma.InputJsonValue },
      create: { key: SETTINGS_KEY, value: next as Prisma.InputJsonValue },
    });

    return NextResponse.json({
      connected: true,
      status: "ACTIVE",
      connectedAt: checkedAt,
      storeId: rappi.storeId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No fue posible conectar con Rappi.";
    const next = {
      ...current,
      RAPPI: {
        ...rappi,
        enabled: true,
        status: "ERROR",
        connectedAt: null,
        lastCheckedAt: checkedAt,
        lastError: message,
      },
    };

    await prisma.appSetting.upsert({
      where: { key: SETTINGS_KEY },
      update: { value: next as Prisma.InputJsonValue },
      create: { key: SETTINGS_KEY, value: next as Prisma.InputJsonValue },
    });

    return NextResponse.json({ connected: false, status: "ERROR", error: message }, { status: 502 });
  }
}
