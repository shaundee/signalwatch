import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { runHtmlChecks } from "@/lib/scanner/htmlChecks";
import { sendSlack } from "@/lib/notify/slack";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ marker: "process-one", error: "missing id" }, { status: 400 });
  }

  const supa = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE!
  );

  try {
    // 1) Fetch the scan row safely
    const { data: q, error: qErr } = await supa
      .from("scans")
      .select("id, domain_id, status, created_at")
      .eq("id", id)
      .limit(1)
      .maybeSingle();

    if (qErr) {
      return NextResponse.json({ marker: "process-one", error: qErr.message, scanId: id }, { status: 400 });
    }
    if (!q) {
      return NextResponse.json({ marker: "process-one", error: "scan not found", scanId: id }, { status: 404 });
    }
    if (q.status !== "queued") {
      return NextResponse.json({ marker: "process-one", note: "not queued", scan: q });
    }

    // 2) Fetch the domain row safely
    const { data: d, error: dErr } = await supa
      .from("domains")
      .select("id, url, last_alert_hash, last_alert_at")
      .eq("id", q.domain_id)
      .limit(1)
      .maybeSingle();

    if (dErr) {
      return NextResponse.json({ marker: "process-one", error: dErr.message, scanId: id }, { status: 400 });
    }
    if (!d) {
      return NextResponse.json({ marker: "process-one", error: "domain not found", scanId: id }, { status: 404 });
    }

    // 3) Mark running
    await supa.from("scans").update({ status: "running", started_at: new Date().toISOString() }).eq("id", q.id);

    // 4) Run checks
    const checks = await runHtmlChecks(d.url);

    // 5) Persist checks
    if (checks?.length) {
      await supa.from("scan_checks").insert(
        checks.map((c: any) => ({
          scan_id: q.id,
          name: c.name,
          status: c.status,
          details: c.details ?? null,
        }))
      );
    }

    // 6) Slack logic
    const reds = (checks || []).filter((c: any) => c.status === "red").map((c: any) => c.name).sort();
    const hash = Buffer.from(reds.join("|")).toString("base64");
    const tooSoon = d.last_alert_at && (Date.now() - new Date(d.last_alert_at).getTime()) < 60 * 60 * 1000;
    const changed = hash !== d.last_alert_hash;

    if (reds.length && changed && !tooSoon && process.env.SLACK_WEBHOOK_URL) {
      const reportUrl = `${process.env.REPORT_BASE_URL || "http://localhost:3000"}/r/${q.id}`;
      const summary = (checks || []).map((c: any) => {
        const dot = c.status === "red" ? "🔴" : c.status === "amber" ? "🟡" : "🟢";
        const fix = c.status === "red" && c.details?.fix ? ` — Fix: ${c.details.fix}` : "";
        return `${dot} ${c.name}${fix}`;
      }).join("\n");

      await sendSlack(
        [`🚨 *SignalWatch* — ${d.url}`, `• Reds: ${reds.length}`, `• Report: ${reportUrl}`, "", summary].join("\n")
      );

      await supa.from("domains")
        .update({ last_alert_hash: hash, last_alert_at: new Date().toISOString() })
        .eq("id", d.id);
    }

    // 7) Mark finished
    await supa.from("scans").update({ status: "finished", finished_at: new Date().toISOString() }).eq("id", q.id);

    return NextResponse.json({ marker: "process-one", processed: 1, scanId: q.id, domain: d.url });
  } catch (e: any) {
    // ensure we mark the scan failed—even if we never loaded it as q
    await supa.from("scans").update({ status: "failed", finished_at: new Date().toISOString() }).eq("id", id);
    return NextResponse.json(
      { marker: "process-one", error: e?.message ?? String(e), scanId: id },
      { status: 500 }
    );
  }
}
