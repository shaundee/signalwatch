"use client";
import { useState } from "react";

export default function ScanPage() {
  const [url, setUrl] = useState("https://example.com");
  const [report, setReport] = useState<string | null>(null);
  const [scanId, setScanId] = useState<string | null>(null);

  async function start() {
    setReport(null);
    const res = await fetch("/api/scan/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ domain: url }),
    }).then(r => r.json());
    setScanId(res.scanId);
    await fetch("/api/scan/run", { method: "POST" });
    setReport(res.reportUrl);
  }

  return (
    <main className="max-w-xl mx-auto p-6 space-y-4">
        
      <h1 className="text-2xl font-semibold">Run an audit</h1>
      <input className="border rounded px-3 py-2 w-full" value={url} onChange={e => setUrl(e.target.value)} />
      <button onClick={start} className="rounded-2xl border px-4 py-2">Start scan</button>
      {report && <p className="mt-4">Report: <a className="underline" href={report} target="_blank">{scanId}</a></p>}
      
      
    </main>
  );
}
