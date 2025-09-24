// ┌───────────────────────────────────────────────────────────┐
// │ File: app/dashboard/page.tsx                              │
// └───────────────────────────────────────────────────────────┘

import { createClient } from "@supabase/supabase-js";

export default async function Dashboard() {
  const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE!);

  // latest scan per domain
  const { data: domains } = await supa.from("domains").select("id,url,last_alert_hash,last_alert_at,created_at").order("created_at", { ascending: true });

  // fetch last scan + last red/amber/green counts per domain
  const rows: any[] = [];
  for (const d of domains ?? []) {
    const { data: lastScan } = await supa.from("scans").select("id,finished_at,status").eq("domain_id", d.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    let counts = { red: 0, amber: 0, green: 0 };
    if (lastScan?.id) {
      const { data: checks } = await supa.from("scan_checks").select("status").eq("scan_id", lastScan.id);
      for (const c of checks ?? []) counts[c.status as "red"|"amber"|"green"]++;
    }
    rows.push({ ...d, lastScan, counts });
  }

  return (
    <main className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Domains</h1>
      <div className="grid grid-cols-1 gap-3">
        {rows.map((r) => (
          <div key={r.id} className="border rounded-xl p-4 flex items-center justify-between">
            <div>
              <div className="font-medium">{r.url}</div>
              <div className="text-xs opacity-70">
                Last scan: {r.lastScan?.finished_at ? new Date(r.lastScan.finished_at).toLocaleString() : "—"}
                {r.last_alert_at ? ` • Last alert: ${new Date(r.last_alert_at).toLocaleString()}` : ""}
              </div>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="px-2 py-1 rounded bg-red-200">{r.counts.red} red</span>
              <span className="px-2 py-1 rounded bg-yellow-200">{r.counts.amber} amber</span>
              <span className="px-2 py-1 rounded bg-green-200">{r.counts.green} green</span>
              {r.lastScan?.id && (
                <a className="underline text-sm" href={`/r/${r.lastScan.id}`} target="_blank">Open report</a>
              )}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
