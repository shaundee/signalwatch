"use client";

import { useEffect, useMemo, useState } from "react";
import ManageBillingButton from "@/components/ManageBillingButton";
import { useToast } from "@/components/ui/ToastProvider";

function Check({ label }: { label: string }): JSX.Element {
  return (
    <li className="flex items-start gap-2 text-sm text-zinc-700">
      <span className="mt-1 inline-block h-4 w-4 rounded-full bg-emerald-500/15 ring-1 ring-emerald-500/40" />
      <span>{label}</span>
    </li>
  );
}

export default function PricingPage() {
  const { success, error, info } = useToast();   // ← here
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<any>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/subscription-status", { credentials: "include" });
        const json = await res.json();
        setStatus(json);
        if (json?.found) info("You already have a subscription.");
      } catch {
        // silent
      }
    })();
  }, [info]);

  const isSubscribed = useMemo(() => {
    if (!status || status.error) return false;
    if (status.found) {
      return ["active", "trialing", "past_due", "incomplete"].includes(status.status);
    }
    return false;
  }, [status]);

  async function startCheckout(plan: "monthly" | "annual") {
    try {
      setLoading(true);
      info("Redirecting to Stripe Checkout…");
      const res = await fetch("/api/checkout-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Checkout failed");
      }
      const { url } = await res.json();
      window.location.href = url;
    } catch (e: any) {
      error(e?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const price = billing === "monthly" ? "£29 / mo" : "£290 / yr";
  const subcopy = billing === "monthly" ? "billed monthly" : "billed yearly";

  return (
    <div className="min-h-[100svh] bg-gradient-to-b from-white via-zinc-50 to-zinc-100">
      {/* Hero */}
      <header className="mx-auto max-w-5xl px-4 pt-16 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white/60 px-3 py-1 text-xs text-zinc-700 backdrop-blur">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
          Payments live in Test mode
        </div>
        <h1 className="mt-6 text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl">
          Simple pricing for Trackify
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-zinc-600">
          Start collecting insights today. Upgrade or cancel anytime.
        </p>

        {/* Billing toggle */}
        <div className="mt-6 inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white/70 p-1 backdrop-blur">
          <button
            className={`px-4 py-2 rounded-xl ${billing === "monthly" ? "bg-zinc-900 text-white" : "hover:bg-zinc-100"}`}
            onClick={() => setBilling("monthly")}
          >
            Monthly
          </button>
          <button
            className={`px-4 py-2 rounded-xl ${billing === "annual" ? "bg-zinc-900 text-white" : "hover:bg-zinc-100"}`}
            onClick={() => setBilling("annual")}
          >
            Annual
          </button>
        </div>
      </header>

      {/* Pricing grid */}
      <main className="mx-auto mt-12 max-w-5xl px-4 pb-24">
        <div className="grid gap-6 md:grid-cols-2">
          {/* Pro plan */}
          <div className="rounded-3xl border border-zinc-200 bg-white/80 p-6 shadow-sm backdrop-blur md:p-8">
            <div className="flex items-baseline justify-between">
              <h2 className="text-xl font-semibold text-zinc-900">Pro</h2>
              <div className="text-right">
                <div className="text-3xl font-bold text-zinc-900">{price}</div>
                <div className="text-xs text-zinc-500">{subcopy}</div>
              </div>
            </div>

            <ul className="mt-6 space-y-2">
              <Check label="Unlimited projects" />
              <Check label="Real-time analytics" />
              <Check label="Export to CSV" />
              <Check label="Priority email support" />
            </ul>

            <div className="mt-8 flex items-center gap-3">
              {isSubscribed ? (
                <ManageBillingButton />
              ) : (
                <button className="btn" onClick={() => startCheckout(billing)} disabled={loading}>
                  {loading ? "Redirecting…" : `Subscribe ${billing === "monthly" ? "Monthly" : "Annually"}`}
                </button>
              )}
              <span className="text-xs text-zinc-500">Cancel anytime</span>
            </div>
          </div>

          {/* Why choose us */}
          <div className="rounded-3xl border border-zinc-200 bg-white/80 p-6 shadow-sm backdrop-blur md:p-8">
            <h3 className="text-xl font-semibold text-zinc-900">Why Trackify?</h3>
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              Fast setup, clear insights, and an integrated billing flow.
            </p>
            <ul className="mt-6 space-y-2">
              <Check label="Stripe Checkout + Portal" />
              <Check label="Secure webhooks with idempotency" />
              <Check label="Supabase-backed subscription state" />
              <Check label="SSR auth + middleware protection" />
            </ul>
            <div className="mt-8 rounded-2xl border border-dashed border-zinc-300 p-4 text-xs text-zinc-600">
              Tip: after subscribing, use <b>Manage billing</b> to update card details or cancel.
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
