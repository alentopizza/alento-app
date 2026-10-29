import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/auth";
import {
  DEFAULT_TRACKING_SETTINGS,
  TRACKING_SETTINGS_KEY,
  normalizeTrackingSettings,
} from "@/lib/trackingSettings";

export const dynamic = "force-dynamic";

type IntegrationKind =
  | "gtm"
  | "ga4"
  | "googleAds"
  | "meta"
  | "tiktok"
  | "clarity";

async function probe(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5500);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "User-Agent": "AlentoPizza-IntegrationCheck/1.0",
      },
    });

    const text = await response.text().catch(() => "");
    return {
      ok: response.ok && text.length > 20,
      status: response.status,
    };
  } catch {
    return { ok: false, status: 0 };
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireStaffSession(["ADMIN"]);
  } catch {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const kind = String(body?.kind || "") as IntegrationKind;

  if (!["gtm", "ga4", "googleAds", "meta", "tiktok", "clarity"].includes(kind)) {
    return NextResponse.json(
      { error: "Integración inválida." },
      { status: 400 },
    );
  }

  const row = await prisma.appSetting.findUnique({
    where: { key: TRACKING_SETTINGS_KEY },
  });

  const settings = row
    ? normalizeTrackingSettings(row.value)
    : DEFAULT_TRACKING_SETTINGS;

  if (!settings.enabled) {
    return NextResponse.json({
      status: "configured",
      title: "Configurada, pero desactivada",
      detail:
        "Los rastreadores externos están apagados. Actívalos para enviar eventos a las plataformas.",
    });
  }

  if (kind === "gtm") {
    if (!settings.googleTagManagerId) {
      return NextResponse.json({
        status: "invalid",
        title: "Falta el ID de Google Tag Manager",
        detail: "Guarda un identificador con formato GTM-XXXXXXX.",
      });
    }

    const check = await probe(
      `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(
        settings.googleTagManagerId,
      )}`,
    );

    return NextResponse.json({
      status: check.ok ? "verified" : "configured",
      title: check.ok
        ? "Contenedor accesible"
        : "Configuración guardada",
      detail: check.ok
        ? "Alentó tiene el ID guardado y Google respondió correctamente al contenedor. Publica el contenedor en Tag Manager para que sus etiquetas entren en producción."
        : "El ID está guardado y tiene formato válido, pero no pudimos confirmar el contenedor desde Google. Revisa que exista y esté publicado.",
    });
  }

  if (kind === "ga4") {
    if (!settings.googleAnalyticsId) {
      return NextResponse.json({
        status: "invalid",
        title: "Falta el ID de Analytics",
        detail: "Guarda el Measurement ID con formato G-XXXXXXXXXX.",
      });
    }

    const check = await probe(
      `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(
        settings.googleAnalyticsId,
      )}`,
    );

    return NextResponse.json({
      status: check.ok ? "verified" : "configured",
      title: check.ok
        ? "Instalación lista para enviar eventos"
        : "ID guardado correctamente",
      detail: check.ok
        ? "El ID está guardado y el script de Google está disponible. La recepción final se confirma en Analytics > Tiempo real o DebugView después de generar una visita."
        : "El ID tiene formato válido y quedó guardado. Google no ofrece una validación pública de propiedad; confirma la recepción en Tiempo real o DebugView.",
    });
  }

  if (kind === "googleAds") {
    if (!settings.googleAdsId) {
      return NextResponse.json({
        status: "invalid",
        title: "Falta el ID de Google Ads",
        detail: "Guarda el Google tag con formato AW-123456789.",
      });
    }

    const check = await probe(
      `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(
        settings.googleAdsId,
      )}`,
    );
    const hasLabel = Boolean(settings.googleAdsPurchaseLabel);

    return NextResponse.json({
      status: check.ok && hasLabel ? "verified" : "configured",
      title:
        check.ok && hasLabel
          ? "Conversión de compra preparada"
          : "Google Ads configurado",
      detail: hasLabel
        ? "El Google tag y la etiqueta de compra están guardados. La conversión se confirma en Google Ads después de que llegue una compra real o de prueba."
        : "El Google tag está guardado, pero falta la etiqueta de conversión de compra. Sin ella podremos cargar Google Ads, pero no atribuir Purchase a la acción de conversión elegida.",
    });
  }

  if (kind === "meta") {
    if (!settings.metaPixelId) {
      return NextResponse.json({
        status: "invalid",
        title: "Falta el Pixel ID",
        detail: "Guarda el identificador numérico del píxel de Meta.",
      });
    }

    const check = await probe(
      "https://connect.facebook.net/en_US/fbevents.js",
    );

    return NextResponse.json({
      status: check.ok ? "verified" : "configured",
      title: check.ok
        ? "Pixel preparado en Alentó"
        : "Pixel guardado",
      detail: check.ok
        ? "El ID quedó guardado y la librería de Meta está accesible. Meta confirma la recepción exacta del píxel en Events Manager > Probar eventos."
        : "El ID tiene formato válido y quedó guardado. Confirma la actividad desde Events Manager > Probar eventos.",
    });
  }

  if (kind === "tiktok") {
    if (!settings.tiktokPixelId) {
      return NextResponse.json({
        status: "invalid",
        title: "Falta el Pixel ID de TikTok",
        detail: "Guarda el identificador del píxel creado en TikTok Events Manager.",
      });
    }

    const check = await probe(
      `https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=${encodeURIComponent(
        settings.tiktokPixelId,
      )}&lib=ttq`,
    );

    return NextResponse.json({
      status: check.ok ? "verified" : "configured",
      title: check.ok ? "Pixel accesible" : "Pixel guardado",
      detail: check.ok
        ? "Alentó tiene el ID guardado y TikTok respondió al script del píxel. La recepción de eventos se confirma en Events Manager > Test Events."
        : "El ID quedó guardado. Confirma la recepción final en TikTok Events Manager > Test Events.",
    });
  }

  if (!settings.clarityId) {
    return NextResponse.json({
      status: "invalid",
      title: "Falta el Project ID de Clarity",
      detail: "Guarda el identificador del proyecto creado en Microsoft Clarity.",
    });
  }

  const check = await probe(
    `https://www.clarity.ms/tag/${encodeURIComponent(settings.clarityId)}`,
  );

  return NextResponse.json({
    status: check.ok ? "verified" : "configured",
    title: check.ok ? "Proyecto accesible" : "Proyecto guardado",
    detail: check.ok
      ? "El Project ID quedó guardado y Clarity respondió al script. Las sesiones aparecerán cuando haya tráfico con consentimiento."
      : "El ID tiene formato válido y quedó guardado. Revisa en Clarity que el proyecto exista y esté activo.",
  });
}
