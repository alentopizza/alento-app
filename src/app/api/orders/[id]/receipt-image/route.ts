import { NextRequest } from "next/server";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/auth";
import { presentOrderItemConfiguration } from "@/lib/orderPresentation";
import { orderCode } from "@/lib/orderCode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOGO_URL =
  "https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/ka91FhewP8WCQ2jD9VzF/pub/esHVvv9U23OXjH5ATQqA.png";

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: number) {
  return new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function receiptDateTime(value: Date) {
  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Bogota",
  }).format(value);
}

function fulfillmentLabel(value: string) {
  if (value === "DELIVERY") return "DOMICILIO";
  if (value === "PICKUP") return "RECOGER EN TIENDA";
  return "LOCAL";
}

function compactDeliveryAddress(value: string | null | undefined) {
  const raw = value?.trim() || "";
  if (!raw) return "";

  return raw
    .replace(/,\s*Bogot[aá](?:\s*,?\s*D\.?C\.?)?.*$/i, "")
    .replace(/,\s*Colombia\s*\)?$/i, "")
    .replace(/\s*,\s*$/, "")
    .trim();
}

function receiptDetailText(value: string) {
  return value.replace(/½/g, "").replace(/\s{2,}/g, " ").trim();
}

function pizzaCrustSnapshot(configuration: unknown) {
  if (!isObject(configuration)) return null;
  if (String(configuration.kind ?? "").toUpperCase() !== "PIZZA") return null;

  const crust = isObject(configuration.crust) ? configuration.crust : null;
  if (!crust) return null;

  const name = typeof crust.name === "string" ? crust.name.trim() : "";
  const price = Math.max(0, numberValue(crust.price));

  return name ? { name, price } : null;
}

function escapeXml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function wrapText(value: string, maxChars: number) {
  const clean = value.replace(/\s+/g, " ").trim();
  if (!clean) return [];

  const words = clean.split(" ");
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length <= maxChars || !line) {
      line = next;
    } else {
      lines.push(line);
      line = word;
    }
  }

  if (line) lines.push(line);
  return lines;
}

