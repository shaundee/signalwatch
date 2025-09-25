// ┌───────────────────────────────────────────────────────────┐
// │ File: app/api/health/route.ts                             │
// └───────────────────────────────────────────────────────────┘
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supa = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE!
    );

    // lightweight DB ping (head count; no rows fetched)
    const domains = await supa
      .from("domains")
      .select("*", { head: true, count: "exact" });

    const scans = await supa
      .from("scans")
      .select("*", { head: true, count: "exact" });

    const ok = domains.error == null && scans.error == null;

    return NextResponse.json(
      {
        ok,
        ts: Date.now(),
        db: {
          url: process.env.NEXT_PUBLIC_SUPABASE_URL,
          hasServiceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE),
          domains: domains.count ?? 0,
          scans: scans.count ?? 0,
        },
        version: process.env.VERCEL_GIT_COMMIT_SHA || process.env.COMMIT_SHA || "dev",
      },
      { headers: { "cache-control": "no-store" }, status: ok ? 200 : 500 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? String(e) },
      { headers: { "cache-control": "no-store" }, status: 500 }
    );
  }
}
