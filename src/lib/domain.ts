// Client-safe domain model: shop, sheet tabs, cycle rules, reconciliation math.
//
// Arab Tea House is a single tea shop. One Google Spreadsheet is the database,
// with two tabs:
//   SALES    — daily money collected (cash + online)
//   EXPENSES — daily expense register (milk, sugar, tea, bakery, ...)

export type ModuleId = "sales" | "inventory";

export const SHOP = { name: "Arab Tea House", short: "Arab Tea" };

export const TABS: Record<ModuleId, string> = {
  sales: "TEA_SALES",
  inventory: "TEA_EXPENSES",
};

export type SalesSchema = {
  /** Full column order written to the sheet header row. */
  columns: string[];
  /** Columns the user types into. The rest are derived. */
  inputs: string[];
  /** Column the collection total is reconciled against, when one exists. */
  target?: string;
  /** Columns summed into TOTAL. */
  totalParts: string[];
  /** Header used for the positive discrepancy. */
  accessKey?: string;
  /** Header used for the negative discrepancy. */
  shortKey?: string;
};

/**
 * Tea shop daily collection: cash + online. There is no POS target to
 * reconcile against, so TOTAL is the day's collection and discrepancy
 * fields stay zero.
 */
export const TEA_SALES_SCHEMA: SalesSchema = {
  columns: ["DATE", "CASH", "ONLINE", "TOTAL"],
  inputs: ["CASH", "ONLINE"],
  totalParts: ["CASH", "ONLINE"],
};

export const SALES_SCHEMA = TEA_SALES_SCHEMA;
export const SALES_INPUTS = TEA_SALES_SCHEMA.inputs;

/** Picks the schema that matches an existing sheet header row. */
export function schemaForHeaders(headers: string[]): SalesSchema | null {
  if (headers.includes("CASH") && headers.includes("ONLINE")) return TEA_SALES_SCHEMA;
  return null;
}

/** Default expense categories (used when creating a fresh sheet). */
export const EXPENSE_CATEGORIES: string[] = [
  "Milk",
  "Sugar",
  "Tea",
  "Bakery",
  "Cold Drinks",
  "Cigarettes",
  "Tobacco",
  "Gas",
  "Others",
];

export const ARCHIVE_PREFIX = "ARCHIVED:";

export function isArchived(header: string) {
  return header.startsWith(ARCHIVE_PREFIX);
}

export function num(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const cleaned = String(v)
    .trim()
    .replace(/[₹$€£,\s]/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return 0;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export function money(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

/** TOTAL = sum of the schema's collection columns; discrepancy vs the target column. */
export function reconcile(values: Record<string, number>, schema: SalesSchema = TEA_SALES_SCHEMA) {
  const total = schema.totalParts.reduce((s, k) => s + num(values[k]), 0);
  if (!schema.target) {
    return { total, discrepancy: 0, access: 0, shot: 0 };
  }
  const discrepancy = total - num(values[schema.target]);
  return {
    total,
    discrepancy,
    access: discrepancy > 0 ? discrepancy : 0,
    shot: discrepancy < 0 ? Math.abs(discrepancy) : 0,
  };
}

/* ------------------------------- dates ---------------------------------- */

export function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** DD/MM/YY */
export function toDDMMYY(d: Date): string {
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${String(d.getFullYear()).slice(-2)}`;
}

/** YYYY-MM-DD for <input type="date"> */
export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromDDMMYY(s: string): Date | null {
  const t = s.trim();
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(t);
  if (m) {
    const [, dd, mm, yy] = m;
    const year = yy!.length === 2 ? 2000 + Number(yy) : Number(yy);
    const d = new Date(year, Number(mm) - 1, Number(dd));
    // Reject overflows: JS Date rolls e.g. 31/02 into March instead of failing.
    if (d.getFullYear() !== year || d.getMonth() !== Number(mm) - 1 || d.getDate() !== Number(dd)) {
      return null;
    }
    return d;
  }
  // Fallback: Google Sheets may return a date serial number.
  if (/^\d{5}(\.\d+)?$/.test(t)) {
    const ms = Math.round((Number(t) - 25569) * 86400 * 1000);
    const d = new Date(ms);
    return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  }
  return null;
}

export function fromISODate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
}

export type Cycle = { start: Date; end: Date; label: string; key: string };

/** Accounting cycle: plain calendar month (1st → last day). */
export function cycleFor(d: Date): Cycle {
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
  return {
    start,
    end,
    label: `${toDDMMYY(start)} – ${toDDMMYY(end)}`,
    key: `${start.getFullYear()}-${pad(start.getMonth() + 1)}`,
  };
}

export function shiftCycle(c: Cycle, months: number): Cycle {
  return cycleFor(new Date(c.start.getFullYear(), c.start.getMonth() + months, c.start.getDate()));
}

export function inCycle(d: Date, c: Cycle) {
  return d >= c.start && d <= c.end;
}

export function totalRowLabel(c: Cycle) {
  return `TOTAL ${toDDMMYY(c.start)}-${toDDMMYY(c.end)}`;
}

export function isTotalRow(dateCell: string) {
  return dateCell.trim().toUpperCase().startsWith("TOTAL");
}

/* ------------------------------ sheet rows ------------------------------- */

export type SheetData = { headers: string[]; rows: string[][]; rowNumbers: number[] };

export type ParsedRow = {
  /** 1-based sheet row number */
  rowNumber: number;
  date: Date;
  dateText: string;
  values: Record<string, number>;
};

export function parseRows(data: SheetData): ParsedRow[] {
  const out: ParsedRow[] = [];
  data.rows.forEach((row, i) => {
    const dateText = (row[0] ?? "").trim();
    if (!dateText || isTotalRow(dateText)) return;
    const date = fromDDMMYY(dateText);
    if (!date) return;
    const values: Record<string, number> = {};
    data.headers.forEach((h, ci) => {
      if (ci === 0) return;
      values[h] = num(row[ci]);
    });
    // Recompute TOTAL from its parts so a stale or hand-edited TOTAL cell
    // in the sheet can't skew cycle sums or the history display.
    if ("TOTAL" in values) {
      let total = 0;
      for (const [k, v] of Object.entries(values)) {
        if (k !== "TOTAL") total += v;
      }
      values["TOTAL"] = total;
    }
    out.push({ rowNumber: data.rowNumbers[i]!, date, dateText, values });
  });
  return out;
}
