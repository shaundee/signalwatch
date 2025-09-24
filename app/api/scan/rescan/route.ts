import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
);

export async function POST(req: NextRequest) {
  const scanId = new URL(req.url).searchParams.get("scanId");
  if (!scanId) return NextResponse.json({ error: "scanId is required" }, { status: 400 });

  const { data: scan, error: scanErr } = await supa
    .from("scans").select("domain_id").eq("id", scanId).limit(1).maybeSingle();
  if (scanErr || !scan) return NextResponse.json({ error: scanErr?.message || "scan not found" }, { status: 404 });

  const { data: next, error: insErr } = await supa
    .from("scans").insert({ domain_id: scan.domain_id, status: "queued" })
    .select("id").limit(1).maybeSingle();
  if (insErr || !next) return NextResponse.json({ error: insErr?.message || "failed to create scan" }, { status: 400 });

  return NextResponse.json({ ok: true, scanId: next.id, reportUrl: `${process.env.REPORT_BASE_URL || "http://localhost:3000"}/r/${next.id}` });
}
