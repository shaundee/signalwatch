"use client";

import { useState } from "react";

export default function TagFiledOrdersButton({
  shopDomain,
  vrn,
  periodKey,
}: {
  shopDomain: string;
  vrn: string;
  periodKey: string;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onClick() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/shopify/tag-filed-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shopDomain, vrn, periodKey }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg(json?.error || `Failed (${res.status})`);
    setMsg(`Tagged ${json?.tagged ?? 0} orders with “${json?.tag}”.`);
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onClick}
        disabled={busy}
        className={`px-3 py-1.5 rounded text-white ${
          busy ? "bg-gray-400" : "bg-black hover:opacity-90"
        }`}
        title="Add a Shopify tag to all orders in this filed period"
      >
        {busy ? "Tagging…" : "Tag orders for this filing"}
      </button>
      {msg && <span className="text-xs text-zinc-700">{msg}</span>}
    </div>
  );
}
