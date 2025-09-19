"use client";
import React from "react";
import type { Obligation } from "./HmrcObligationsTable";

export type Boxes = {
  vatDueSales: string;
  vatDueAcquisitions: string;
  totalVatDue: string;
  vatReclaimedCurrPeriod: string;
  netVatDue: string;
  totalValueSalesExVAT: number;
  totalValuePurchasesExVAT: number;
  totalValueGoodsSuppliedExVAT: number;
  totalAcquisitionsExVAT: number;
};

type Props = {
  shopDomain: string;
  obligation: Obligation | null;
  onLoaded?: (b: Boxes | null) => void;
};

export default function VatBoxesPreview({ shopDomain, obligation, onLoaded }: Props) {
  const [boxes, setBoxes] = React.useState<Boxes | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  async function load() {
    if (!shopDomain || !obligation) return;
    setLoading(true);
    setErr(null);
    try {
      const u = new URL("/api/vat/boxes", window.location.origin);
      u.searchParams.set("shopDomain", shopDomain.trim());
      u.searchParams.set("from", obligation.start);
      u.searchParams.set("to", obligation.end);
     const res = await fetch(u.toString());
const json = await res.json();
if (!json?.ok) throw new Error(json?.error || `HTTP ${res.status}`);

setBoxes(json.data?.boxes as Boxes);
onLoaded?.(json.data?.boxes as Boxes);

    } catch (e: any) {
      setErr(e.message || String(e));
      setBoxes(null);
      onLoaded?.(null);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    setBoxes(null);
    setErr(null);
    if (shopDomain && obligation) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopDomain, obligation?.periodKey]);

  return (
    <section className="rounded-xl border p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-medium">Boxes (preview)</h3>
        <button
          onClick={load}
          className="rounded-xl px-3 py-1 border hover:bg-gray-50 disabled:opacity-50"
          disabled={!shopDomain || !obligation || loading}
        >
          {loading ? "Calculating…" : "Recalculate"}
        </button>
      </div>

      {err && (
        <div className="mb-3 rounded-md border border-red-300 bg-red-50 p-2 text-sm text-red-700">
          {err}
        </div>
      )}

      {boxes ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-sm">
          {Object.entries(boxes).map(([k, v]) => (
            <div key={k} className="rounded-lg border px-3 py-2">
              <div className="text-gray-500">{k}</div>
              <div className="font-mono">{String(v)}</div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-500">Select a period to preview boxes.</p>
      )}
    </section>
  );
}
