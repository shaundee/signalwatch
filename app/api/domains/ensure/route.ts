// app/api/domains/ensure/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Same sanitizer used in /api/scan/start
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
  process.env.SUPABASE_SERVICE_ROLE! // server-only secret
);

async function ensureDomain(rawUrl: string) {
  const url = normUrl(rawUrl);
  const { data, error } = await supa
    .from("domains")
    .upsert({ url }, { onConflict: "url" })
    .select("id,url,last_alert_hash,last_alert_at,created_at,updated_at")
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("ensure_failed");
  return data;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({} as any));
  const rawUrl = body?.url as string | undefined;
  if (!rawUrl) return NextResponse.json({ error: "url required" }, { status: 400 });

  try {
    const domain = await ensureDomain(rawUrl);
    return NextResponse.json({ ok: true, domain });
  } catch (e: any) {
    const msg = e?.message || "invalid";
    const code = msg === "https_required" || msg === "invalid_host" ? 400 : 400;
    return NextResponse.json({ error: msg }, { status: code });
  }
}

export async function GET(req: NextRequest) {
  const rawUrl = req.nextUrl.searchParams.get("url") || undefined;
  if (!rawUrl) return NextResponse.json({ error: "url required" }, { status: 400 });

  try {
    const domain = await ensureDomain(rawUrl);
    return NextResponse.json({ ok: true, domain });
  } catch (e: any) {
    const msg = e?.message || "invalid";
    const code = msg === "https_required" || msg === "invalid_host" ? 400 : 400;
    return NextResponse.json({ error: msg }, { status: code });
  }
}
