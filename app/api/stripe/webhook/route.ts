import { headers } from "next/headers";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type Stripe from "stripe";

export const runtime = "nodejs";

async function upsertFromSubscription(sub: Stripe.Subscription, sourceEvent: string) {
  const customerId = (sub.customer as string) ?? undefined;
  const subscriptionId = sub.id;
  const status = sub.status;
  const priceId = (sub.items.data[0]?.price?.id) ?? null;
  const planInterval = (sub.items.data[0]?.price?.recurring?.interval) ?? null;
  const currentPeriodEnd =
    sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null;

  // Try to fetch email from customer
  let email: string | null = null;
  if (customerId) {
    try {
      const cust = await stripe.customers.retrieve(customerId);
      if (cust && !("deleted" in cust)) email = cust.email;
    } catch {}
  }

  const { error } = await supabaseAdmin
    .from("stripe_billing")
    .upsert(
      {
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        status,
        price_id: priceId,
        plan: planInterval,
        current_period_end: currentPeriodEnd,
        email,
        metadata: { latest_event: sourceEvent },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "stripe_customer_id" }
    );

  if (error) {
    console.error("Supabase upsert error:", error);
    throw error;
  }
}

export async function POST(req: Request) {
  const sig = headers().get("stripe-signature");
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !whSecret) {
    return new Response("Missing signature or webhook secret", { status: 400 });
  }

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, whSecret);
  } catch (err: any) {
    console.error("❌ Webhook signature verification failed:", err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const cs = event.data.object as Stripe.Checkout.Session;
        if (cs.subscription) {
          const subId = cs.subscription as string;
          const sub = await stripe.subscriptions.retrieve(subId);
          await upsertFromSubscription(sub, event.type);
        } else if (cs.mode === "payment") {
          const customerId = (cs.customer as string) ?? undefined;
          let email: string | null = cs.customer_details?.email ?? null;
          if (!email && customerId) {
            try {
              const cust = await stripe.customers.retrieve(customerId);
              if (cust && !("deleted" in cust)) email = cust.email;
            } catch {}
          }
          const { error } = await supabaseAdmin
            .from("stripe_billing")
            .upsert(
              {
                stripe_customer_id: customerId,
                email,
                status: "one_time",
                metadata: { latest_event: event.type },
                updated_at: new Date().toISOString(),
              },
              { onConflict: "stripe_customer_id" }
            );
          if (error) throw error;
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await upsertFromSubscription(sub, event.type);
        break;
      }

      case "invoice.payment_succeeded": {
        const inv = event.data.object as Stripe.Invoice;
        if (inv.subscription) {
          const sub = await stripe.subscriptions.retrieve(inv.subscription as string);
          await upsertFromSubscription(sub, event.type);
        }
        break;
      }

      default:
        break;
    }

    return new Response("ok", { status: 200 });
  } catch (err: any) {
    console.error("Webhook handler error:", err?.message ?? err);
    return new Response("Internal error", { status: 500 });
  }
}
