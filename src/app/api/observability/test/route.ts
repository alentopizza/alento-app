import { NextRequest, NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/auth";
import {
  reportOperationalIncident,
  requestIdFromHeaders,
} from "@/lib/observability";

export async function POST(request: NextRequest) {
  let session;
  try {
    session = await requireStaffSession(["ADMIN"]);
  } catch (error) {
    const forbidden = error instanceof Error && error.message === "FORBIDDEN";
    return NextResponse.json(
      { error: forbidden ? "Sin permisos." : "No autorizado." },
      { status: forbidden ? 403 : 401 },
    );
  }

  const requestId = requestIdFromHeaders(request.headers);
  const incident = await reportOperationalIncident({
    level: "WARNING",
    category: "SYSTEM",
    code: "OBSERVABILITY_TEST",
    message:
      "Alerta de prueba generada desde Salud del sistema. No representa una falla real.",
    requestId,
    source: "api/observability/test",
    fingerprintKey: "manual-validation",
    metadata: {
      generatedByUserId: session.userId,
      generatedByName: session.name,
    },
  });

  if (!incident) {
    return NextResponse.json(
      { error: "No fue posible registrar la alerta de prueba." },
      { status: 500 },
    );
  }

  return NextResponse.json({ incident }, { status: 201 });
}
