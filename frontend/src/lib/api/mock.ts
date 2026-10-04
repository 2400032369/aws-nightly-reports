import type { ApiService, InputMeta, LogEvent, LogsResponse, Report, ReportRow, Run, ServiceHealth, TaskStatus } from "./types";

const CLUSTER = "nightly-reports-cluster";
const ACCOUNT = "123456789012";
const REGION = "ap-south-2";
const delay = (ms = 350) => new Promise((r) => setTimeout(r, ms + Math.random() * 250));

let seed = 42;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const hex = (n: number) => Array.from({ length: n }, () => Math.floor(rand() * 16).toString(16)).join("");

export const REPORT_ROWS: ReportRow[] = [
  { product: "Headphones", totalQuantity: 9, totalRevenue: 22500, orderCount: 2 },
  { product: "Keyboard", totalQuantity: 12, totalRevenue: 18000, orderCount: 3 },
  { product: "Laptop", totalQuantity: 6, totalRevenue: 330000, orderCount: 4 },
  { product: "Monitor", totalQuantity: 6, totalRevenue: 72000, orderCount: 3 },
  { product: "Mouse", totalQuantity: 36, totalRevenue: 18000, orderCount: 4 },
  { product: "Webcam", totalQuantity: 5, totalRevenue: 16000, orderCount: 2 },
];

// Phase durations (ms) for live simulated runs
const PHASES: [TaskStatus, number][] = [
  ["PROVISIONING", 3000],
  ["PENDING", 3000],
  ["RUNNING", 9000],
];

interface Stored {
  run: Run;
  live: boolean;
  createdMs: number;
  fail: boolean;
}

const store: Stored[] = [];
let inputMeta: InputMeta = {
  bucket: "nightly-reports-data-apsouth2",
  key: "input/sales.csv",
  sizeBytes: 1184,
  lastModified: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString(),
  rowCount: 18,
  columns: ["order_id", "order_date", "product", "quantity", "unit_price"],
};
let reportModified = Date.now() - 1000 * 60 * 60 * 20;

function makeRun(createdMs: number, trigger: Run["trigger"], fail: boolean, live: boolean): Stored {
  const taskId = hex(32);
  const run: Run = {
    taskId,
    taskArn: `arn:aws:ecs:${REGION}:${ACCOUNT}:task/${CLUSTER}/${taskId}`,
    status: "PROVISIONING",
    trigger,
    createdAt: new Date(createdMs).toISOString(),
    startedAt: null,
    stoppedAt: null,
    durationSec: null,
    exitCode: null,
    stoppedReason: null,
    cpu: "256",
    memory: "512",
    timeline: [{ status: "CREATED", at: new Date(createdMs).toISOString() }],
  };
  return { run, live, createdMs, fail };
}

function resolve(s: Stored): Run {
  const r = s.run;
  const scale = s.live ? 1 : 4 + (s.createdMs % 7);
  const elapsed = Date.now() - s.createdMs;
  let t = 0;
  const timeline: Run["timeline"] = [{ status: "CREATED", at: r.createdAt }];
  let status: TaskStatus = "STOPPED";
  for (const [ph, dur] of PHASES) {
    if (elapsed < t) break;
    timeline.push({ status: ph, at: new Date(s.createdMs + t).toISOString() });
    const d = dur * scale;
    if (elapsed < t + d) {
      status = ph;
      t += d;
      break;
    }
    t += d;
  }
  const stopAt = s.createdMs + PHASES.reduce((a, [, d]) => a + d * scale, 0);
  const runStart = s.createdMs + (3000 + 3000) * scale;
  if (Date.now() >= stopAt) {
    status = "STOPPED";
    timeline.push({ status: "STOPPED", at: new Date(stopAt).toISOString() });
  }
  const stopped = status === "STOPPED";
  return {
    ...r,
    status,
    timeline,
    startedAt: Date.now() >= runStart ? new Date(runStart).toISOString() : null,
    stoppedAt: stopped ? new Date(stopAt).toISOString() : null,
    durationSec: stopped
      ? Math.round((stopAt - s.createdMs) / 1000)
      : Math.round(elapsed / 1000),
    exitCode: stopped ? (s.fail ? 1 : 0) : null,
    stoppedReason: stopped ? (s.fail ? "Essential container in task exited" : "Essential container in task exited") : null,
  };
}

// Seed 14 nights of scheduled history
(function seedHistory() {
  const now = new Date();
  for (let i = 14; i >= 1; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    d.setUTCHours(18, 30, 0, 0); // 00:00 IST
    store.push(makeRun(d.getTime(), "SCHEDULER", i === 9 || i === 4, false));
  }
  const m = new Date(now.getTime() - 1000 * 60 * 60 * 26);
  store.push(makeRun(m.getTime(), "MANUAL", false, false));
  store.sort((a, b) => b.createdMs - a.createdMs);
})();

