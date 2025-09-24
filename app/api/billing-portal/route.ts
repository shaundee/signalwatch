import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { stripe } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST() {
  try {
    const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const supa = supabaseServer();
    const { data: { user } } = await supa.auth.getUser();
    if (!user?.id) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { data: row } = await supabaseAdmin
      .from("stripe_billing")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const customer = row?.stripe_customer_id;
    if (!customer) {
      // No customer on file → tell the client to start checkout
      return NextResponse.json(
        { error: "missing_customer", message: "No Stripe customer on file. Start a subscription first." },
        { status: 409 }
      );
    }

    try {
      const session = await stripe.billingPortal.sessions.create({
        customer,
        return_url: `${site}/dashboard`,
      });
      return NextResponse.json({ url: session.url });
    } catch (e: any) {
      const msg = e?.raw?.message || e?.message || "";
      // If Stripe says the customer doesn't exist anymore, clear our pointer and ask the client to start checkout
      if (msg.includes("No such customer")) {
        await supabaseAdmin
          .from("stripe_billing")
          .update({ stripe_customer_id: null })
          .eq("stripe_customer_id", customer);
        return NextResponse.json(
          { error: "missing_customer", message: "Your billing profile was removed. Please start a new checkout." },
          { status: 409 }
        );
      }
      console.error("billing-portal error:", e);
      return NextResponse.json({ error: "internal_error" }, { status: 500 });
    }
  } catch (e) {
    console.error("billing-portal unexpected error:", e);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
