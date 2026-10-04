import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Loader2, Play } from "lucide-react";
import { api, type TaskStatus } from "@/lib/api";
import { Panel, PageHeader, StatusBadge, fmtDur, runLabel } from "@/components/ops/ui";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/run")({
  head: () => ({
    meta: [
      { title: "Run Report — AWS Nightly Reports" },
      { name: "description", content: "Manually start the nightly sales report Fargate task and watch its lifecycle." },
      { property: "og:title", content: "Run Report — AWS Nightly Reports" },
      { property: "og:description", content: "Start the Fargate report task on demand." },
    ],
  }),
  component: RunPage,
});

const STEPS: TaskStatus[] = ["PROVISIONING", "PENDING", "RUNNING", "STOPPED"];

function RunPage() {
  const qc = useQueryClient();
  const [taskId, setTaskId] = useState<string | null>(null);
  const start = useMutation({
    mutationFn: api.startRun,
    onSuccess: (r) => { setTaskId(r.taskId); toast.success("Task started", { description: r.taskId }); qc.invalidateQueries({ queryKey: ["runs"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to start"),
  });
  const run = useQuery({
    queryKey: ["run", taskId],
    queryFn: () => api.getRun(taskId!),
    enabled: !!taskId,
    refetchInterval: (q) => (q.state.data?.status === "STOPPED" ? false : 1000),
  });
  const r = run.data;
  const idx = r ? STEPS.indexOf(r.status) : -1;
  const busy = start.isPending || (r && r.status !== "STOPPED");

  return (
    <>
      <PageHeader title="Run Report" desc="Launch nightly-sales-report-task on nightly-reports-cluster (FARGATE)" />
      <Panel>
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">Runs the Python + Pandas job against <span className="font-mono text-foreground">s3://…/input/sales.csv</span>.</div>
          <button disabled={!!busy} onClick={() => start.mutate()} className="flex items-center gap-2 rounded bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} {busy ? "Running…" : "Run Report"}
          </button>
        </div>
        <ol className="mt-6 grid grid-cols-4 gap-2">
          {STEPS.map((s, i) => {
            const done = idx > i || (r?.status === "STOPPED" && i === 3);
            const cur = idx === i && r?.status !== "STOPPED";
            return (
              <li key={s} className={cn("rounded border p-3 text-center", done ? "border-success/50 bg-success/10" : cur ? "border-primary bg-primary/10" : "border-border")}>
                <div className="flex justify-center">{done ? <Check className="h-4 w-4 text-success" /> : cur ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <span className="h-4 w-4 rounded-full border border-border" />}</div>
                <div className="mt-1 font-mono text-[10px] sm:text-xs">{s}</div>
              </li>
            );
          })}
        </ol>
      </Panel>
      {r && (
        <Panel title="Task" className="mt-4" action={<StatusBadge status={runLabel(r)} />}>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <Field k="Task ID" v={r.taskId} />
            <Field k="Status" v={r.status} />
            <Field k="Task ARN" v={r.taskArn} wide />
            <Field k="Duration" v={fmtDur(r.durationSec)} />
            <Field k="Exit code" v={r.exitCode ?? "—"} />
          </dl>
          {r.status === "STOPPED" && (
            <div className="mt-4 flex gap-2">
              <Link to="/logs" search={{ task: r.taskId }} className="rounded bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">View Logs</Link>
              <Link to="/executions/$taskId" params={{ taskId: r.taskId }} className="rounded border border-border px-3 py-2 text-sm">Details</Link>
              <Link to="/reports" className="rounded border border-border px-3 py-2 text-sm">View report</Link>
            </div>
          )}
        </Panel>
      )}
    </>
  );
}

function Field({ k, v, wide }: { k: string; v: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <dt className="text-xs text-muted-foreground">{k}</dt>
      <dd className="break-all font-mono text-xs">{v}</dd>
    </div>
  );
}
