import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const supa = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE!  // must be service role
  );

  const envOk = !!process.env.SUPABASE_SERVICE_ROLE && process.env.SUPABASE_SERVICE_ROLE!.length > 20;

  const countRes = await supa
    .from("scans")
    .select("*", { count: "exact", head: true })
    .eq("status", "queued");

  const selRes = await supa
    .from("scans")
    .select("id,domain_id,created_at,status")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(5);

  return NextResponse.json({
    marker: "peek-v1",
    envOk,
    queuedCount: countRes.count ?? 0,
    selectError: selRes.error?.message ?? null,
    rows: selRes.data ?? [],
  });
}
