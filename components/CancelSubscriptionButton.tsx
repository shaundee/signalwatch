"use client";
import { useState } from "react";
import { useToast } from "@/components/ui/ToastProvider";

export default function CancelSubscriptionButton() {
  const { success, error: toastError, info } = useToast();
  const [loading, setLoading] = useState(false);

  async function cancel() {
    if (!confirm("Cancel at period end? You can always resubscribe later.")) return;
    try {
      setLoading(true);
      const res = await fetch("/api/cancel-subscription", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Could not cancel");
      if (json.already_set) info("Cancellation already scheduled at period end.");
      else success("Cancellation scheduled. You’ll keep access until the period ends.");
    } catch (e: any) {
      toastError(e?.message || "Cancel failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={cancel}
      disabled={loading}
      className="px-4 py-2 rounded-2xl border border-zinc-300 hover:bg-zinc-50 disabled:opacity-50"
    >
      {loading ? "Scheduling…" : "Cancel subscription"}
    </button>
  );
}
