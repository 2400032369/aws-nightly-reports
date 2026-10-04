import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ScrollText } from "lucide-react";
import { api } from "@/lib/api";
import { ErrorState, Loading, Panel, PageHeader, Stat, StatusBadge, fmtDur, fmtTime, runLabel, shortId } from "@/components/ops/ui";

export const Route = createFileRoute("/executions/$taskId")({
  head: ({ params }) => ({
    meta: [
      { title: `Task ${params.taskId.slice(0, 8)} — AWS Nightly Reports` },
      { name: "description", content: "Details, timeline and exit status of a Fargate report task." },
      { property: "og:title", content: "Execution details — AWS Nightly Reports" },
      { property: "og:description", content: "Timeline and exit status of a Fargate report task." },
    ],
  }),
  component: Details,
});

function Details() {
  const { taskId } = Route.useParams();
  const q = useQuery({
    queryKey: ["run", taskId],
    queryFn: () => api.getRun(taskId),
    refetchInterval: (s) => (s.state.data?.status === "STOPPED" ? false : 1000),
  });
  const back = <Link to="/executions" className="flex items-center gap-1 rounded border border-border px-3 py-2 text-sm hover:bg-accent"><ArrowLeft className="h-4 w-4" /> Executions</Link>;
  if (q.isLoading) return <Loading />;
  if (q.error || !q.data) return <><PageHeader title="Execution" actions={back} /><ErrorState error={q.error} /></>;
  const r = q.data;
  return (
    <>
      <PageHeader title={`Task ${shortId(r.taskId)}`} desc={r.taskArn} actions={<>{back}<Link to="/logs" search={{ task: r.taskId }} className="flex items-center gap-1 rounded bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"><ScrollText className="h-4 w-4" /> CloudWatch Logs</Link></>} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Status" value={<StatusBadge status={runLabel(r)} />} sub={r.status} />
        <Stat label="Runtime" value={fmtDur(r.durationSec)} />
        <Stat label="Exit code" value={r.exitCode ?? "—"} sub={r.stoppedReason ?? ""} />
        <Stat label="Trigger" value={r.trigger} sub={`${r.cpu} CPU · ${r.memory} MiB`} />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Task information">
          <dl className="space-y-2 text-sm">
            {[["Task ID", r.taskId], ["Cluster", "nightly-reports-cluster"], ["Task definition", "nightly-sales-report-task:3"], ["Launch type", "FARGATE"], ["Created", fmtTime(r.createdAt)], ["Started", fmtTime(r.startedAt)], ["Stopped", fmtTime(r.stoppedAt)], ["Log group", "/ecs/nightly-sales-report"]].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 border-b border-border pb-2 last:border-0"><dt className="text-muted-foreground">{k}</dt><dd className="break-all text-right font-mono text-xs">{v}</dd></div>
            ))}
          </dl>
        </Panel>
        <Panel title="Execution timeline">
          <ol className="relative ml-2 border-l border-border">
            {r.timeline.map((t) => (
              <li key={t.status} className="mb-5 ml-4 last:mb-0">
                <span className="absolute -left-1.5 mt-1 h-3 w-3 rounded-full border-2 border-background bg-primary" />
                <div className="font-mono text-xs font-semibold">{t.status}</div>
                <div className="text-xs text-muted-foreground">{fmtTime(t.at)}</div>
              </li>
            ))}
          </ol>
        </Panel>
      </div>
    </>
  );
}
