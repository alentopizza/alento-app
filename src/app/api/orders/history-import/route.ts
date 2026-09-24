import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/auth";
import {
  parseHistoricalOrdersCsv,
  type HistoricalOrderImportRow,
} from "@/lib/historicalOrdersCsv";

const IMPORT_LOCK_KEY = "historical_orders_import_v1";

function addressKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

async function requireAdmin() {
  try {
    await requireStaffSession(["ADMIN"]);
    return null;
  } catch (error) {
    const forbidden = error instanceof Error && error.message === "FORBIDDEN";
    return NextResponse.json(
      { error: forbidden ? "Sin permisos." : "No autorizado." },
      { status: forbidden ? 403 : 401 },
    );
  }
}

async function analyze(text: string) {
  const parsed = parseHistoricalOrdersCsv(text);
  const lock = await prisma.appSetting.findUnique({
    where: { key: IMPORT_LOCK_KEY },
    select: { value: true },
  });
  const existingOrderCount = await prisma.order.count();

  const uniquePhones = [...new Set(parsed.valid.map((row) => row.phone))];
  const existingCustomers = uniquePhones.length
    ? await prisma.customer.findMany({
        where: { phone: { in: uniquePhones } },
        select: { phone: true },
      })
    : [];
  const existingPhoneSet = new Set(
    existingCustomers
      .map((customer) => customer.phone)
      .filter((value): value is string => Boolean(value)),
  );

  const preview = parsed.valid.slice(0, 15).map((row, index) => ({
    sequenceNumber: index + 1,
    source: row.source,
    createdAt: row.createdAt.toISOString(),
    customerName: row.customerName,
    fulfillmentType: row.fulfillmentType,
    total: row.total,
    itemCount: row.items.reduce((sum, item) => sum + item.quantity, 0),
  }));

  const correctedPayments = parsed.valid.filter(
    (row) => row.correctedUnpaid,
  ).length;
  const totalSales = parsed.valid.reduce((sum, row) => sum + row.total, 0);
  const totalItems = parsed.valid.reduce(
    (sum, row) =>
      sum + row.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
    0,
  );

  const blockers: string[] = [];
  if (lock) {
    blockers.push(
      "La importación histórica ya fue ejecutada y está bloqueada para evitar duplicados.",
    );
  }
  if (existingOrderCount > 0) {
    blockers.push(
      "La base contiene " +
        existingOrderCount +
        " pedido(s). Esta migración solo puede ejecutarse con Pedidos vacío para iniciar el consecutivo en 0001.",
    );
  }
  if (parsed.issues.length > 0) {
    blockers.push(
      "El archivo tiene " +
        parsed.issues.length +
        " fila(s) que deben corregirse antes de importar.",
    );
  }

  return {
    parsed,
    lock,
    existingOrderCount,
    summary: {
      totalRows: parsed.totalRows,
      toImport: parsed.valid.length,
      issues: parsed.issues.length,
      uniqueCustomers: uniquePhones.length,
      matchedCustomers: existingPhoneSet.size,
      customersToCreate: uniquePhones.filter(
        (phone) => !existingPhoneSet.has(phone),
      ).length,
      correctedPayments,
      totalSales,
      totalItems,
      firstSequence: parsed.valid.length ? 1 : 0,
      lastSequence: parsed.valid.length,
      canImport: blockers.length === 0 && parsed.valid.length > 0,
    },
    preview,
    blockers,
  };
}

