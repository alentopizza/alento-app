import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/auth";
import {
  reportOperationalIncident,
  requestIdFromHeaders,
} from "@/lib/observability";
import {
  DEFAULT_TRACKING_SETTINGS,
  TRACKING_SETTINGS_KEY,
  normalizeTrackingSettings,
} from "@/lib/trackingSettings";

export const dynamic = "force-dynamic";

type CheckStatus = "ok" | "warning" | "error" | "not_configured";

function notifierHealthUrl() {
  const raw = process.env.NOTIFIER_WEBHOOK_URL?.trim();
  if (!raw) return null;

  try {
    const url = new URL(raw);
    url.pathname = url.pathname.replace(/\/events\/?$/, "/health");
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

async function checkNotifier(requestId: string | null) {
  const url = notifierHealthUrl();
  if (!url) {
    return {
      status: "not_configured" as CheckStatus,
      latencyMs: null,
      detail: "El microservicio de WhatsApp no está configurado.",
    };
  }

  const startedAt = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "User-Agent": "AlentoPizza-HealthCheck/1.0",
      },
    });
    const latencyMs = Math.round(performance.now() - startedAt);

    if (!response.ok) {
      await reportOperationalIncident({
        level: "WARNING",
        category: "INTEGRATION",
        code: "NOTIFIER_HEALTH_FAILED",
        message: `El notificador respondió HTTP ${response.status}.`,
        requestId,
        source: "api/observability/summary",
        fingerprintKey: "notifier-health",
        metadata: {
          status: response.status,
          latencyMs,
        },
      });

      return {
        status: "warning" as CheckStatus,
        latencyMs,
        detail: "El notificador respondió, pero no está saludable.",
      };
    }

    return {
      status: "ok" as CheckStatus,
      latencyMs,
      detail: "Microservicio de WhatsApp disponible.",
    };
  } catch (error) {
    const latencyMs = Math.round(performance.now() - startedAt);
    await reportOperationalIncident({
      level: "WARNING",
      category: "INTEGRATION",
      code: "NOTIFIER_UNREACHABLE",
      message:
        error instanceof Error
          ? error.message
          : "No fue posible contactar el notificador.",
      requestId,
      source: "api/observability/summary",
      fingerprintKey: "notifier-health",
      metadata: { latencyMs },
    });

    return {
      status: "warning" as CheckStatus,
      latencyMs,
      detail: "No fue posible contactar el microservicio de WhatsApp.",
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(request: NextRequest) {
  try {
    await requireStaffSession(["ADMIN"]);
  } catch (error) {
    const forbidden = error instanceof Error && error.message === "FORBIDDEN";
    return NextResponse.json(
      { error: forbidden ? "Sin permisos." : "No autorizado." },
      { status: forbidden ? 403 : 401 },
    );
  }

  const requestId = requestIdFromHeaders(request.headers);
  const now = new Date();
  const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const databaseStartedAt = performance.now();

  try {
    await prisma.$queryRaw`SELECT 1`;
    const databaseLatencyMs = Math.round(
      performance.now() - databaseStartedAt,
    );

    const notifier = await checkNotifier(requestId);

    const [
      openIncidents,
      recentResolvedIncidents,
      pendingOverdueJobs,
      failedJobs,
      sentJobs24h,
      oldestPendingJob,
      failedPushCampaigns24h,
      pendingContactWebhooks,
      trackingRow,
    ] = await Promise.all([
      prisma.operationalIncident.findMany({
        where: { resolvedAt: null },
        orderBy: [{ level: "asc" }, { lastSeenAt: "desc" }],
        take: 60,
      }),
      prisma.operationalIncident.findMany({
        where: { resolvedAt: { not: null } },
        orderBy: { lastSeenAt: "desc" },
        take: 20,
      }),
      prisma.notificationJob.count({
        where: {
          status: "PENDING",
          runAt: { lte: now },
        },
      }),
      prisma.notificationJob.count({
        where: { status: "FAILED" },
      }),
      prisma.notificationJob.count({
        where: {
          status: "SENT",
          sentAt: { gte: last24Hours },
        },
      }),
      prisma.notificationJob.findFirst({
        where: { status: "PENDING" },
        orderBy: { runAt: "asc" },
        select: {
          id: true,
          kind: true,
          runAt: true,
          attempts: true,
          lastError: true,
        },
      }),
      prisma.pushCampaign.count({
        where: {
          status: "FAILED",
          createdAt: { gte: last24Hours },
        },
      }),
      prisma.customer.count({
        where: { contactWebhookPending: true },
      }),
      prisma.appSetting.findUnique({
        where: { key: TRACKING_SETTINGS_KEY },
        select: { value: true, updatedAt: true },
      }),
    ]);

    const tracking = trackingRow
      ? normalizeTrackingSettings(trackingRow.value)
      : DEFAULT_TRACKING_SETTINGS;
    const configuredTracking = [
      ["Google Tag Manager", tracking.googleTagManagerId],
      ["Google Analytics 4", tracking.googleAnalyticsId],
      ["Google Ads", tracking.googleAdsId],
      ["Meta Pixel", tracking.metaPixelId],
      ["TikTok Pixel", tracking.tiktokPixelId],
      ["Microsoft Clarity", tracking.clarityId],
    ]
      .filter(([, value]) => Boolean(value))
      .map(([name]) => name);

    const webPushConfigured = Boolean(
      process.env.WEB_PUSH_VAPID_SUBJECT?.trim() &&
        process.env.WEB_PUSH_VAPID_PUBLIC_KEY?.trim() &&
        process.env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim(),
    );
    const googleMapsConfigured = Boolean(
      process.env.GOOGLE_MAPS_SERVER_API_KEY?.trim(),
    );

    if (!googleMapsConfigured) {
      await reportOperationalIncident({
        level: "WARNING",
        category: "CONFIGURATION",
        code: "GOOGLE_MAPS_SERVER_KEY_MISSING",
        message:
          "Falta GOOGLE_MAPS_SERVER_API_KEY; el cálculo server-side de domicilios puede fallar.",
        requestId,
        source: "api/observability/summary",
        fingerprintKey: "google-maps-server-key",
      });
    }

    const openErrorCount = openIncidents.filter(
      (incident) => incident.level === "ERROR",
    ).length;
    const openWarningCount = openIncidents.filter(
      (incident) => incident.level === "WARNING",
    ).length;

    const jobsStatus: CheckStatus =
      failedJobs > 0
        ? "error"
        : pendingOverdueJobs > 0
          ? "warning"
          : "ok";

    const overallStatus =
      openErrorCount > 0 || failedJobs > 0
        ? "critical"
        : openWarningCount > 0 ||
            pendingOverdueJobs > 0 ||
            notifier.status === "warning" ||
            failedPushCampaigns24h > 0
          ? "attention"
          : "healthy";

    return NextResponse.json({
      status: overallStatus,
      requestId,
      generatedAt: now.toISOString(),
      runtime: {
        uptimeSeconds: Math.round(process.uptime()),
        nodeVersion: process.version,
      },
      checks: {
        database: {
          status: "ok" as CheckStatus,
          latencyMs: databaseLatencyMs,
          detail: "PostgreSQL conectado.",
        },
        notifier,
        webPush: {
          status: webPushConfigured
            ? ("ok" as CheckStatus)
            : ("not_configured" as CheckStatus),
          detail: webPushConfigured
            ? "Web Push configurado."
            : "Web Push no está configurado.",
        },
        googleMaps: {
          status: googleMapsConfigured
            ? ("ok" as CheckStatus)
            : ("warning" as CheckStatus),
          detail: googleMapsConfigured
            ? "Clave server-side de Google Maps configurada."
            : "Falta la clave server-side de Google Maps.",
        },
        notificationJobs: {
          status: jobsStatus,
          detail:
            failedJobs > 0
              ? `${failedJobs} trabajo(s) fallido(s).`
              : pendingOverdueJobs > 0
                ? `${pendingOverdueJobs} trabajo(s) vencido(s) pendiente(s).`
                : "Trabajos programados sin alertas.",
        },
      },
      incidents: {
        open: openIncidents,
        recentResolved: recentResolvedIncidents,
        openErrorCount,
        openWarningCount,
      },
      jobs: {
        pendingOverdue: pendingOverdueJobs,
        failed: failedJobs,
        sentLast24Hours: sentJobs24h,
        oldestPending: oldestPendingJob,
      },
      integrations: {
        notifierConfigured: Boolean(notifierHealthUrl()),
        webPushConfigured,
        googleMapsConfigured,
        trackingEnabled: tracking.enabled,
        configuredTracking,
        trackingUpdatedAt: trackingRow?.updatedAt ?? null,
        failedPushCampaignsLast24Hours: failedPushCampaigns24h,
        pendingCustomerContactWebhooks: pendingContactWebhooks,
      },
    });
  } catch (error) {
    await reportOperationalIncident({
      level: "ERROR",
      category: "DATABASE",
      code: "OBSERVABILITY_SUMMARY_FAILED",
      message:
        error instanceof Error
          ? error.message
          : "No fue posible construir el resumen de salud.",
      requestId,
      source: "api/observability/summary",
      fingerprintKey: "summary",
    });

    return NextResponse.json(
      {
        status: "critical",
        requestId,
        generatedAt: new Date().toISOString(),
        error: "No fue posible consultar la salud del sistema.",
      },
      { status: 503 },
    );
  }
}
