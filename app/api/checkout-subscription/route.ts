import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabaseServer } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type Stripe from "stripe";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { plan } = await req.json().catch(() => ({} as any));

    const supa = supabaseServer();
    const { data: { user } } = await supa.auth.getUser();
    if (!user?.id) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const priceId = plan === "annual" ? process.env.STRIPE_PRICE_ANNUAL : process.env.STRIPE_PRICE_MONTHLY;
    if (!priceId) return NextResponse.json({ error: "Missing price ID" }, { status: 400 });

    await stripe.prices.retrieve(priceId); // validate price exists

    // load any saved customer
 // ...after you've resolved `user`, `site`, and `priceId`

// Try to get a customer id from DB
let customer: string | undefined;
const { data: row } = await supabaseAdmin
  .from("stripe_billing")
  .select("stripe_customer_id")
  .eq("user_id", user.id)
  .order("updated_at", { ascending: false })
  .limit(1)
  .maybeSingle();
if (row?.stripe_customer_id) customer = row.stripe_customer_id;

// If we don't have one, try to find by email so we reuse old customers
if (!customer && user.email) {
  const found = await stripe.customers.list({ email: user.email, limit: 1 });
  if (found.data[0]) customer = found.data[0].id;
}

// Validate saved customer still exists; if not, forget it locally
if (customer) {
  try {
    const c = await stripe.customers.retrieve(customer);
    if ((c as any)?.deleted) throw new Error("deleted_customer");
  } catch (err: any) {
    const msg = err?.raw?.message || err?.message || "";
    if (msg.includes("No such customer") || msg === "deleted_customer") {
      await supabaseAdmin
        .from("stripe_billing")
        .update({ stripe_customer_id: null, stripe_subscription_id: null })
        .eq("stripe_customer_id", customer);
      customer = undefined;
    } else {
      throw err;
    }
  }
}

// If a valid customer already has an active/trialing sub, send to Portal (your existing 409 logic)
// ...

// ➜ Determine trial eligibility (monthly only)
const TRIAL_DAYS = Number(process.env.NEXT_PUBLIC_TRIAL_DAYS || "0");
let trialEligible = TRIAL_DAYS > 0 && (/* monthly only */ true);

// If we have a customer, check metadata and past subs
if (trialEligible && customer) {
  // 1) metadata flag
  const cust = (await stripe.customers.retrieve(customer)) as Stripe.Customer;
  if (cust.metadata?.trial_used === "true") {
    trialEligible = false;
  } else {
    // 2) scan history for any prior trial
    const subs = await stripe.subscriptions.list({ customer, status: "all", limit: 20 });
    if (subs.data.some(s => s.trial_start && s.trial_end)) {
      trialEligible = false;
    }
  }
}

// Build subscription_data with or without the trial
const subscription_data: Stripe.Checkout.SessionCreateParams.SubscriptionData = {
  metadata: { user_id: user.id, email: user.email || "" },
  ...(trialEligible ? { trial_period_days: TRIAL_DAYS } : {}),
};

// Create Checkout Session (no customer_creation in subscription mode)
const session = await stripe.checkout.sessions.create({
  mode: "subscription",
  ui_mode: "hosted",
  allow_promotion_codes: true,
  payment_method_collection: "always",
  line_items: [{ price: priceId, quantity: 1 }],
  ...(customer ? { customer } : {}),
  success_url: `${site}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: `${site}/checkout/cancel`,
  metadata: { user_id: user.id, email: user.email || "" },
  subscription_data,
});

return NextResponse.json({ url: session.url });

  } catch (e: any) {
    console.error("checkout-subscription error:", e?.raw?.message || e?.message || e);
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
  }
}
