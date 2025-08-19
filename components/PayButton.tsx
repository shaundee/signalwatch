"use client";

export default function PayButton() {
  async function pay() {
    const res = await fetch("/api/checkout-session", { method: "POST" });
    const { url } = await res.json();
    window.location.href = url;
  }
  return <button className="btn" onClick={pay}>Pay £5 (test)</button>;
}
