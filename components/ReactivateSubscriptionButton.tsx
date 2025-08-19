"use client";
import { useState } from "react";
import { useToast } from "@/components/ui/ToastProvider";

export default function ReactivateSubscriptionButton() {
  const { success, error: toastError, info } = useToast();
  const [loading, setLoading] = useState(false);

  async function reactivate() {
    try {
      setLoading(true);
      const res = await fetch("/api/reactivate-subscription", { method: "POST" });
      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("application/json")) {
        const text = await res.text();
        throw new Error(`Unexpected response (${res.status}).`);
      }
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Could not reactivate");

      if (json.already_active) info("No cancellation scheduled — already active.");
      else success("Subscription reactivated. Billing will continue next cycle.");
    } catch (e: any) {
      toastError(e?.message || "Reactivate failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={reactivate}
      disabled={loading}
      className="px-4 py-2 rounded-2xl border border-zinc-300 hover:bg-zinc-50 disabled:opacity-50"
    >
      {loading ? "Reactivating…" : "Reactivate subscription"}
    </button>
  );
}