function logsFor(s: Stored): LogEvent[] {
  const r = resolve(s);
  const base = s.createdMs;
  const runStart = r.startedAt ? new Date(r.startedAt).getTime() : null;
  if (!runStart) return [];
  const span = (r.stoppedAt ? new Date(r.stoppedAt).getTime() : Date.now()) - runStart;
  const lines: [number, LogEvent["level"], string][] = [
    [0, "INFO", "Starting nightly sales report job"],
    [0.05, "INFO", `Region=${REGION} Bucket=${inputMeta.bucket}`],
    [0.12, "INFO", `Downloading s3://${inputMeta.bucket}/${inputMeta.key}`],
    [0.22, "INFO", `Downloaded ${inputMeta.sizeBytes} bytes`],
    [0.3, "INFO", `Loaded DataFrame with ${inputMeta.rowCount} rows, ${inputMeta.columns.length} columns`],
    [0.38, "INFO", `Validating columns: ${inputMeta.columns.join(", ")}`],
    [0.48, "INFO", "Computing revenue = quantity * unit_price"],
    [0.58, "INFO", "Grouping by product: sum(quantity), sum(revenue), count(order_id)"],
  ];
  if (s.fail) {
    lines.push([0.7, "WARN", "Found 2 rows with null unit_price"], [0.85, "ERROR", "ValueError: could not convert string to float: 'N/A'"], [0.95, "ERROR", "Job failed with exit code 1"]);
  } else {
    lines.push(
      [0.68, "INFO", `Aggregated ${REPORT_ROWS.length} products`],
      [0.78, "INFO", `Uploading s3://${inputMeta.bucket}/output/nightly_sales_report.csv`],
      [0.9, "INFO", "Upload complete (412 bytes)"],
      [0.98, "INFO", "Nightly sales report job finished successfully"],
    );
  }
  void base;
  return lines
    .map(([f, level, message]) => ({ timestamp: new Date(runStart + f * span).toISOString(), level, message }))
    .filter((l) => new Date(l.timestamp).getTime() <= Date.now());
}

function find(id: string) {
  const s = store.find((x) => x.run.taskId === id);
  if (!s) throw new Error(`Task ${id} not found`);
  return s;
}

function toCsv(rows: ReportRow[]) {
  return ["product,total_quantity,total_revenue,order_count", ...rows.map((r) => `${r.product},${r.totalQuantity},${r.totalRevenue},${r.orderCount}`)].join("\n") + "\n";
}

export const mockService: ApiService = {
  async startRun() {
    await delay(600);
    if (store.some((s) => resolve(s).status !== "STOPPED")) throw new Error("A task is already running");
    const s = makeRun(Date.now(), "MANUAL", false, true);
    store.unshift(s);
    setTimeout(() => (reportModified = Date.now()), 15500);
    return resolve(s);
  },
  async listRuns() {
    await delay(250);
    return store.map(resolve);
  },
  async getRun(id) {
    await delay(150);
    return resolve(find(id));
  },
  async getRunLogs(id) {
    await delay(250);
    return { taskId: id, logGroup: "/ecs/nightly-sales-report", events: logsFor(find(id)) } satisfies LogsResponse;
  },
  async listReports() {
    await delay();
    const csv = toCsv(REPORT_ROWS);
    return [{ name: "nightly_sales_report.csv", key: "output/nightly_sales_report.csv", bucket: inputMeta.bucket, sizeBytes: csv.length, lastModified: new Date(reportModified).toISOString() }];
  },
  async getReport(name): Promise<Report> {
    const [meta] = await this.listReports();
    if (!meta || name !== meta.name) throw new Error(`Report ${name} not found`);
    return { ...meta, rows: REPORT_ROWS };
  },
  async downloadReport() {
    await delay(200);
    return new Blob([toCsv(REPORT_ROWS)], { type: "text/csv" });
  },
  async uploadData(file, onProgress) {
    for (let p = 0; p <= 100; p += 10) {
      onProgress(p);
      await new Promise((r) => setTimeout(r, 120));
    }
    const text = await file.text();
    const lines = text.trim().split(/\r?\n/);
    inputMeta = { ...inputMeta, sizeBytes: file.size, lastModified: new Date().toISOString(), rowCount: Math.max(0, lines.length - 1), columns: (lines[0] ?? "").split(",").map((c) => c.trim()) };
    return inputMeta;
  },
  async getInput() {
    await delay();
    return inputMeta;
  },
  async getScheduler() {
    await delay();
    const now = new Date();
    const next = new Date(now);
    next.setUTCHours(18, 30, 0, 0);
    if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
    const last = store.find((s) => s.run.trigger === "SCHEDULER");
    return {
      name: "nightly-sales-report-schedule",
      state: "ENABLED",
      expression: "cron(0 0 * * ? *)",
      frequency: "Daily at 00:00",
      timezone: "Asia/Calcutta",
      target: "nightly-sales-report-task",
      cluster: CLUSTER,
      nextRun: next.toISOString(),
      lastRun: last?.run.createdAt ?? null,
    };
  },
  async getHealth(): Promise<ServiceHealth[]> {
    await delay(700);
    const at = new Date().toISOString();
    const l = () => Math.round(20 + Math.random() * 120);
    return [
      { id: "api", name: "Reports API", state: "HEALTHY", latencyMs: l(), detail: "FastAPI · mock mode", checkedAt: at },
      { id: "s3", name: "Amazon S3", state: "HEALTHY", latencyMs: l(), detail: inputMeta.bucket, checkedAt: at },
      { id: "ecs", name: "ECS / Fargate", state: "HEALTHY", latencyMs: l(), detail: `${CLUSTER} · ACTIVE`, checkedAt: at },
      { id: "logs", name: "CloudWatch Logs", state: Math.random() < 0.2 ? "DEGRADED" : "HEALTHY", latencyMs: l() + 80, detail: "/ecs/nightly-sales-report", checkedAt: at },
      { id: "events", name: "EventBridge Scheduler", state: "HEALTHY", latencyMs: l(), detail: "nightly-sales-report-schedule", checkedAt: at },
    ];
  },
};
