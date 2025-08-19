"use client";
import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/ui/ToastProvider";

type Status =
  | { found: true; status: string; plan?: string | null }
  | { found: false }
  | { error: string };

export default function ChangePlanButtons() {
  const { success, error: toastError, info } = useToast();
  const [sub, setSub] = useState<Status | null>(null);
  const [busy, setBusy] = useState<"monthly" | "annual" | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/subscription-status", { credentials: "include" });
        const j = await r.json();
        setSub(j);
      } catch {
        setSub({ error: "Failed to load status" });
      }
    })();
  }, []);

  const currentPlan = useMemo<"monthly" | "annual" | null>(() => {
    if (sub && "found" in sub && sub.found) {
      const p = sub.plan ?? null; // 'month' | 'year'
      if (p === "month") return "monthly";
      if (p === "year") return "annual";
    }
    return null;
  }, [sub]);

  const disabled = !(sub && "found" in sub && sub.found && ["active", "trialing", "past_due"].includes(sub.status));

  async function change(plan: "monthly" | "annual") {
    try {
      setBusy(plan);
      info(`Switching to ${plan}…`);
      const res = await fetch("/api/change-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Could not change plan");

      if (json.unchanged) info(`You’re already on the ${plan} plan`);
      else success(`Plan updated to ${plan}. Proration applied.`);

      const r2 = await fetch("/api/subscription-status", { credentials: "include" });
      setSub(await r2.json());
    } catch (e: any) {
      toastError(e?.message || "Plan change failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        className="px-4 py-2 rounded-2xl border border-zinc-300 hover:bg-zinc-50 disabled:opacity-50"
        onClick={() => change("monthly")}
        disabled={disabled || busy !== null || currentPlan === "monthly"}
        title={currentPlan === "monthly" ? "Already on monthly" : "Switch to monthly"}
      >
        {busy === "monthly" ? "Switching…" : "Switch to monthly"}
      </button>

      <button
        className="px-4 py-2 rounded-2xl border border-zinc-300 hover:bg-zinc-50 disabled:opacity-50"
        onClick={() => change("annual")}
        disabled={disabled || busy !== null || currentPlan === "annual"}
        title={currentPlan === "annual" ? "Already on annual" : "Switch to annual"}
      >
        {busy === "annual" ? "Switching…" : "Switch to annual"}
      </button>
    </div>
  );
}
