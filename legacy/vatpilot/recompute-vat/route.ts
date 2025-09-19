import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { computeOrderTotals, toNineBox } from "@/utils/vat/engine";

export async function POST(req: Request) {
  try {
    const { shopId, from, to } = await req.json();
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get: n => cookieStore.get(n)?.value, set: () => {}, remove: () => {} } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: shop } = await supabase.from("shop").select("*").eq("id", shopId).maybeSingle();
    if (!shop || shop.owner_user_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Fetch orders in window
    const { data: orders, error } = await supabase
      .from("orders")
      .select("id, created_at, currency, shipping_country, total_price, total_tax, order_lines:order_lines(*), refunds(*)")
      .eq("shop_id", shopId)
      .gte("created_at", from)
      .lt("created_at", to)
      .order("created_at", { ascending: true });

    if (error) throw error;

    // Clear previous txns in window
    await supabase.from("vat_txns").delete()
      .eq("shop_id", shopId)
      .gte("occurred_at", from)
      .lt("occurred_at", to);

    let aggNet = 0, aggTax = 0, aggGross = 0;

    for (const o of (orders || [])) {
      const lines = (o.order_lines || []).filter((l: any) => ["item","shipping"].includes(l.kind)).map((l:any)=>({
        kind: l.kind, qty: l.quantity || 1, gross: Number(l.price||0), tax: Number(l.tax||0), rate: Number(l.tax_rate||0)
      }));
      const refunds = (o.refunds || []).map((r:any)=>({ occurredAt: r.created_at, gross: Number(r.total_refund||0), tax: Number(r.refund_tax||0) }));

      const totals = computeOrderTotals({
        occurredAt: o.created_at, currency: o.currency, shippingCountry: o.shipping_country, lines, refunds
      });

      aggNet += totals.net; aggTax += totals.tax; aggGross += totals.gross;

      // Optionally persist per-order VAT txns (collapsed)
      await supabase.from("vat_txns").insert({
        shop_id: shopId, order_id: o.id, occurred_at: o.created_at,
        type: "sale", country_code: "GB",
        rate: 0, net: totals.net, tax: totals.tax, gross: totals.gross,
        meta: {}
      });
    }

    // Upsert VAT return (draft)
    const nine = toNineBox({ net: aggNet, tax: aggTax, gross: aggGross, byRate: [] });
    const calc = { from, to, totals: { net: aggNet, tax: aggTax, gross: aggGross } };

    const { data: existing } = await supabase
      .from("vat_returns")
      .select("id")
      .eq("shop_id", shopId).eq("period_start", from).eq("period_end", to)
      .maybeSingle();

    if (existing) {
      await supabase.from("vat_returns").update({
        box1: nine.box1, box2: nine.box2, box3: nine.box3, box4: nine.box4, box5: nine.box5,
        box6: nine.box6, box7: nine.box7, box8: nine.box8, box9: nine.box9, calc
      }).eq("id", existing.id);
    } else {
      await supabase.from("vat_returns").insert({
        shop_id: shopId, period_start: from, period_end: to,
        box1: nine.box1, box2: nine.box2, box3: nine.box3, box4: nine.box4, box5: nine.box5,
        box6: nine.box6, box7: nine.box7, box8: nine.box8, box9: nine.box9, calc
      });
    }

    return NextResponse.json({ ok: true, nine, totals: calc.totals });
  } catch (e:any) {
    return NextResponse.json({ error: e.message || "recompute failed" }, { status: 500 });
  }
}
