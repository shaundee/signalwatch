import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET() {
  const row = {
    shop_domain: "probe.dev",
    topic: "probe/test",
    payload: { ok: true },
    received_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin
    .from("webhook_events")
    .insert(row)
    .select();

  if (error) {
    console.error("SUPA-TEST INSERT ERROR:", error);
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }
  return NextResponse.json({ ok: true, data });
}
