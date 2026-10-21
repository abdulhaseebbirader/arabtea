import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  cycleFor,
  fromDDMMYY,
  isTotalRow,
  num,
  reconcile,
  schemaForHeaders,
  totalRowLabel,
  ARCHIVE_PREFIX,
  type SheetData,
} from "./domain";
import {
  colLetter,
  formatRow,
  getValues,
  insertColumn,
  insertRows,
  updateRange,
} from "./sheets.server";

const tabSchema = z.enum(["TEA_SALES", "TEA_EXPENSES"]);

export const loadTab = createServerFn({ method: "GET" })
  .validator((d: { tab: string }) => ({ tab: tabSchema.parse(d.tab) }))
  .handler(async ({ data }): Promise<SheetData> => {
    const values = await getValues(data.tab);
    const headers = (values[0] ?? []).map((h) => h.trim());
    const rows: string[][] = [];
    const rowNumbers: number[] = [];
    values.slice(1).forEach((row, i) => {
      if (row.every((c) => c === "")) return;
      rows.push(headers.map((_, ci) => row[ci] ?? ""));
      rowNumbers.push(i + 2);
    });
    return { headers, rows, rowNumbers };
  });

function buildRow(
  headers: string[],
  dateText: string,
  values: Record<string, number>,
  existingCells?: string[],
) {
  const salesSchema = schemaForHeaders(headers);
  const merged = { ...values };
  // Preserve cells the form didn't submit (e.g. archived expense categories)
  // so editing a row never wipes historical data.
  if (existingCells) {
    headers.forEach((h, ci) => {
      if (ci === 0 || h === "TOTAL") return;
      if (merged[h] === undefined) merged[h] = num(existingCells[ci]);
    });
  }
  if (salesSchema) {
    const r = reconcile(merged, salesSchema);
    merged["TOTAL"] = r.total;
    if (salesSchema.accessKey) merged[salesSchema.accessKey] = r.access;
    if (salesSchema.shortKey) merged[salesSchema.shortKey] = r.shot;
  } else {
    // TOTAL covers every value column, including archived ones — their
    // historical amounts still count toward the day's spend.
    merged["TOTAL"] = headers
      .slice(1)
      .filter((h) => h !== "TOTAL")
      .reduce((s, h) => s + num(merged[h]), 0);
  }
  return headers.map((h, i) => {
    if (i === 0) return `'${dateText}`; // Prefix with single quote to force text format in Google Sheets
    const v = merged[h];
    return v === undefined || v === null || v === 0 ? "" : v;
  });
}