async function logoDataUri() {
  try {
    const response = await fetch(LOGO_URL, { cache: "force-cache" });
    if (!response.ok) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get("content-type") || "image/png";
    return `data:${contentType};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireStaffSession();
  } catch {
    return new Response("No autorizado.", { status: 401 });
  }

  const { id: rawId } = await context.params;
  const id = Number(rawId);

  if (!Number.isInteger(id) || id <= 0) {
    return new Response("Pedido inválido.", { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      customer: true,
      address: true,
      items: { orderBy: { id: "asc" } },
      payments: { orderBy: { id: "asc" } },
    },
  });

  if (!order) {
    return new Response("Pedido no encontrado.", { status: 404 });
  }

  const paidPayments = order.payments.filter(
    (payment) => payment.status === "PAID",
  );
  const paidTotal = paidPayments.reduce(
    (sum, payment) => sum + Number(payment.amount),
    0,
  );
  const pendingBalance = Math.max(0, Number(order.total) - paidTotal);
  const paidInFull = pendingBalance <= 0 && Number(order.total) > 0;
  const pendingPayment =
    order.payments.find((payment) =>
      ["PENDING", "PARTIAL"].includes(payment.status),
    ) ?? null;

  const displayNumber = order.sequenceNumber ?? order.id;
  const displayCode = orderCode(displayNumber, order.source);
  const address = compactDeliveryAddress(order.address?.address);
  const deliveryInstructions = order.address?.notes?.trim() || "";
  const logo = await logoDataUri();

  const width = 840;
  const left = 72;
  const right = width - 72;
  const contentWidth = right - left;
  let y = 54;
  const parts: string[] = [];

  const line = (gapTop = 24, gapBottom = 24, dashed = true) => {
    y += gapTop;
    parts.push(
      `<line x1="${left}" y1="${y}" x2="${right}" y2="${y}" stroke="#000" stroke-width="4" ${dashed ? 'stroke-dasharray="14 10"' : ""}/>`,
    );
    y += gapBottom;
  };

  const centered = (
    text: string,
    size: number,
    weight = 700,
    gap = 10,
  ) => {
    y += size;
    parts.push(
      `<text x="${width / 2}" y="${y}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${size}" font-weight="${weight}" fill="#000">${escapeXml(text)}</text>`,
    );
    y += gap;
  };

  const leftText = (
    text: string,
    size: number,
    weight = 700,
    indent = 0,
    gap = 9,
  ) => {
    y += size;
    parts.push(
      `<text x="${left + indent}" y="${y}" font-family="Arial, Helvetica, sans-serif" font-size="${size}" font-weight="${weight}" fill="#000">${escapeXml(text)}</text>`,
    );
    y += gap;
  };

  const row = (
    label: string,
    value: string,
    size = 31,
    weight = 800,
  ) => {
    y += size;
    parts.push(
      `<text x="${left}" y="${y}" font-family="Arial, Helvetica, sans-serif" font-size="${size}" font-weight="${weight}" fill="#000">${escapeXml(label)}</text>`,
    );
    parts.push(
      `<text x="${right}" y="${y}" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="${size}" font-weight="${weight}" fill="#000">${escapeXml(value)}</text>`,
    );
    y += 10;
  };

  const boxedCentered = (
    lines: string[],
    fontSize: number,
    weight = 800,
    padding = 22,
  ) => {
    const lineHeight = Math.round(fontSize * 1.28);
    const height = padding * 2 + Math.max(1, lines.length) * lineHeight;
    parts.push(
      `<rect x="${left}" y="${y}" width="${contentWidth}" height="${height}" rx="0" fill="#fff" stroke="#000" stroke-width="4"/>`,
    );
    let textY = y + padding + fontSize;
    for (const text of lines) {
      parts.push(
        `<text x="${width / 2}" y="${textY}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="${weight}" fill="#000">${escapeXml(text)}</text>`,
      );
      textY += lineHeight;
    }
    y += height + 12;
  };

  if (logo) {
    parts.push(
      `<image href="${logo}" x="${width / 2 - 74}" y="${y}" width="148" height="148" preserveAspectRatio="xMidYMid meet"/>`,
    );
    y += 158;
  }

  centered("ALENTÓ PIZZA", 46, 900, 4);
  centered("WHATSAPP 324 333 4009", 30, 900, 8);

  line();

  centered(receiptDateTime(order.createdAt), 26, 700, 6);
  centered(displayCode, 70, 900, 16);

  const mode = fulfillmentLabel(order.fulfillmentType);
  const modeWidth = Math.min(contentWidth, Math.max(280, mode.length * 24 + 74));
  parts.push(
    `<rect x="${(width - modeWidth) / 2}" y="${y}" width="${modeWidth}" height="64" fill="#fff" stroke="#000" stroke-width="4"/>`,
  );
  parts.push(
    `<text x="${width / 2}" y="${y + 43}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="31" font-weight="900" fill="#000">${escapeXml(mode)}</text>`,
  );
  y += 76;

  line();

  centered(
    (order.customer?.name || "CLIENTE OCASIONAL").toUpperCase(),
    38,
    900,
    3,
  );

  if (order.customer?.phone) {
    centered(
      `${order.customer.countryCode || ""}${order.customer.phone}`,
      27,
      700,
      4,
    );
  }

  if (order.fulfillmentType === "DELIVERY" && address) {
    for (const addressLine of wrapText(address.toUpperCase(), 38)) {
      centered(addressLine, 27, 800, 2);
    }
  }

  if (order.fulfillmentType === "DELIVERY" && deliveryInstructions) {
    y += 12;
    boxedCentered(
      wrapText(deliveryInstructions.toUpperCase(), 37),
      27,
      900,
      18,
    );
  }

  if (order.notes) {
    for (const noteLine of wrapText(
      `NOTA: ${order.notes.toUpperCase()}`,
      42,
    )) {
      centered(noteLine, 24, 800, 2);
    }
  }

  line();

  leftText("DETALLE DEL PEDIDO", 32, 900, 0, 14);

  for (const item of order.items) {
    const crust = pizzaCrustSnapshot(item.configuration);
    const crustTotal = crust
      ? crust.price * Math.max(1, item.quantity)
      : 0;
    const baseLineTotal = Math.max(
      0,
      Number(item.lineTotal) - crustTotal,
    );
    const details = presentOrderItemConfiguration(
      item.configuration,
    ).filter(
      (detail) =>
        detail.label.trim().toLocaleLowerCase("es") !== "borde",
    );

    const productLines = wrapText(
      `${item.quantity} × ${item.productName.toUpperCase()}`,
      34,
    );

    y += 31;
    parts.push(
      `<text x="${left}" y="${y}" font-family="Arial, Helvetica, sans-serif" font-size="29" font-weight="900" fill="#000">${escapeXml(productLines[0] || "")}</text>`,
    );
    parts.push(
      `<text x="${right}" y="${y}" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="900" fill="#000">$ ${escapeXml(money(baseLineTotal))}</text>`,
    );
    y += 7;

    for (const continuation of productLines.slice(1)) {
      leftText(continuation, 26, 900, 0, 2);
    }

    for (const detail of details) {
      const detailText =
        `${detail.label.toUpperCase()}: ${receiptDetailText(detail.value).toUpperCase()}`;
      for (const detailLine of wrapText(detailText, 43)) {
        leftText(detailLine, 23, 700, 28, 2);
      }
    }

    if (crust) {
      const crustText = `BORDE: ${crust.name.toUpperCase()}`;
      y += 25;
      parts.push(
        `<text x="${left + 28}" y="${y}" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="700" fill="#000">${escapeXml(crustText)}</text>`,
      );
      if (crustTotal > 0) {
        parts.push(
          `<text x="${right}" y="${y}" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="25" font-weight="900" fill="#000">$ ${escapeXml(money(crustTotal))}</text>`,
        );
      }
      y += 4;
    }

    if (item.notes) {
      const noteLines = wrapText(
        `NOTA COCINA: ${item.notes.toUpperCase()}`,
        39,
      );
      y += 8;
      const boxHeight = 20 * 2 + noteLines.length * 28;
      parts.push(
        `<rect x="${left + 28}" y="${y}" width="${contentWidth - 28}" height="${boxHeight}" fill="#fff" stroke="#000" stroke-width="3"/>`,
      );
      let noteY = y + 20 + 22;
      for (const noteLine of noteLines) {
        parts.push(
          `<text x="${left + 44}" y="${noteY}" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="900" fill="#000">${escapeXml(noteLine)}</text>`,
        );
        noteY += 28;
      }
      y += boxHeight;
    }

    y += 22;
  }

  line(8, 22);

  row("SUBTOTAL", `$ ${money(Number(order.subtotal))}`);
  row("DOMICILIO", `$ ${money(Number(order.deliveryFee))}`);
  row("DESCUENTO", `-$ ${money(Number(order.discount))}`);

  y += 12;
  parts.push(
    `<line x1="${left}" y1="${y}" x2="${right}" y2="${y}" stroke="#000" stroke-width="4"/>`,
  );
  y += 48;
  parts.push(
    `<text x="${left}" y="${y}" font-family="Arial, Helvetica, sans-serif" font-size="48" font-weight="900" fill="#000">TOTAL</text>`,
  );
  parts.push(
    `<text x="${right}" y="${y}" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="48" font-weight="900" fill="#000">$ ${escapeXml(money(Number(order.total)))}</text>`,
  );
  y += 28;

  const paymentLines = [
    "ESTADO DE PAGO",
    paidInFull
      ? `PAGADO $ ${money(paidTotal)}`
      : `PENDIENTE $ ${money(pendingBalance)}`,
  ];

  if (!paidInFull) {
    paymentLines.push(
      pendingPayment
        ? `COBRAR ${pendingPayment.method.toUpperCase()} · $ ${money(pendingBalance)}`
        : "SIN MEDIO DE PAGO REGISTRADO",
    );

    if (pendingPayment?.cashReceived != null) {
      paymentLines.push(
        `PAGA CON $ ${money(Number(pendingPayment.cashReceived))} · VUELTAS $ ${money(Number(pendingPayment.changeDue || 0))}`,
      );
    }
  }

  boxedCentered(
    paymentLines.flatMap((value) => wrapText(value, 39)),
    27,
    900,
    20,
  );

  if (order.couponName) {
    centered(`CUPÓN: ${order.couponName.toUpperCase()}`, 23, 700, 6);
  }

  line(8, 18);
  centered("GRACIAS POR ELEGIR ALENTÓ PIZZA", 27, 900, 3);
  centered("Sabor Que Te Hace Volver.", 23, 700, 10);

  const height = y + 58;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<rect width="100%" height="100%" fill="#fff"/>` +
    parts.join("") +
    `</svg>`;

  try {
    const png = await sharp(Buffer.from(svg))
      .png({ compressionLevel: 9 })
      .toBuffer();

    return new Response(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="${displayCode}-factura.png"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Receipt image generation failed", {
      orderId: order.id,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return new Response("No fue posible generar la factura como imagen.", {
      status: 500,
    });
  }
}
