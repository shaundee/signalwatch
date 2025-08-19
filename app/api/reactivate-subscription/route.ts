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
      const list = await stripe.subscriptions.list({ customer: row.stripe_customer_id, limit: 1 });
      subscription = list.data[0] ?? null;
    }
    if (!subscription) return NextResponse.json({ error: "No subscription found" }, { status: 404 });
    if (subscription.status === "canceled") {
      return NextResponse.json({ error: "Subscription is fully canceled. Start a new one from Pricing." }, { status: 409 });
    }
    if (!subscription.cancel_at_period_end) {
      return NextResponse.json({ ok: true, already_active: true });
    }

    const updated = await stripe.subscriptions.update(
      subscription.id,
      { cancel_at_period_end: false, proration_behavior: "none" },
      { idempotencyKey: `reactivate:${user.id}:${subscription.id}` }
    );

    return NextResponse.json({
      ok: true,
      cancel_at_period_end: updated.cancel_at_period_end,
      status: updated.status,
    });
  } catch (e: any) {
    console.error("reactivate-subscription error:", e?.message ?? e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// Optional: keep GET for quick health check
export async function GET() {
  return NextResponse.json({ ok: true, route: "reactivate-subscription" });
}
