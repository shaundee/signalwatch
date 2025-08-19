"use client";
export default function StatusChip({ value }: { value?: string | null }) {
  const v = (value || "unknown").toLowerCase();
  const cls =
    v === "active" ? "bg-emerald-100 text-emerald-800" :
    v === "trialing" ? "bg-sky-100 text-sky-800" :
    v === "past_due" ? "bg-amber-100 text-amber-800" :
    v === "unpaid" ? "bg-rose-100 text-rose-800" :
    "bg-zinc-100 text-zinc-700";
  return <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${cls}`}>{v.replace("_"," ")}</span>;
}
