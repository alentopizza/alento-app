export type CustomerImportRow = {
  rowNumber: number;
  name: string;
  countryCode: string;
  phone: string;
  email: string;
  address: string;
  addressNotes: string;
  notes: string;
};

export type CustomerImportIssue = {
  rowNumber: number;
  name: string;
  phone: string;
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

function countDelimiter(line: string, delimiter: string) {
  let count = 0;
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (!quoted && char === delimiter) {
      count += 1;
    }
  }
  return count;
}

function detectDelimiter(text: string) {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const candidates = [",", ";", "\t"];
  return candidates.sort((a, b) => countDelimiter(firstLine, b) - countDelimiter(firstLine, a))[0] ?? ",";
}

export function parseCsv(text: string) {
  const source = text.replace(/^\uFEFF/, "");
  const delimiter = detectDelimiter(source);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];

    if (char === '"') {
      if (quoted && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (!quoted && char === delimiter) {
      row.push(field);
      field = "";
      continue;
    }

    if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && source[index + 1] === "\n") index += 1;
      row.push(field);
      field = "";
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
      continue;
    }

    field += char;
  }

  row.push(field);
  if (row.some((value) => value.trim() !== "")) rows.push(row);

  if (rows.length === 0) {
    return { headers: [] as string[], records: [] as Record<string, string>[] };
  }

  const headers = rows[0].map((value) => value.trim());
  const records = rows.slice(1).map((values) => {
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[normalizeHeader(header)] = String(values[index] ?? "").trim();
    });
    return record;
  });

  return { headers, records };
}

function read(record: Record<string, string>, aliases: string[]) {
  for (const alias of aliases) {
    const value = record[normalizeHeader(alias)];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

export function normalizeCountryCode(value: string) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits ? `+${digits}` : "+57";
}

export function normalizeImportedPhone(value: string, countryCode: string) {
  let digits = String(value ?? "").replace(/\D/g, "");
  const countryDigits = countryCode.replace(/\D/g, "");

  if (
    countryDigits
    && digits.startsWith(countryDigits)
    && digits.length - countryDigits.length >= 7
    && digits.length > 10
  ) {
    digits = digits.slice(countryDigits.length);
  }

  return digits;
}

export function mapCustomerImport(records: Record<string, string>[]) {
  const valid: CustomerImportRow[] = [];
  const invalid: CustomerImportIssue[] = [];

  records.forEach((record, index) => {
    const rowNumber = index + 2;
    const name = read(record, ["Cliente/Nombre", "Nombre", "Cliente", "Name"]);
    const countryCode = normalizeCountryCode(
      read(record, ["Cliente/Indicativo", "Indicativo", "Country Code", "CountryCode"]),
    );
    const rawPhone = read(record, [
      "Cliente/Telefono",
      "Cliente/Teléfono",
      "Telefono",
      "Teléfono",
      "Celular",
      "Phone",
    ]);
    const phone = normalizeImportedPhone(rawPhone, countryCode);
    const email = read(record, ["Cliente/Correo", "Correo", "Email"]).toLowerCase();
    const address = read(record, ["Cliente/Dirección", "Cliente/Direccion", "Dirección", "Direccion", "Address"]);
    const complement = read(record, ["Cliente/Complemento", "Complemento"]);
    const gpsLink = read(record, ["Cliente/GPS Link", "GPS Link", "GPS"]);
    const notes = read(record, ["Cliente/Notas", "Notas", "Notes"]);

    if (!name) {
      invalid.push({ rowNumber, name: "", phone, reason: "Falta el nombre." });
      return;
    }

    if (!phone || phone.length < 7 || phone.length > 15) {
      invalid.push({ rowNumber, name, phone, reason: "Teléfono vacío o inválido." });
      return;
    }

    if (email && !email.includes("@")) {
      invalid.push({ rowNumber, name, phone, reason: "Correo inválido." });
      return;
    }

    const addressNotes = [
      complement,
      gpsLink ? `GPS: ${gpsLink}` : "",
    ].filter(Boolean).join(" · ");

    valid.push({
      rowNumber,
      name,
      countryCode,
      phone,
      email,
      address,
      addressNotes,
      notes,
    });
  });

  return { valid, invalid };
}

export function csvEscape(value: unknown) {
  const text = String(value ?? "");
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}
