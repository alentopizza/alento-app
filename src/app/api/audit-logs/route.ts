import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/auth";

function safeDate(value: string | null, endOfDay = false) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const suffix = endOfDay ? "T23:59:59.999-05:00" : "T00:00:00.000-05:00";
  const parsed = new Date(value + suffix);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
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

  const params = request.nextUrl.searchParams;
  const action = params.get("action")?.trim() || "";
  const entityType = params.get("entityType")?.trim() || "";
  const actor = params.get("actor")?.trim() || "";
  const from = safeDate(params.get("from"));
  const to = safeDate(params.get("to"), true);
  const requestedTake = Number(params.get("take") || 100);
  const take = Math.min(
    200,
    Math.max(20, Number.isFinite(requestedTake) ? Math.floor(requestedTake) : 100),
  );

  const where: Prisma.AuditLogWhereInput = {};

  if (action) where.action = action;
  if (entityType) where.entityType = entityType;

  if (actor) {
    where.OR = [
      { actorName: { contains: actor, mode: "insensitive" } },
      { actorEmail: { contains: actor, mode: "insensitive" } },
      { summary: { contains: actor, mode: "insensitive" } },
    ];
  }

  if (from || to) {
    where.occurredAt = {
      ...(from ? { gte: from } : {}),
      ...(to ? { lte: to } : {}),
    };
  }

  try {
    const [logs, actionRows, entityRows] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
        take,
      }),
      prisma.auditLog.findMany({
        distinct: ["action"],
        select: { action: true },
        orderBy: { action: "asc" },
      }),
      prisma.auditLog.findMany({
        distinct: ["entityType"],
        select: { entityType: true },
        orderBy: { entityType: "asc" },
      }),
    ]);

    return NextResponse.json({
      logs,
      filters: {
        actions: actionRows.map((row) => row.action),
        entityTypes: entityRows.map((row) => row.entityType),
      },
      limit: take,
    });
  } catch (error) {
    console.error("Audit log read error", error);
    return NextResponse.json(
      { error: "No fue posible cargar la auditoría." },
      { status: 500 },
    );
  }
}
