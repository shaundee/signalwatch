// ┌───────────────────────────────────────────────────────────┐
// │ File: app/request-access/page.tsx                         │
// └───────────────────────────────────────────────────────────┘
"use client";

import { useState } from "react";

export default function RequestAccessPage() {
  const APP = process.env.NEXT_PUBLIC_APP_NAME ?? "SignalWatch";
  const stripe = process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK;
  const calendly = process.env.NEXT_PUBLIC_CALENDLY_URL;

  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function joinWaitlist(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!email) return;
    setSaving(true);
    try {
      const res = await fetch("/api/api/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error(await res.text());
      setSaved(true);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-semibold mb-3">Request Access</h1>
      <p className="opacity-80 mb-6">
        Join the early access list for <span className="font-medium">{APP}</span>. Agencies get priority
        onboarding and founding-member pricing.
      </p>

      <form onSubmit={joinWaitlist} className="flex gap-2 mb-8">
        <input
          type="email"
          required
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1 border rounded-xl px-3 py-2"
        />
        <button
          disabled={saving}
          className="rounded-xl px-4 py-2 bg-black text-white disabled:opacity-60"
        >
          {saving ? "Saving…" : saved ? "Saved ✓" : "Join"}
        </button>
      </form>

      {err && <div className="text-red-600 text-sm mb-4">{err}</div>}

      <div className="grid sm:grid-cols-2 gap-3">
        <a
          href={stripe || "#"}
          target="_blank"
          className={`block text-center rounded-2xl px-4 py-3 border ${stripe ? "hover:bg-gray-50" : "opacity-50 pointer-events-none"}`}
        >
          Pay deposit via Stripe
        </a>
        <a
          href={calendly || "#"}
          target="_blank"
          className={`block text-center rounded-2xl px-4 py-3 border ${calendly ? "hover:bg-gray-50" : "opacity-50 pointer-events-none"}`}
        >
          Book 15-min onboarding
        </a>
      </div>

      <p className="text-xs opacity-70 mt-6">
        We’ll only scan publicly available pages. You can revoke access anytime.
      </p>
    </div>
  );
}
