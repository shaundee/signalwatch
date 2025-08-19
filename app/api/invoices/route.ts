import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { stripe } from "@/lib/stripe";

export const runtime = "nodejs";

export async function GET() {
  try {
    // Auth (server-side)
    const supa = supabaseServer();
    const { data: { user }, error: userErr } = await supa.auth.getUser();
    if (userErr || !user?.id) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    // Find Stripe customer for this user (prefer user_id)
    const { data: row, error } = await supabaseAdmin
      .from("stripe_billing")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const customerId = row?.stripe_customer_id;
    if (!customerId) return NextResponse.json({ invoices: [] }, { status: 200 });

    // List recent invoices
    const list = await stripe.invoices.list({ customer: customerId, limit: 12 });

    const invoices = list.data.map(inv => ({
      id: inv.id,
      number: inv.number,
      status: inv.status,
      currency: inv.currency,
      amount_due: inv.amount_due ?? 0,
      amount_paid: inv.amount_paid ?? 0,
      created: inv.created ? new Date(inv.created * 1000).toISOString() : null,
      period_start: inv.period_start ? new Date(inv.period_start * 1000).toISOString() : null,
      period_end: inv.period_end ? new Date(inv.period_end * 1000).toISOString() : null,
      hosted_invoice_url: inv.hosted_invoice_url ?? null,
      invoice_pdf: inv.invoice_pdf ?? null,
    }));

    return NextResponse.json({ invoices }, { status: 200 });
  } catch (e: any) {
    console.error("invoices GET error:", e?.message ?? e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
