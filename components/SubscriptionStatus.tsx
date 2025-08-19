"use client";
import { useEffect, useState } from "react";

type StatusRes = {
  found?: boolean;
  status?: string;
  plan?: string | null;
  price_id?: string | null;
  current_period_end?: string | null;
  stripe_customer_id?: string;
  stripe_subscription_id?: string | null;
  updated_at?: string;
  error?: string;
};

export default function SubscriptionStatus() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<StatusRes | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/subscription-status", { credentials: "include" });
        const text = await res.text();
        try {
          const json = JSON.parse(text);
          setData(json);
        } catch {
          setErr(`Bad JSON (status ${res.status}): ${text.slice(0, 200)}`);
        }
      } catch (e: any) {
        setErr(e?.message || "Request failed");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="card">Loading subscription…</div>;
  if (err) return <div className="card">Error: {err}</div>;
  if (!data) return <div className="card">No data.</div>;
  if (data.error) {
    if (data.error === "Not authenticated") return <div className="card">Please sign in first.</div>;
    return <div className="card">Error: {data.error}</div>;
  }
  if (!data.found) return <div className="card">No subscription found.</div>;

  const dt = data.current_period_end ? new Date(data.current_period_end) : null;
  return (
    <div className="card">
      <h2 className="text-xl font-semibold">Subscription</h2>
      <p className="mt-2">
        Status: <b>{data.status}</b>{data.plan ? ` (${data.plan})` : ""}
      </p>
      {dt && <p>Current period ends: {dt.toLocaleString()}</p>}
      <p className="text-sm text-gray-600 mt-2">Customer: {data.stripe_customer_id}</p>
      {data.stripe_subscription_id && (
        <p className="text-sm text-gray-600">Subscription: {data.stripe_subscription_id}</p>
      )}
    </div>
  );
}
