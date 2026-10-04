import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  Activity, CalendarClock, Database, FileSpreadsheet, LayoutDashboard, ListChecks, Menu, Play, ScrollText, Server, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { USE_MOCK } from "@/lib/api";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/run", label: "Run Report", icon: Play },
  { to: "/executions", label: "Executions", icon: ListChecks },
  { to: "/reports", label: "Reports", icon: FileSpreadsheet },
  { to: "/logs", label: "CloudWatch Logs", icon: ScrollText },
  { to: "/data", label: "Data Management", icon: Database },
  { to: "/scheduler", label: "Scheduler", icon: CalendarClock },
  { to: "/status", label: "System Status", icon: Activity },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-h-screen bg-background font-sans text-foreground">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-60 border-r border-sidebar-border bg-sidebar transition-transform lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
          <div className="flex h-7 w-7 items-center justify-center rounded bg-primary text-primary-foreground">
            <Server className="h-4 w-4" />
          </div>
          <span className="text-sm font-semibold">AWS Nightly Reports</span>
          <button className="ml-auto lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu"><X className="h-4 w-4" /></button>
        </div>
        <nav className="space-y-0.5 p-2">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              onClick={() => setOpen(false)}
              activeOptions={{ exact: to === "/" }}
              className="flex items-center gap-3 rounded px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent"
              activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground border-l-2 border-primary" }}
            >
              <Icon className="h-4 w-4" /> {label}
            </Link>
          ))}
        </nav>
        <div className="absolute bottom-0 w-full border-t border-sidebar-border p-4 font-mono text-[11px] text-muted-foreground">
          cluster: nightly-reports-cluster
          <br />
          data: {USE_MOCK ? "mock service" : "REST API"}
        </div>
      </aside>
      {open && <div className="fixed inset-0 z-30 bg-background/70 lg:hidden" onClick={() => setOpen(false)} />}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur">
          <button className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Menu className="h-5 w-5" /></button>
          <span className="text-sm font-semibold lg:hidden">AWS Nightly Reports</span>
          <div className="ml-auto flex items-center gap-2 font-mono text-[11px]">
            <span className="hidden rounded border border-border px-2 py-1 sm:inline">Region: <b className="text-primary">ap-south-2</b></span>
            <span className="rounded border border-info/40 bg-info/10 px-2 py-1 text-info">Development</span>
            {USE_MOCK && <span className="hidden rounded border border-warning/40 px-2 py-1 text-warning md:inline">MOCK</span>}
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
