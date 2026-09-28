import { NextRequest, NextResponse } from "next/server";
import {
  extractRappiOrders,
  rappiIntegrationStatus,
  rappiListStoreOrders,
} from "@/lib/rappi";
import { importRappiOrder } from "@/lib/rappiOrderImport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    integration: rappiIntegrationStatus(),
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const action = String(body?.action ?? "sync").trim().toLowerCase();

    if (action !== "sync" && action !== "test") {
      return NextResponse.json(
        { error: "Acción Rappi no soportada." },
        { status: 400 },
      );
    }

    const status = rappiIntegrationStatus();
    if (!status.apiConfigured) {
      return NextResponse.json(
        {
          error:
            "La API de Rappi todavía no tiene credenciales completas en el servidor.",
          integration: status,
        },
        { status: 503 },
      );
    }

    const response = await rappiListStoreOrders(status.storeId);
    const remoteOrders = extractRappiOrders(response);

    if (action === "test") {
      return NextResponse.json({
        ok: true,
        integration: status,
        pendingOrders: remoteOrders.length,
      });
    }

    const results = [];
    for (const remoteOrder of remoteOrders) {
      const imported = await importRappiOrder(remoteOrder, {
        eventName: "MANUAL_SYNC",
      });
      results.push({
        externalOrderId: imported.parsed.externalOrderId,
        orderId: imported.order?.id ?? null,
        created: imported.created,
        autoAccepted: imported.autoAccepted,
      });
    }

    return NextResponse.json({
      ok: true,
      integration: status,
      found: remoteOrders.length,
      created: results.filter((item) => item.created).length,
      results,
    });
  } catch (error) {
    console.error("Rappi integration sync error", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No fue posible consultar Rappi.",
      },
      { status: 502 },
    );
  }
}
