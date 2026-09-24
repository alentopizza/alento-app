import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/auth";

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireStaffSession(["ADMIN", "CASHIER"]);
  } catch (error) {
    const forbidden = error instanceof Error && error.message === "FORBIDDEN";
    return NextResponse.json(
      { error: forbidden ? "Sin permisos." : "No autorizado." },
      { status: forbidden ? 403 : 401 },
    );
  }

  const { id: rawId } = await context.params;
  const id = Number(rawId);

  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Ingreso inválido." }, { status: 400 });
  }

  try {
    const existing = await prisma.cashIncome.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "El ingreso ya no existe." },
        { status: 404 },
      );
    }

    await prisma.cashIncome.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Cash income delete error", error);
    return NextResponse.json(
      { error: "No fue posible eliminar el ingreso." },
      { status: 500 },
    );
  }
}
