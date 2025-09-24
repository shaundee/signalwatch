"use client";

import { useState } from "react";

export function ReportActions({ scanId }: { scanId: string }) {
  const [busy, setBusy] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(location.href);
      // optional: show a toast/snackbar
    } catch {
      // fallback if clipboard blocked
      prompt("Copy link:", location.href);
    }
  }

  async function rescan() {
    if (busy) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/scan/rescan?scanId=${encodeURIComponent(scanId)}`, { method: "POST" });
      const j = await r.json();
      if (j?.reportUrl) {
        window.location.href = j.reportUrl; // go to the new report
      } else {
        throw new Error(j?.error || "Rescan failed");
      }
    } catch (err) {
      console.error(err);
      alert("Rescan failed. Check server logs.");
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <a
        className="text-xs underline"
        href={`/api/report/pdf?scanId=${encodeURIComponent(scanId)}`}
        target="_blank"
        rel="noreferrer"
      >
        Download PDF
      </a>

      <button onClick={copyLink} className="text-xs underline">
        Copy share link
      </button>

      <button
        onClick={rescan}
        disabled={busy}
        className="text-xs underline disabled:opacity-50 disabled:cursor-not-allowed"
        aria-busy={busy}
      >
        {busy ? "Rescanning…" : "Rescan"}
      </button>
    </div>
  );
}
