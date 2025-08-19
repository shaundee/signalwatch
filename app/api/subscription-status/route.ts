import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/SupabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET() {
  try {
    const supa = supabaseServer();
    const { data: { user: authUser }, error: userErr } = await supa.auth.getUser();
    if (userErr || !authUser?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin
      .from("stripe_billing")
      .select("status, plan, price_id, current_period_end, stripe_customer_id, stripe_subscription_id, updated_at")
      .eq("email", authUser.email)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ found: false }, { status: 200 });
    return NextResponse.json({ found: true, ...data }, { status: 200 });
  } catch (e: any) {
    console.error("subscription-status GET error:", e?.message ?? e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
