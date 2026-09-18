import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mapCustomerImport, parseCsv } from "@/lib/customerCsv";

type ExistingCustomer = {
  id: number;
  phone: string | null;
  email: string | null;
};

function dedupeRows(rows: ReturnType<typeof mapCustomerImport>["valid"]) {
  const seenPhones = new Map<string, number>();
  const accepted = [];
  const duplicates = [];

  for (const row of rows) {
    const key = row.phone;
    const first = seenPhones.get(key);
    if (first) {
      duplicates.push({
        rowNumber: row.rowNumber,
        name: row.name,
        phone: row.phone,
        reason: `Teléfono repetido en el archivo (primera aparición en fila ${first}).`,
      });
      continue;
    }
    seenPhones.set(key, row.rowNumber);
    accepted.push(row);
  }

  return { accepted, duplicates };
}

function existingMatches(rows: ReturnType<typeof mapCustomerImport>["valid"], existing: ExistingCustomer[]) {
  const byPhone = new Set(existing.map((item) => item.phone ?? "").filter(Boolean));
  const byEmail = new Set(existing.map((item) => item.email?.toLowerCase() ?? "").filter(Boolean));

  const create = [];
  const skip = [];

  for (const row of rows) {
    const phoneExists = byPhone.has(row.phone);
    const emailExists = row.email ? byEmail.has(row.email.toLowerCase()) : false;

    if (phoneExists || emailExists) {
      skip.push({
        rowNumber: row.rowNumber,
        name: row.name,
        phone: row.phone,
        reason: phoneExists ? "Ya existe un cliente con este teléfono." : "Ya existe un cliente con este correo.",
      });
      continue;
    }

    create.push(row);
  }

  return { create, skip };
}

async function analyzeCsv(text: string) {
  const { records } = parseCsv(text);
  const mapped = mapCustomerImport(records);
  const deduped = dedupeRows(mapped.valid);

  const phones = deduped.accepted.map((row) => row.phone);
  const emails = deduped.accepted.map((row) => row.email).filter(Boolean);

  const existing = phones.length || emails.length
    ? await prisma.customer.findMany({
        where: {
          OR: [
            ...(phones.length ? [{ phone: { in: phones } }] : []),
            ...(emails.length ? [{ email: { in: emails } }] : []),
          ],
        },
        select: { id: true, phone: true, email: true },
      })
    : [];

  const matched = existingMatches(deduped.accepted, existing);

  return {
    totalRows: records.length,
    create: matched.create,
    skipped: [...mapped.invalid, ...deduped.duplicates, ...matched.skip],
  };
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file");
  const action = String(formData.get("action") ?? "preview");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Debes seleccionar un archivo CSV." }, { status: 400 });
  }

  if (!file.name.toLowerCase().endsWith(".csv")) {
    return NextResponse.json({ error: "El archivo debe ser CSV." }, { status: 400 });
  }

  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "El archivo supera el límite de 5 MB." }, { status: 400 });
  }

  const text = await file.text();
  const analysis = await analyzeCsv(text);

  if (action === "preview") {
    return NextResponse.json({
      summary: {
        totalRows: analysis.totalRows,
        toCreate: analysis.create.length,
        skipped: analysis.skipped.length,
      },
      preview: analysis.create.slice(0, 20),
      issues: analysis.skipped.slice(0, 50),
    });
  }

  if (action !== "import") {
    return NextResponse.json({ error: "Acción inválida." }, { status: 400 });
  }

  if (analysis.create.length === 0) {
    return NextResponse.json({
      imported: 0,
      skipped: analysis.skipped.length,
      message: "No hay clientes nuevos para importar.",
    });
  }

  const createdIds: number[] = [];

  await prisma.$transaction(async (tx) => {
    for (const row of analysis.create) {
      const customer = await tx.customer.create({
        data: {
          name: row.name,
          countryCode: row.countryCode,
          phone: row.phone,
          email: row.email || null,
          notes: row.notes || null,
          ...(row.address
            ? {
                addresses: {
                  create: {
                    address: row.address,
                    notes: row.addressNotes || null,
                    isDefault: true,
                  },
                },
              }
            : {}),
        },
        select: { id: true },
      });
      createdIds.push(customer.id);
    }
  });

  return NextResponse.json({
    imported: createdIds.length,
    skipped: analysis.skipped.length,
    createdIds,
  });
}
