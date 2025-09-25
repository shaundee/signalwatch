// ┌───────────────────────────────────────────────────────────┐
// │ File: app/api/scan/run-all/route.ts                       │
// └───────────────────────────────────────────────────────────┘
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { runHtmlChecks } from "@/lib/scanner/htmlChecks";
import { sendSlack } from "@/lib/notify/slack";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Stable hash so we don't spam Slack for the same alert content */
function hashText(s: string) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

export async function POST() {
  const supa = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE!
  );

  // 0) how many are waiting?
  const countRes = await supa
    .from("scans")
    .select("*", { head: true, count: "exact" })
    .eq("status", "queued");

  const queuedCount = countRes.count ?? 0;

  // 1) pick a small batch of oldest queued
  const { data: queued, error: selErr } = await supa
    .from("scans")
    .select("id, domain_id, created_at, status")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(5);

  if (selErr) {
    return NextResponse.json(
      { error: selErr.message, queuedCount },
      { status: 500 }
    );
  }

  let processed = 0;
  const skipped: string[] = [];
  const failed: Array<{ id: string; error: string }> = [];

  for (const q of queued ?? []) {
    // holder for logging/Slack in catch scope
    let domainUrl: string | null = null;

    try {
      // 2) fetch domain row
      const { data: d } = await supa
        .from("domains")
        .select("id,url,last_alert_hash,last_alert_at")
        .eq("id", q.domain_id)
        .single();

      if (!d) {
        // orphan safeguard → fail scan and move on
        await supa
          .from("scans")
          .update({ status: "failed", finished_at: new Date().toISOString() })
          .eq("id", q.id);
        skipped.push(q.id);
        continue;
      }

      domainUrl = d.url;

      // 3) mark running
      await supa
        .from("scans")
        .update({ status: "running", started_at: new Date().toISOString() })
        .eq("id", q.id);

      // 4) run checks
      const checks = await runHtmlChecks(d.url);

      // 5) summarize + dedupe alerts
      const summary = checks
        .map((c: any) => {
          const dot = c.status === "red" ? "🔴" : c.status === "amber" ? "🟡" : "🟢";
          const fix = c.status === "red" && c.details?.fix ? ` — Fix: ${c.details.fix}` : "";
          return `${dot} ${c.name}${fix}`;
        })
        .join("\n");

      const hasRed = checks.some((c: any) => c.status === "red");
      const summaryHash = hashText(summary);

      // 6) Slack only if RED and content changed since last alert
      if (hasRed && process.env.SLACK_WEBHOOK_URL && summaryHash !== d.last_alert_hash) {
        const reportUrl = `${process.env.REPORT_BASE_URL}/r/${q.id}`;
        const reds = checks.filter((c: any) => c.status === "red").length;
        const ambers = checks.filter((c: any) => c.status === "amber").length;
        const greens = checks.filter((c: any) => c.status === "green").length;

        await sendSlack(
          [
            `🚨 *SignalWatch* — ${d.url}`,
            `• Reds: ${reds}  Ambers: ${ambers}  Greens: ${greens}`,
            `• Report: ${reportUrl}`,
            "",
            summary,
          ].join("\n")
        );

        await supa
          .from("domains")
          .update({
            last_alert_hash: summaryHash,
            last_alert_at: new Date().toISOString(),
          })
          .eq("id", d.id);
      }

      // 7) mark finished
      await supa
        .from("scans")
        .update({ status: "finished", finished_at: new Date().toISOString() })
        .eq("id", q.id);

      processed++;
    } catch (e: any) {
      // 8) fail this scan record
      await supa
        .from("scans")
        .update({ status: "failed", finished_at: new Date().toISOString() })
        .eq("id", q.id);

      failed.push({ id: q.id, error: e?.message ?? String(e) });

      // 🔔 Slack alert for batch failures (non-blocking)
      try {
        if (process.env.SLACK_WEBHOOK_URL) {
          const msg = [
            "*SignalWatch: worker error (batch run)*",
            `• Scan: ${q.id}`,
            `• Domain: ${domainUrl ?? "(unknown)"}`,
            `• Error: ${e?.message ?? String(e)}`,
          ].join("\n");
          await sendSlack(msg);
        }
      } catch {}
    }
  }

  return NextResponse.json({
    marker: "run-all-v5",
    processed,
    queuedCount,
    skipped,
    failed,
  });
}
export async function GET() {
  return POST(); // reuse the same logic
}
