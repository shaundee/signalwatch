import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { stripe } from "@/lib/stripe";
import type Stripe from "stripe";

export const runtime = "nodejs";

export async function POST() {
  try {
    const supa = supabaseServer();
    const { data: { user }, error: userErr } = await supa.auth.getUser();
    if (userErr || !user?.id) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { data: row, error } = await supabaseAdmin
      .from("stripe_billing")
      .select("stripe_subscription_id, stripe_customer_id")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    let subscription: Stripe.Subscription | null = null;
    if (row?.stripe_subscription_id) {
      subscription = await stripe.subscriptions.retrieve(row.stripe_subscription_id);
    } else if (row?.stripe_customer_id) {
      const list = await stripe.subscriptions.list({ customer: row.stripe_customer_id, status: "active", limit: 1 });
      subscription = list.data[0] ?? null;
    }
    if (!subscription) return NextResponse.json({ error: "No active subscription found" }, { status: 404 });

    // If already set to cancel at period end, no-op
    if (subscription.cancel_at_period_end) return NextResponse.json({ ok: true, already_set: true });

    const updated = await stripe.subscriptions.update(subscription.id, { cancel_at_period_end: true });

    // DB will sync via webhook (customer.subscription.updated)
    return NextResponse.json({ ok: true, cancel_at_period_end: updated.cancel_at_period_end });
  } catch (e: any) {
    console.error("cancel-subscription error:", e?.message ?? e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
