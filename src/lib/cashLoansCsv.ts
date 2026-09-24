import { parseCsv } from "@/lib/customerCsv";

export type CashLoanImportRow = {
  rowNumber: number;
  issuedAt: Date;
  workerName: string;
  amount: number;
  paid: boolean;
};

export type CashLoanImportIssue = {
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
  const match = source.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*([ap])\.?\s*m\.?)?$/i,
  );
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  let hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6] ?? 0);
  const meridiem = match[7]?.toLowerCase();

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

export function parseCashLoansCsv(text: string) {
  const { records } = parseCsv(text);
  const valid: CashLoanImportRow[] = [];
  const issues: CashLoanImportIssue[] = [];

  records.forEach((record, index) => {
    const rowNumber = index + 2;
    const issuedAt = parseBogotaDate(read(record, ["Fecha"]));
    const workerName = read(record, ["Trabajador", "Empleado"]);
    const parsedAmount = amount(read(record, ["Monto", "Valor"]));
    const rawStatus = read(record, ["Estado Final", "Estado"]).toUpperCase();
    const paid =
      rawStatus === "PAGADO" ||
      rawStatus === "PAGADA" ||
      rawStatus === "PAID";

    const reasons: string[] = [];
    if (!issuedAt || Number.isNaN(issuedAt.getTime())) {
      reasons.push("Fecha inválida.");
    }
    if (!workerName) reasons.push("Falta el trabajador.");
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      reasons.push("Monto inválido.");
    }
    if (
      rawStatus &&
      !["PAGADO", "PAGADA", "PAID", "NO PAGADO", "NO PAGADA", "PENDING"].includes(rawStatus)
    ) {
      reasons.push("Estado no reconocido.");
    }

    if (reasons.length || !issuedAt) {
      issues.push({ rowNumber, reason: reasons.join(" ") });
      return;
    }

    valid.push({
      rowNumber,
      issuedAt,
      workerName,
      amount: parsedAmount,
      paid,
    });
  });

  valid.sort((a, b) => a.issuedAt.getTime() - b.issuedAt.getTime());

  return { totalRows: records.length, valid, issues };
}
