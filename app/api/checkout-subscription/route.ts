import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

export async function POST(req: Request) {
  const { plan } = await req.json().catch(() => ({ plan: "monthly" }));
  const price = plan === "annual" ? process.env.STRIPE_PRICE_ANNUAL : process.env.STRIPE_PRICE_MONTHLY;

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: price!, quantity: 1 }],
    allow_promotion_codes: true,
    success_url: `${baseUrl}/?sub=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/?sub=cancelled`,
    // Optional if using Stripe Tax:
    // automatic_tax: { enabled: true },
  });

  return NextResponse.json({ url: session.url });
}
