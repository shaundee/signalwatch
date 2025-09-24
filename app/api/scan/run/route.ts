// app/api/scan/run/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { runHtmlChecks } from "@/lib/scanner/htmlChecks";
import { sendSlack } from "@/lib/notify/slack";

export const runtime = "nodejs";

export async function POST() {
  try {
    const supa = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE!
    );

    // 1) get the oldest queued scan
    const { data: q, error: eQ } = await supa
      .from("scans")
      .select("id, domain_id")
      .eq("status", "queued")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (eQ) throw eQ;
    if (!q) return NextResponse.json({ done: true });

    // 2) get domain url
    const { data: d, error: eD } = await supa
      .from("domains")
      .select("url")
      .eq("id", q.domain_id)
      .single();
    if (eD) throw eD;

    // 3) mark running
    await supa
      .from("scans")
      .update({ status: "running", started_at: new Date().toISOString() })
      .eq("id", q.id);

    // 4) run checks
    const checks = await runHtmlChecks(d.url);

    // 5) write checks
    const rows = checks.map((c) => ({
      scan_id: q.id,
      name: c.name,
      status: c.status,
      details: c.details ?? null,
    }));
    const { error: eIns } = await supa.from("scan_checks").insert(rows);
    if (eIns) throw eIns;

    // 6) 🔔 Slack alert (after insert, before finish)
    const summary = checks.map(c => {
  const dot = c.status==='red' ? '🔴' : c.status==='amber' ? '🟡' : '🟢';
  const fix = c.status==='red' && c.details?.fix ? ` — Fix: ${c.details.fix}` : "";
  return `${dot} ${c.name}${fix}`;
}).join("\n");
    const hasRed = checks.some((c) => c.status === "red");
  
if (hasRed && process.env.SLACK_WEBHOOK_URL) {
  const reportUrl = `${process.env.REPORT_BASE_URL}/r/${q.id}`;
  await sendSlack(`*SignalWatch: RED checks detected*\n• Domain: ${d.url}\n• Report: ${reportUrl}\n\n${summary}`);
    }

    // 7) mark finished
    await supa
      .from("scans")
      .update({ status: "finished", finished_at: new Date().toISOString() })
      .eq("id", q.id);

 const redNames = checks.filter(c => c.status === "red").map(c => c.name).sort();
const hash = Buffer.from(redNames.join("|")).toString("base64"); // simple stable hash

// read last alert meta
const { data: meta } = await supa.from("domains")
  .select("last_alert_hash,last_alert_at")
  .eq("id", q.domain_id)
  .single();

const tooSoon = meta?.last_alert_at && Date.now() - new Date(meta.last_alert_at).getTime() < 60 * 60 * 1000;
const changed = hash !== meta?.last_alert_hash;

if (redNames.length && changed && !tooSoon && process.env.SLACK_WEBHOOK_URL) {
  const summary = checks
    .map(c => `${c.status === "red" ? "🔴" : c.status === "amber" ? "🟡" : "🟢"} ${c.name}`)
    .join("\n");
  const reportUrl = `${process.env.REPORT_BASE_URL}/r/${q.id}`;
  await sendSlack([
`🚨 *SignalWatch* — ${d.url}`,
`• Reds: ${redNames.length} • Ambers: ${checks.filter(c=>c.status==='amber').length} • Greens: ${checks.filter(c=>c.status==='green').length}`,
`• Report: ${reportUrl}`,
"",
...checks.map(c => `${c.status==='red'?'🔴':c.status==='amber'?'🟡':'🟢'} ${c.name}`)
].join("\n"));


  await supa.from("domains").update({
    last_alert_hash: hash,
    last_alert_at: new Date().toISOString(),
  }).eq("id", q.domain_id);
}

    return NextResponse.json({ scanId: q.id, checks: rows.length });
  } catch (err: any) {
    console.error("scan/run error:", err?.message ?? err);
    return NextResponse.json({ error: err?.message ?? "unknown" }, { status: 500 });
  }
}
