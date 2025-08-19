import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/SupabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { stripe } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST() {
  const supa = supabaseServer();
  const {
    data: { user: authUser },
    error: userErr,
  } = await supa.auth.getUser();

  if (userErr || !authUser?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("stripe_billing")
    .select("stripe_customer_id")
    .eq("email", authUser.email)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return NextResponse.json({ error: "Database error" }, { status: 500 });

  const customerId = data?.stripe_customer_id;
  if (!customerId) {
    return NextResponse.json({ error: "No customer found for this user" }, { status: 404 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const portal = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${baseUrl}/`,
  });

  return NextResponse.json({ url: portal.url });
}
