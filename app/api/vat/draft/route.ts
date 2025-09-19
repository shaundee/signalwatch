import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function isDate(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const start = url.searchParams.get("start") || "";
  const end = url.searchParams.get("end") || "";

  if (!isDate(start) || !isDate(end)) {
    return NextResponse.json({ ok: false, error: "Invalid start/end" }, { status: 400 });
  }

  // Build ISO range
  const from = `${start}T00:00:00Z`;
  const to = `${end}T23:59:59Z`;

  // ---- Orders / Lines ----
  // We’ll try to read from order_lines if it exists; otherwise fallback to orders.
  let ordersCount = 0;
  let netSales = 0; // Box 6 (net, excl VAT, excl shipping)
  let vatDue = 0;   // Box 1 (VAT on goods + shipping)

  // 1) Sum lines
  {
    // Expect columns on order_lines: price (net), total (gross) OR tax_rate/tax_lines/total_tax.
    // We’ll try a couple of shapes safely.
    const { data: lines, error } = await supabaseAdmin
      .from("order_lines")
      .select("created_at, line_type, price, total, tax_rate, tax_lines, total_tax", { head: false, count: "exact" })
      .gte("created_at", from)
      .lte("created_at", to);

    if (!error && lines) {
      ordersCount = (lines as any[]).reduce((acc, l) => acc + (l ? 1 : 0), 0); // rough; improved via distinct(order_id) later

      for (const l of lines as any[]) {
        const isShipping = (l.line_type || "").toLowerCase().includes("shipping");
        const price = Number(l.price ?? 0);       // expected net price
        const total = Number(l.total ?? 0);       // if only total exists and price is null, we’ll derive net via tax
        const explicitTax = Number(l.total_tax ?? 0);
        // derive VAT if needed
        let vat = explicitTax;
        if (!vat && l.tax_rate) {
          vat = price * Number(l.tax_rate);
        } else if (!vat && total && price) {
          vat = Math.max(0, total - price);
        } else if (!vat && total && !price) {
          // last resort: if we only have total and no tax metadata, assume no VAT
          vat = 0;
        }

        // Box 6 excludes shipping net
        if (!isShipping) netSales += price || Math.max(0, total - vat);

        // Box 1 includes VAT on everything (goods + shipping)
        vatDue += vat;
      }
    } else {
      // Fallback: use orders table if order_lines isn’t populated
      const { data: orders, error: e2 } = await supabaseAdmin
        .from("orders")
        .select("subtotal_price,total_tax,created_at", { head: false, count: "exact" })
        .gte("created_at", from)
        .lte("created_at", to);

      if (e2) {
        return NextResponse.json({ ok: false, error: e2.message }, { status: 500 });
      }
      ordersCount = orders?.length ?? 0;
      for (const o of orders || []) {
        netSales += Number(o.subtotal_price ?? 0);
        vatDue += Number(o.total_tax ?? 0);
      }
    }
  }

  // 2) Refunds in period — subtract both net and VAT components
  {
    // Expect refunds table with at least: created_at, refund_amount_net, refund_vat OR raw json
    const { data: refunds } = await supabaseAdmin
      .from("refunds")
      .select("created_at, amount_net, amount_vat, total, tax", { head: false })
      .gte("created_at", from)
      .lte("created_at", to);

    for (const r of (refunds || []) as any[]) {
      const net = Number(r.amount_net ?? r.total ?? 0);
      const vat = Number(r.amount_vat ?? r.tax ?? 0);
      netSales -= net;
      vatDue -= vat;
    }

    // Clamp if negative after refunds
    if (netSales < 0) netSales = 0;
    if (vatDue < 0) vatDue = 0;
  }

  return NextResponse.json({
    ok: true,
    orders: ordersCount,
    totals: {
      box1_vat_due: +vatDue.toFixed(2),
      box6_net_sales: +netSales.toFixed(2),
    },
  });
}
