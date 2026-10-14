import { Pencil, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { money, toISODate, type ParsedRow } from "@/lib/domain";
import { cn } from "@/lib/utils";

export function HistoryTable({
  rows,
  columns,
  highlight,
  onEdit,
}: {
  rows: ParsedRow[];
  /** Numeric columns to show in the compact mobile list. */
  columns: string[];
  /** Column shown as the headline figure for each row. */
  highlight: string;
  onEdit: (isoDate: string) => void;
}) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const sorted = [...rows].sort((a, b) => b.date.getTime() - a.date.getTime());
    if (!term) return sorted;
    return sorted.filter(
      (r) =>
        r.dateText.toLowerCase().includes(term) ||
        columns.some((c) => String(r.values[c] ?? "").includes(term)),
    );
  }, [rows, q, columns]);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Cycle history</h2>
        <span className="text-xs text-muted-foreground">{filtered.length} entries</span>
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-input bg-card px-3">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search date or amount"
          className="h-11 flex-1 bg-transparent text-sm outline-none"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="card-surface p-6 text-center text-sm text-muted-foreground">
          No entries logged in this cycle yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((r) => (
            <li key={r.rowNumber} className="card-surface overflow-hidden">
              <button
                type="button"
                onClick={() => onEdit(toISODate(r.date))}
                className="flex w-full items-center gap-3 p-3 text-left transition-colors active:bg-secondary"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="numeric text-sm font-semibold">{r.dateText}</span>
                    <span className="numeric text-sm font-bold text-primary">
                      {money(r.values[highlight] ?? 0)}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                    {columns
                      .filter((c) => (r.values[c] ?? 0) !== 0)
                      .slice(0, 6)
                      .map((c) => (
                        <span
                          key={c}
                          className={cn(
                            "text-[11px] text-muted-foreground",
                            c === "SHOT" && "text-destructive",
                            c === "ACCESS" && "text-success",
                          )}
                        >
                          {c} <span className="numeric font-medium">{r.values[c]}</span>
                        </span>
                      ))}
                  </div>
                </div>
                <Pencil className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
