import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveAccountForRequest } from "@/lib/account";

export const runtime = "nodejs";

export async function GET() {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE!
  );

  const { accountId } = await resolveAccountForRequest();
  const { data: acc, error } = await admin
    .from("accounts")
    .select("id, name, tier, stripe_customer_id, soft_limit_scans, hard_limit_scans")
    .eq("id", accountId)
    .single();

  if (error || !acc) return NextResponse.json({ error: "account_not_found" }, { status: 404 });
  return NextResponse.json({ account: acc });
}
