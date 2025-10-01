import Stripe from "stripe";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const LIMITS: Record<"starter" | "pro" | "agency", { soft: number; hard: number }> = {
  starter: { soft: 200, hard: 200 },
  pro:     { soft: 600, hard: 600 },
  agency:  { soft: 2000, hard: 2000 },
};

export async function POST(req: Request) {
  const body = await req.text();
  const sig = (req.headers as any).get("stripe-signature");
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" });

  let evt: Stripe.Event;
  try {
    evt = stripe.webhooks.constructEvent(body, sig!, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (e: any) {
    return new NextResponse(`Webhook error: ${e.message}`, { status: 400 });
  }

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE!);

  async function updateAccountByCustomer(customerId: string, tier: keyof typeof LIMITS) {
    const { soft, hard } = LIMITS[tier];
    await admin
      .from("accounts")
      .update({ tier, soft_limit_scans: soft, hard_limit_scans: hard })
      .eq("stripe_customer_id", customerId);
  }

  if (evt.type === "checkout.session.completed") {
    const s = evt.data.object as Stripe.Checkout.Session;
    const customerId = s.customer as string | null;
    if (!customerId) return NextResponse.json({ ok: true });

    // Resolve subscription & price
    let price: Stripe.Price | null = null;
    if (s.subscription) {
      const sub = await stripe.subscriptions.retrieve(s.subscription as string, { expand: ["items.data.price"] });
      price = sub.items.data[0]?.price ?? null;
    } else if (s.line_items) {
      // rarely used; expand if needed
    }

    // Determine tier from price metadata or nickname/id
    const metaTier = (price?.metadata?.tier || price?.nickname || price?.id || "").toLowerCase();
    const tier: "starter" | "pro" | "agency" =
      metaTier.includes("agency") ? "agency" :
      metaTier.includes("pro")    ? "pro"    : "starter";

    await updateAccountByCustomer(customerId, tier);
  }

  if (evt.type === "customer.subscription.updated") {
    const sub = evt.data.object as Stripe.Subscription;
    const customerId = sub.customer as string;
    const price = sub.items.data[0]?.price;
    const metaTier = (price?.metadata?.tier || price?.nickname || price?.id || "").toLowerCase();
    const tier: "starter" | "pro" | "agency" =
      metaTier.includes("agency") ? "agency" :
      metaTier.includes("pro")    ? "pro"    : "starter";
    await updateAccountByCustomer(customerId, tier);
  }

  if (evt.type === "customer.subscription.deleted") {
    const sub = evt.data.object as Stripe.Subscription;
    const customerId = sub.customer as string;
    // Back to free
    await admin
      .from("accounts")
      .update({ tier: "free", soft_limit_scans: 50, hard_limit_scans: 100 })
      .eq("stripe_customer_id", customerId);
  }

  return NextResponse.json({ ok: true });
}
