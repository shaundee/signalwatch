import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { stripe } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { plan } = await req.json();
    const supa = supabaseServer();
    const { data: { user } } = await supa.auth.getUser();
    if (!user?.id) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const targetPrice =
      plan === "annual" ? process.env.STRIPE_PRICE_ANNUAL : process.env.STRIPE_PRICE_MONTHLY;
    if (!targetPrice) return NextResponse.json({ error: "Missing target price" }, { status: 400 });

    // Find sub
    const { data: row } = await supabaseAdmin
      .from("stripe_billing")
      .select("stripe_customer_id, stripe_subscription_id")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!row) return NextResponse.json({ error: "No subscription" }, { status: 404 });

    let subId = row.stripe_subscription_id ?? null;
    if (!subId && row.stripe_customer_id) {
      const list = await stripe.subscriptions.list({ customer: row.stripe_customer_id, status: "all", limit: 5 });
      subId = list.data[0]?.id ?? null;
    }
    if (!subId) return NextResponse.json({ error: "No subscription found" }, { status: 404 });

    const sub = await stripe.subscriptions.retrieve(subId);
    const item = sub.items.data[0];
    const currentPrice = item.price.id;
    if (currentPrice === targetPrice) {
      return NextResponse.json({ ok: true, unchanged: true });
    }

    const updated = await stripe.subscriptions.update(sub.id, {
      items: [{ id: item.id, price: targetPrice }],
      proration_behavior: "create_prorations",
    });

    return NextResponse.json({ ok: true, status: updated.status });
  } catch (e: any) {
    console.error("change-plan error:", e?.message ?? e);
    return NextResponse.json({ error: "Failed to change plan" }, { status: 500 });
  }
}
