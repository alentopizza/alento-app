import {
  normalizeCountryCode,
  normalizeImportedPhone,
  parseCsv,
} from "@/lib/customerCsv";

export type HistoricalOrderItemImport = {
  productName: string;
  quantity: number;
  lineTotal: number;
  unitPrice: number;
  detail: string;
  notes: string | null;
};

export type HistoricalOrderImportRow = {
  rowNumber: number;
  createdAt: Date;
  fulfillmentType: "DELIVERY" | "PICKUP" | "STORE";
  source: "POS" | "WEB";
  customerName: string;
  countryCode: string;
  phone: string;
  address: string;
  addressNotes: string;
  items: HistoricalOrderItemImport[];
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  paymentMethod: string;
  correctedUnpaid: boolean;
};

export type HistoricalOrderImportIssue = {
  rowNumber: number;
  reason: string;
};

function normalizeHeader(value: string) {
  return value
    .replace(/^\uFEFF/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function read(record: Record<string, string>, aliases: string[]) {
  for (const alias of aliases) {
    const value = record[normalizeHeader(alias)];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function money(value: string) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits ? Number(digits) : 0;
}

function parseBogotaDate(value: string) {
  const match = value
    .trim()
    .match(
      /^(\d{1,2})\/(\d{1,2})\/(\d{4}),?\s+(\d{1,2}):(\d{2}):(\d{2})(?:\s*([ap])\.?m\.?)?$/i,
    );

  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  let hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const meridiem = match[7]?.toLowerCase();

  if (meridiem === "p" && hour < 12) hour += 12;
  if (meridiem === "a" && hour === 12) hour = 0;

  if (
    !Number.isInteger(day) ||
    !Number.isInteger(month) ||
    !Number.isInteger(year) ||
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    !Number.isInteger(second) ||
    day < 1 ||
    day > 31 ||
    month < 1 ||
    month > 12 ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59 ||
    second < 0 ||
    second > 59
  ) {
    return null;
  }

  // Bogotá es UTC-5 todo el año.
  const date = new Date(
    Date.UTC(year, month - 1, day, hour + 5, minute, second),
  );

  return Number.isNaN(date.getTime()) ? null : date;
}

function cleanValue(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function escapeRegex(value: string) {
  return value.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
}

function field(block: string, label: string) {
  const match = block.match(
    new RegExp(escapeRegex(label) + ":\\s*\\*([\\s\\S]*?)\\*", "i"),
  );
  return match ? cleanValue(match[1]) : "";
}

const PRODUCT_PATTERN =
  /Producto:\s*\*([\s\S]*?)\*\s*·\s*([0-9])(?:\uFE0F?\u20E3)?([\s\S]*?)(?=(?:\n\s*\*[^\n]+\*\s*\n)?Producto:|$)/gi;

function parseItems(value: string) {
  const items: HistoricalOrderItemImport[] = [];
  PRODUCT_PATTERN.lastIndex = 0;

  for (const match of value.matchAll(PRODUCT_PATTERN)) {
    const productName = cleanValue(match[1]);
    const quantity = Number(match[2]);
    const block = match[3] ?? "";
    const lineTotal = money(field(block, "Subtotal"));

    if (
      !productName ||
      !Number.isInteger(quantity) ||
      quantity <= 0 ||
      !Number.isFinite(lineTotal) ||
      lineTotal < 0
    ) {
      continue;
    }

    const detailParts = [
      ["Tamaño", field(block, "Tamaño")],
      ["Sabor 1", field(block, "Sabor 1")],
      ["Sabor 2", field(block, "Sabor 2")],
      ["Borde", field(block, "Borde")],
      ["Bebida", field(block, "Bebida")],
    ]
      .filter(([, detail]) => Boolean(detail))
      .map(([label, detail]) => label + ": " + detail);

    const rawNote = field(block, "Nota");
    const unitPrice =
      quantity > 0 ? Math.round(lineTotal / quantity) : lineTotal;

    items.push({
      productName,
      quantity,
      lineTotal,
      unitPrice,
      detail: detailParts.join(" · "),
      notes: rawNote || null,
    });
  }

  return items;
}

function fulfillment(value: string) {
  const normalized = cleanValue(value).toUpperCase();
  if (normalized === "DOMICILIO") return "DELIVERY" as const;
  if (
    normalized === "RECOGER EN TIENDA" ||
    normalized === "RECOGER" ||
    normalized === "PICKUP"
  ) {
    return "PICKUP" as const;
  }
  if (
    normalized === "LOCAL" ||
    normalized === "CONSUMO EN LOCAL" ||
    normalized === "EN TIENDA"
  ) {
    return "STORE" as const;
  }
  return null;
}

function source(value: string) {
  return cleanValue(value).toUpperCase() === "WEB"
    ? ("WEB" as const)
    : ("POS" as const);
}

export function parseHistoricalOrdersCsv(text: string) {
  const { records } = parseCsv(text);
  const valid: HistoricalOrderImportRow[] = [];
  const issues: HistoricalOrderImportIssue[] = [];

  records.forEach((record, index) => {
    const rowNumber = index + 2;
    const createdAt = parseBogotaDate(
      read(record, ["Fecha Y Hora", "Fecha y hora", "Fecha"]),
    );
    const fulfillmentType = fulfillment(
      read(record, ["Tipo De Pedido", "Tipo de pedido"]),
    );
    const customerName = read(record, [
      "Cliente/Nombre",
      "Cliente",
      "Nombre",
    ]);
    const countryCode = normalizeCountryCode(
      read(record, ["Cliente/Indicativo", "Indicativo"]),
    );
    const phone = normalizeImportedPhone(
      read(record, [
        "Cliente/Telefono",
        "Cliente/Teléfono",
        "Telefono",
        "Teléfono",
      ]),
      countryCode,
    );
    const address = read(record, [
      "Cliente/Dirección",
      "Cliente/Direccion",
      "Dirección",
      "Direccion",
    ]);
    const addressNotes = read(record, [
      "Cliente/Complemento",
      "Complemento",
    ]);
    const productText = read(record, [
      "Pedido/Listado De Productos",
      "Pedido/Listado de productos",
      "Productos",
    ]);
    const items = parseItems(productText);
    const subtotal = money(
      read(record, ["Totales/Sub Total Final", "Totales/Sub Total"]),
    );
    const deliveryFee = money(
      read(record, ["Totales/Envió", "Totales/Envio", "Domicilio"]),
    );
    const discount = money(
      read(record, ["Totales/Descuento", "Descuento"]),
    );
    const total = money(
      read(record, ["Totales/Total Calculado", "Total"]),
    );
    const paymentStatus = read(record, ["Pagos/Estado", "Estado de pago"]);
    const paymentAmount = money(
      read(record, ["Pagos/Monto", "Monto pagado"]),
    );
    const paymentMethod = read(record, [
      "Cliente/Medio De Pago",
      "Cliente/Medio de pago",
      "Medio De Pago",
      "Medio de pago",
    ]);
    const calculatedTotal = subtotal + deliveryFee - discount;
    const itemSubtotal = items.reduce(
      (sum, item) => sum + item.lineTotal,
      0,
    );
    const paymentText = paymentStatus.toUpperCase();
    const paid =
      paymentText.includes("PAGADO") &&
      !paymentText.includes("NO PAGADO") &&
      paymentAmount === total;
    const correctedUnpaid = !paid;

    const reasons: string[] = [];
    if (!createdAt) reasons.push("Fecha y hora inválidas.");
    if (!fulfillmentType) reasons.push("Tipo de pedido no reconocido.");
    if (!customerName) reasons.push("Falta el nombre del cliente.");
    if (!phone || phone.length < 7 || phone.length > 15) {
      reasons.push("Teléfono vacío o inválido.");
    }
    if (items.length === 0) reasons.push("No se detectaron productos.");
    if (itemSubtotal !== subtotal) {
      reasons.push(
        "Los productos suman $" +
          itemSubtotal.toLocaleString("es-CO") +
          " y el subtotal es $" +
          subtotal.toLocaleString("es-CO") +
          ".",
      );
    }
    if (calculatedTotal !== total) {
      reasons.push(
        "Subtotal + domicilio - descuento da $" +
          calculatedTotal.toLocaleString("es-CO") +
          " y el total es $" +
          total.toLocaleString("es-CO") +
          ".",
      );
    }

    if (reasons.length || !createdAt || !fulfillmentType) {
      issues.push({
        rowNumber,
        reason: reasons.join(" "),
      });
      return;
    }

    valid.push({
      rowNumber,
      createdAt,
      fulfillmentType,
      source: source(
        read(record, [
          "Tipo De Facturación",
          "Tipo De Facturacion",
          "Origen",
        ]),
      ),
      customerName,
      countryCode,
      phone,
      address,
      addressNotes,
      items,
      subtotal,
      deliveryFee,
      discount,
      total,
      paymentMethod,
      correctedUnpaid,
    });
  });

  valid.sort((a, b) => {
    const byDate = a.createdAt.getTime() - b.createdAt.getTime();
    return byDate || a.rowNumber - b.rowNumber;
  });

  return {
    totalRows: records.length,
    valid,
    issues,
  };
}
