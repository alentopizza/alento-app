import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/auth";
import { parseCashLoansCsv } from "@/lib/cashLoansCsv";

const IMPORT_LOCK_KEY = "cash_loans_import_v1";

async function requireAdmin() {
  try {
    const session = await requireStaffSession(["ADMIN"]);
    return { session, response: null as NextResponse | null };
  } catch (error) {
    const forbidden = error instanceof Error && error.message === "FORBIDDEN";
    return {
      session: null,
      response: NextResponse.json(
        { error: forbidden ? "Sin permisos." : "No autorizado." },
        { status: forbidden ? 403 : 401 },
      ),
    };
  }
}

async function readFile(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file");
  const action = String(formData.get("action") ?? "preview");

  if (!(file instanceof File)) {
    return {
      response: NextResponse.json(
        { error: "Selecciona el CSV de préstamos." },
        { status: 400 },
      ),
    };
  }
  if (!file.name.toLowerCase().endsWith(".csv")) {
    return {
      response: NextResponse.json(
        { error: "El archivo debe ser CSV." },
        { status: 400 },
      ),
    };
  }
  if (file.size > 5 * 1024 * 1024) {
    return {
      response: NextResponse.json(
        { error: "El archivo supera el límite de 5 MB." },
        { status: 400 },
      ),
    };
  }

  return { text: await file.text(), action };
}

export async function GET() {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const lock = await prisma.appSetting.findUnique({
    where: { key: IMPORT_LOCK_KEY },
    select: { value: true },
  });

  return NextResponse.json({
    completed: Boolean(lock),
    lock: lock?.value ?? null,
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;
  if (!auth.session) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const fileResult = await readFile(request);
  if ("response" in fileResult) return fileResult.response;

  const parsed = parseCashLoansCsv(fileResult.text);
  const lock = await prisma.appSetting.findUnique({
    where: { key: IMPORT_LOCK_KEY },
    select: { value: true },
  });

  const totalAmount = parsed.valid.reduce(
    (sum, row) => sum + row.amount,
    0,
  );
  const paidRows = parsed.valid.filter((row) => row.paid);
  const openRows = parsed.valid.filter((row) => !row.paid);
  const paidAmount = paidRows.reduce((sum, row) => sum + row.amount, 0);
  const outstandingAmount = openRows.reduce(
    (sum, row) => sum + row.amount,
    0,
  );
  const workers = new Set(parsed.valid.map((row) => row.workerName)).size;

  const blockers: string[] = [];
  if (lock) {
    blockers.push("La migración histórica de préstamos ya fue ejecutada.");
  }
  if (parsed.issues.length > 0) {
    blockers.push(
      `El archivo tiene ${parsed.issues.length} fila(s) con errores.`,
    );
  }

  if (fileResult.action === "preview") {
    return NextResponse.json({
      summary: {
        totalRows: parsed.totalRows,
        toImport: parsed.valid.length,
        issues: parsed.issues.length,
        totalAmount,
        paidCount: paidRows.length,
        paidAmount,
        openCount: openRows.length,
        outstandingAmount,
        workers,
        canImport:
          !lock && parsed.issues.length === 0 && parsed.valid.length > 0,
      },
      preview: parsed.valid.slice(0, 16).map((row) => ({
        rowNumber: row.rowNumber,
        issuedAt: row.issuedAt,
        workerName: row.workerName,
        amount: row.amount,
        paid: row.paid,
      })),
      issues: parsed.issues.slice(0, 50),
      blockers,
    });
  }

  if (fileResult.action !== "import") {
    return NextResponse.json(
      { error: "Acción inválida." },
      { status: 400 },
    );
  }

  if (blockers.length || parsed.valid.length === 0) {
    return NextResponse.json(
      {
        error: blockers[0] || "No hay préstamos válidos para importar.",
        blockers,
      },
      { status: 409 },
    );
  }

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const existingLock = await tx.appSetting.findUnique({
          where: { key: IMPORT_LOCK_KEY },
          select: { key: true },
        });
        if (existingLock) {
          throw new Error("CASH_LOAN_IMPORT_ALREADY_DONE");
        }

        for (const row of parsed.valid) {
          await tx.cashLoan.create({
            data: {
              workerName: row.workerName,
              principal: row.amount,
              issuedAt: row.issuedAt,
              status: row.paid ? "PAID" : "OPEN",
              source: "GLIDE_IMPORT",
              createdByName: auth.session.name,
              historicalPaidWithoutRepayment: row.paid,
              createdAt: row.issuedAt,
            },
          });
        }

        await tx.appSetting.create({
          data: {
            key: IMPORT_LOCK_KEY,
            value: {
              completedAt: new Date().toISOString(),
              importedLoans: parsed.valid.length,
              totalAmount,
              paidCount: paidRows.length,
              paidAmount,
              openCount: openRows.length,
              outstandingAmount,
              workers,
              note:
                "Los préstamos históricos PAGADO no incluyen fecha de devolución en el archivo fuente; se conservan como cerrados sin inventar un movimiento de caja.",
            },
          },
        });

        return {
          imported: parsed.valid.length,
          totalAmount,
          paidCount: paidRows.length,
          paidAmount,
          openCount: openRows.length,
          outstandingAmount,
          workers,
        };
      },
      { maxWait: 10_000, timeout: 120_000 },
    );

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "CASH_LOAN_IMPORT_ALREADY_DONE"
    ) {
      return NextResponse.json(
        { error: "La migración histórica de préstamos ya fue ejecutada." },
        { status: 409 },
      );
    }

    console.error("Cash loan import error", error);
    return NextResponse.json(
      { error: "No fue posible importar los préstamos." },
      { status: 500 },
    );
  }
}
