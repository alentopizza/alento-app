import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { csvEscape } from "@/lib/customerCsv";

export async function GET() {
  const customers = await prisma.customer.findMany({
    orderBy: { name: "asc" },
    select: {
      name: true,
      countryCode: true,
      phone: true,
      email: true,
      notes: true,
      addresses: {
        orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
        take: 1,
        select: {
          address: true,
          notes: true,
        },
      },
    },
  });

  const header = [
    "Cliente/Nombre",
    "Cliente/Indicativo",
    "Cliente/Telefono",
    "Cliente/Correo",
    "Cliente/Dirección",
    "Cliente/Complemento",
    "Cliente/Notas",
  ];

  const rows = customers.map((customer) => {
    const address = customer.addresses[0];
    return [
      customer.name,
      customer.countryCode.replace(/^\+/, ""),
      customer.phone ?? "",
      customer.email ?? "",
      address?.address ?? "",
      address?.notes ?? "",
      customer.notes ?? "",
    ];
  });

  const csv = [
    header.map(csvEscape).join(","),
    ...rows.map((row) => row.map(csvEscape).join(",")),
  ].join("\r\n");

  return new NextResponse("\uFEFF" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="clientes-alento.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
