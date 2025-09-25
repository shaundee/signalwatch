// ┌───────────────────────────────────────────────────────────┐
// │ File: app/api/scan/peek/route.ts                          │
// └───────────────────────────────────────────────────────────┘
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { headers } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** In-memory throttle per IP (dev-safe, HMR-safe best effort) */
const lastHitByIp = new Map<string, number>();
const MIN_INTERVAL_MS = 1800;

export async function GET() {
  // hard throttle (coalesce bursts)
  const ip =
    (headers().get("x-forwarded-for") || "").split(",")[0].trim() || "local";
  const now = Date.now();
  const last = lastHitByIp.get(ip) ?? 0;
  if (now - last < MIN_INTERVAL_MS) {
    lastHitByIp.set(ip, now);
    return new NextResponse(null, {
      status: 204,
      headers: {
        "cache-control": "no-store, no-cache, must-revalidate, max-age=0",
        pragma: "no-cache",
        expires: "0",
        "retry-after": String(Math.ceil((MIN_INTERVAL_MS - (now - last)) / 1000)),
      },
    });
  }
  lastHitByIp.set(ip, now);

  // build payload
  const supa = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE!
  );

  const envOk =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE;

  const countRes = await supa
    .from("scans")
    .select("*", { head: true, count: "exact" })
    .eq("status", "queued");

  const selRes = await supa
    .from("scans")
    .select("id, status, created_at")
    .order("created_at", { ascending: false })
    .limit(10);

  return NextResponse.json(
    {
      marker: "peek-v1",
      envOk,
      queuedCount: countRes.count ?? 0,
      selectError: selRes.error?.message ?? null,
      rows: selRes.data ?? [],
    },
    {
      headers: {
        "cache-control": "no-store, no-cache, must-revalidate, max-age=0",
        pragma: "no-cache",
        expires: "0",
      },
    }
  );
}
