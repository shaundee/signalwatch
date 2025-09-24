import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const supa = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE!
  );
  const { count: domains } = await supa.from("domains").select("*", { count: "exact", head: true });
  const { count: scans }   = await supa.from("scans").select("*",   { count: "exact", head: true });
  return NextResponse.json({
    marker: "diag-db",
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasServiceRole: !!process.env.SUPABASE_SERVICE_ROLE,
    domains, scans
  });
}
