"use client";
import { useEffect, useState } from "react";

type Invoice = {
  id: string; number: string | null; status: string | null; currency: string | null;
  amount_due: number; amount_paid: number; created: string | null;
  hosted_invoice_url: string | null; invoice_pdf: string | null;
};

function money(cents: number, currency: string | null) {
  const cur = (currency || "usd").toUpperCase();
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency: cur }).format(cents / 100); }
  catch { return `${(cents / 100).toFixed(2)} ${cur}`; }
}

export default function BillingHistory() {
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/invoices", { credentials: "include" });
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error || "Failed to load invoices");
        setInvoices(j.invoices || []);
      } catch (e: any) {
        setErr(e?.message || "Could not load invoices");
      }
    })();
  }, []);

  if (err) return <div className="text-sm text-rose-600">{err}</div>;
  if (!invoices) return <div className="text-sm text-zinc-500">Loading invoices…</div>;
  if (invoices.length === 0) return <div className="text-sm text-zinc-500">No invoices yet.</div>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-zinc-500">
            <th className="py-2 pr-4">Date</th>
            <th className="py-2 pr-4">Invoice</th>
            <th className="py-2 pr-4">Status</th>
            <th className="py-2 pr-4">Amount</th>
            <th className="py-2 pr-4">Actions</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map(inv => (
            <tr key={inv.id} className="border-top border-zinc-200">
              <td className="py-2 pr-4">{inv.created ? new Date(inv.created).toLocaleDateString() : "—"}</td>
              <td className="py-2 pr-4">{inv.number ?? inv.id.slice(0, 10)}</td>
              <td className="py-2 pr-4"><span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs capitalize">{inv.status ?? "unknown"}</span></td>
              <td className="py-2 pr-4">{money(inv.amount_paid || inv.amount_due, inv.currency)}</td>
              <td className="py-2 pr-4">
                <div className="flex gap-2">
                  {inv.hosted_invoice_url && <a className="px-3 py-1 rounded-xl border hover:bg-zinc-50" href={inv.hosted_invoice_url} target="_blank">View</a>}
                  {inv.invoice_pdf && <a className="px-3 py-1 rounded-xl border hover:bg-zinc-50" href={inv.invoice_pdf} target="_blank">PDF</a>}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
