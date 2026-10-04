import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw, Search } from "lucide-react";
import { api } from "@/lib/api";
import { Empty, ErrorState, Loading, Panel, PageHeader, StatusBadge, fmtDur, fmtTime, runLabel, shortId } from "@/components/ops/ui";

export const Route = createFileRoute("/executions/")({
  head: () => ({
    meta: [
      { title: "Executions — AWS Nightly Reports" },
      { name: "description", content: "Searchable history of every Fargate nightly report task." },
      { property: "og:title", content: "Executions — AWS Nightly Reports" },
      { property: "og:description", content: "History of every Fargate report task." },
    ],
  }),
  component: Executions,
});

const FILTERS = ["ALL", "SUCCEEDED", "FAILED", "RUNNING"] as const;

function Executions() {
  const q = useQuery({ queryKey: ["runs"], queryFn: api.listRuns, refetchInterval: 3000 });
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("ALL");
  const rows = useMemo(
    () =>
      (q.data ?? []).filter((r) => {
        const l = runLabel(r);
        const f = filter === "ALL" || (filter === "RUNNING" ? r.status !== "STOPPED" : l === filter);
        return f && r.taskId.includes(search.trim().toLowerCase());
      }),
    [q.data, search, filter],
  );

  return (
    <>
      <PageHeader title="Executions" desc="ECS tasks for nightly-sales-report-task" actions={<button onClick={() => q.refetch()} className="flex items-center gap-2 rounded border border-border px-3 py-2 text-sm hover:bg-accent"><RefreshCw className={`h-4 w-4 ${q.isFetching ? "animate-spin" : ""}`} /> Refresh</button>} />
      <Panel>
        <div className="mb-4 flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search task ID…" className="w-full rounded border border-input bg-background py-2 pl-9 pr-3 font-mono text-sm outline-none focus:border-primary" />
          </div>
          <div className="flex gap-1">
            {FILTERS.map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={`rounded px-3 py-2 font-mono text-xs ${filter === f ? "bg-primary text-primary-foreground" : "border border-border hover:bg-accent"}`}>{f}</button>
            ))}
          </div>
        </div>
        {q.isLoading ? <Loading /> : q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : rows.length === 0 ? <Empty label="No executions match your filters" /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="text-left text-xs text-muted-foreground"><tr><th className="py-2">Task ID</th><th>Status</th><th>Started</th><th>Stopped</th><th>Duration</th><th>Exit</th><th className="text-right">Actions</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.taskId} className="border-t border-border hover:bg-accent/40">
                    <td className="py-2 font-mono" title={r.taskId}>{shortId(r.taskId)}…</td>
                    <td><StatusBadge status={runLabel(r)} /></td>
                    <td className="text-xs text-muted-foreground">{fmtTime(r.startedAt)}</td>
                    <td className="text-xs text-muted-foreground">{fmtTime(r.stoppedAt)}</td>
                    <td className="font-mono">{fmtDur(r.durationSec)}</td>
                    <td className="font-mono">{r.exitCode ?? "—"}</td>
                    <td className="space-x-3 text-right text-xs">
                      <Link to="/executions/$taskId" params={{ taskId: r.taskId }} className="text-primary hover:underline">Details</Link>
                      <Link to="/logs" search={{ task: r.taskId }} className="text-primary hover:underline">Logs</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
