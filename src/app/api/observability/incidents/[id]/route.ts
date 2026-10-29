import { NextRequest, NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/auth";
import {
  logInfo,
  requestIdFromHeaders,
  resolveOperationalIncident,
} from "@/lib/observability";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
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
  const { id } = await context.params;

  try {
    const incident = await resolveOperationalIncident({
      id,
      userId: session.userId,
      userName: session.name,
    });

    logInfo(
      "OPERATIONAL_INCIDENT_RESOLVED",
      `Incidente ${incident.code} marcado como resuelto.`,
      {
        requestId,
        source: "api/observability/incidents/[id]",
        entityType: "OPERATIONAL_INCIDENT",
        entityId: incident.id,
        metadata: {
          category: incident.category,
          occurrenceCount: incident.occurrenceCount,
        },
      },
    );

    return NextResponse.json({ incident });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error && "code" in error && error.code === "P2025"
            ? "El incidente ya no existe."
            : "No fue posible marcar el incidente como resuelto.",
      },
      { status: 404 },
    );
  }
}
