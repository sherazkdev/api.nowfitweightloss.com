export type CsvParseOptions = {
  hasHeaders?: boolean;
};

export type CsvParseResult = {
  headers: string[];
  rows: string[][];
};

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }
    current += char;
  }

  values.push(current);
  return values.map((value) => value.trim());
}

export function parseCsv(text: string, options: CsvParseOptions = {}): CsvParseResult {
  const hasHeaders = options.hasHeaders ?? true;
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const parsedLines = lines.map(parseCsvLine);
  if (!hasHeaders) {
    const width = parsedLines[0]?.length ?? 0;
    const headers = Array.from({ length: width }, (_, index) => `column_${index + 1}`);
    return { headers, rows: parsedLines };
  }

  const headers = parsedLines[0] ?? [];
  return { headers, rows: parsedLines.slice(1) };
}

function escapeCsvValue(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function stringifyCsv(headers: string[], rows: string[][]): string {
  const headerLine = headers.map(escapeCsvValue).join(",");
  const dataLines = rows.map((row) => row.map((value) => escapeCsvValue(value ?? "")).join(","));
  return [headerLine, ...dataLines].join("\n");
}

export function csvRowsToObjects(headers: string[], rows: string[][]): Record<string, string>[] {
  return rows.map((row) => {
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[normalizeCsvHeader(header)] = row[index] ?? "";
    });
    return record;
  });
}

export function normalizeCsvHeader(header: string): string {
  const normalized = header
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  const aliases: Record<string, string> = {
    title_name: "name",
    title: "title",
    status: "is_active",
    active: "is_active",
    sort_order: "sort_order",
    created_date: "created_at",
    created: "created_at",
    workout_level: "level_ids",
    level: "level_ids",
    category: "category_ids",
    workout_category: "category_ids",
    calories: "calories_min",
  };

  return aliases[normalized] ?? normalized;
}
