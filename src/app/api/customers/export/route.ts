import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { csvEscape } from "@/lib/customerCsv";

type CustomerMetrics = {
  purchaseCount: number;
  lastOrderAt: Date | null;
  frequencyDays: number | null;
};

function digits(value: string | null | undefined) {
  return String(value ?? "").replace(/\D/g, "");
}

function chatwootPhone(countryCode: string | null, phone: string | null) {
  const phoneDigits = digits(phone);
  if (!phoneDigits) return "";

  const countryDigits = digits(countryCode) || "57";

  if (phoneDigits.startsWith(countryDigits) && phoneDigits.length > 10) {
    return `+${phoneDigits}`;
  }

  return `+${countryDigits}${phoneDigits}`;
}

function daysSince(value: Date | null) {
  if (!value) return null;
  return Math.max(0, Math.floor((Date.now() - value.getTime()) / 86400000));
}

function customerSignal(metrics: CustomerMetrics) {
  if (metrics.purchaseCount === 0) return "Sin compras";
  if (metrics.purchaseCount === 1) return "Nuevo";

  const inactiveDays = daysSince(metrics.lastOrderAt);
  const expected = metrics.frequencyDays ?? 30;
  const rescueThreshold = Math.max(21, Math.round(expected * 1.6));

  if (inactiveDays !== null && inactiveDays > rescueThreshold) {
    return "Por recuperar";
  }

  if (metrics.purchaseCount >= 4) return "Frecuente";
  return "Activo";
}

export async function GET() {
  const customers = await prisma.customer.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      countryCode: true,
      phone: true,
      email: true,
      addresses: {
        orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
        take: 1,
        select: {
          address: true,
          notes: true,
        },
      },
      orders: {
        where: { status: { not: "CANCELED" } },
        orderBy: { createdAt: "asc" },
        select: {
          createdAt: true,
        },
      },
    },
  });

  const header = [
    "id",
    "name",
    "email",
    "identifier",
    "phone_number",
    "labels",
    "ip_address",
    "company_name",
    "custom_attribute_1",
    "custom_attribute_2",
    "custom_attribute_3",
    "custom_attribute_4",
  ];

  const rows = customers.map((customer) => {
    const address = customer.addresses[0];
    const purchaseCount = customer.orders.length;
    const firstOrderAt = customer.orders[0]?.createdAt ?? null;
    const lastOrderAt = customer.orders.at(-1)?.createdAt ?? null;
    const frequencyDays =
      purchaseCount > 1 && firstOrderAt && lastOrderAt
        ? Math.max(
            1,
            Math.round(
              (lastOrderAt.getTime() - firstOrderAt.getTime()) /
                86400000 /
                (purchaseCount - 1),
            ),
          )
        : null;

    const status = customerSignal({
      purchaseCount,
      lastOrderAt,
      frequencyDays,
    });

    return [
      customer.id,
      customer.name,
      customer.email ?? "",
      `alento_customer_${customer.id}`,
      chatwootPhone(customer.countryCode, customer.phone),
      "",
      "",
      "Alentó Pizza",
      address?.address ?? "",
      address?.notes ?? "",
      customer.id,
      status,
    ];
  });

  const csv = [
    header.map(csvEscape).join(","),
    ...rows.map((row) => row.map(csvEscape).join(",")),
  ].join("\r\n");

  return new NextResponse("\uFEFF" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="clientes-alento-chatwoot.csv"',
      "Cache-Control": "no-store",
    },
  });
}
