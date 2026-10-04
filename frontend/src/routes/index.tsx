import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowRight, CalendarClock, Clock, Cpu, Database, FileSpreadsheet, FileText, Server, Timer, Zap } from "lucide-react";
import { api } from "@/lib/api";
import { Empty, ErrorState, Loading, Panel, PageHeader, Stat, StatusBadge, fmtBytes, fmtDur, fmtTime, runLabel, shortId } from "@/components/ops/ui";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — AWS Nightly Reports" },
      { name: "description", content: "Overview of the ECS Fargate nightly sales report pipeline: runs, reports, scheduler and health." },
      { property: "og:title", content: "Dashboard — AWS Nightly Reports" },
      { property: "og:description", content: "Overview of the Fargate nightly sales report pipeline." },
    ],
  }),
  component: Dashboard,
});

const PIPE = [
  { icon: Database, name: "S3", sub: "sales.csv" },
  { icon: CalendarClock, name: "EventBridge", sub: "Scheduler" },
  { icon: Cpu, name: "ECS Fargate", sub: "task" },
  { icon: Zap, name: "Python", sub: "Pandas" },
  { icon: FileSpreadsheet, name: "S3", sub: "report.csv" },
  { icon: FileText, name: "CloudWatch", sub: "Logs" },
];

function Dashboard() {
  const runs = useQuery({ queryKey: ["runs"], queryFn: api.listRuns, refetchInterval: 3000 });
  const input = useQuery({ queryKey: ["input"], queryFn: api.getInput });
  const sched = useQuery({ queryKey: ["scheduler"], queryFn: api.getScheduler });
  const reports = useQuery({ queryKey: ["reports"], queryFn: api.listReports });
  const health = useQuery({ queryKey: ["health"], queryFn: api.getHealth });

  const list = runs.data ?? [];
  const last = list[0];
  const active = list.find((r) => r.status !== "STOPPED");
  const ok = list.filter((r) => r.status === "STOPPED" && r.exitCode === 0).length;
  const chart = [...list].reverse().filter((r) => r.status === "STOPPED").map((r) => ({
    day: new Date(r.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
    dur: r.durationSec,
    ok: r.exitCode === 0,
  }));

  return (
    <>
      <PageHeader title="Dashboard" desc="Nightly sales report pipeline · ap-south-2" actions={<Link to="/run" className="rounded bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">Run report</Link>} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Last execution" icon={<Clock className="h-4 w-4" />} value={last ? runLabel(last) : "—"} sub={last ? fmtTime(last.createdAt) : ""} />
        <Stat label="Active task" icon={<Server className="h-4 w-4" />} value={active ? shortId(active.taskId) : "None"} sub={active ? active.status : "Cluster idle"} />
        <Stat label="Reports generated" icon={<FileSpreadsheet className="h-4 w-4" />} value={ok} sub={`${list.length} total runs`} />
        <Stat label="sales.csv" icon={<Database className="h-4 w-4" />} value={input.data ? `${input.data.rowCount} rows` : "…"} sub={input.data ? `${fmtBytes(input.data.sizeBytes)} · ${fmtTime(input.data.lastModified)}` : ""} />
        <Stat label="Scheduler" icon={<Timer className="h-4 w-4" />} value={sched.data?.state ?? "…"} sub={sched.data ? `Next ${fmtTime(sched.data.nextRun)}` : ""} />
      </div>

      <Panel title="Pipeline" className="mt-4">
        <div className="flex items-center gap-0 overflow-x-auto pb-1">
          {PIPE.map((p, i) => (
            <div key={i} className="flex items-center">
              <div className={`flex w-28 shrink-0 flex-col items-center rounded border p-3 text-center ${active && (i === 2 || i === 3) ? "border-primary bg-primary/10" : "border-border bg-secondary"}`}>
                <p.icon className="h-5 w-5 text-primary" />
                <div className="mt-1 text-xs font-semibold">{p.name}</div>
                <div className="font-mono text-[10px] text-muted-foreground">{p.sub}</div>
              </div>
              {i < PIPE.length - 1 && <div className={`h-0.5 w-8 shrink-0 ${active ? "flow-line" : "bg-border"}`} />}
            </div>
          ))}
        </div>
      </Panel>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel title="Execution duration (s)" className="lg:col-span-2">
          {runs.isLoading ? <Loading /> : runs.error ? <ErrorState error={runs.error} /> : (
            <div className="h-56">
              <ResponsiveContainer>
                <BarChart data={chart}>
                  <CartesianGrid stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} />
                  <YAxis tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)" }} cursor={{ fill: "var(--color-accent)" }} />
                  <Bar dataKey="dur" name="Duration (s)">
                    {chart.map((c, i) => <Cell key={i} fill={c.ok ? "var(--color-chart-1)" : "var(--color-destructive)"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>
        <Panel title="AWS health" action={<Link to="/status" className="text-xs text-primary">Details</Link>}>
          {health.isLoading ? <Loading /> : (
            <ul className="space-y-2">
              {health.data?.map((h) => (
                <li key={h.id} className="flex items-center justify-between text-sm">
                  <span>{h.name}</span><StatusBadge status={h.state} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="Recent executions" className="mt-4" action={<Link to="/executions" className="flex items-center gap-1 text-xs text-primary">All <ArrowRight className="h-3 w-3" /></Link>}>
        {runs.isLoading ? <Loading /> : list.length === 0 ? <Empty label="No executions yet" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground"><tr><th className="py-2">Task</th><th>Status</th><th>Trigger</th><th>Started</th><th>Duration</th></tr></thead>
              <tbody>
                {list.slice(0, 5).map((r) => (
                  <tr key={r.taskId} className="border-t border-border">
                    <td className="py-2 font-mono"><Link to="/executions/$taskId" params={{ taskId: r.taskId }} className="text-primary hover:underline">{shortId(r.taskId)}</Link></td>
                    <td><StatusBadge status={runLabel(r)} /></td>
                    <td className="font-mono text-xs">{r.trigger}</td>
                    <td className="text-muted-foreground">{fmtTime(r.createdAt)}</td>
                    <td className="font-mono">{fmtDur(r.durationSec)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {reports.data && <p className="mt-3 text-xs text-muted-foreground">Latest report: <span className="font-mono">{reports.data[0]?.name}</span> · {fmtTime(reports.data[0]?.lastModified ?? null)}</p>}
      </Panel>
    </>
  );
}
