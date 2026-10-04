export type TaskStatus = "PROVISIONING" | "PENDING" | "RUNNING" | "STOPPED";

export interface Run {
  taskId: string;
  taskArn: string;
  status: TaskStatus;
  trigger: "SCHEDULER" | "MANUAL";
  createdAt: string;
  startedAt: string | null;
  stoppedAt: string | null;
  durationSec: number | null;
  exitCode: number | null;
  stoppedReason: string | null;
  cpu: string;
  memory: string;
  timeline: { status: TaskStatus | "CREATED"; at: string }[];
}

export interface LogEvent {
  timestamp: string;
  message: string;
  level: "INFO" | "WARN" | "ERROR";
}

export interface LogsResponse {
  taskId: string;
  logGroup: string;
  events: LogEvent[];
}

export interface ReportRow {
  product: string;
  totalQuantity: number;
  totalRevenue: number;
  orderCount: number;
}

export interface ReportMeta {
  name: string;
  key: string;
  bucket: string;
  sizeBytes: number;
  lastModified: string;
}

export interface Report extends ReportMeta {
  rows: ReportRow[];
}

export interface InputMeta {
  bucket: string;
  key: string;
  sizeBytes: number;
  lastModified: string;
  rowCount: number;
  columns: string[];
}

export interface Scheduler {
  name: string;
  state: "ENABLED" | "DISABLED";
  expression: string;
  frequency: string;
  timezone: string;
  target: string;
  cluster: string;
  nextRun: string | null;
  lastRun: string | null;
}

export type HealthState = "HEALTHY" | "DEGRADED" | "DOWN";
export interface ServiceHealth {
  id: string;
  name: string;
  state: HealthState;
  latencyMs: number;
  detail: string;
  checkedAt: string;
}

export interface ApiService {
  startRun(): Promise<Run>;
  listRuns(): Promise<Run[]>;
  getRun(taskId: string): Promise<Run>;
  getRunLogs(taskId: string): Promise<LogsResponse>;
  listReports(): Promise<ReportMeta[]>;
  getReport(name: string): Promise<Report>;
  downloadReport(name: string): Promise<Blob>;
  uploadData(file: File, onProgress: (pct: number) => void): Promise<InputMeta>;
  getInput(): Promise<InputMeta>;
  getScheduler(): Promise<Scheduler>;
  getHealth(): Promise<ServiceHealth[]>;
}
