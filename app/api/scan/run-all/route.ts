import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { runHtmlChecks } from "@/lib/scanner/htmlChecks";
import { sendSlack } from "@/lib/notify/slack";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const supa = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE!
  );

  const countRes = await supa
    .from("scans")
    .select("*", { count: "exact", head: true })
    .eq("status", "queued");
  const queuedCount = countRes.count ?? 0;

  const { data: queued, error: qErr } = await supa
    .from("scans")
    .select("id,domain_id,created_at,status")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(10);

  if (qErr) return NextResponse.json({ marker: "run-all-v4", queuedCount, error: qErr.message }, { status: 500 });
  if (!queued?.length) return NextResponse.json({ marker: "run-all-v4", processed: 0, queuedCount });

  let processed = 0;
  const skipped: string[] = [];
  const failed: Array<{ id: string; error: string }> = [];

  for (const q of queued) {
    try {
      const { data: d } = await supa
        .from("domains")
        .select("id,url,last_alert_hash,last_alert_at")
        .eq("id", q.domain_id)
        .single();

      if (!d) {
        // orphan (should not happen once FK is in place) → mark failed and continue
        await supa.from("scans").update({ status: "failed", finished_at: new Date().toISOString() }).eq("id", q.id);
        skipped.push(q.id);
        continue;
      }

      await supa.from("scans").update({ status: "running", started_at: new Date().toISOString() }).eq("id", q.id);

      const checks = await runHtmlChecks(d.url);

      await supa.from("scan_checks").insert(
        checks.map(c => ({ scan_id: q.id, name: c.name, status: c.status, details: c.details ?? null }))
      );

      const reds = checks.filter(c => c.status === "red").map(c => c.name).sort();
      const hash = Buffer.from(reds.join("|")).toString("base64");
      const tooSoon = d.last_alert_at && (Date.now() - new Date(d.last_alert_at).getTime()) < 60 * 60 * 1000;
      const changed = hash !== d.last_alert_hash;

      if (reds.length && changed && !tooSoon && process.env.SLACK_WEBHOOK_URL) {
        const reportUrl = `${process.env.REPORT_BASE_URL}/r/${q.id}`;
        const summary = checks.map(c => {
          const dot = c.status==='red' ? '🔴' : c.status==='amber' ? '🟡' : '🟢';
          const fix = c.status==='red' && c.details?.fix ? ` — Fix: ${c.details.fix}` : "";
          return `${dot} ${c.name}${fix}`;
        }).join("\n");
        await sendSlack([`🚨 *SignalWatch* — ${d.url}`, `• Reds: ${reds.length}`, `• Report: ${reportUrl}`, "", summary].join("\n"));
        await supa.from("domains").update({ last_alert_hash: hash, last_alert_at: new Date().toISOString() }).eq("id", d.id);
      }

      await supa.from("scans").update({ status: "finished", finished_at: new Date().toISOString() }).eq("id", q.id);
      processed++;
    } catch (e: any) {
      await supa.from("scans").update({ status: "failed", finished_at: new Date().toISOString() }).eq("id", q.id);
      failed.push({ id: q.id, error: e?.message ?? String(e) });
    }
  }

  return NextResponse.json({ marker: "run-all-v4", processed, queuedCount, skipped, failed });
}
