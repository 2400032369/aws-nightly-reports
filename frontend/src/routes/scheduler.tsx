import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { ErrorState, Loading, Panel, PageHeader, Stat, StatusBadge, fmtTime } from "@/components/ops/ui";

export const Route = createFileRoute("/scheduler")({
  head: () => ({
    meta: [
      { title: "Scheduler — AWS Nightly Reports" },
      { name: "description", content: "EventBridge Scheduler configuration and next run for the nightly report." },
      { property: "og:title", content: "Scheduler — AWS Nightly Reports" },
      { property: "og:description", content: "EventBridge schedule for the nightly report." },
    ],
  }),
  component: SchedulerPage,
});

function Countdown({ to }: { to: string | null }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { setNow(Date.now()); const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  if (to == null || now == null) return <>—</>;
  const s = Math.max(0, Math.floor((new Date(to).getTime() - now) / 1000));
  const p = (n: number) => String(n).padStart(2, "0");
  return <>{p(Math.floor(s / 3600))}:{p(Math.floor((s % 3600) / 60))}:{p(s % 60)}</>;
}

function SchedulerPage() {
  const q = useQuery({ queryKey: ["scheduler"], queryFn: api.getScheduler });
  if (q.isLoading) return <Loading />;
  if (q.error || !q.data) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const s = q.data;
  return (
    <>
      <PageHeader title="Scheduler" desc="Amazon EventBridge Scheduler" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="State" value={<StatusBadge status={s.state} />} />
        <Stat label="Frequency" value={s.frequency} sub={s.expression} />
        <Stat label="Next run in" value={<Countdown to={s.nextRun} />} sub={fmtTime(s.nextRun)} />
        <Stat label="Last run" value={s.lastRun ? new Date(s.lastRun).toLocaleDateString("en-IN") : "—"} sub={fmtTime(s.lastRun)} />
      </div>
      <Panel title="Schedule configuration" className="mt-4">
        <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
          {[["Name", s.name], ["State", s.state], ["Schedule expression", s.expression], ["Timezone", s.timezone], ["Target", s.target], ["Cluster", s.cluster], ["Launch type", "FARGATE"], ["Flexible window", "OFF"]].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 border-b border-border pb-2"><dt className="text-muted-foreground">{k}</dt><dd className="font-mono text-xs">{v}</dd></div>
          ))}
        </dl>
      </Panel>
    </>
  );
}
