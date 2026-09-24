import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/auth";
import { parseCashExpensesCsv } from "@/lib/cashExpensesCsv";

const IMPORT_LOCK_KEY = "cash_expenses_import_v1";

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
        { error: "Selecciona el CSV de salidas." },
        { status: 400 },
      ),
    };
  }

  if (!file.name.toLowerCase().endsWith(".csv")) {
    return {
      response: NextResponse.json(
        { error: "Para esta migración usa el archivo CSV de salidas." },
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

  const parsed = parseCashExpensesCsv(fileResult.text);
  const lock = await prisma.appSetting.findUnique({
    where: { key: IMPORT_LOCK_KEY },
    select: { value: true },
  });

  const totalAmount = parsed.valid.reduce(
    (sum, row) => sum + row.amount,
    0,
  );
  const categoryCount = new Set(
    parsed.valid.map((row) => row.category),
  ).size;
  const blockers: string[] = [];

  if (lock) {
    blockers.push(
      "La migración histórica de salidas ya fue ejecutada.",
    );
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
        categoryCount,
        canImport:
          !lock && parsed.issues.length === 0 && parsed.valid.length > 0,
      },
      preview: parsed.valid.slice(0, 12).map((row) => ({
        rowNumber: row.rowNumber,
        occurredAt: row.occurredAt,
        category: row.category,
        subcategory: row.subcategory,
        note: row.note,
        amount: row.amount,
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
        error: blockers[0] || "No hay salidas válidas para importar.",
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
          throw new Error("CASH_EXPENSE_IMPORT_ALREADY_DONE");
        }

        for (const row of parsed.valid) {
          await tx.cashExpense.create({
            data: {
              category: row.category,
              subcategory: row.subcategory || null,
              note: row.note || null,
              amount: row.amount,
              occurredAt: row.occurredAt,
              source: "GLIDE_IMPORT",
              createdByName: auth.session!.name,
              createdAt: row.occurredAt,
            },
          });
        }

        await tx.appSetting.create({
          data: {
            key: IMPORT_LOCK_KEY,
            value: {
              completedAt: new Date().toISOString(),
              importedExpenses: parsed.valid.length,
              totalAmount,
              categoryCount,
            },
          },
        });

        return {
          imported: parsed.valid.length,
          totalAmount,
          categoryCount,
        };
      },
      {
        maxWait: 10_000,
        timeout: 120_000,
      },
    );

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "CASH_EXPENSE_IMPORT_ALREADY_DONE"
    ) {
      return NextResponse.json(
        { error: "La migración histórica de salidas ya fue ejecutada." },
        { status: 409 },
      );
    }

    console.error("Cash expense import error", error);
    return NextResponse.json(
      { error: "No fue posible importar las salidas." },
      { status: 500 },
    );
  }
}
