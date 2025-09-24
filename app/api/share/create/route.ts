// app/api/share/create/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { corsHeaders } from "@/lib/cors";


export const runtime="nodejs"; export const dynamic="force-dynamic";

const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE!);

export async function POST(req: NextRequest) {
  const { scanId } = await req.json().catch(() => ({}));
  if (!scanId) return NextResponse.json({ error: "scanId required" },{ status: 400, headers: corsHeaders() });

  // Optional: validate scan exists
  const { data: scan } = await supa.from("scans").select("id").eq("id", scanId).limit(1).maybeSingle();
  if (!scan) return NextResponse.json({ error: "scan not found" },{ status: 404, headers: corsHeaders() });

  const { data, error } = await supa.from("report_shares").insert({ scan_id: scanId }).select("token").maybeSingle();
  if (error || !data) return NextResponse.json({ error: error?.message || "failed" },{ status: 400, headers: corsHeaders() });

  const base = process.env.REPORT_BASE_URL || "http://localhost:3000";
  return NextResponse.json({ ok: true, url: `${base}/s/${data.token}` },{ headers: corsHeaders() });
}
