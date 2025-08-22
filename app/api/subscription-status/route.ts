import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { stripe } from "@/lib/stripe";
import type Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function pickBest(subs: Stripe.Subscription[]) {
  return (
    subs.find(s => ["active","trialing","past_due"].includes(s.status) && !s.cancel_at && !s.cancel_at_period_end) ||
    subs.find(s => ["active","trialing","past_due"].includes(s.status)) ||
    subs[0] ||
    null
  );
}

export async function GET() {
  try {
    const supa = supabaseServer();
    const { data: { user } } = await supa.auth.getUser();
    if (!user?.id) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    // First try the DB by user_id
    let { data: row } = await supabaseAdmin
      .from("stripe_billing")
      .select("status, plan, price_id, current_period_end, stripe_customer_id, stripe_subscription_id, updated_at, email")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // If no row, try to find the Stripe customer by email and heal DB
    if (!row) {
      if (!user.email) return NextResponse.json({ found: false }, { headers: { "Cache-Control": "no-store" } });

      const cl = await stripe.customers.list({ email: user.email, limit: 1 });
      const customer = cl.data[0];
      if (!customer) return NextResponse.json({ found: false }, { headers: { "Cache-Control": "no-store" } });

      const subs = await stripe.subscriptions.list({ customer: customer.id, status: "all", limit: 20 });
      const sub = pickBest(subs.data);
      if (!sub) return NextResponse.json({ found: false }, { headers: { "Cache-Control": "no-store" } });

      const item = sub.items.data[0];
      const price = item?.price;

      // Upsert and re-load as the user's row
      await supabaseAdmin.from("stripe_billing").upsert(
        {
          user_id: user.id,
          email: customer.email ?? user.email,
          stripe_customer_id: customer.id,
          stripe_subscription_id: sub.id,
          status: sub.status,
          plan: price?.recurring?.interval ?? null,
          price_id: price?.id ?? null,
          current_period_end: sub.current_period_end
            ? new Date(sub.current_period_end * 1000).toISOString()
            : null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "stripe_customer_id" }
      );

      row = {
        status: sub.status,
        plan: price?.recurring?.interval ?? null,
        price_id: price?.id ?? null,
        current_period_end: sub.current_period_end
          ? new Date(sub.current_period_end * 1000).toISOString()
          : null,
        stripe_customer_id: customer.id,
        stripe_subscription_id: sub.id,
        updated_at: new Date().toISOString(),
        email: customer.email ?? user.email ?? null,
      };
    }

    // If we got here, row exists; also confirm live status from Stripe
    let sub: Stripe.Subscription | null = null;
    if (row.stripe_customer_id) {
      const list = await stripe.subscriptions.list({
        customer: row.stripe_customer_id,
        status: "all",
        limit: 20,
      });
      sub = pickBest(list.data);
    }
    if (!sub) return NextResponse.json({ found: false }, { headers: { "Cache-Control": "no-store" } });

    const cancel_at_period_end = !!sub.cancel_at_period_end;
    const cancel_at = sub.cancel_at ?? null;
    const scheduled_to_cancel = !!(cancel_at_period_end || cancel_at);

    const firstItem = sub.items.data[0];
    const price = firstItem?.price;

    return NextResponse.json(
      {
        found: true,
        status: sub.status,
        plan: price?.recurring?.interval ?? null,
        price_id: price?.id ?? null,
        current_period_end: sub.current_period_end
          ? new Date(sub.current_period_end * 1000).toISOString()
          : null,
        stripe_customer_id: row.stripe_customer_id,
        stripe_subscription_id: sub.id,
        updated_at: new Date().toISOString(),
        cancel_at_period_end,
        cancel_at,
        scheduled_to_cancel,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: any) {
    console.error("subscription-status GET error:", e?.message ?? e);
    return NextResponse.json({ error: "Internal error" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
