// ┌───────────────────────────────────────────────────────────┐
// │ File: app/api/scan/start/route.ts                         │
// └───────────────────────────────────────────────────────────┘
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { headers as nextHeaders } from "next/headers";
import { corsHeaders } from "@/lib/cors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Normalize & validate a user-supplied URL */
function normUrl(raw: string) {
  const u = new URL(raw);

  // Require HTTPS in production
  if (process.env.NODE_ENV === "production" && u.protocol !== "https:") {
    throw new Error("https_required");
  }
  // Block localhost / private ranges
  if (/(^|\.)(localhost|127\.|10\.|192\.168\.)/i.test(u.hostname)) {
    throw new Error("invalid_host");
  }

  u.hash = "";
  u.pathname = u.pathname.replace(/\/+$/, "");
  u.host = u.host.toLowerCase();
  return u.toString();
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE! // server-only key
  // (no auth persistence on server)
);

export async function POST(req: NextRequest) {
  const cors = corsHeaders();
  console.log("RL MAX =", process.env.START_RATE_LIMIT_PER_HOUR);

  // 1) Parse input
  const body = await req.json().catch(() => ({} as any));
  const domain = (body?.domain as string | undefined)?.trim();
  if (!domain) {
    return NextResponse.json({ error: "domain required" }, { status: 400, headers: cors });
  }

  // 2) Naive per-IP rate limit (per hour)
  const rawMax = process.env.START_RATE_LIMIT_PER_HOUR;
  const MAX_PER_HOUR =
    Number.isFinite(Number(rawMax)) && Number(rawMax) > 0 ? Number(rawMax) : 3;

  if (MAX_PER_HOUR > 0) {
    try {
      const ip =
        (nextHeaders().get("x-forwarded-for") || "").split(",")[0]?.trim() || "unknown";
      const hourKey = new Date().toISOString().slice(0, 13); // YYYY-MM-DDTHH
      const key = `rl:${ip}:${hourKey}`;

      const { data: rl, error: selErr } = await supabase
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
            { error: "Too many audits from your IP. Try again in an hour." },
            { status: 429, headers: cors }
          );
        }
        const { error: upErr } = await supabase
          .from("rate_limits")
          .upsert({ key, count: count + 1 }, { onConflict: "key" });
        if (upErr) console.error("rate_limits upsert error:", upErr.message); // fail-open
      }
    } catch (e: any) {
      console.error("rate limit block crashed:", e?.message || e); // fail-open
    }
  }

  // 3) Normalize / validate URL
  let url: string;
  try {
    url = normUrl(domain);
  } catch (e: any) {
    const code =
      e?.message === "https_required" ? 400 :
      e?.message === "invalid_host"   ? 400 : 422;
    return NextResponse.json(
      { error: e?.message || "invalid_url" },
      { status: code, headers: cors }
    );
  }

  // 4) Ensure domain row exists (idempotent by url)
  const { data: d, error: dErr } = await supabase
    .from("domains")
    .upsert({ url }, { onConflict: "url" })
    .select("id, url")
    .limit(1)
    .maybeSingle();

  if (dErr || !d) {
    return NextResponse.json(
      { error: dErr?.message || "ensure domain failed" },
      { status: 500, headers: cors }
    );
  }

  // 5) Create scan row — idempotent with partial unique index on (domain_id) WHERE status IN ('queued','running')
  let scanId: string | undefined;

  const tryInsert = await supabase
    .from("scans")
    .insert({ domain_id: d.id, status: "queued" })
    .select("id")
    .single();

  if (tryInsert.data?.id) {
    scanId = tryInsert.data.id;
  } else if (tryInsert.error?.code === "23505") {
    // Unique violation → active scan already exists for this domain_id. Fetch it.
    const existing = await supabase
      .from("scans")
      .select("id")
      .eq("domain_id", d.id)
      .in("status", ["queued", "running"])
      .limit(1)
      .single();

    if (!existing.data?.id) {
      return NextResponse.json(
        { error: existing.error?.message || "create scan failed (conflict)" },
        { status: 500, headers: cors }
      );
    }
    scanId = existing.data.id;
  } else {
    return NextResponse.json(
      { error: tryInsert.error?.message || "create scan failed" },
      { status: 500, headers: cors }
    );
  }

  // 6) Success response
  const base = process.env.REPORT_BASE_URL || "http://localhost:3000";
  return NextResponse.json(
    { scanId, reportUrl: `${base}/r/${scanId}` },
    { headers: cors }
  );
}

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}
