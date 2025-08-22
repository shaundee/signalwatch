import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type Stripe from "stripe";

export const runtime = "nodejs";

/** Write/refresh our billing row from a subscription */
async function upsertFromSubscription(sub: Stripe.Subscription) {
  const item = sub.items?.data?.[0];
  const price = item?.price;
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;

  // try to capture email (handy for backfills)
  let email: string | null = null;
  if (customerId) {
    try {
      const cust = await stripe.customers.retrieve(customerId);
      if (!("deleted" in cust) && cust.email) email = cust.email;
    } catch {}
  }

  await supabaseAdmin.from("stripe_billing").upsert(
    {
      email,
      stripe_customer_id: customerId ?? null,
      stripe_subscription_id: sub.id ?? null,
      status: sub.status ?? null,
      plan: price?.recurring?.interval ?? null, // "month" | "year"
      price_id: price?.id ?? null,
      current_period_end: sub.current_period_end
        ? new Date(sub.current_period_end * 1000).toISOString()
        : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_customer_id" }
  );
}

/** Find the card fingerprint used for this subscription (default PM or latest invoice’s PM) */
async function getCardFingerprintForSubscription(sub: Stripe.Subscription): Promise<string | null> {
  // 1) default_payment_method on the sub
  if (typeof sub.default_payment_method === "string") {
    const pm = await stripe.paymentMethods.retrieve(sub.default_payment_method);
    return pm.card?.fingerprint ?? null;
  } else if (sub.default_payment_method && (sub.default_payment_method as any).id) {
    const pm = sub.default_payment_method as Stripe.PaymentMethod;
    return pm.card?.fingerprint ?? null;
  }

  // 2) fallback: latest invoice -> payment intent -> payment method
  let invoice: Stripe.Invoice | null = null;
  if (typeof sub.latest_invoice === "string" && sub.latest_invoice) {
    invoice = await stripe.invoices.retrieve(sub.latest_invoice);
  } else if (sub.latest_invoice && (sub.latest_invoice as any).id) {
    invoice = sub.latest_invoice as Stripe.Invoice;
  }

  if (invoice?.payment_intent) {
    let pi: Stripe.PaymentIntent | null = null;
    if (typeof invoice.payment_intent === "string") {
      pi = await stripe.paymentIntents.retrieve(invoice.payment_intent);
    } else {
      pi = invoice.payment_intent as Stripe.PaymentIntent;
    }

    const pmId = typeof pi.payment_method === "string" ? pi.payment_method : (pi.payment_method as any)?.id;
    if (pmId) {
      const pm = await stripe.paymentMethods.retrieve(pmId);
      return pm.card?.fingerprint ?? null;
    }
  }

  return null;
}

export async function POST(req: Request) {
  const sig = headers().get("stripe-signature");
  const whsec = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !whsec) return NextResponse.json({}, { status: 400 });

  const raw = await req.text();
  let event: Stripe.Event;

  try {
    event = await stripe.webhooks.constructEventAsync(raw, sig, whsec);
  } catch (err: any) {
    console.error("Webhook signature verify failed:", err?.message || err);
    return NextResponse.json({}, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const sess = event.data.object as Stripe.Checkout.Session;
        if (sess.mode === "subscription" && sess.subscription) {
          const sub =
            typeof sess.subscription === "string"
              ? await stripe.subscriptions.retrieve(sess.subscription)
              : (sess.subscription as Stripe.Subscription);

          await upsertFromSubscription(sub);
          // no card enforcement here; we do it on subscription.created below
        }
        break;
      }

      case "customer.subscription.created": {
        const sub = event.data.object as Stripe.Subscription;
        await upsertFromSubscription(sub);

        // ── One-trial-per-customer: mark customer when a trial starts
        const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
        if (sub.trial_start && sub.trial_end && customerId) {
          try {
            await stripe.customers.update(customerId, { metadata: { trial_used: "true" } });
          } catch (e) {
            console.error("Failed to set customer.metadata.trial_used", e);
          }
        }

        // ── One-trial-per-card: if this sub has a trial, enforce by card fingerprint
        if (sub.trial_start && sub.trial_end) {
          const fingerprint = await getCardFingerprintForSubscription(sub);
          if (fingerprint) {
            // Check if this fingerprint got a trial before
            const { data: existing } = await supabaseAdmin
              .from("trial_cards")
              .select("card_fingerprint")
              .eq("card_fingerprint", fingerprint)
              .maybeSingle();

            if (existing) {
              // End trial immediately; charge now (no proration)
              try {
                await stripe.subscriptions.update(sub.id, {
                  trial_end: "now",
                  proration_behavior: "none",
                });
              } catch (e) {
                console.error("Failed to end duplicate trial immediately", e);
              }
            } else {
              // First time this card sees a trial — record it
              try {
                await supabaseAdmin.from("trial_cards").insert({
                  card_fingerprint: fingerprint,
                  first_user_id: (sub.metadata as any)?.user_id ?? null,
                  first_email: (sub.metadata as any)?.email ?? null,
                  first_customer_id: customerId ?? null,
                });
              } catch (e) {
                // unique constraint races are fine; ignore
              }
            }
          }
        }
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await upsertFromSubscription(sub);
        break;
      }

      default:
        // ignore others
        break;
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err) {
    console.error("Webhook handler error:", err);
    return NextResponse.json({}, { status: 500 });
  }
}
