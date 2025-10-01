// ┌───────────────────────────────────────────────────────────┐
// │ File: app/api/scan/start/route.ts                         │
// │ Purpose: enqueue (or reuse) a scan for a domain           │
// │ - Multi-tenant: attaches account_id to domains & scans    │
// │ - Per-IP rate limit (hour)                                │
// │ - Per-account monthly hard limit                          │
// │ - URL normalization + prod HTTPS + localhost guard        │
// │ - Idempotent: reuses active (queued/running) scan         │
// │ - CORS + no-store headers                                 │
// └───────────────────────────────────────────────────────────┘
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { corsHeaders } from "@/lib/cors";
import { resolveAccountForRequest } from "@/lib/account";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE! // server-only key
);

// ─────────────────────────────────────────────────────────────
// utils
function normUrl(raw: string) {
  const u = new URL(raw);
  if (process.env.NODE_ENV === "production" && u.protocol !== "https:") {
    throw new Error("https_required");
  }
  // block private/dev hosts
 const isPrivate = /(^|\.)(localhost|127\.|10\.|192\.168\.)/i.test(u.hostname);
if (process.env.NODE_ENV === "production" && isPrivate) {
  throw new Error("invalid_host");
}

  u.hash = "";
  u.pathname = u.pathname.replace(/\/+$/, "");
  u.host = u.host.toLowerCase();
  return u.toString();
}

function noStoreHeaders() {
  return {
    ...corsHeaders(),
    "cache-control": "no-store, no-cache, must-revalidate, max-age=0",
    pragma: "no-cache",
    expires: "0",
  };
}

// ─────────────────────────────────────────────────────────────
// route
export async function POST(req: NextRequest) {
  // debug knob for rate limit
  const rawMax = process.env.START_RATE_LIMIT_PER_HOUR;
  const MAX_PER_HOUR =
    Number.isFinite(Number(rawMax)) && Number(rawMax) > 0 ? Number(rawMax) : 3;

  // 0) parse body
  const body = await req.json().catch(() => ({} as any));
  const domainInput = (body?.domain ?? body?.url ?? "").trim();
  if (!domainInput) {
    return NextResponse.json(
      { error: "domain required" },
      { status: 400, headers: noStoreHeaders() }
    );
  }

  // 1) per-IP rate limit (hour bucket)
  try {
    if (MAX_PER_HOUR > 0) {
      const ip =
        (headers().get("x-forwarded-for") || "").split(",")[0].trim() ||
        req.ip ||
        "unknown";
      const hourKey = new Date().toISOString().slice(0, 13); // YYYY-MM-DDTHH
      const key = `start:${ip}:${hourKey}`;

      const { data: rl, error: selErr } = await supa
        .from("rate_limits")
        .select("count")
        .eq("key", key)
        .maybeSingle();

      if (!selErr) {
        const count = rl?.count ?? 0;
        if (count >= MAX_PER_HOUR) {
          return NextResponse.json(
            {
              error:
                "Too many audits from your IP. Try again in about an hour.",
            },
            { status: 429, headers: noStoreHeaders() }
          );
        }
        await supa
          .from("rate_limits")
          .upsert({ key, count: count + 1 }, { onConflict: "key" });
      }
    }
  } catch (e) {
    // fail-open on RL errors
    console.error("start rate-limit error:", (e as any)?.message || e);
  }

  // 2) normalize URL
  let url: string;
  try {
    url = normUrl(domainInput);
  } catch (e: any) {
    const msg = e?.message || "invalid_url";
    const status =
      msg === "https_required" || msg === "invalid_host" ? 400 : 422;
    return NextResponse.json(
      { error: msg },
      { status, headers: noStoreHeaders() }
    );
  }

  // 3) resolve account + enforce monthly hard limit
  const { accountId, account } = await resolveAccountForRequest();

  const monthStartISO = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1
  ).toISOString();

  const { data: mc, error: mcErr } = await supa
    .from("v_monthly_scan_counts")
    .select("scans")
    .eq("account_id", accountId)
    .eq("month", monthStartISO)
    .maybeSingle();

  if (mcErr) console.error("monthly count fetch error:", mcErr.message);

  const used = mc?.scans ?? 0;
  const hard = account?.hard_limit_scans ?? 100; // sensible default
  if (used >= hard) {
    return NextResponse.json(
      {
        error: "limit_reached",
        used,
        hard,
        upgrade: "/pricing",
      },
      { status: 402, headers: noStoreHeaders() }
    );
  }

  // 4) ensure domain (unique per account: (account_id,url))
  const { data: d, error: dErr } = await supa
    .from("domains")
    .upsert({ account_id: accountId, url }, { onConflict: "account_id,url" })
    .select("id,url")
    .limit(1)
    .maybeSingle();

  if (dErr || !d) {
    return NextResponse.json(
      { error: dErr?.message || "ensure domain failed" },
      { status: 500, headers: noStoreHeaders() }
    );
  }

  // 5) idempotency: reuse existing active scan if present
  const { data: existing, error: exErr } = await supa
    .from("scans")
    .select("id,status")
    .eq("account_id", accountId)
    .eq("domain_id", d.id)
    .in("status", ["queued", "running"] as any)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (exErr) {
    console.error("select active scan error:", exErr.message);
  }
  let scanId: string | null = existing?.id ?? null;

  // 6) create new scan if none active
  if (!scanId) {
    const { data: s, error: sErr } = await supa
      .from("scans")
      .insert({ account_id: accountId, domain_id: d.id, status: "queued" })
      .select("id")
      .limit(1)
      .maybeSingle();

    if (sErr || !s) {
      // handle unique violation race (someone else created it between select/insert)
      const isUnique =
        typeof sErr?.message === "string" &&
        /duplicate key|unique/i.test(sErr.message);
      if (isUnique) {
        const { data: r } = await supa
          .from("scans")
          .select("id")
          .eq("account_id", accountId)
          .eq("domain_id", d.id)
          .in("status", ["queued", "running"] as any)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        scanId = r?.id ?? null;
      } else {
        return NextResponse.json(
          { error: sErr?.message || "create scan failed" },
          { status: 500, headers: noStoreHeaders() }
        );
      }
    } else {
      scanId = s.id;
    }
  }

  // 7) reply
  const base = process.env.REPORT_BASE_URL || "http://localhost:3000";
  return NextResponse.json(
    {
      scanId,
      reportUrl: `${base}/r/${scanId}`,
      accountId,
    },
    { headers: noStoreHeaders() }
  );
}

// CORS preflight
export async function OPTIONS() {
  return new Response(null, { headers: noStoreHeaders() });
}
