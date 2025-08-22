// app/api/repair-subscription/route.ts
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabaseServer } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const supa = supabaseServer();
  const { data: { user } } = await supa.auth.getUser();
  if (!user?.id) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { session_id, subscription_id } = await req.json().catch(() => ({} as any));

  try {
    let sub: any = null;
    let customerId: string | undefined;

    if (session_id) {
      const sess = await stripe.checkout.sessions.retrieve(session_id, { expand: ["subscription", "customer"] });
      customerId = typeof sess.customer === "string" ? sess.customer : sess.customer?.id;
      sub = typeof sess.subscription === "string"
        ? await stripe.subscriptions.retrieve(sess.subscription)
        : sess.subscription;
    } else if (subscription_id) {
      sub = await stripe.subscriptions.retrieve(subscription_id);
      customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
    } else {
      return NextResponse.json({ error: "Provide session_id or subscription_id" }, { status: 400 });
    }

    if (!sub || !customerId) {
      return NextResponse.json({ error: "Could not resolve subscription/customer" }, { status: 404 });
    }

    const first = sub.items.data[0];
    const price = first?.price;

    await supabaseAdmin.from("stripe_billing").upsert(
      {
        user_id: user.id,
        email: user.email ?? null,
        stripe_customer_id: customerId,
        stripe_subscription_id: sub.id,
        status: sub.status,
        plan: price?.recurring?.interval ?? null, // "month" | "year"
        price_id: price?.id ?? null,
        current_period_end: sub.current_period_end
          ? new Date(sub.current_period_end * 1000).toISOString()
          : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    return NextResponse.json({
      ok: true,
      stripe_customer_id: customerId,
      stripe_subscription_id: sub.id,
      status: sub.status,
    });
  } catch (e: any) {
    console.error("repair-subscription error:", e?.raw?.message || e?.message || e);
    return NextResponse.json({ error: "repair_failed" }, { status: 500 });
  }
}
