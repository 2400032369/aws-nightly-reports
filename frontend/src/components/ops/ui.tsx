import type { ReactNode } from "react";
import { AlertTriangle, Inbox, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { HealthState, Run, TaskStatus } from "@/lib/api";

export function PageHeader({ title, desc, actions }: { title: string; desc?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {desc && <p className="mt-1 text-sm text-muted-foreground">{desc}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, action, children, className }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("panel", className)}>
      {title && (
        <header className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <h2 className="text-sm font-semibold">{title}</h2>
          {action}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Stat({ label, value, sub, icon }: { label: string; value: ReactNode; sub?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between text-xs uppercase tracking-wider text-muted-foreground">
        {label}
        <span className="text-primary">{icon}</span>
      </div>
      <div className="mt-2 truncate font-mono text-xl font-semibold">{value}</div>
      {sub && <div className="mt-1 truncate text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

const statusTone: Record<string, string> = {
  PROVISIONING: "text-info border-info/40 bg-info/10",
  PENDING: "text-warning border-warning/40 bg-warning/10",
  RUNNING: "text-primary border-primary/40 bg-primary/10",
  SUCCEEDED: "text-success border-success/40 bg-success/10",
  FAILED: "text-destructive border-destructive/40 bg-destructive/10",
  HEALTHY: "text-success border-success/40 bg-success/10",
  DEGRADED: "text-warning border-warning/40 bg-warning/10",
  DOWN: "text-destructive border-destructive/40 bg-destructive/10",
  ENABLED: "text-success border-success/40 bg-success/10",
  DISABLED: "text-muted-foreground border-border bg-muted",
  STOPPED: "text-muted-foreground border-border bg-muted",
};

export function runLabel(r: Pick<Run, "status" | "exitCode">): string {
  if (r.status !== "STOPPED") return r.status;
  return r.exitCode === 0 ? "SUCCEEDED" : "FAILED";
}

export function StatusBadge({ status }: { status: TaskStatus | HealthState | string }) {
  const live = status === "RUNNING" || status === "PENDING" || status === "PROVISIONING";
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded border px-2 py-0.5 font-mono text-[11px] font-medium", statusTone[status] ?? statusTone["STOPPED"])}>
      <span className={cn("h-1.5 w-1.5 rounded-full bg-current", live && "pulse-dot")} />
      {status}
    </span>
  );
}

export const Loading = ({ label = "Loading…" }: { label?: string }) => (
  <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
    <Loader2 className="h-4 w-4 animate-spin" /> {label}
  </div>
);
export const ErrorState = ({ error, onRetry }: { error: unknown; onRetry?: () => void }) => (
  <div className="flex flex-col items-center gap-2 py-10 text-sm text-destructive">
    <AlertTriangle className="h-5 w-5" />
    {error instanceof Error ? error.message : "Something went wrong"}
    {onRetry && <button onClick={onRetry} className="text-primary underline">Retry</button>}
  </div>
);
export const Empty = ({ label }: { label: string }) => (
  <div className="flex flex-col items-center gap-2 py-10 text-sm text-muted-foreground">
    <Inbox className="h-5 w-5" /> {label}
  </div>
);

export const inr = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
export const fmtBytes = (b: number) => (b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(2)} MB`);
export const fmtTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Calcutta", dateStyle: "medium", timeStyle: "medium" }) : "—";
export const fmtDur = (s: number | null) => (s == null ? "—" : s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`);
export const shortId = (id: string) => id.slice(0, 8);
