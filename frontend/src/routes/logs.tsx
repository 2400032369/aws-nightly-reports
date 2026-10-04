import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, RefreshCw, Search } from "lucide-react";
import { z } from "zod";
import { api } from "@/lib/api";
import { Empty, ErrorState, Loading, PageHeader, StatusBadge, runLabel, shortId } from "@/components/ops/ui";

export const Route = createFileRoute("/logs")({
  validateSearch: z.object({ task: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "CloudWatch Logs — AWS Nightly Reports" },
      { name: "description", content: "Terminal-style viewer for /ecs/nightly-sales-report log streams." },
      { property: "og:title", content: "CloudWatch Logs — AWS Nightly Reports" },
      { property: "og:description", content: "Live log viewer for the Fargate report task." },
    ],
  }),
  component: Logs,
});

function Logs() {
  const { task } = Route.useSearch();
  const navigate = Route.useNavigate();
  const runs = useQuery({ queryKey: ["runs"], queryFn: api.listRuns, refetchInterval: 3000 });
  const selected = task ?? runs.data?.[0]?.taskId;
  const run = runs.data?.find((r) => r.taskId === selected);
  const logs = useQuery({
    queryKey: ["logs", selected],
    queryFn: () => api.getRunLogs(selected!),
    enabled: !!selected,
    refetchInterval: run && run.status !== "STOPPED" ? 1500 : false,
  });
  const [search, setSearch] = useState("");
  const [auto, setAuto] = useState(true);
  const ref = useRef<HTMLDivElement>(null);
  const lines = useMemo(() => (logs.data?.events ?? []).filter((l) => l.message.toLowerCase().includes(search.toLowerCase())), [logs.data, search]);
  useEffect(() => {
    if (auto && ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [lines, auto]);

  const copy = async () => {
    await navigator.clipboard.writeText(lines.map((l) => `${l.timestamp} ${l.level} ${l.message}`).join("\n"));
    toast.success(`Copied ${lines.length} lines`);
  };

  return (
    <>
      <PageHeader title="CloudWatch Logs" desc="Log group: /ecs/nightly-sales-report" />
      <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-center">
        <select value={selected ?? ""} onChange={(e) => navigate({ search: { task: e.target.value } })} className="rounded border border-input bg-background px-3 py-2 font-mono text-sm">
          {runs.data?.map((r) => <option key={r.taskId} value={r.taskId}>{shortId(r.taskId)} · {runLabel(r)} · {new Date(r.createdAt).toLocaleDateString("en-IN")}</option>)}
        </select>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter events…" className="w-full rounded border border-input bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-primary" />
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} className="accent-primary" /> Auto-scroll</label>
        <button onClick={() => logs.refetch()} className="flex items-center gap-2 rounded border border-border px-3 py-2 text-sm hover:bg-accent"><RefreshCw className={`h-4 w-4 ${logs.isFetching ? "animate-spin" : ""}`} /> Refresh</button>
        <button onClick={copy} disabled={!lines.length} className="flex items-center gap-2 rounded border border-border px-3 py-2 text-sm hover:bg-accent disabled:opacity-50"><Copy className="h-4 w-4" /> Copy</button>
      </div>
      <div className="overflow-hidden rounded border border-border">
        <div className="flex items-center justify-between border-b border-border bg-secondary px-3 py-1.5 font-mono text-[11px] text-muted-foreground">
          <span>ecs/nightly-sales-report/{selected ?? "…"}</span>
          {run && <StatusBadge status={runLabel(run)} />}
        </div>
        <div ref={ref} className="h-[60vh] overflow-auto bg-terminal p-3 font-mono text-xs leading-relaxed">
          {runs.isLoading || logs.isLoading ? <Loading label="Fetching log events…" /> : logs.error ? <ErrorState error={logs.error} /> : lines.length === 0 ? <Empty label={run && run.status !== "RUNNING" && run.status !== "STOPPED" ? "Waiting for container to start…" : "No log events"} /> : lines.map((l, i) => (
            <div key={i} className="flex gap-3 hover:bg-accent/30">
              <span className="shrink-0 text-muted-foreground">{new Date(l.timestamp).toISOString().replace("T", " ").slice(0, 23)}</span>
              <span className={`w-12 shrink-0 ${l.level === "ERROR" ? "text-destructive" : l.level === "WARN" ? "text-warning" : "text-success"}`}>{l.level}</span>
              <span className="break-all">{l.message}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
