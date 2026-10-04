import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, FileUp, XCircle } from "lucide-react";
import { api } from "@/lib/api";
import { ErrorState, Loading, Panel, PageHeader, fmtBytes, fmtTime } from "@/components/ops/ui";
import { cn } from "@/lib/utils";

const EXPECTED = ["order_id", "order_date", "product", "quantity", "unit_price"];

export const Route = createFileRoute("/data")({
  head: () => ({
    meta: [
      { title: "Data Management — AWS Nightly Reports" },
      { name: "description", content: "Inspect and replace the sales.csv input file with schema validation." },
      { property: "og:title", content: "Data Management — AWS Nightly Reports" },
      { property: "og:description", content: "Upload and validate the sales.csv input." },
    ],
  }),
  component: DataPage,
});

interface Validation { ok: boolean; errors: string[]; rows: number; header: string[]; preview: string[][] }

async function validate(file: File): Promise<Validation> {
  const errors: string[] = [];
  if (!file.name.toLowerCase().endsWith(".csv")) errors.push("File must have a .csv extension");
  if (file.size > 10 * 1024 * 1024) errors.push("File exceeds 10 MB");
  const text = await file.text();
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  const header = (lines[0] ?? "").split(",").map((h) => h.trim());
  const missing = EXPECTED.filter((c) => !header.includes(c));
  if (missing.length) errors.push(`Missing columns: ${missing.join(", ")}`);
  if (lines.length < 2) errors.push("No data rows found");
  const qi = header.indexOf("quantity"), pi = header.indexOf("unit_price");
  lines.slice(1).forEach((l, i) => {
    const c = l.split(",");
    if (c.length !== header.length) errors.push(`Row ${i + 2}: expected ${header.length} fields, got ${c.length}`);
    else if ((qi >= 0 && isNaN(Number(c[qi]))) || (pi >= 0 && isNaN(Number(c[pi])))) errors.push(`Row ${i + 2}: quantity/unit_price must be numeric`);
  });
  return { ok: errors.length === 0, errors: errors.slice(0, 8), rows: Math.max(0, lines.length - 1), header, preview: lines.slice(1, 6).map((l) => l.split(",")) };
}

function DataPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["input"], queryFn: api.getInput });
  const [file, setFile] = useState<File | null>(null);
  const [v, setV] = useState<Validation | null>(null);
  const [drag, setDrag] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const pick = async (f?: File) => {
    if (!f) return;
    setFile(f);
    setProgress(null);
    setV(await validate(f));
  };
  const upload = async () => {
    if (!file) return;
    try {
      setProgress(0);
      await api.uploadData(file, setProgress);
      toast.success("sales.csv uploaded to S3");
      qc.invalidateQueries({ queryKey: ["input"] });
      setFile(null); setV(null); setProgress(null);
    } catch (e) {
      setProgress(null);
      toast.error(e instanceof Error ? e.message : "Upload failed");
    }
  };

  return (
    <>
      <PageHeader title="Data Management" desc="Input dataset consumed by the nightly task" />
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="sales.csv metadata">
          {q.isLoading ? <Loading /> : q.error || !q.data ? <ErrorState error={q.error} /> : (
            <dl className="space-y-2 text-sm">
              {[["Bucket", q.data.bucket], ["Key", q.data.key], ["Size", fmtBytes(q.data.sizeBytes)], ["Rows", q.data.rowCount], ["Modified", fmtTime(q.data.lastModified)]].map(([k, val]) => (
                <div key={k as string} className="flex justify-between gap-3 border-b border-border pb-2"><dt className="text-muted-foreground">{k}</dt><dd className="break-all text-right font-mono text-xs">{val}</dd></div>
              ))}
              <div><dt className="mb-2 text-muted-foreground">Expected columns</dt><dd className="flex flex-wrap gap-1">{EXPECTED.map((c) => <span key={c} className={cn("rounded border px-2 py-0.5 font-mono text-[11px]", q.data!.columns.includes(c) ? "border-success/40 text-success" : "border-destructive/40 text-destructive")}>{c}</span>)}</dd></div>
            </dl>
          )}
        </Panel>
        <Panel title="Upload new sales.csv" className="lg:col-span-2">
          <div
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files[0]); }}
            onClick={() => input.current?.click()}
            className={cn("flex cursor-pointer flex-col items-center justify-center rounded border-2 border-dashed p-10 text-center transition-colors", drag ? "border-primary bg-primary/10" : "border-border hover:border-primary/60")}
          >
            <FileUp className="h-8 w-8 text-primary" />
            <p className="mt-2 text-sm">Drag & drop a CSV here, or <span className="text-primary">browse</span></p>
            <p className="mt-1 font-mono text-[11px] text-muted-foreground">{EXPECTED.join(", ")}</p>
            <input ref={input} type="file" accept=".csv,text/csv" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
          </div>
          {file && v && (
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-mono">{file.name} · {fmtBytes(file.size)} · {v.rows} rows</span>
                {v.ok ? <span className="flex items-center gap-1 text-success"><CheckCircle2 className="h-4 w-4" /> Valid</span> : <span className="flex items-center gap-1 text-destructive"><XCircle className="h-4 w-4" /> Invalid</span>}
              </div>
              {!v.ok && <ul className="list-inside list-disc rounded border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">{v.errors.map((e) => <li key={e}>{e}</li>)}</ul>}
              {v.ok && (
                <div className="overflow-x-auto rounded border border-border">
                  <table className="w-full font-mono text-xs"><thead className="bg-secondary"><tr>{v.header.map((h) => <th key={h} className="px-2 py-1 text-left">{h}</th>)}</tr></thead>
                    <tbody>{v.preview.map((r, i) => <tr key={i} className="border-t border-border">{r.map((c, j) => <td key={j} className="px-2 py-1">{c}</td>)}</tr>)}</tbody></table>
                </div>
              )}
              {progress != null && <div className="h-2 overflow-hidden rounded bg-muted"><div className="h-2 bg-primary transition-all" style={{ width: `${progress}%` }} /></div>}
              <div className="flex gap-2">
                <button disabled={!v.ok || progress != null} onClick={upload} className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">{progress != null ? `Uploading ${progress}%` : "Upload to S3"}</button>
                <button disabled={progress != null} onClick={() => { setFile(null); setV(null); }} className="rounded border border-border px-4 py-2 text-sm">Cancel</button>
              </div>
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
