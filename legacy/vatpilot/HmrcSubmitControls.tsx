"use client";
import React from "react";
import type { Obligation } from "./HmrcObligationsTable";
import type { Boxes } from "./VatBoxesPreview";

type Props = {
  shopDomain: string;
  vrn: string;
  obligation: Obligation | null;
  boxes: Boxes | null;
};

export default function HmrcSubmitControls({ shopDomain, vrn, obligation, boxes }: Props) {
  const [finalised, setFinalised] = React.useState(true);
  const [dryRun, setDryRun] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [receipt, setReceipt] = React.useState<any>(null);

  async function submit() {
    if (!shopDomain || !vrn || !obligation) return;
    setLoading(true);
    setErr(null);
    setReceipt(null);
    try {
      const u = new URL("/api/vat/submit", window.location.origin);
      u.searchParams.set("shopDomain", shopDomain.trim());
      u.searchParams.set("vrn", vrn.trim());
      u.searchParams.set("periodKey", obligation.periodKey);
      u.searchParams.set("from", obligation.start);
      u.searchParams.set("to", obligation.end);
      if (dryRun) u.searchParams.set("dryRun", "true");
      if (!finalised) u.searchParams.set("finalised", "false");

     const res = await fetch(u.toString(), { method: "POST" });
const json = await res.json();
if (!json?.ok) throw new Error(json?.error || `HTTP ${res.status}`);

// submit returns { data: { vrn, periodKey, from, to, boxes, receipt, diagnostics? } }
setReceipt(json.data?.receipt ?? json.data);

    } catch (e: any) {
    setErr(e?.message || "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-xl border p-4">
      <h3 className="font-medium mb-3">Submit</h3>

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={finalised} onChange={(e) => setFinalised(e.target.checked)} />
          Finalised
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
          Dry run (don’t submit)
        </label>

        <button
          onClick={submit}
          className="ml-auto rounded-xl px-4 py-2 border hover:bg-gray-50 disabled:opacity-50"
          disabled={!shopDomain || !vrn || !obligation || loading}
        >
          {loading ? "Submitting…" : dryRun ? "Calculate only" : "Submit to HMRC"}
        </button>
      </div>

      {err && (
        <div className="mt-3 rounded-md border border-red-300 bg-red-50 p-2 text-sm text-red-700">
          {err}
        </div>
      )}

      {receipt && (
        <div className="mt-3">
          <div className="text-sm text-gray-600 mb-1">Receipt</div>
          <pre className="text-xs bg-gray-50 rounded-lg p-3 overflow-auto">
            {JSON.stringify(receipt, null, 2)}
          </pre>
        </div>
      )}
    </section>
  );
}
