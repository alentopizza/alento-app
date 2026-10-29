import { NextResponse } from "next/server";
import { csvEscape } from "@/lib/customerCsv";

export async function GET() {
  const header = [
    "Cliente/Nombre",
    "Cliente/Indicativo",
    "Cliente/Telefono",
    "Cliente/Correo",
    "Cliente/Dirección",
    "Cliente/Complemento",
    "Cliente/GPS Link",
    "Cliente/Notas",
  ];

  const example = [
    "Cliente Ejemplo",
    "57",
    "3001234567",
    "cliente@ejemplo.com",
    "Calle 8a #92-72",
    "Casa 139",
    "",
    "Cliente frecuente",
  ];

  const csv = [
    header.map(csvEscape).join(","),
    example.map(csvEscape).join(","),
  ].join("\r\n");

  return new NextResponse("\uFEFF" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="template-clientes-alento.csv"',
      "Cache-Control": "no-store",
    },
  });
}
