import { CalendarDays, Loader2, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  money,
  num,
  reconcile,
  toDDMMYY,
  toISODate,
  fromISODate,
  type ModuleId,
} from "@/lib/domain";
import { cn } from "@/lib/utils";

type Props = {
  module: ModuleId;
  /** Editable numeric column headers, in display order. */
  fields: string[];
  /** Returns saved values for a date, or null when it's a fresh entry. */
  lookup: (dateText: string) => Record<string, number> | null;
  saving: boolean;
  onSave: (dateText: string, values: Record<string, number>) => void;
  /** Optional date to jump to (used by inline edit from history). */
  dateOverride?: string | null;
};

export function EntryForm({ module, fields, lookup, saving, onSave, dateOverride }: Props) {
  const [iso, setIso] = useState(() => toISODate(new Date()));
  const [values, setValues] = useState<Record<string, string>>({});

  const dateText = useMemo(() => toDDMMYY(fromISODate(iso)), [iso]);
  const existing = lookup(dateText);

  useEffect(() => {
    if (dateOverride) setIso(dateOverride);
  }, [dateOverride]);

  useEffect(() => {
    const saved = lookup(dateText);
    const next: Record<string, string> = {};
    for (const f of fields) {
      const v = saved?.[f] ?? 0;
      next[f] = v ? String(v) : "";
    }
    setValues(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateText, fields.join("|")]);

  const numeric = useMemo(() => {
    const out: Record<string, number> = {};
    for (const f of fields) out[f] = num(values[f]);
    return out;
  }, [values, fields]);

  const rec = reconcile(numeric);
  const invTotal = fields.reduce((s, f) => s + num(values[f]), 0);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">
          {module === "sales" ? "Daily collection entry" : "Daily expense entry"}
        </h2>
        {existing && (
          <span className="rounded-full bg-accent/40 px-2.5 py-1 text-[11px] font-medium text-accent-foreground">
            Editing existing row
          </span>
        )}
      </div>

      <div className="card-surface p-4">
        <label className="mb-3 flex items-center gap-3 rounded-xl bg-secondary px-3 py-2.5">
          <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="text-sm font-medium">Date</span>
          <input
            type="date"
            value={iso}
            onChange={(e) => setIso(e.target.value)}
            className="numeric ml-auto bg-transparent text-sm font-semibold outline-none"
          />
        </label>

        <div className="grid grid-cols-2 gap-2.5">
          {fields.map((f) => (
            <label key={f} className="block">
              <span className="mb-1 block truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {f}
              </span>
              <input
                type="number"
                inputMode="decimal"
                pattern="[0-9]*"
                placeholder="0"
                value={values[f] ?? ""}
                onChange={(e) => setValues((p) => ({ ...p, [f]: e.target.value }))}
                className="numeric h-12 w-full rounded-xl border border-input bg-background px-3 text-right text-base font-semibold outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/30"
              />
            </label>
          ))}
        </div>

        {module === "sales" ? (
          <div className="mt-4 space-y-2 rounded-xl bg-secondary p-3">
            <Line label="Total collection (cash + online)" value={money(rec.total)} strong />
          </div>
        ) : (
          <div className="mt-4 rounded-xl bg-secondary p-3">
            <Line label="Total daily expenses" value={money(invTotal)} strong />
          </div>
        )}

        <button
          type="button"
          disabled={saving}
          onClick={() => onSave(dateText, numeric)}
          className="mt-4 flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-bold text-primary-foreground transition-opacity active:opacity-80 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {existing ? "Update entry" : "Save entry"}
        </button>
      </div>
    </section>
  );
}

function Line({
  label,
  value,
  strong,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: "success" | "destructive" | undefined;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "numeric",
          strong && "font-bold",
          tone === "success" && "text-success",
          tone === "destructive" && "text-destructive",
        )}
      >
        {value}
      </span>
    </div>
  );
}
