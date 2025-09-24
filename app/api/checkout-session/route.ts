import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

export async function POST() {
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "gbp",
          unit_amount: 500,
          product_data: { name: "Test VAT report" },
        },
        quantity: 1,
      },
    ],
    success_url: "http://localhost:3000?paid=1",
    cancel_url: "http://localhost:3000?cancelled=1",
  });

  return NextResponse.json({ url: session.url });
}