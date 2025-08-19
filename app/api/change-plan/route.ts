import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { stripe } from "@/lib/stripe";
import type Stripe from "stripe";

export const runtime = "nodejs";

type Plan = "monthly" | "annual";

export async function POST(req: Request) {
  try {
    const { plan } = (await req.json()) as { plan?: Plan };
    if (plan !== "monthly" && plan !== "annual") {
      return NextResponse.json({ error: "plan must be 'monthly' or 'annual'" }, { status: 400 });
    }

    const monthlyId = process.env.STRIPE_PRICE_MONTHLY;
    const annualId  = process.env.STRIPE_PRICE_ANNUAL;
    if (!monthlyId || !annualId) {
      return NextResponse.json(
        { error: "Missing STRIPE_PRICE_MONTHLY / STRIPE_PRICE_ANNUAL env vars" },
        { status: 500 }
      );
    }
    const targetPrice = plan === "monthly" ? monthlyId : annualId;

    // Auth
    const supa = supabaseServer();
    const { data: { user }, error: userErr } = await supa.auth.getUser();
    if (userErr || !user?.id) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    // Find user's subscription
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

    if (!subscription) {
      return NextResponse.json({ error: "No active subscription found" }, { status: 404 });
    }

    const item = subscription.items.data[0];
    if (!item?.id) return NextResponse.json({ error: "No subscription item found" }, { status: 400 });

    if ((item.price?.id ?? "") === targetPrice) {
      return NextResponse.json({ ok: true, unchanged: true });
    }

    const updated = await stripe.subscriptions.update(subscription.id, {
      items: [{ id: item.id, price: targetPrice }],
      proration_behavior: "create_prorations",
    });

    // Webhook will sync DB
    return NextResponse.json({
      ok: true,
      status: updated.status,
      price: updated.items.data[0]?.price?.id,
    });
  } catch (e: any) {
    console.error("change-plan error:", e?.message ?? e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
