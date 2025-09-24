"use client";
import { useState } from "react";
import { useToast } from "@/components/ui/ToastProvider";

export default function SubscribeButtons({
  variant,
  trialDays,
}: { variant: "monthly" | "annual"; trialDays?: number }) {
  const [loading, setLoading] = useState(false);
  const { error } = useToast();

  async function start() {
    try {
      setLoading(true);
      const res = await fetch("/api/checkout-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: variant }),
      });
      const json = await res.json();

      if (res.status === 409 && json.portal_url) {
        window.location.href = json.portal_url; // manage billing instead
        return;
      }
      if (!res.ok || !json.url) throw new Error(json?.error || "Could not start checkout");

      window.location.href = json.url; // Stripe Checkout
    } catch (e: any) {
      error(e?.message || "Checkout failed");
    } finally {
      setLoading(false);
    }
  }

  const label =
    trialDays && variant === "monthly" && trialDays > 0
      ? `Start ${trialDays}-day trial`
      : variant === "monthly"
      ? "Start monthly"
      : "Start annual";

  return (
    <button onClick={start} disabled={loading} className="btn mt-4">
      {loading ? "Redirecting…" : label}
    </button>
  );
}
