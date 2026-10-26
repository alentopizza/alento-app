import { NextRequest } from "next/server";
import sharp from "sharp";
import opentype from "opentype.js";
import { prisma } from "@/lib/prisma";
import { requireStaffSession } from "@/lib/auth";
import { presentOrderItemConfiguration } from "@/lib/orderPresentation";
import { orderCode } from "@/lib/orderCode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOGO_URL =
  "https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/ka91FhewP8WCQ2jD9VzF/pub/esHVvv9U23OXjH5ATQqA.png";

const FONT_URLS = {
  regular:
    "https://raw.githubusercontent.com/google/fonts/main/ofl/lato/Lato-Regular.ttf",
  bold:
    "https://raw.githubusercontent.com/google/fonts/main/ofl/lato/Lato-Bold.ttf",
  black:
    "https://raw.githubusercontent.com/google/fonts/main/ofl/lato/Lato-Black.ttf",
} as const;

type ReceiptFont = ReturnType<typeof opentype.parse>;
type ReceiptFonts = {
  regular: ReceiptFont;
  bold: ReceiptFont;
  black: ReceiptFont;
};

let receiptFontsPromise: Promise<ReceiptFonts> | null = null;

async function fetchReceiptFont(url: string) {
  const response = await fetch(url, { cache: "force-cache" });
  if (!response.ok) {
    throw new Error(`No fue posible cargar la tipografía de la factura (${response.status}).`);
  }
  return opentype.parse(await response.arrayBuffer());
}

async function loadReceiptFonts(): Promise<ReceiptFonts> {
  if (!receiptFontsPromise) {
    receiptFontsPromise = Promise.all([
      fetchReceiptFont(FONT_URLS.regular),
      fetchReceiptFont(FONT_URLS.bold),
      fetchReceiptFont(FONT_URLS.black),
    ]).then(([regular, bold, black]) => ({ regular, bold, black }));
  }

  try {
    return await receiptFontsPromise;
  } catch (error) {
    receiptFontsPromise = null;
    throw error;
  }
}

function fontForWeight(fonts: ReceiptFonts, weight: number) {
  if (weight >= 850) return fonts.black;
  if (weight >= 650) return fonts.bold;
  return fonts.regular;
}

function textAsPath(
  fonts: ReceiptFonts,
  value: string,
  x: number,
  y: number,
  size: number,
  weight = 700,
  anchor: "start" | "middle" | "end" = "start",
) {
  const font = fontForWeight(fonts, weight);
  const advance = font.getAdvanceWidth(value, size);
  const startX =
    anchor === "middle"
      ? x - advance / 2
      : anchor === "end"
        ? x - advance
        : x;
  const path = font.getPath(value, startX, y, size);

  return `<path d="${path.toPathData(2)}" fill="#000"/>`;
}

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

type ReceiptCustomPizza = {
  mode: "WHOLE" | "HALF_HALF";
  size: string;
  crust: string;
  wholeIngredients: string[];
  firstHalfIngredients: string[];
  secondHalfIngredients: string[];
};

function receiptIngredientNames(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value.flatMap((ingredient) =>
    isObject(ingredient) && typeof ingredient.name === "string"
      ? [ingredient.name.trim()]
      : [],
  ).filter(Boolean);
}

