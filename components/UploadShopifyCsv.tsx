"use client";
import { useState } from "react";

export default function UploadShopifyCsv() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setResult(null);
    const fd = new FormData();
    fd.append("file", file);
    const r = await fetch("/api/import/shopify", { method: "POST", body: fd });
    const j = await r.json().catch(() => ({}));
    if (r.ok) setResult(`Imported ${j.imported} orders`);
    else setResult(j.error || "Failed");
    setLoading(false);
  }

  return (
    <div className="rounded-lg border p-4">
      <h3 className="font-semibold">Import Shopify orders (CSV)</h3>
      <p className="mt-1 text-sm text-zinc-600">
        Export from Shopify → Orders CSV, then upload here.
      </p>
      <input
        type="file"
        accept=".csv,text/csv"
        onChange={onChange}
        className="mt-3 block w-full text-sm"
      />
      {loading && <p className="mt-2 text-sm text-zinc-500">Uploading…</p>}
      {result && <p className="mt-2 text-sm">{result}</p>}
    </div>
  );
}
