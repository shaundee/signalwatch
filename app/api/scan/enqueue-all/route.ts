import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
export const runtime = "nodejs";

export async function POST() {
  const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE!);
  const { data: domains } = await supa.from("domains").select("id");
  if (!domains?.length) return NextResponse.json({ enqueued: 0 });

  const scans = domains.map(d => ({ domain_id: d.id, status: "queued" }));
  await supa.from("scans").insert(scans);
  return NextResponse.json({ enqueued: scans.length });
}
