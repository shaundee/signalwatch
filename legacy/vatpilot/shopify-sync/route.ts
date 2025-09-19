import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { listOrdersSince } from "@/utils/shopify";

export async function POST(req: Request) {
  try {
    const { since, shopId } = await req.json();
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get: n => cookieStore.get(n)?.value, set: () => {}, remove: () => {} } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Ensure the shop belongs to the user
    const { data: shop } = await supabase.from("shop").select("*").eq("id", shopId).maybeSingle();
    if (!shop || shop.owner_user_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const iso = since || new Date(Date.now() - 90*24*3600*1000).toISOString(); // last 90 days default
    const orders = await listOrdersSince(iso);

    let inserted = 0;
    for (const o of orders) {
      const base = {
        shop_id: shopId,
        shopify_id: String(o.id),
        name: o.name,
        created_at: o.created_at ?? o.processed_at ?? new Date().toISOString(),
        processed_at: o.processed_at,
        currency: o.currency ?? shop.currency,
        financial_status: o.financial_status,
        fulfillment_status: o.fulfillment_status,
        customer_email: o.email ?? o.customer?.email ?? null,
        shipping_country: o.shipping_address?.country_code,
        total_price: Number(o.total_price ?? 0),
        total_tax: Number(o.total_tax ?? 0),
        is_test: !!o.test,
        raw: o,
      };
      const { data, error } = await supabase.from("orders")
        .insert(base)
        .select("id")
        .single()
        .throwOnError();
      if (!error) inserted++;

      // Lines (items)
      const lines = [];
      for (const li of o.line_items ?? []) {
        const gross = Number(li.price) * (li.quantity ?? 1);
        const tax = (li.tax_lines ?? []).reduce((s: number, tl: any) => s + Number(tl.price), 0);
        const rate = (li.tax_lines && li.tax_lines[0]) ? Number(li.tax_lines[0].rate) : 0;
        lines.push({
          order_id: data.id, kind: "item", title: li.title, quantity: li.quantity ?? 1,
          price: gross, tax, tax_rate: rate, taxable: !!li.taxable
        });
      }
      // Shipping lines
      for (const sh of o.shipping_lines ?? []) {
        const gross = Number(sh.price);
        const tax = (sh.tax_lines ?? []).reduce((s: number, tl: any) => s + Number(tl.price), 0);
        const rate = (sh.tax_lines && sh.tax_lines[0]) ? Number(sh.tax_lines[0].rate) : 0;
        lines.push({
          order_id: data.id, kind: "shipping", title: sh.title ?? "Shipping", quantity: 1,
          price: gross, tax, tax_rate: rate, taxable: true
        });
      }
      if (lines.length) await supabase.from("order_lines").insert(lines);

      // Refunds (coarse)
      for (const r of o.refunds ?? []) {
        const refundGross = (r.transactions ?? []).filter((t: any)=>t.kind==="refund").reduce((s:number,t:any)=>s+Number(t.amount),0);
        const refundTax = (r.refund_line_items ?? []).flatMap((rli: any)=> rli.line_item?.tax_lines ?? [])
                          .reduce((s:number, tl:any)=> s + Number(tl.price ?? 0), 0);
        await supabase.from("refunds").insert({
          order_id: data.id,
          created_at: r.created_at ?? o.processed_at ?? new Date().toISOString(),
          total_refund: refundGross, refund_tax: refundTax, raw: r
        });
      }
    }

    return NextResponse.json({ ok: true, imported: inserted, sample: orders.length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "sync failed" }, { status: 500 });
  }
}
