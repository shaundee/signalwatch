// app/api/scan/start/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { corsHeaders } from "@/lib/cors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normUrl(raw: string) {
  const u = new URL(raw);
  if (process.env.NODE_ENV === "production" && u.protocol !== "https:") {
    throw new Error("https_required");
  }
  if (/(^|\.)(localhost|127\.|10\.|192\.168\.)/i.test(u.hostname)) {
    throw new Error("invalid_host");
  }
  u.hash = "";
  u.pathname = u.pathname.replace(/\/+$/, "");
  u.host = u.host.toLowerCase();
  return u.toString();
}

const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE! // server-only key
);

export async function POST(req: NextRequest) {
  console.log("RL MAX =", process.env.START_RATE_LIMIT_PER_HOUR);

  // 1) Parse once
  const body = await req.json().catch(() => ({} as any));
  const domain = body?.domain as string | undefined;
  if (!domain) {
    return NextResponse.json({ error: "domain required" }, { status: 400 });
  }

  // 2) Rate limit (PER-IP, per hour)
  const rawMax = process.env.START_RATE_LIMIT_PER_HOUR;
  const MAX_PER_HOUR =
    Number.isFinite(Number(rawMax)) && Number(rawMax) > 0 ? Number(rawMax) : 3;

  try {
    if (MAX_PER_HOUR > 0) {
      const ip =
        (headers().get("x-forwarded-for") || "").split(",")[0]?.trim() || "unknown";
      const key = `rl:${ip}:${new Date().toISOString().slice(0, 13)}`; // ip + YYYY-MM-DDTHH

      const { data: rl, error: selErr } = await supa
        .from("rate_limits")
        .select("count")
        .eq("key", key)
        .maybeSingle();

      if (selErr) {
        console.error("rate_limits select error:", selErr.message); // fail-open
      } else {
        const count = rl?.count ?? 0;
        if (count >= MAX_PER_HOUR) {
          return NextResponse.json(
            { error: "Too many audits from your IP. Try again in an hour." },{ status: 429, headers: corsHeaders() }
          );
        }
        const { error: upErr } = await supa
          .from("rate_limits")
          .upsert({ key, count: count + 1 }, { onConflict: "key" });
        if (upErr) console.error("rate_limits upsert error:", upErr.message); // fail-open
      }
    }
  } catch (e: any) {
    console.error("rate limit block crashed:", e?.message || e); // fail-open
  }

  // 3) Normalize/validate
  let url: string;
  try {
    url = normUrl(domain);
  } catch (e: any) {
    const code =
      e?.message === "https_required" ? 400 :
      e?.message === "invalid_host"   ? 400 : 422;
    return NextResponse.json({ error: e?.message || "invalid_url" },{ status: 500, headers: corsHeaders() });
  }

  // 4) Ensure domain (idempotent)
  const { data: d, error: dErr } = await supa
    .from("domains")
    .upsert({ url }, { onConflict: "url" })
    .select("id,url")
    .limit(1)
    .maybeSingle();

  if (dErr || !d) {
    return NextResponse.json({ error: dErr?.message || "ensure domain failed" },{ status: 500, headers: corsHeaders() });
  }

  // 5) Create scan row
  const { data: s, error: sErr } = await supa
    .from("scans")
    .insert({ domain_id: d.id, status: "queued" })
    .select("id")
    .limit(1)
    .maybeSingle();

  if (sErr || !s) {
    return NextResponse.json({ error: sErr?.message || "create scan failed" },{ status: 500, headers: corsHeaders() });
  }

  // 6) Reply
  const base = process.env.REPORT_BASE_URL || "http://localhost:3000";
  return NextResponse.json({
    scanId: s.id,
    reportUrl: `${base}/r/${s.id}`,
  },{headers: corsHeaders() });
}
export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}