async function fileFromRequest(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file");
  const action = String(formData.get("action") ?? "preview");

  if (!(file instanceof File)) {
    return {
      response: NextResponse.json(
        { error: "Selecciona el archivo CSV de pedidos." },
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

  return {
    text: await file.text(),
    action,
  };
}

export async function GET() {
  const authError = await requireAdmin();
  if (authError) return authError;

  const lock = await prisma.appSetting.findUnique({
    where: { key: IMPORT_LOCK_KEY },
    select: { value: true },
  });
  const existingOrderCount = await prisma.order.count();

  return NextResponse.json({
    completed: Boolean(lock),
    existingOrderCount,
    lock: lock?.value ?? null,
  });
}

export async function POST(request: NextRequest) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const fileResult = await fileFromRequest(request);
  if ("response" in fileResult) return fileResult.response;

  const analysis = await analyze(fileResult.text);

  if (fileResult.action === "preview") {
    return NextResponse.json({
      summary: analysis.summary,
      preview: analysis.preview,
      issues: analysis.parsed.issues.slice(0, 50),
      blockers: analysis.blockers,
    });
  }

  if (fileResult.action !== "import") {
    return NextResponse.json(
      { error: "Acción inválida." },
      { status: 400 },
    );
  }

  if (!analysis.summary.canImport) {
    return NextResponse.json(
      {
        error:
          analysis.blockers[0] ||
          "El archivo todavía no está listo para importarse.",
        blockers: analysis.blockers,
      },
      { status: 409 },
    );
  }

  const rows = analysis.parsed.valid;

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const lock = await tx.appSetting.findUnique({
          where: { key: IMPORT_LOCK_KEY },
          select: { key: true },
        });
        if (lock) {
          throw new Error("HISTORICAL_IMPORT_ALREADY_DONE");
        }

        const existingOrderCount = await tx.order.count();
        if (existingOrderCount > 0) {
          throw new Error("HISTORICAL_IMPORT_REQUIRES_EMPTY_ORDERS");
        }

        const uniquePhones = [...new Set(rows.map((row) => row.phone))];
        const existingCustomers = uniquePhones.length
          ? await tx.customer.findMany({
              where: { phone: { in: uniquePhones } },
              select: {
                id: true,
                phone: true,
                addresses: {
                  select: {
                    id: true,
                    address: true,
                    isDefault: true,
                  },
                },
              },
            })
          : [];

        const customerByPhone = new Map<
          string,
          {
            id: number;
            addresses: Array<{
              id: number;
              address: string;
              isDefault: boolean;
            }>;
          }
        >();

        existingCustomers.forEach((customer) => {
          if (!customer.phone) return;
          customerByPhone.set(customer.phone, {
            id: customer.id,
            addresses: [...customer.addresses],
          });
        });

        let imported = 0;
        let createdCustomers = 0;
        let createdAddresses = 0;
        let correctedPayments = 0;

        for (let index = 0; index < rows.length; index += 1) {
          const row: HistoricalOrderImportRow = rows[index];
          const sequenceNumber = index + 1;
          let customer = customerByPhone.get(row.phone);

          if (!customer) {
            const created = await tx.customer.create({
              data: {
                name: row.customerName,
                countryCode: row.countryCode,
                phone: row.phone,
                createdAt: row.createdAt,
              },
              select: { id: true },
            });
            customer = { id: created.id, addresses: [] };
            customerByPhone.set(row.phone, customer);
            createdCustomers += 1;
          }

          let addressId: number | null = null;

          if (row.fulfillmentType === "DELIVERY" && row.address) {
            const normalized = addressKey(row.address);
            const existingAddress = customer.addresses.find(
              (address) => addressKey(address.address) === normalized,
            );

            if (existingAddress) {
              addressId = existingAddress.id;
            } else {
              const created = await tx.customerAddress.create({
                data: {
                  customerId: customer.id,
                  label: "Histórico",
                  address: row.address,
                  notes: row.addressNotes || null,
                  isDefault: customer.addresses.length === 0,
                  createdAt: row.createdAt,
                },
                select: {
                  id: true,
                  address: true,
                  isDefault: true,
                },
              });

              customer.addresses.push(created);
              addressId = created.id;
              createdAddresses += 1;
            }
          }

          const paymentMethod = row.correctedUnpaid
            ? "Efectivo"
            : row.paymentMethod || "Histórico";

          if (row.correctedUnpaid && row.total > 0) {
            correctedPayments += 1;
          }

          await tx.order.create({
            data: {
              sequenceNumber,
              customerId: customer.id,
              addressId,
              status: "COMPLETED",
              fulfillmentType: row.fulfillmentType,
              source: row.source,
              subtotal: row.subtotal,
              deliveryFee: row.deliveryFee,
              discount: row.discount,
              discountSource: row.discount > 0 ? "HISTORICAL" : "NONE",
              total: row.total,
              createdAt: row.createdAt,
              items: {
                create: row.items.map((item) => ({
                  productName: item.productName,
                  unitPrice: item.unitPrice,
                  quantity: item.quantity,
                  preparedQuantity: item.quantity,
                  lineTotal: item.lineTotal,
                  configuration: item.detail
                    ? {
                        kind: "POS_SNAPSHOT",
                        detail: item.detail,
                      }
                    : undefined,
                  notes: item.notes,
                  createdAt: row.createdAt,
                })),
              },
              ...(row.total > 0
                ? {
                    payments: {
                      create: {
                        method: paymentMethod,
                        amount: row.total,
                        status: "PAID",
                        paidAt: row.createdAt,
                        createdAt: row.createdAt,
                      },
                    },
                  }
                : {}),
            },
          });

          imported += 1;
        }

        await tx.orderSequence.upsert({
          where: { id: 1 },
          create: { id: 1, current: imported },
          update: { current: imported },
        });

        await tx.appSetting.create({
          data: {
            key: IMPORT_LOCK_KEY,
            value: {
              completedAt: new Date().toISOString(),
              importedOrders: imported,
              firstSequence: 1,
              lastSequence: imported,
              createdCustomers,
              createdAddresses,
              correctedPayments,
            },
          },
        });

        return {
          imported,
          createdCustomers,
          createdAddresses,
          correctedPayments,
          firstSequence: 1,
          lastSequence: imported,
        };
      },
      {
        maxWait: 10_000,
        timeout: 120_000,
      },
    );

    return NextResponse.json({
      ok: true,
      ...result,
      message:
        "Importación histórica completada: " +
        result.imported +
        " pedidos · consecutivos 0001 a " +
        String(result.lastSequence).padStart(4, "0") +
        ".",
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "HISTORICAL_IMPORT_ALREADY_DONE"
    ) {
      return NextResponse.json(
        { error: "La importación histórica ya fue ejecutada." },
        { status: 409 },
      );
    }
    if (
      error instanceof Error &&
      error.message === "HISTORICAL_IMPORT_REQUIRES_EMPTY_ORDERS"
    ) {
      return NextResponse.json(
        {
          error:
            "Pedidos ya contiene registros. La migración histórica requiere la base vacía para iniciar en 0001.",
        },
        { status: 409 },
      );
    }

    console.error("Historical orders import error", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No fue posible importar el historial.",
      },
      { status: 500 },
    );
  }
}
