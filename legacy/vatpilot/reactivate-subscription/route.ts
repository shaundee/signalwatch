import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { stripe } from "@/lib/stripe";
import type Stripe from "stripe";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

export async function POST() {
  try {
    const supa = supabaseServer();
    const { data: { user } } = await supa.auth.getUser();
    if (!user?.id) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { data: row } = await supabaseAdmin
      .from("stripe_billing")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!row?.stripe_customer_id) return NextResponse.json({ error: "No Stripe customer found" }, { status: 404 });

    const subs = await stripe.subscriptions.list({ customer: row.stripe_customer_id, status: "all", limit: 20 });
    const target =
      subs.data.find(s => (s.cancel_at_period_end || !!s.cancel_at) && ["active","trialing","past_due"].includes(s.status))
      ?? null;

    if (!target) {
      const activeLike = subs.data.find(s => ["active","trialing"].includes(s.status) && !s.cancel_at_period_end && !s.cancel_at);
      if (activeLike) return NextResponse.json({ ok: true, already_active: true });
      return NextResponse.json({ error: "No subscription scheduled to cancel" }, { status: 404 });
    }

    let updated: Stripe.Subscription;
    if (target.cancel_at) {
      // ts-expect-error Stripe accepts null to clear cancel_at
      updated = await stripe.subscriptions.update(
        target.id,
        { cancel_at: null, proration_behavior: "none" },
        { idempotencyKey: `reactivate-${user.id}-${target.id}-${randomUUID()}` }
      );
    } else if (target.cancel_at_period_end) {
      updated = await stripe.subscriptions.update(
        target.id,
        { cancel_at_period_end: false, proration_behavior: "none" },
        { idempotencyKey: `reactivate-${user.id}-${target.id}-${randomUUID()}` }
      );
    } else {
      return NextResponse.json({ ok: true, already_active: true });
    }

    const confirm = await stripe.subscriptions.retrieve(updated.id);

    return NextResponse.json({
      ok: true,
      subscription_id: confirm.id,
      status: confirm.status,
      cancel_at_period_end: confirm.cancel_at_period_end,
      cancel_at: confirm.cancel_at,
    });
  } catch (e: any) {
    console.error("reactivate-subscription error:", e?.message ?? e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
