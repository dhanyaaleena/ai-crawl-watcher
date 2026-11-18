export const CSV_COLUMNS = [
  "timestamp",
  "page_url",
  "bot_name",
  "platform",
  "bot_type",
  "user_agent",
  "page_path",
  "ip_hash",
] as const;

export type CsvRow = Record<(typeof CSV_COLUMNS)[number], string | null>;

/**
 * Quotes a value for CSV (RFC 4180). Values that a spreadsheet would treat as a
 * formula (=, +, -, @, tab, CR) are prefixed with an apostrophe, because user
 * agents and URLs are attacker-controlled.
 */
export function csvCell(value: string | null | undefined): string {
  let s = value ?? "";
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) || s !== s.trim() ? `"${s.replace(/"/g, '""')}"` : s;
}

export function csvLine(row: CsvRow): string {
  return CSV_COLUMNS.map((c) => csvCell(row[c])).join(",") + "\r\n";
}

export const CSV_HEADER = CSV_COLUMNS.join(",") + "\r\n";
