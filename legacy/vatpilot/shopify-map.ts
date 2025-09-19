// lib/shopify-map.ts
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/** Resolve our internal shop.id from the shop domain Shopify sends on webhooks */
export async function getShopIdByDomain(shop_domain: string) {
  const { data, error } = await supabaseAdmin
    .from("shop")
    .select("id")
    .eq("shop_domain", shop_domain)
    .single();

  if (error || !data) {
    throw new Error(`Shop not found for domain: ${shop_domain}`);
  }
  return data.id as string;
}

/**
 * Upsert an order and its lines from an `orders/*` webhook payload.
 * Assumes unique constraint on (shop_id, shopify_order_id) in `orders`.
 */
export async function upsertOrderFromWebhook(shop_domain: string, order: any) {
  const shop_id = await getShopIdByDomain(shop_domain);

  // --- Upsert order ---
  const orderRow = {
    shop_id,
    shopify_order_id: String(order?.id ?? ""),
    order_name: (order?.name ?? null) as string | null,
    currency: (order?.currency ?? order?.presentment_currency ?? null) as string | null,
    created_at_src: (order?.created_at ?? null) as string | null,
    updated_at_src: (order?.updated_at ?? null) as string | null,
    subtotal_price: numberOrNull(order?.current_subtotal_price ?? order?.subtotal_price),
    total_tax: numberOrNull(order?.current_total_tax ?? order?.total_tax),
    total_price: numberOrNull(order?.current_total_price ?? order?.total_price),
    customer_email: (order?.email ?? order?.customer?.email ?? null) as string | null,
    shipping_country: (order?.shipping_address?.country_code ?? null) as string | null,
    raw: order ?? null, // jsonb column recommended
  };

  if (!orderRow.shopify_order_id) {
    throw new Error("Missing order.id in webhook payload");
  }

  const upsert = await supabaseAdmin
    .from("orders")
    .upsert(orderRow, { onConflict: "shop_id,shopify_order_id" })
    .select("id")
    .single();

  if (upsert.error) throw upsert.error;
  const dbOrderId = upsert.data.id as string;

  // --- Rebuild order_lines (idempotent: delete then insert) ---
  const del = await supabaseAdmin.from("order_lines").delete().eq("order_id", dbOrderId);
  if (del.error) throw del.error;

  const items = Array.isArray(order?.line_items) ? order!.line_items : [];
  const shipLines = Array.isArray(order?.shipping_lines) ? order!.shipping_lines : [];

  const lines: any[] = [];

  // Product lines
  for (const li of items) {
    const price = numberOrNull(li?.price);
    const qty = numberOrNull(li?.quantity) ?? 0;
    lines.push({
      order_id: dbOrderId,
      shop_id,
      line_type: "product", // your enum/text
      shopify_line_id: String(li?.id ?? ""),
      sku: (li?.sku ?? null) as string | null,
      title: (li?.title ?? null) as string | null,
      quantity: qty,
      price,
      total: mult(price, qty),
      tax_rate: taxRateFromLine(li),
      tax_lines: (Array.isArray(li?.tax_lines) ? li.tax_lines : null) as any,
      raw: li ?? null,
    });
  }

  // Shipping as synthetic line(s)
  for (const sl of shipLines) {
    const price = numberOrNull(sl?.price);
    lines.push({
      order_id: dbOrderId,
      shop_id,
      line_type: "shipping",
      shopify_line_id: String(sl?.id ?? ""),
      sku: null,
      title: (sl?.title ?? "Shipping") as string,
      quantity: 1,
      price,
      total: price,
      tax_rate: taxRateFromLine(sl),
      tax_lines: (Array.isArray(sl?.tax_lines) ? sl.tax_lines : null) as any,
      raw: sl ?? null,
    });
  }

  if (lines.length) {
    const ins = await supabaseAdmin.from("order_lines").insert(lines);
    if (ins.error) throw ins.error;
  }

  return { order_id: dbOrderId, inserted_lines: lines.length };
}

/**
 * Insert/Upsert refunds from `refunds/create` webhook.
 * Uses (shop_id, shopify_refund_id) uniqueness to be idempotent.
 */
export async function insertRefundFromWebhook(shop_domain: string, refund: any) {
  const shop_id = await getShopIdByDomain(shop_domain);

  const shopify_order_id = String(refund?.order_id ?? "");
  if (!shopify_order_id) throw new Error("Missing refund.order_id");

  // Resolve orders.id FK if present
  const orderSel = await supabaseAdmin
    .from("orders")
    .select("id")
    .eq("shop_id", shop_id)
    .eq("shopify_order_id", shopify_order_id)
    .maybeSingle();

  const order_id = orderSel.data?.id ?? null;

  const refundRow = {
    shop_id,
    order_id,
    shopify_refund_id: String(refund?.id ?? ""),
    shopify_order_id,
    created_at_src: (refund?.created_at ?? null) as string | null,
    note: (refund?.note ?? null) as string | null,
    transactions: (Array.isArray(refund?.transactions) ? refund.transactions : null) as any,
    refund_line_items: (Array.isArray(refund?.refund_line_items) ? refund.refund_line_items : null) as any,
    raw: refund ?? null,
  };

  if (!refundRow.shopify_refund_id) {
    throw new Error("Missing refund.id in webhook payload");
  }

  const ins = await supabaseAdmin
    .from("refunds")
    .upsert(refundRow, { onConflict: "shop_id,shopify_refund_id" });

  if (ins.error) throw ins.error;

  return { refund_id: refundRow.shopify_refund_id };
}

// ----------------- helpers -----------------

function numberOrNull(v: any): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function mult(a: number | null, b: number | null): number | null {
  if (a === null || b === null) return null;
  return a * b;
}

/** Pull first tax_lines.rate if present, e.g., 0.2 for 20% */
function taxRateFromLine(li: any): number | null {
  const arr = Array.isArray(li?.tax_lines) ? li.tax_lines : [];
  const first = arr[0];
  return typeof first?.rate === "number" ? first.rate : null;
}
