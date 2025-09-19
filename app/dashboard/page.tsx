// ┌───────────────────────────────────────────────────────────┐
// │ File: app/dashboard/page.tsx                              │
// └───────────────────────────────────────────────────────────┘
"use client";

import React from "react";
import HmrcObligationsTable, { Obligation } from "@/components/ui/HmrcObligationsTable";
import VatBoxesPreview, { Boxes } from "@/components/ui/VatBoxesPreview";
import HmrcSubmitControls from "@/components/ui/HmrcSubmitControls";

export default function DashboardPage() {
  // if you already store these in context/session, you can hydrate them here:
  const [shopDomain, setShopDomain] = React.useState("");
  const [vrn, setVrn] = React.useState("");

  const [selected, setSelected] = React.useState<Obligation | null>(null);
  const [boxes, setBoxes] = React.useState<Boxes | null>(null);

  return (
    <div className="mx-auto max-w-4xl p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">VAT Dashboard</h1>
        <span className="text-xs text-gray-500">MTD VAT</span>
      </header>

      {/* connection bar */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="block">
          <span className="text-sm font-medium">Shop domain</span>
          <input
            className="mt-1 w-full rounded-xl border px-3 py-2"
            placeholder="example.myshopify.com"
            value={shopDomain}
            onChange={(e) => setShopDomain(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">VAT VRN</span>
          <input
            className="mt-1 w-full rounded-xl border px-3 py-2"
            placeholder="123456789"
            value={vrn}
            onChange={(e) => setVrn(e.target.value)}
          />
        </label>
      </section>

      <HmrcObligationsTable vrn={vrn} selected={selected} onSelect={(o) => { setSelected(o); setBoxes(null); }} />

      <VatBoxesPreview shopDomain={shopDomain} obligation={selected} onLoaded={setBoxes} />

      <HmrcSubmitControls shopDomain={shopDomain} vrn={vrn} obligation={selected} boxes={boxes} />
    </div>
  );
}
