"use client";
import { useEffect, useState } from "react";
import StatusChip from "@/components/StatusChip";

type Res =
  | { found: true; status: string; plan?: string | null; current_period_end?: string | null }
  | { found: false }
  | { error: string };

export default function SubscriptionStatus() {
  const [res, setRes] = useState<Res | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/subscription-status", { credentials: "include" });
        setRes(await r.json());
      } catch {
        setRes({ error: "Failed to load subscription" });
      }
    })();
  }, []);

  if (!res) return <div className="text-sm text-zinc-500">Loading…</div>;
  if ("error" in res) return <div className="text-sm text-rose-600">{res.error}</div>;
  if (!res.found) return <div className="text-sm text-zinc-600">No subscription found.</div>;

  const isTrial = res.status?.toLowerCase() === "trialing";
  const daysLeft =
    isTrial && res.current_period_end
      ? Math.max(0, Math.ceil((new Date(res.current_period_end).getTime() - Date.now()) / 86400000))
      : null;

  return (
    <div className="text-sm text-zinc-800 flex items-center gap-2">
      Status: <StatusChip value={res.status} />
      {res.plan && <>· Plan: <b className="capitalize">{res.plan}</b></>}
      {isTrial && typeof daysLeft === "number" && <>· Trial: {daysLeft} day{daysLeft === 1 ? "" : "s"} left</>}
      {!isTrial && res.current_period_end && <>· Renews: {new Date(res.current_period_end).toLocaleDateString()}</>}
    </div>
  );
}
