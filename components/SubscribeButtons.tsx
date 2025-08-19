"use client";

export default function SubscribeButtons() {
  async function go(plan: "monthly" | "annual") {
    const res = await fetch("/api/checkout-subscription", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    });
    const { url } = await res.json();
    window.location.href = url;
  }
  return (
    <div className="flex gap-2">
      <button className="btn" onClick={() => go("monthly")}>Subscribe £29/mo</button>
      <button className="btn" onClick={() => go("annual")}>Subscribe £290/yr</button>
    </div>
  );
}
