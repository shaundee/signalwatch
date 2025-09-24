// ┌───────────────────────────────────────────────────────────┐
// │ File: app/dev/receipts/page.tsx                           │
// └───────────────────────────────────────────────────────────┘
"use client";

import React from "react";

type JsonValue = any;

export default function ReceiptsDevPage() {
  const [vrn, setVrn] = React.useState("");
  const [shopDomain, setShopDomain] = React.useState("");
  const [periodKey, setPeriodKey] = React.useState("");
  const [payload, setPayload] = React.useState('{"note":"test payload"}');
  const [receipt, setReceipt] = React.useState('{"note":"test receipt"}');

  const [result, setResult] = React.useState<JsonValue>(null);
  const [loading, setLoading] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function doGet() {
    setLoading("GET");
    setError(null);
    setResult(null);
    try {
      const params = new URLSearchParams();
      if (vrn) params.set("vrn", vrn.trim());
      if (shopDomain) params.set("shopDomain", shopDomain.trim());
      if (periodKey) params.set("periodKey", periodKey.trim());
      const res = await fetch(`/api/hmrc/receipts?${params.toString()}`);
      const json = await res.json();
      setResult(json);
      if (!res.ok) setError(json?.error || `HTTP ${res.status}`);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(null);
    }
  }

  async function doPost() {
    setLoading("POST");
    setError(null);
    setResult(null);
    try {
      const body = {
        vrn: vrn.trim(),
        shopDomain: shopDomain.trim() || undefined,
        periodKey: periodKey.trim(),
        payload: safeParse(payload) ?? {},
        receipt: safeParse(receipt) ?? {},
      };
      const res = await fetch(`/api/hmrc/receipts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      setResult(json);
      if (!res.ok) setError(json?.error || `HTTP ${res.status}`);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(null);
    }
  }

  async function doDeleteOne() {
    setLoading("DELETE one");
    setError(null);
    setResult(null);
    try {
      const params = new URLSearchParams();
      params.set("vrn", vrn.trim());
      params.set("periodKey", periodKey.trim());
      if (shopDomain) params.set("shopDomain", shopDomain.trim());
      const res = await fetch(`/api/hmrc/receipts?${params.toString()}`, {
        method: "DELETE",
      });
      const json = await res.json();
      setResult(json);
      if (!res.ok) setError(json?.error || `HTTP ${res.status}`);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(null);
    }
  }

  async function doDeleteAll() {
    setLoading("DELETE all");
    setError(null);
    setResult(null);
    try {
      const params = new URLSearchParams();
      params.set("vrn", vrn.trim());
      params.set("all", "true");
      if (shopDomain) params.set("shopDomain", shopDomain.trim());
      const res = await fetch(`/api/hmrc/receipts?${params.toString()}`, {
        method: "DELETE",
      });
      const json = await res.json();
      setResult(json);
      if (!res.ok) setError(json?.error || `HTTP ${res.status}`);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">HMRC Receipts — Dev Console</h1>
        <p className="text-sm text-gray-500">
          Quick tester for <code>/api/hmrc/receipts</code> (GET / POST / DELETE).
        </p>
      </header>

      <section className="grid grid-cols-1 gap-4">
        <div className="grid grid-cols-1 gap-3">
          <label className="block">
            <span className="text-sm font-medium">VRN *</span>
            <input
              className="mt-1 w-full rounded-xl border px-3 py-2"
              placeholder="123456789"
              value={vrn}
              onChange={(e) => setVrn(e.target.value)}
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium">Shop domain (optional)</span>
            <input
              className="mt-1 w-full rounded-xl border px-3 py-2"
              placeholder="vatpilot.myshopify.com"
              value={shopDomain}
              onChange={(e) => setShopDomain(e.target.value)}
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium">Period key (optional for GET / required for POST & delete-one)</span>
            <input
              className="mt-1 w-full rounded-xl border px-3 py-2"
              placeholder="24A1"
              value={periodKey}
              onChange={(e) => setPeriodKey(e.target.value)}
            />
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-sm font-medium">Payload (JSON)</span>
            <textarea
              className="mt-1 w-full rounded-xl border px-3 py-2 font-mono text-sm h-32"
              value={payload}
              onChange={(e) => setPayload(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Receipt (JSON)</span>
            <textarea
              className="mt-1 w-full rounded-xl border px-3 py-2 font-mono text-sm h-32"
              value={receipt}
              onChange={(e) => setReceipt(e.target.value)}
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={doGet}
            className="rounded-xl px-4 py-2 border hover:bg-gray-50 disabled:opacity-50"
            disabled={!vrn || !!loading}
          >
            {loading === "GET" ? "Loading..." : "GET (fetch)"}
          </button>
          <button
            onClick={doPost}
            className="rounded-xl px-4 py-2 border hover:bg-gray-50 disabled:opacity-50"
            disabled={!vrn || !periodKey || !!loading}
          >
            {loading === "POST" ? "Posting..." : "POST (upsert)"}
          </button>
          <button
            onClick={doDeleteOne}
            className="rounded-xl px-4 py-2 border hover:bg-gray-50 disabled:opacity-50"
            disabled={!vrn || !periodKey || !!loading}
          >
            {loading === "DELETE one" ? "Deleting..." : "DELETE (one)"}
          </button>
          <button
            onClick={doDeleteAll}
            className="rounded-xl px-4 py-2 border hover:bg-gray-50 disabled:opacity-50"
            disabled={!vrn || !!loading}
          >
            {loading === "DELETE all" ? "Purging..." : "DELETE (all for VRN)"}
          </button>
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          <strong>Error:</strong> {error}
        </div>
      )}

      <section>
        <h2 className="text-lg font-medium mb-2">Result</h2>
        <pre className="w-full overflow-auto rounded-xl border p-3 text-sm bg-gray-50">
          {pretty(result)}
        </pre>
      </section>
    </div>
  );
}

function pretty(v: unknown) {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v ?? "");
  }
}

function safeParse(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
