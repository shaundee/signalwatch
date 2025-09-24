import Link from "next/link";

export const metadata = { title: "VAT Admin" };

export default function AdminVatPage() {
  // simple UI: you paste shopId and dates and click the buttons
  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-2xl font-semibold">VAT Admin</h1>
      <form className="mt-6 grid gap-3" action="/api/admin/recompute-vat" method="post">
        <input name="shopId" placeholder="shop id" className="rounded border px-3 py-2" required />
        <input name="from" placeholder="YYYY-MM-01" className="rounded border px-3 py-2" required />
        <input name="to" placeholder="YYYY-MM-31" className="rounded border px-3 py-2" required />
        {/* This form submits as application/x-www-form-urlencoded, but our API expects JSON.
            For quick use, trigger from console or add a small client wrapper button instead. */}
        <p className="text-sm text-zinc-500">Use the console helpers below for now.</p>
      </form>

      <div className="mt-8 space-y-2 text-sm">
        <p><b>Console helpers</b></p>
        <pre className="rounded bg-zinc-100 p-3 text-xs">
{`// import last 90 days
fetch("/api/admin/shopify-sync", {method:"POST", headers:{'Content-Type':'application/json'},
  body: JSON.stringify({ shopId: "<SHOP_ID>", since: "2025-06-01T00:00:00Z" })
}).then(r=>r.json()).then(console.log);

// recompute 9-box for a period
fetch("/api/admin/recompute-vat",{method:"POST",headers:{'Content-Type':'application/json'},
  body: JSON.stringify({ shopId: "<SHOP_ID>", from:"2025-07-01", to:"2025-09-30"})
}).then(r=>r.json()).then(console.log);

// download CSV
open('/api/admin/vat-export?shopId=<SHOP_ID>&from=2025-07-01&to=2025-09-30');
`}
        </pre>
        <Link className="underline" href="/dashboard">Back to dashboard</Link>
      </div>
    </main>
  );
}
