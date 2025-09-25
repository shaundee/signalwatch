// ┌───────────────────────────────────────────────────────────┐
// │ File: app/api/scan/run/route.ts                           │
// └───────────────────────────────────────────────────────────┘
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { runHtmlChecks } from "@/lib/scanner/htmlChecks";
import { sendSlack } from "@/lib/notify/slack";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function hashText(s: string) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

export async function POST() {
  const supa = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE!
  );

  // 1) pick the oldest queued scan
  const { data: q, error: selErr } = await supa
    .from("scans")
    .select("id, domain_id, created_at, status")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (selErr) {
    return NextResponse.json({ error: selErr.message }, { status: 500 });
  }

  if (!q) {
    return NextResponse.json({ ok: true, message: "no queued scans" });
  }

  let domainUrl: string | null = null;

  try {
    // 2) fetch domain row
    const { data: d } = await supa
      .from("domains")
      .select("id,url,last_alert_hash,last_alert_at")
      .eq("id", q.domain_id)
      .single();

    if (!d) {
      // orphan safeguard → fail scan and exit
      await supa
        .from("scans")
        .update({ status: "failed", finished_at: new Date().toISOString() })
        .eq("id", q.id);
      return NextResponse.json({ ok: false, error: "orphan_scan" }, { status: 200 });
    }

    domainUrl = d.url;

    // 3) mark running
    await supa
      .from("scans")
      .update({ status: "running", started_at: new Date().toISOString() })
      .eq("id", q.id);

    // 4) run checks
    const checks = await runHtmlChecks(d.url);

    // 5) write checks (if your system stores them—skip if not needed)
    // Example table name: scan_checks (you already use this in batch worker)
    const rows = checks.map((c: any) => ({
      scan_id: q.id,
      name: c.name,
      status: c.status,            // 'red' | 'amber' | 'green'
      details: c.details ?? null,  // jsonb
    }));
    if (rows.length) {
      const { error: eIns } = await supa.from("scan_checks").insert(rows);
      if (eIns) throw eIns;
    }

    // 6) summarize + Slack dedupe on content
    const summary = checks
      .map((c: any) => {
        const dot = c.status === "red" ? "🔴" : c.status === "amber" ? "🟡" : "🟢";
        const fix = c.status === "red" && c.details?.fix ? ` — Fix: ${c.details.fix}` : "";
        return `${dot} ${c.name}${fix}`;
      })
      .join("\n");

    const hasRed = checks.some((c: any) => c.status === "red");
    const summaryHash = hashText(summary);

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

    // 7) finish scan
    await supa
      .from("scans")
      .update({ status: "finished", finished_at: new Date().toISOString() })
      .eq("id", q.id);

    return NextResponse.json({ ok: true, scanId: q.id, checks: rows.length });
  } catch (err: any) {
    // mark failed
    await supa
      .from("scans")
      .update({ status: "failed", finished_at: new Date().toISOString() })
      .eq("id", q.id);

    // 🔔 Slack error (non-blocking)
    try {
      if (process.env.SLACK_WEBHOOK_URL) {
        const msg = [
          "*SignalWatch: worker error (single run)*",
          `• Scan: ${q.id}`,
          `• Domain: ${domainUrl ?? "(unknown)"}`,
          `• Error: ${err?.message ?? String(err)}`,
        ].join("\n");
        await sendSlack(msg);
      }
    } catch {}

    return NextResponse.json({ error: err?.message ?? "unknown" }, { status: 500 });
  }
}
