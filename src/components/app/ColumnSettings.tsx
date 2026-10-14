import { useQueryClient } from "@tanstack/react-query";
import { Archive, Loader2, Plus, RotateCcw, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ARCHIVE_PREFIX, isArchived } from "@/lib/domain";
import { addColumn, archiveColumn, renameColumn, restoreColumn } from "@/lib/sheets.functions";

export function ColumnSettings({
  tab,
  headers,
  onClose,
}: {
  tab: string;
  headers: string[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [newName, setNewName] = useState("");
  const [drafts, setDrafts] = useState<Record<number, string>>({});

  const run = async (fn: () => Promise<unknown>, okMessage: string) => {
    setBusy(true);
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: ["sheet", tab] });
      toast.success(okMessage);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const editable = headers
    .map((h, i) => ({ h, i }))
    .filter(({ h, i }) => i > 0 && h !== "TOTAL" && h !== "");

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 backdrop-blur-sm sm:items-center">
      <div className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-border bg-card p-5 sm:rounded-3xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Manage categories</h2>
            <p className="text-xs text-muted-foreground">
              Archiving keeps past figures untouched in the sheet.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 place-items-center rounded-xl bg-secondary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-4 flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New category (e.g. Charcoal)"
            className="h-11 flex-1 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-primary"
          />
          <button
            type="button"
            disabled={busy || !newName.trim()}
            onClick={() =>
              void run(async () => {
                await addColumn({ data: { tab, name: newName.trim() } });
                setNewName("");
              }, "Category added")
            }
            className="flex h-11 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add
          </button>
        </div>

        <ul className="space-y-2">
          {editable.map(({ h, i }) => {
            const archived = isArchived(h);
            const display = archived ? h.slice(ARCHIVE_PREFIX.length) : h;
            return (
              <li key={i} className="flex items-center gap-2 rounded-xl bg-secondary p-2">
                <input
                  value={drafts[i] ?? display}
                  disabled={archived}
                  onChange={(e) => setDrafts((p) => ({ ...p, [i]: e.target.value }))}
                  onBlur={() => {
                    const v = (drafts[i] ?? display).trim();
                    if (!v || v === display) return;
                    void run(
                      () => renameColumn({ data: { tab, index: i, name: v } }),
                      "Category renamed",
                    );
                  }}
                  className="h-9 flex-1 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus:border-primary disabled:opacity-60"
                />
                {archived ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void run(
                        () => restoreColumn({ data: { tab, index: i } }),
                        "Category restored",
                      )
                    }
                    className="grid h-9 w-9 place-items-center rounded-lg bg-card text-success"
                    aria-label={`Restore ${display}`}
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void run(
                        () => archiveColumn({ data: { tab, index: i } }),
                        "Category archived",
                      )
                    }
                    className="grid h-9 w-9 place-items-center rounded-lg bg-card text-muted-foreground"
                    aria-label={`Archive ${display}`}
                  >
                    <Archive className="h-4 w-4" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
