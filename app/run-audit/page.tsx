"use client";

import { useEffect, useState } from "react";

type StartResp =
  | { scanId: string; reportUrl?: string; report_id?: string }
  | { scanId?: string; error: string; details?: any };

export default function RunAuditPage() {
  const [url, setUrl] = useState("");
  const [starting, setStarting] = useState(false);
  const [scanId, setScanId] = useState<string | null>(null);
  const [reportUrl, setReportUrl] = useState<string | null>(null);
  const [queuedCount, setQueuedCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function startScan(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStarting(true);
    setScanId(null);
    setReportUrl(null);

    try {
      const res = await fetch("/api/scan/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ domain: url.trim() })
      });
      const json: StartResp = await res.json();

      if (!res.ok || "error" in json) {
        setError((json as any).error || "Failed to start scan");
      } else {
        setScanId(json.scanId);
        const ru =
          (json as any).reportUrl ||
          ((json as any).report_id ? `/r/${(json as any).report_id}` : null);
        if (ru) setReportUrl(ru);
      }
    } catch (err: any) {
      setError(err?.message || "Network error");
    } finally {
      setStarting(false);
    }
  }

  useEffect(() => {
    let timer: any;
    async function poll() {
      try {
        const res = await fetch("/api/scan/peek", { cache: "no-store" });
        const j = await res.json();
        setQueuedCount(typeof j?.queuedCount === "number" ? j.queuedCount : null);
      } catch {
        // ignore
      } finally {
        timer = setTimeout(poll, 5000);
      }
    }
    poll();
    return () => clearTimeout(timer);
  }, []);
const [botTrap, setBotTrap] = useState("");
if (botTrap) { setError("Form validation failed."); return; }

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-2xl font-semibold mb-3">Run an audit</h1>
      <p className="text-sm opacity-80 mb-6">
        Paste a site URL. We’ll queue a scan and link you to the report when it’s ready.
      </p>

      <form onSubmit={startScan} className="flex gap-2">
        <input
        type="text"   
        name="company"
          required
          placeholder="https://example.com"
         value={botTrap}
          onChange={(e)=>setBotTrap(e.target.value)}
          className="hidden"
          autoComplete="off"
        />
        <button
          type="submit"
          disabled={starting || !url}
          className="rounded-xl px-5 py-3 border font-medium disabled:opacity-50"
        >
          {starting ? "Starting…" : "Run audit"}
        </button>
      </form>

      {error && <div className="mt-4 text-red-600 text-sm">{error}</div>}

      {(scanId || reportUrl) && (
        <div className="mt-6 rounded-xl border p-4">
          <div className="text-sm opacity-70">Scan started</div>
          <div className="text-sm">Scan ID: <code>{scanId}</code></div>
          {reportUrl ? (
            <div className="mt-2">
              <a className="underline" href={reportUrl}>Open report</a>
              <span className="ml-2 opacity-70 text-sm">(may still be processing)</span>
            </div>
          ) : (
            <div className="mt-2 text-sm opacity-70">
              We’ll link the report here as soon as your API returns it.
            </div>
          )}
        </div>
      )}

      <div className="mt-8 text-sm opacity-70">
        Queue: {queuedCount ?? "—"}
        <span className="ml-2 opacity-60">(updates every ~5s)</span>
      </div>
    </div>
  );
}