export const saveEntry = createServerFn({ method: "POST" })
  .validator((d: { tab: string; dateText: string; values: Record<string, number> }) =>
    z
      .object({
        tab: tabSchema,
        dateText: z
          .string()
          .regex(/^\d{2}\/\d{2}\/\d{2}$/)
          .refine((s) => fromDDMMYY(s) !== null, { message: "Invalid calendar date" }),
        values: z.record(z.number()),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const raw = await getValues(data.tab);
    const headers = (raw[0] ?? []).map((h) => h.trim());
    if (headers.length === 0) throw new Error("Sheet has no header row");

    const rowValues = buildRow(headers, data.dateText, data.values);
    const lastCol = colLetter(headers.length - 1);

    // Existing row for this date -> in-place update.
    const existingIndex = raw.findIndex((r, i) => i > 0 && (r[0] ?? "").trim() === data.dateText);
    if (existingIndex > 0) {
      const rowNumber = existingIndex + 1;
      const updatedValues = buildRow(headers, data.dateText, data.values, raw[existingIndex]);
      await updateRange(data.tab, `A${rowNumber}:${lastCol}${rowNumber}`, [updatedValues]);
      return { mode: "updated" as const, rowNumber };
    }

    // New date: seal the previous cycle with a summary row when the cycle rolls over.
    const newCycle = cycleFor(fromDDMMYY(data.dateText)!);
    let lastDataCycleKey: string | null = null;
    let lastCellIsTotal = false;
    for (let i = raw.length - 1; i >= 1; i--) {
      const cell = (raw[i]?.[0] ?? "").trim();
      if (!cell) continue;
      if (isTotalRow(cell)) {
        lastCellIsTotal = true;
        break;
      }
      const d = fromDDMMYY(cell);
      if (d) lastDataCycleKey = cycleFor(d).key;
      break;
    }

    // A cycle can already have its TOTAL row (e.g. a backdated entry appended
    // after it was sealed) — never write a second one for the same cycle.
    const totalRowExists = raw.slice(1).some((r) => {
      const cell = (r[0] ?? "").trim();
      if (!isTotalRow(cell)) return false;
      const m = /(\d{1,2}\/\d{1,2}\/\d{2,4})/.exec(cell);
      const d = m?.[1] ? fromDDMMYY(m[1]) : null;
      return d ? cycleFor(d).key === lastDataCycleKey : false;
    });

    if (
      !lastCellIsTotal &&
      lastDataCycleKey &&
      lastDataCycleKey !== newCycle.key &&
      !totalRowExists
    ) {
      const prevCycleRows = raw.slice(1).filter((r) => {
        const d = fromDDMMYY((r[0] ?? "").trim());
        return d ? cycleFor(d).key === lastDataCycleKey : false;
      });
      const totals = headers.map((h, ci) => {
        if (ci === 0) {
          const anyDate = fromDDMMYY((prevCycleRows[0]?.[0] ?? "").trim());
          return anyDate ? totalRowLabel(cycleFor(anyDate)) : "TOTAL";
        }
        void h;
        return prevCycleRows.reduce((s, r) => s + num(r[ci]), 0);
      });

      // values.append cannot write an empty row, so insert real blank rows
      // then write the TOTAL row and the new entry at fixed positions:
      // [blank] [TOTAL] [blank] [entry]
      await insertRows(data.tab, raw.length, 4);
      const totalRowNumber = raw.length + 2;
      await updateRange(data.tab, `A${totalRowNumber}:${lastCol}${totalRowNumber}`, [totals]);
      await formatRow(data.tab, totalRowNumber - 1, 0, headers.length, {
        bold: true,
        backgroundColor: { red: 1, green: 1, blue: 0.6 },
      });
      const entryRowNumber = raw.length + 4;
      await updateRange(data.tab, `A${entryRowNumber}:${lastCol}${entryRowNumber}`, [rowValues]);
      return { mode: "appended" as const, rowNumber: entryRowNumber };
    }

    // values.append stops at blank separator rows, so write the new entry
    // explicitly below the last non-empty row.
    const entryRowNumber = raw.length + 1;
    await updateRange(data.tab, `A${entryRowNumber}:${lastCol}${entryRowNumber}`, [rowValues]);
    return { mode: "appended" as const, rowNumber: entryRowNumber };
  });

/* --------------------- dynamic inventory column admin -------------------- */

const invTab = z.enum(["TEA_EXPENSES"]);

export const addColumn = createServerFn({ method: "POST" })
  .validator((d: { tab: string; name: string }) =>
    z.object({ tab: invTab, name: z.string().trim().min(1).max(40) }).parse(d),
  )
  .handler(async ({ data }) => {
    const raw = await getValues(data.tab);
    const headers = (raw[0] ?? []).map((h) => h.trim());
    if (headers.some((h) => h.toLowerCase() === data.name.toLowerCase())) {
      throw new Error(`Column "${data.name}" already exists`);
    }
    const totalIdx = headers.indexOf("TOTAL");
    const at = totalIdx === -1 ? headers.length : totalIdx;
    await insertColumn(data.tab, at);
    await updateRange(data.tab, `${colLetter(at)}1`, [[data.name]]);
    return { ok: true };
  });

export const renameColumn = createServerFn({ method: "POST" })
  .validator((d: { tab: string; index: number; name: string }) =>
    z
      .object({
        tab: invTab,
        index: z.number().int().min(1),
        name: z.string().trim().min(1).max(40),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await updateRange(data.tab, `${colLetter(data.index)}1`, [[data.name]]);
    return { ok: true };
  });

/** Archive keeps historical values intact; the UI simply stops showing the column. */
export const archiveColumn = createServerFn({ method: "POST" })
  .validator((d: { tab: string; index: number }) =>
    z.object({ tab: invTab, index: z.number().int().min(1) }).parse(d),
  )
  .handler(async ({ data }) => {
    const raw = await getValues(data.tab, "A1:BZ1");
    const headers = (raw[0] ?? []).map((h) => h.trim());
    const current = headers[data.index] ?? "";
    if (!current || current === "TOTAL") throw new Error("This column cannot be archived");
    if (current.startsWith(ARCHIVE_PREFIX)) return { ok: true };
    await updateRange(data.tab, `${colLetter(data.index)}1`, [[`${ARCHIVE_PREFIX}${current}`]]);
    return { ok: true };
  });

export const restoreColumn = createServerFn({ method: "POST" })
  .validator((d: { tab: string; index: number }) =>
    z.object({ tab: invTab, index: z.number().int().min(1) }).parse(d),
  )
  .handler(async ({ data }) => {
    const raw = await getValues(data.tab, "A1:BZ1");
    const headers = (raw[0] ?? []).map((h) => h.trim());
    const current = headers[data.index] ?? "";
    if (!current.startsWith(ARCHIVE_PREFIX)) return { ok: true };
    await updateRange(data.tab, `${colLetter(data.index)}1`, [
      [current.slice(ARCHIVE_PREFIX.length)],
    ]);
    return { ok: true };
  });
