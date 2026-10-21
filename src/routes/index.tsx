import { createFileRoute } from "@tanstack/react-router";
import { Settings2 } from "lucide-react";
import { useMemo, useState } from "react";

import { ColumnSettings } from "@/components/app/ColumnSettings";
import { EntryForm } from "@/components/app/EntryForm";
import { HistoryTable } from "@/components/app/HistoryTable";
import { SummaryCards } from "@/components/app/SummaryCards";
import { TopNav } from "@/components/app/TopNav";
import {
  SALES_SCHEMA,
  SHOP,
  TABS,
  cycleFor,
  inCycle,
  isArchived,
  parseRows,
  shiftCycle,
  type ModuleId,
} from "@/lib/domain";
import {
  useOnlineStatus,
  usePendingCount,
  useQueueSync,
  useSaveEntry,
  useSheetTab,
} from "@/lib/useSheetData";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: `${SHOP.name} — Daily Reconciliation` },
      {
        name: "description",
        content:
          "Log daily cash and online collections against daily expenses for Arab Tea House, synced straight into Google Sheets, even offline.",
      },
      { property: "og:title", content: `${SHOP.name} — Daily Reconciliation` },
      {
        property: "og:description",
        content:
          "Daily collection and expense register for a tea shop that syncs directly to Google Sheets.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Hub,
});

function Hub() {
  const [module, setModule] = useState<ModuleId>("sales");
  const [cycleOffset, setCycleOffset] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dateOverride, setDateOverride] = useState<string | null>(null);

  const online = useOnlineStatus();
  const pending = usePendingCount();
  useQueueSync();

  const salesTab = TABS["sales"];
  const invTab = TABS["inventory"];
  const activeTab = module === "sales" ? salesTab : invTab;

  const sales = useSheetTab(salesTab);
  const inventory = useSheetTab(invTab);
  const active = module === "sales" ? sales : inventory;
  const save = useSaveEntry(activeTab);

  const cycle = useMemo(() => shiftCycle(cycleFor(new Date()), cycleOffset), [cycleOffset]);

  const salesRows = useMemo(() => (sales.data ? parseRows(sales.data) : []), [sales.data]);
  const invRows = useMemo(
    () => (inventory.data ? parseRows(inventory.data) : []),
    [inventory.data],
  );

  const salesCycleRows = salesRows.filter((r) => inCycle(r.date, cycle));
  const invCycleRows = invRows.filter((r) => inCycle(r.date, cycle));

  const collections = salesCycleRows.reduce((s, r) => s + (r.values["TOTAL"] ?? 0), 0);
  const expenses = invCycleRows.reduce((s, r) => s + (r.values["TOTAL"] ?? 0), 0);
  const cash = salesCycleRows.reduce((s, r) => s + (r.values["CASH"] ?? 0), 0);
  const onlineAmt = salesCycleRows.reduce((s, r) => s + (r.values["ONLINE"] ?? 0), 0);

  const expenseFields = useMemo(
    () =>
      (inventory.data?.headers ?? []).slice(1).filter((h) => h && h !== "TOTAL" && !isArchived(h)),
    [inventory.data],
  );

  const fields = module === "sales" ? SALES_SCHEMA.inputs : expenseFields;
  const rows = module === "sales" ? salesCycleRows : invCycleRows;

  const lookup = (dateText: string) => {
    const all = module === "sales" ? salesRows : invRows;
    return all.find((r) => r.dateText === dateText)?.values ?? null;
  };

  const historyColumns =
    module === "sales"
      ? SALES_SCHEMA.columns.filter((c) => new Set(["CASH", "ONLINE"]).has(c))
      : expenseFields;

  const refreshing = sales.isFetching || inventory.isFetching;

  return (
    <div className="min-h-screen bg-background pb-24">
      <TopNav
        module={module}
        online={online}
        pending={pending}
        refreshing={refreshing}
        onModule={setModule}
        onRefresh={() => {
          void sales.refetch();
          void inventory.refetch();
        }}
      />

      <main className="mx-auto max-w-3xl space-y-6 px-4 pt-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-2">
            <CycleButton onClick={() => setCycleOffset((o) => o - 1)} label="‹ Prev" />
            {cycleOffset !== 0 && <CycleButton onClick={() => setCycleOffset(0)} label="Current" />}
            <CycleButton
              onClick={() => setCycleOffset((o) => Math.min(0, o + 1))}
              label="Next ›"
              disabled={cycleOffset >= 0}
            />
          </div>
          <p className="text-xs text-muted-foreground">{SHOP.name}</p>
        </div>

        <SummaryCards
          cycle={cycle}
          collections={collections}
          expenses={expenses}
          cash={cash}
          onlineAmt={onlineAmt}
          daysLogged={new Set(salesCycleRows.map((r) => r.dateText)).size}
        />

        {active.usingCache && (
          <p className="rounded-xl bg-warning/15 px-3 py-2 text-xs text-warning-foreground">
            Showing the last saved copy of this sheet. It will refresh once you're back online.
          </p>
        )}

        {module === "inventory" && (
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-3 text-sm font-semibold text-muted-foreground"
          >
            <Settings2 className="h-4 w-4" />
            Manage expense categories
          </button>
        )}

        {active.isLoading && !active.data ? (
          <p className="card-surface p-6 text-center text-sm text-muted-foreground">
            Loading sheet…
          </p>
        ) : (
          <>
            <EntryForm
              key={`${activeTab}-form`}
              module={module}
              fields={fields}
              lookup={lookup}
              saving={save.isPending}
              dateOverride={dateOverride}
              onSave={(dateText, values) => {
                setDateOverride(null);
                save.mutate({ dateText, values });
              }}
            />

            <HistoryTable
              rows={rows}
              columns={historyColumns}
              highlight="TOTAL"
              onEdit={(iso) => {
                setDateOverride(iso);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            />
          </>
        )}
      </main>

      {settingsOpen && inventory.data && (
        <ColumnSettings
          tab={invTab}
          headers={inventory.data.headers}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}

function CycleButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground disabled:opacity-40"
    >
      {label}
    </button>
  );
}
