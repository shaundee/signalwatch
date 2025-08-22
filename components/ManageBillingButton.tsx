"use client";
import { useState } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import { useRouter } from "next/navigation";

export default function ManageBillingButton() {
  const [loading, setLoading] = useState(false);
  const { error, success } = useToast();
  const router = useRouter();

  async function openPortal() {
    try {
      setLoading(true);
      const res = await fetch("/api/billing-portal", { method: "POST" });
      const json = await res.json();

      if (res.status === 409) {
        // No customer on Stripe — start a checkout to recreate one
        error(json?.message || "No billing profile yet. Please choose a plan.");
        router.push("/pricing");
        return;
      }
      if (!res.ok || !json.url) throw new Error(json?.error || "Could not open billing portal");

      window.location.href = json.url;
    } catch (e: any) {
      error(e?.message || "Could not open billing portal");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button onClick={openPortal} disabled={loading} className="btn">
      {loading ? "Opening…" : "Manage billing"}
    </button>
  );
}
