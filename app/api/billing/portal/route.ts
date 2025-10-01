import Stripe from "stripe";
import { NextResponse } from "next/server";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const { customerId } = await req.json();
  if (!customerId) return NextResponse.json({ error: "missing customerId" }, { status: 400 });
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" });
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/billing`,
  });
  return NextResponse.json({ url: session.url });
}
