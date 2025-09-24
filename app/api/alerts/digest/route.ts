import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendSlack } from "@/lib/notify/slack";

export const runtime = "nodejs";

export async function POST() {
  const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE!);
  const { data: domains } = await supa.from("domains").select("id,url");

  let lines: string[] = [];
  for (const d of domains ?? []) {
    const { data: lastScan } = await supa.from("scans").select("id").eq("domain_id", d.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!lastScan?.id) continue;
    const { data: checks } = await supa.from("scan_checks").select("name,status").eq("scan_id", lastScan.id);
    const ambers = (checks ?? []).filter(c => c.status === "amber");
    if (!ambers.length) continue;
    lines.push(`• ${d.url}\n  ${ambers.map(a => `🟡 ${a.name}`).join("\n  ")}`);
  }

  if (lines.length && process.env.SLACK_WEBHOOK_URL) {
    await sendSlack(`🗞️ *SignalWatch Daily Digest* (ambers)\n\n${lines.join("\n")}`);
  }

  return NextResponse.json({ sent: !!lines.length, domains_with_ambers: lines.length });
}
