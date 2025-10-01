import Stripe from "stripe";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type Body = { priceId: string; accountId: string };

export async function POST(req: Request) {
  const { priceId, accountId } = (await req.json()) as Body;
  if (!priceId || !accountId) {
    return NextResponse.json({ error: "missing priceId or accountId" }, { status: 400 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" });
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE!);

  const { data: acc, error } = await admin
    .from("accounts")
    .select("id, name, stripe_customer_id")
    .eq("id", accountId)
    .single();

  if (error || !acc) {
    return NextResponse.json({ error: "account_not_found" }, { status: 404 });
  }

  // Create a customer once
  const customerId =
    acc.stripe_customer_id ||
    (await stripe.customers.create({
      name: acc.name ?? undefined,
      metadata: { account_id: accountId },
    })).id;

  if (!acc.stripe_customer_id) {
    await admin.from("accounts").update({ stripe_customer_id: customerId }).eq("id", accountId);
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/billing?sub=ok`,
    cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/pricing`,
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
    metadata: { account_id: accountId },
  });

  return NextResponse.json({ url: session.url });
}
