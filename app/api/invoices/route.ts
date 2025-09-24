import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { stripe } from "@/lib/stripe";

export const runtime = "nodejs";

export async function GET() {
  try {
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

    if (!row?.stripe_customer_id) return NextResponse.json({ invoices: [] });

    const list = await stripe.invoices.list({ customer: row.stripe_customer_id, limit: 20 });
    const invoices = list.data.map((i) => ({
      id: i.id,
      number: i.number,
      status: i.status,
      currency: i.currency,
      amount_due: i.amount_due ?? 0,
      amount_paid: i.amount_paid ?? 0,
      created: i.created ? new Date(i.created * 1000).toISOString() : null,
      hosted_invoice_url: i.hosted_invoice_url,
      invoice_pdf: i.invoice_pdf,
    }));

    return NextResponse.json({ invoices });
  } catch (e: any) {
    console.error("invoices error:", e?.message ?? e);
    return NextResponse.json({ error: "Failed to load invoices" }, { status: 500 });
  }
}
