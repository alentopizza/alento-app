import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const SETTINGS_KEY = "integrations_settings";

type ProviderId = "RAPPI" | "DIDI";
type IntegrationStatus = "NOT_CONFIGURED" | "PENDING" | "ACTIVE" | "ERROR";

type ProviderSettings = {
  enabled: boolean;
  storeId: string;
  autoAccept: boolean;
  status: IntegrationStatus;
  connectedAt: string | null;
  lastCheckedAt: string | null;
  lastError: string | null;
};

type IntegrationSettings = Record<ProviderId, ProviderSettings>;

const DEFAULT_SETTINGS: IntegrationSettings = {
  RAPPI: {
    enabled: false,
    storeId: "",
    autoAccept: false,
    status: "NOT_CONFIGURED",
    connectedAt: null,
    lastCheckedAt: null,
    lastError: null,
  },
  DIDI: {
    enabled: false,
    storeId: "",
    autoAccept: false,
    status: "NOT_CONFIGURED",
    connectedAt: null,
    lastCheckedAt: null,
    lastError: null,
  },
};

function normalizeProvider(value: unknown, fallback: ProviderSettings): ProviderSettings {
  if (!value || typeof value !== "object") return fallback;
  const raw = value as Partial<ProviderSettings>;

  const enabled = raw.enabled === true;
  const storeId = typeof raw.storeId === "string" ? raw.storeId.trim().slice(0, 120) : "";
  const autoAccept = raw.autoAccept === true;
  const status: IntegrationStatus =
    raw.status === "ACTIVE"
      ? "ACTIVE"
      : raw.status === "ERROR"
        ? "ERROR"
        : enabled
          ? "PENDING"
          : "NOT_CONFIGURED";
  return {
    enabled,
    storeId,
    autoAccept,
    status,
    connectedAt: status === "ACTIVE" && typeof raw.connectedAt === "string" ? raw.connectedAt : null,
    lastCheckedAt: typeof raw.lastCheckedAt === "string" ? raw.lastCheckedAt : null,
    lastError: typeof raw.lastError === "string" && raw.lastError.trim() ? raw.lastError.trim().slice(0, 500) : null,
  };
}

function normalizeSettings(value: unknown): IntegrationSettings {
  const raw = value && typeof value === "object"
    ? value as Partial<Record<ProviderId, unknown>>
    : {};

  return {
    RAPPI: normalizeProvider(raw.RAPPI, DEFAULT_SETTINGS.RAPPI),
    DIDI: normalizeProvider(raw.DIDI, DEFAULT_SETTINGS.DIDI),
  };
}

export async function GET() {
  const saved = await prisma.appSetting.findUnique({ where: { key: SETTINGS_KEY } });
  return NextResponse.json({
    settings: saved ? normalizeSettings(saved.value) : DEFAULT_SETTINGS,
  });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const settings = normalizeSettings(body?.settings);

  const saved = await prisma.appSetting.upsert({
    where: { key: SETTINGS_KEY },
    update: { value: settings },
    create: { key: SETTINGS_KEY, value: settings },
  });

  return NextResponse.json({ settings: normalizeSettings(saved.value) });
}
