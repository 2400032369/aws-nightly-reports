import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, Cpu, Database, FileText, Globe, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { ErrorState, Loading, PageHeader, StatusBadge, fmtTime } from "@/components/ops/ui";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/status")({
  head: () => ({
    meta: [
      { title: "System Status — AWS Nightly Reports" },
      { name: "description", content: "Health of the API, S3, ECS Fargate, CloudWatch and EventBridge." },
      { property: "og:title", content: "System Status — AWS Nightly Reports" },
      { property: "og:description", content: "Health of every service in the report pipeline." },
    ],
  }),
  component: Status,
});

const ICONS: Record<string, typeof Globe> = { api: Globe, s3: Database, ecs: Cpu, logs: FileText, events: CalendarClock };

function Status() {
  const q = useQuery({ queryKey: ["health"], queryFn: api.getHealth });
  const all = q.data?.every((h) => h.state === "HEALTHY");
  return (
    <>
      <PageHeader title="System Status" desc="Service health checks" actions={<button onClick={() => q.refetch()} disabled={q.isFetching} className="flex items-center gap-2 rounded border border-border px-3 py-2 text-sm hover:bg-accent disabled:opacity-50"><RefreshCw className={cn("h-4 w-4", q.isFetching && "animate-spin")} /> Refresh</button>} />
      {q.isLoading ? <Loading label="Running health checks…" /> : q.error || !q.data ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : (
        <>
          <div className={cn("mb-4 rounded border p-4 text-sm font-medium", all ? "border-success/40 bg-success/10 text-success" : "border-warning/40 bg-warning/10 text-warning")}>
            {all ? "All systems operational" : "Some services are degraded"}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {q.data.map((h) => {
              const Icon = ICONS[h.id] ?? Globe;
              return (
                <div key={h.id} className="panel p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-semibold"><Icon className="h-4 w-4 text-primary" /> {h.name}</div>
                    <StatusBadge status={h.state} />
                  </div>
                  <div className="mt-3 font-mono text-xs text-muted-foreground">{h.detail}</div>
                  <div className="mt-3 flex justify-between text-xs"><span>Latency <b className="font-mono">{h.latencyMs} ms</b></span><span className="text-muted-foreground">{fmtTime(h.checkedAt)}</span></div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
