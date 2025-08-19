"use client";

import { useSearchParams } from "next/navigation";

export default function ManageBillingButton() {
  const params = useSearchParams();

  async function openPortal() {
    const sessionId = params.get("session_id");
    const res = await fetch("/api/billing-portal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data?.error || "Failed to open billing portal");
      return;
    }
    window.location.href = data.url;
  }

  return <button className="btn" onClick={openPortal}>Manage billing</button>;
}
