import { NextResponse } from "next/server";
import { parse } from "csv-parse/sync";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type Row = Record<string, string>;

function toNum(s?: string) {
  if (!s) return 0;
  const n = parseFloat(String(s).replace(/[^0-9.-]/g, ""));
  return isFinite(n) ? n : 0;
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

    const text = await file.text();
    const records: Row[] = parse(text, { columns: true, skip_empty_lines: true });

    // Group by order "Name" or "Order ID"
    const byOrder = new Map<string, Row[]>();
    for (const r of records) {
      const key = r["Name"] || r["Order ID"] || r["Order Number"];
      if (!key) continue;
      const arr = byOrder.get(key) || [];
      arr.push(r);
      byOrder.set(key, arr);
    }

    // Insert orders + items
    for (const [orderKey, rows] of byOrder) {
      const first = rows[0];
      const createdAt = first["Created at"] || first["Created At"] || first["Created At (UTC)"];
      const dest = first["Shipping Country"] || first["Shipping Address Country"] || "GB";
      const email = first["Email"] || first["Customer Email"] || null;

      // Sum shipping (Shopify CSV usually repeats on each row; we take first non-zero)
      let shippingNet = 0, shippingVat = 0;
      for (const r of rows) {
        const ship = toNum(r["Shipping"]);
        const taxShip = toNum(r["Shipping Tax"]);
        if (ship || taxShip) { shippingNet = ship; shippingVat = taxShip; break; }
      }

      const { data: ord, error: e1 } = await supabaseAdmin
        .from("orders")
        .insert({
          shopify_order_id: String(orderKey),
          order_number: String(orderKey),
          created_at: createdAt ? new Date(createdAt).toISOString() : new Date().toISOString(),
          destination_country: dest || "GB",
          customer_email: email,
          shipping_lines_total_net: shippingNet,
          shipping_lines_total_vat: shippingVat,
          raw: first
        })
        .select("id")
        .single();

      if (e1) {
        // ignore duplicates
        if (!String(e1.message || "").includes("duplicate key")) {
          console.error("order insert error:", e1);
        }
        continue;
      }
      const orderId = ord!.id;

      for (const r of rows) {
        const title = r["Lineitem name"] || r["Lineitem title"] || r["Product Title"] || "Item";
        const variant = r["Lineitem variant"] || r["Variant Title"] || null;

        const unitPrice = toNum(r["Lineitem price"]);
        const qty = toNum(r["Lineitem quantity"]) || 1;
        const lineNet = unitPrice * qty;

        // Shopify export might include "Lineitem tax" or a tax rate column (%)
        const taxAmt = toNum(r["Lineitem tax"]);
        let rate = toNum(r["Tax %"]) || toNum(r["Tax Rate"]);
        if (!rate && lineNet) {
          rate = (taxAmt / lineNet) * 100;
        }

        await supabaseAdmin.from("order_items").insert({
          order_id: orderId,
          title,
          variant,
          quantity: qty,
          net_amount: lineNet,
          vat_amount: taxAmt,
          vat_rate: Number.isFinite(rate) ? Math.round(rate * 100) / 100 : null,
          raw: r
        });
      }
    }

    return NextResponse.json({ ok: true, imported: byOrder.size });
  } catch (e: any) {
    console.error("import error:", e?.message || e);
    return NextResponse.json({ error: "Import failed" }, { status: 500 });
  }
}
