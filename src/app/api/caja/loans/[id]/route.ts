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
    return NextResponse.json(
      { error: "Préstamo inválido." },
      { status: 400 },
    );
  }

  try {
    const loan = await prisma.cashLoan.findUnique({
      where: { id },
      include: { repayments: { select: { id: true } } },
    });

    if (!loan) {
      return NextResponse.json(
        { error: "El préstamo ya no existe." },
        { status: 404 },
      );
    }

    if (loan.repayments.length > 0) {
      return NextResponse.json(
        {
          error:
            "Este préstamo ya tiene abonos. Conserva la trazabilidad en lugar de eliminarlo.",
        },
        { status: 409 },
      );
    }

    await prisma.cashLoan.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Cash loan delete error", error);
    return NextResponse.json(
      { error: "No fue posible eliminar el préstamo." },
      { status: 500 },
    );
  }
}