function receiptCustomPizza(configuration: unknown): ReceiptCustomPizza | null {
  if (
    !isObject(configuration) ||
    String(configuration.kind ?? "").toUpperCase() !== "PIZZA_CUSTOM"
  ) {
    return null;
  }

  const size = isObject(configuration.size) ? configuration.size : null;
  const crust = isObject(configuration.crust) ? configuration.crust : null;
  const sizeName =
    size && typeof size.name === "string" ? size.name.trim() : "";
  const diameter = size ? numberValue(size.diameterCm) : 0;
  const crustName =
    crust && typeof crust.name === "string" ? crust.name.trim() : "";

  return {
    mode:
      String(configuration.mode ?? "").toUpperCase() === "HALF_HALF"
        ? "HALF_HALF"
        : "WHOLE",
    size: sizeName
      ? diameter > 0
        ? `${sizeName} · ${diameter} CM`
        : sizeName
      : "",
    crust: crustName,
    wholeIngredients: receiptIngredientNames(
      configuration.wholeIngredients,
    ),
    firstHalfIngredients: receiptIngredientNames(
      configuration.firstHalfIngredients,
    ),
    secondHalfIngredients: receiptIngredientNames(
      configuration.secondHalfIngredients,
    ),
  };
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

  let fonts: ReceiptFonts;
  let logo: string | null;

  try {
    [fonts, logo] = await Promise.all([
      loadReceiptFonts(),
      logoDataUri(),
    ]);
  } catch (assetError) {
    console.error("Receipt assets failed to load", {
      orderId: order.id,
      error:
        assetError instanceof Error
          ? assetError.message
          : "Unknown asset error",
    });
    return new Response(
      "No fue posible preparar la tipografía de la factura.",
      { status: 500 },
    );
  }

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
      textAsPath(fonts, text, width / 2, y, size, weight, "middle"),
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
      textAsPath(fonts, text, left + indent, y, size, weight, "start"),
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
      textAsPath(fonts, label, left, y, size, weight, "start"),
    );
    parts.push(
      textAsPath(fonts, value, right, y, size, weight, "end"),
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
        textAsPath(
          fonts,
          text,
          width / 2,
          textY,
          fontSize,
          weight,
          "middle",
        ),
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
    textAsPath(fonts, mode, width / 2, y + 43, 31, 900, "middle"),
  );
  y += 76;

  if (order.scheduledFor) {
    boxedCentered(
      [
        "PROGRAMADO PARA",
        receiptDateTime(order.scheduledFor).toUpperCase(),
      ],
      27,
      900,
      18,
    );
  }

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
    const customPizza = receiptCustomPizza(item.configuration);
    const crust = pizzaCrustSnapshot(item.configuration);
    const crustTotal = crust
      ? crust.price * Math.max(1, item.quantity)
      : 0;
    const baseLineTotal = Math.max(
      0,
      Number(item.lineTotal) - crustTotal,
    );
    const details = customPizza
      ? []
      : presentOrderItemConfiguration(item.configuration).filter(
          (detail) =>
            detail.label.trim().toLocaleLowerCase("es") !== "borde",
        );

    const productLines = wrapText(
      `${item.quantity} × ${item.productName.toUpperCase()}`,
      34,
    );

    y += 31;
    parts.push(
      textAsPath(
        fonts,
        productLines[0] || "",
        left,
        y,
        29,
        900,
        "start",
      ),
    );
    parts.push(
      textAsPath(
        fonts,
        `$ ${money(baseLineTotal)}`,
        right,
        y,
        30,
        900,
        "end",
      ),
    );
    y += 7;

    for (const continuation of productLines.slice(1)) {
      leftText(continuation, 26, 900, 0, 2);
    }

    if (customPizza) {
      if (customPizza.size) {
        leftText(
          `TAMAÑO: ${customPizza.size.toUpperCase()}`,
          22,
          800,
          28,
          2,
        );
      }
      if (customPizza.crust) {
        leftText(
          `BORDE: ${customPizza.crust.toUpperCase()}`,
          22,
          800,
          28,
          2,
        );
      }

      leftText(
        customPizza.mode === "HALF_HALF"
          ? "FORMA: MITAD Y MITAD"
          : "FORMA: PIZZA COMPLETA",
        23,
        900,
        28,
        5,
      );

      const ingredientLines = (
        title: string,
        ingredients: string[],
      ) => {
        leftText(title, 22, 900, 28, 1);
        if (!ingredients.length) {
          leftText("- SIN INGREDIENTES", 21, 700, 48, 3);
          return;
        }

        for (const ingredient of ingredients) {
          for (const ingredientLine of wrapText(
            `- ${ingredient.toUpperCase()}`,
            38,
          )) {
            leftText(ingredientLine, 21, 700, 48, 2);
          }
        }
      };

      if (customPizza.mode === "HALF_HALF") {
        ingredientLines("MITAD 1", customPizza.firstHalfIngredients);
        y += 5;
        ingredientLines("MITAD 2", customPizza.secondHalfIngredients);
      } else {
        ingredientLines("INGREDIENTES", customPizza.wholeIngredients);
      }
    } else {
      for (const detail of details) {
        const detailText =
          `${detail.label.toUpperCase()}: ${receiptDetailText(detail.value).toUpperCase()}`;
        for (const detailLine of wrapText(detailText, 43)) {
          leftText(detailLine, 23, 700, 28, 2);
        }
      }
    }

    if (crust) {
      const crustText = `BORDE: ${crust.name.toUpperCase()}`;
      y += 25;
      parts.push(
        textAsPath(fonts, crustText, left + 28, y, 24, 700, "start"),
      );
      if (crustTotal > 0) {
        parts.push(
          textAsPath(
            fonts,
            `$ ${money(crustTotal)}`,
            right,
            y,
            25,
            900,
            "end",
          ),
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
          textAsPath(
            fonts,
            noteLine,
            left + 44,
            noteY,
            22,
            900,
            "start",
          ),
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
    textAsPath(fonts, "TOTAL", left, y, 48, 900, "start"),
  );
  parts.push(
    textAsPath(
      fonts,
      `$ ${money(Number(order.total))}`,
      right,
      y,
      48,
      900,
      "end",
    ),
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
