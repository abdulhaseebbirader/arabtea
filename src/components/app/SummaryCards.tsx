import { ArrowDownRight, ArrowUpRight, Banknote, PackageOpen, Wallet } from "lucide-react";

import { money, type Cycle } from "@/lib/domain";
import { cn } from "@/lib/utils";

export function SummaryCards({
  cycle,
  collections,
  expenses,
  cash,
  onlineAmt,
  daysLogged,
}: {
  cycle: Cycle;
  collections: number;
  expenses: number;
  cash: number;
  onlineAmt: number;
  daysLogged: number;
}) {
  const net = collections - expenses;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Cycle overview</h2>
        <span className="numeric rounded-full bg-secondary px-2.5 py-1 text-[11px] text-secondary-foreground">
          {cycle.label}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat
          icon={<Banknote className="h-4 w-4" />}
          label="Cycle collections"
          value={money(collections)}
          tone="success"
        />
        <Stat
          icon={<PackageOpen className="h-4 w-4" />}
          label="Cycle expenses"
          value={money(expenses)}
          tone="warning"
        />
      </div>

      <div
        className={cn(
          "card-surface flex items-center justify-between p-4",
          net >= 0 ? "bg-success/8" : "bg-destructive/8",
        )}
      >
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "grid h-10 w-10 place-items-center rounded-xl",
              net >= 0 ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive",
            )}
          >
            <Wallet className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs text-muted-foreground">Net (collections − expenses)</p>
            <p className="numeric text-xl font-bold">{money(net)}</p>
          </div>
        </div>
        {net >= 0 ? (
          <ArrowUpRight className="h-6 w-6 text-success" />
        ) : (
          <ArrowDownRight className="h-6 w-6 text-destructive" />
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Mini label="Cash" value={money(cash)} tone="success" />
        <Mini label="Online" value={money(onlineAmt)} tone="muted" />
        <Mini label="Days logged" value={String(daysLogged)} tone="muted" />
      </div>
    </section>
  );
}

function Stat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "success" | "warning";
}) {
  return (
    <div className="card-surface p-4">
      <span
        className={cn(
          "mb-2 inline-grid h-8 w-8 place-items-center rounded-lg",
          tone === "success" ? "bg-success/15 text-success" : "bg-warning/20 text-warning",
        )}
      >
        {icon}
      </span>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="numeric text-lg font-bold leading-tight">{value}</p>
    </div>
  );
}

function Mini({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "success" | "destructive" | "muted";
}) {
  return (
    <div className="card-surface px-3 py-2.5 text-center">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn(
          "numeric text-sm font-bold",
          tone === "success" && "text-success",
          tone === "destructive" && "text-destructive",
        )}
      >
        {value}
      </p>
    </div>
  );
}
