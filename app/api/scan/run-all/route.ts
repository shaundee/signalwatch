// ┌───────────────────────────────────────────────────────────┐
// │ File: app/api/scan/run-all/route.ts                       │
// │ Purpose: process up to N queued scans (sequential by def) │
// │ Query/body: { limit?: number } or ?limit=10               │
// └───────────────────────────────────────────────────────────┘
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
);

// Light wrapper around the single-run logic to avoid duplication.
// You can import the single-run function if you factor it out to a module.
async function processOne(): Promise<{
  id?: string;
  done: boolean;   // true if processed a job; false if queue empty
  status?: "finished" | "failed";
  issues?: number;
  error?: string;
}> {
  // Pick one queued
  const { data: q } = await supa
    .from("scans")
    .select("id, account_id, domain_id")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!q) return { done: false };

  // Claim
  const { data: claimed } = await supa
    .from("scans")
    .update({ status: "running", started_at: new Date().toISOString() })
    .eq("id", q.id)
    .eq("status", "queued")
    .select("id")
    .maybeSingle();
  if (!claimed) return { done: false }; // lost race; let caller loop again

 
// Load domain + account webhook
const [{ data: d }, { data: acc2 }] = await Promise.all([
  supa.from("domains").select("url").eq("id", q.domain_id).maybeSingle(),
  supa
    .from("accounts")
    .select("name, slack_webhook_url") // <-- include it here
    .eq("id", q.account_id)
    .maybeSingle(),
]);

const domainUrl = d?.url ?? "(unknown)";
const accountName = acc2?.name ?? "Account";
const webhook = acc2?.slack_webhook_url ?? process.env.SLACK_WEBHOOK_URL ?? null;

  // Run (placeholder)
  let issues = 0;
  let failMsg: string | null = null;
  try {
    // TODO: call your real audit here
    issues = 0;
  } catch (e: any) {
    failMsg = e?.message || String(e);
  }

  // Update + Slack
  if (failMsg) {
    await supa
      .from("scans")
      .update({
        status: "failed",
        finished_at: new Date().toISOString(),
        error: failMsg.slice(0, 500),
      })
      .eq("id", q.id);

    if (webhook) {
      await fetch(webhook, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text: [
            `❌ SignalWatch: Scan failed`,
            `• Account: ${accountName}`,
            `• Domain: ${domainUrl}`,
            `• Scan: ${q.id}`,
            `• Error: ${failMsg}`,
          ].join("\n"),
        }),
      }).catch(() => {});
    }

    return { id: q.id, done: true, status: "failed", error: failMsg };
  }

  await supa
    .from("scans")
    .update({
      status: "finished",
      finished_at: new Date().toISOString(),
      issue_count: issues,
    })
    .eq("id", q.id);

  if (issues > 0 && webhook) {
    await fetch(webhook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: [
          `⚠️ SignalWatch: Issues detected`,
          `• Account: ${accountName}`,
          `• Domain: ${domainUrl}`,
          `• Scan: ${q.id}`,
          `• Issues: ${issues}`,
          `${process.env.REPORT_BASE_URL || "http://localhost:3000"}/r/${q.id}`,
        ].join("\n"),
      }),
    }).catch(() => {});
  }

  return { id: q.id, done: true, status: "finished", issues };
}

export async function POST(req: NextRequest) {
  // limit from body or query
  let limit = 5;
  try {
    const j = await req.json();
    if (Number.isFinite(Number(j?.limit))) limit = Math.max(1, Math.min(50, Number(j.limit)));
  } catch {}
  const qlimit = Number(new URL(req.url).searchParams.get("limit"));
  if (Number.isFinite(qlimit)) limit = Math.max(1, Math.min(50, qlimit));

  const results: any[] = [];
  let processed = 0;

  for (let i = 0; i < limit; i++) {
    const r = await processOne();
    if (!r.done) break; // queue empty or race
    results.push(r);
    processed++;
  }

  return NextResponse.json({
    marker: "run-all-v5",
    requested: limit,
    processed,
    results,
  });
}

// Allow GET (for cron)
export async function GET(req: NextRequest) {
  return POST(req);
}
