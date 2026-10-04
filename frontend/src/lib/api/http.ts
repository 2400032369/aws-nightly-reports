import type { ApiService, InputMeta } from "./types";

const BASE = (import.meta.env["VITE_API_BASE_URL"] as string | undefined) ?? "http://localhost:8000";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init);
  if (!res.ok) throw new Error(`Request failed [${res.status}]: ${await res.text()}`);
  return res.json() as Promise<T>;
}

/** FastAPI REST implementation — same contract as the mock service. */
export const httpService: ApiService = {
  startRun: () => req("/api/runs", { method: "POST" }),
  listRuns: () => req("/api/runs"),
  getRun: (id) => req(`/api/runs/${encodeURIComponent(id)}`),
  getRunLogs: (id) => req(`/api/runs/${encodeURIComponent(id)}/logs`),
  listReports: () => req("/api/reports"),
  getReport: (n) => req(`/api/reports/${encodeURIComponent(n)}`),
  async downloadReport(n) {
    const res = await fetch(`${BASE}/api/reports/${encodeURIComponent(n)}/download`);
    if (!res.ok) throw new Error(`Download failed [${res.status}]`);
    return res.blob();
  },
  uploadData(file, onProgress) {
    return new Promise<InputMeta>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const fd = new FormData();
      fd.append("file", file);
      xhr.open("POST", `${BASE}/api/data/upload`);
      xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
      xhr.onload = () =>
        xhr.status < 300 ? resolve(JSON.parse(xhr.responseText)) : reject(new Error(xhr.responseText));
      xhr.onerror = () => reject(new Error("Network error"));
      xhr.send(fd);
    });
  },
  getInput: () => req("/api/data/input"),
  getScheduler: () => req("/api/scheduler"),
  getHealth: () => req("/api/health/aws"),
};
