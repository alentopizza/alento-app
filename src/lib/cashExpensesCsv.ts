import { parseCsv } from "@/lib/customerCsv";

export type CashExpenseImportRow = {
  rowNumber: number;
  occurredAt: Date;
  category: string;
  subcategory: string;
  note: string;
  amount: number;
};

export type CashExpenseImportIssue = {
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

function amount(value: string) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits ? Number(digits) : 0;
}

function parseBogotaDate(value: string) {
  const source = value.trim();
  if (!source) return null;

  const iso = source.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/,
  );
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]);
    const day = Number(iso[3]);
    const hour = Number(iso[4] ?? 0);
    const minute = Number(iso[5] ?? 0);
    const second = Number(iso[6] ?? 0);
    return new Date(
      Date.UTC(year, month - 1, day, hour + 5, minute, second),
    );
  }

  const local = source.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*([ap])\.?\s*m\.?)?$/i,
  );
  if (!local) return null;

  const day = Number(local[1]);
  const month = Number(local[2]);
  const year = Number(local[3]);
  let hour = Number(local[4]);
  const minute = Number(local[5]);
  const second = Number(local[6] ?? 0);
  const meridiem = local[7]?.toLowerCase();

  if (meridiem === "p" && hour < 12) hour += 12;
  if (meridiem === "a" && hour === 12) hour = 0;

  if (
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

  return new Date(
    Date.UTC(year, month - 1, day, hour + 5, minute, second),
  );
}

export function parseCashExpensesCsv(text: string) {
  const { records } = parseCsv(text);
  const valid: CashExpenseImportRow[] = [];
  const issues: CashExpenseImportIssue[] = [];

  records.forEach((record, index) => {
    const rowNumber = index + 2;
    const occurredAt = parseBogotaDate(
      read(record, ["Fecha", "Fecha Y Hora", "Fecha y hora"]),
    );
    const category = read(record, ["Tipo De Gasto", "Tipo de gasto", "Categoria", "Categoría"]);
    const subcategory = read(record, [
      "Sub Tipo De Gasto",
      "Sub Tipo de gasto",
      "Subtipo",
      "Sub categoria",
      "Sub categoría",
    ]);
    const note = read(record, ["Observación", "Observacion", "Nota"]);
    const parsedAmount = amount(read(record, ["Monto", "Valor", "Amount"]));

    const reasons: string[] = [];
    if (!occurredAt || Number.isNaN(occurredAt.getTime())) {
      reasons.push("Fecha inválida.");
    }
    if (!category) reasons.push("Falta el tipo de gasto.");
    if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
      reasons.push("Monto inválido.");
    }

    if (reasons.length || !occurredAt) {
      issues.push({ rowNumber, reason: reasons.join(" ") });
      return;
    }

    valid.push({
      rowNumber,
      occurredAt,
      category,
      subcategory,
      note,
      amount: parsedAmount,
    });
  });

  valid.sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());

  return { totalRows: records.length, valid, issues };
}
