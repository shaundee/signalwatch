import { createClient } from "@supabase/supabase-js";
import { ReportActions } from "./ReportActions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function Report({ params }: { params: { scanId: string } }) {
  const supa = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE! // server component: OK
  );

  const [{ data: scan, error: scanErr }, { data: checks, error: checksErr }] = await Promise.all([
    supa
      .from("scans")
      .select("id,status,started_at,finished_at,domain_id")
      .eq("id", params.scanId)
      .limit(1)
      .maybeSingle(),
    supa
      .from("scan_checks")
      .select("name,status,details,created_at")
      .eq("scan_id", params.scanId)
      .order("name"),
  ]);

  // If scan not found, show message (and log any errors to server console)
  if (scanErr) console.error("scanErr:", scanErr);
  if (checksErr) console.error("checksErr:", checksErr);
  if (!scan) return <div className="p-8">Report not found.</div>;

  // fetch domain separately (no FK dependency needed)
  const { data: domain, error: domainErr } = await supa
    .from("domains")
    .select("url")
    .eq("id", scan.domain_id)
    .limit(1)
    .maybeSingle();
  if (domainErr) console.error("domainErr:", domainErr);

  // score
  const scoreMap: Record<string, number> = { green: 2, amber: 1, red: 0 };
  const total = (checks ?? []).reduce((s, c: any) => s + (scoreMap[c.status] ?? 0), 0);
  const max = Math.max((checks?.length ?? 0) * 2, 1);
  const percent = Math.round((total / max) * 100);

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">SignalWatch Audit</h1>
          <p className="text-sm opacity-70">
            {domain?.url ?? "(unknown domain)"} •{" "}
            {scan.started_at ? new Date(scan.started_at).toLocaleString() : "queued"}
            {scan.finished_at ? ` → ${new Date(scan.finished_at).toLocaleTimeString()}` : ""}
          </p>
          <p className="text-sm mt-1">Health score: <strong>{percent}%</strong></p>
        </div>
        <div className="mb-4 rounded-xl border p-3 text-sm bg-black/5 dark:bg-white/5">
  Want Slack alerts & scheduled scans? Join the pilot →
  <a href="/run-audit" className="underline ml-1">Run a free audit</a>
</div>

        <ReportActions scanId={params.scanId} />
      </div>

      <ul className="space-y-2">
        {checks?.map((c: any) => (
          <li key={c.name} className="flex flex-col gap-2 border rounded-xl p-3">
            <div className="flex items-center justify-between">
              <span className="font-mono">{c.name}</span>
              <span className={`px-2 py-1 rounded text-xs ${c.status==='green'?'bg-green-200':c.status==='amber'?'bg-yellow-200':'bg-red-200'}`}>
                {c.status}
              </span>
            </div>
            {c.details && (
              <details className="text-sm">
                <summary className="cursor-pointer opacity-80">Why it matters & how to fix</summary>
                <div className="mt-2 space-y-1">
                  <p><span className="font-medium">Why:</span> {c.details.why}</p>
                  <p><span className="font-medium">Fix:</span> {c.details.fix}</p>
                </div>
              </details>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
