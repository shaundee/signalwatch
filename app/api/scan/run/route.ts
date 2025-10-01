// ┌───────────────────────────────────────────────────────────┐
// │ File: app/api/scan/run/route.ts                           │
// │ Purpose: atomically claim ONE queued scan, run it, update │
// │ Notes:                                                    │
// │  - Multi-tenant: loads account + domain for Slack routing │
// │  - Race-safe: claim via status check on update            │
// │  - Replace runAudit() with your real scanner              │
// └───────────────────────────────────────────────────────────┘
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
);

// --- helpers ------------------------------------------------
async function postSlack(webhook: string | null | undefined, text: string) {
  const url = webhook || process.env.SLACK_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });
  } catch (e) {
    console.error("Slack post failed:", (e as any)?.message || e);
  }
}

async function getAccountSlackWebhook(accountId: string) {
  const { data } = await supa
    .from("accounts")
    .select("slack_webhook_url,name")
    .eq("id", accountId)
    .maybeSingle();
  return { webhook: data?.slack_webhook_url ?? null, accountName: data?.name ?? "Account" };
}

// Replace with your real scanner. Must NOT throw for normal “no issues”.
async function runAudit(url: string): Promise<{ ok: true; issues: number; note?: string } | { ok: false; error: string }> {
  // TODO: call your real audit. Keep it deterministic & bounded.
  // For now: pretend we found 0 issues.
  return { ok: true, issues: 0 };
}

// --- route --------------------------------------------------
export async function POST() {
  // 1) pick the oldest queued
  const { data: q } = await supa
    .from("scans")
    .select("id, account_id, domain_id")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!q) {
    return NextResponse.json({ ok: true, empty: true, message: "no queued scans" });
  }

  // 2) claim it (race safe)
  const { data: claimed } = await supa
    .from("scans")
    .update({ status: "running", started_at: new Date().toISOString() })
    .eq("id", q.id)
    .eq("status", "queued")
    .select("id")
    .maybeSingle();

  if (!claimed) {
    // Someone else took it
    return NextResponse.json({ ok: true, claimed: false, id: q.id });
  }

  // 3) domain url + account webhook
  const [{ data: d }, { webhook, accountName }] = await Promise.all([
    supa.from("domains").select("url").eq("id", q.domain_id).maybeSingle(),
    getAccountSlackWebhook(q.account_id),
  ]);
  const domainUrl = d?.url ?? "(unknown)";

  // 4) run audit
  let issues = 0;
  let failMsg: string | null = null;
  try {
    const res = await runAudit(domainUrl);
    if (res.ok) issues = res.issues;
    else failMsg = res.error;
  } catch (e: any) {
    failMsg = e?.message || String(e);
  }

  // 5) update result
  if (failMsg) {
    await supa
      .from("scans")
      .update({
        status: "failed",
        finished_at: new Date().toISOString(),
        error: failMsg.slice(0, 500),
      })
      .eq("id", q.id);

    await postSlack(
      webhook,
      [
        `❌ SignalWatch: Scan failed`,
        `• Account: ${accountName}`,
        `• Domain: ${domainUrl}`,
        `• Scan: ${q.id}`,
        `• Error: ${failMsg}`,
      ].join("\n")
    );

    return NextResponse.json({ ok: true, id: q.id, status: "failed", error: failMsg });
  }

  await supa
    .from("scans")
    .update({
      status: "finished",
      finished_at: new Date().toISOString(),
      issue_count: issues,
    })
    .eq("id", q.id);

  if (issues > 0) {
    await postSlack(
      webhook,
      [
        `⚠️ SignalWatch: Issues detected`,
        `• Account: ${accountName}`,
        `• Domain: ${domainUrl}`,
        `• Scan: ${q.id}`,
        `• Issues: ${issues}`,
        `${process.env.REPORT_BASE_URL || "http://localhost:3000"}/r/${q.id}`,
      ].join("\n")
    );
  }

  return NextResponse.json({ ok: true, id: q.id, status: "finished", issues });
}

// Allow GET (for cron)
export async function GET() {
  return POST();
}
