// ┌───────────────────────────────────────────────────────────┐
// │ File: app/api/shopify/webhooks/route.ts                   │
// └───────────────────────────────────────────────────────────┘
import { NextRequest } from "next/server";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { ok, bad } from "@/lib/api/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // never cache

const SHOPIFY_WEBHOOK_SECRET = process.env.SHOPIFY_WEBHOOK_SECRET!;

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

function verifyHmac(raw: string, hmacHeader: string | null) {
  if (!hmacHeader) return false;
  const digest = crypto.createHmac("sha256", SHOPIFY_WEBHOOK_SECRET)
    .update(raw, "utf8")
    .digest("base64");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(hmacHeader, "utf8"),
      Buffer.from(digest, "utf8")
    );
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const topic = (req.headers.get("x-shopify-topic") || "").toLowerCase();
  const shopDomain = (req.headers.get("x-shopify-shop-domain") || "").toLowerCase();
  const hmac = req.headers.get("x-shopify-hmac-sha256");

  const raw = await req.text(); // must read raw body
  const valid = verifyHmac(raw, hmac);

  let payload: any = {};
  try { payload = raw ? JSON.parse(raw) : {}; } catch { payload = {}; }

  // Always log event for audit/debug
  const supabase = sb();
  await supabase.from("webhook_events").insert({
    shop_domain: shopDomain || null,
    topic,
    payload,
    received_at: new Date().toISOString(),
  });

  if (!valid) {
    return bad("Invalid HMAC", 401, "hmac");
  }

  try {
    switch (topic) {
      case "orders/create":
      case "orders/updated":
        await ingestOrder(supabase, shopDomain, payload);
        break;
      case "refunds/create":
        await ingestRefund(supabase, shopDomain, payload);
        break;
      default:
        // other topics ignored
        break;
    }
  } catch (e: any) {
    console.error("[shopify/webhooks] ingest error", topic, e);
  }

  return ok({ received: true });
}

// ---------- Ingest helpers ----------

async function ingestOrder(s: ReturnType<typeof sb>, shop: string, o: any) {
  const orderId = String(o.id ?? "");
  await s.from("orders").upsert({
    id: orderId,
    shop_domain: shop,
    shopify_order_id: String(o.id ?? ""),
    order_number: String(o.order_number ?? ""),
    currency: o.currency ?? null,
    created_at_src: o.created_at ?? null,
    updated_at_src: o.updated_at ?? null,
    subtotal_price: Number(o.subtotal_price ?? 0),
    total_tax: Number(o.total_tax ?? 0),
    total_price: Number(o.total_price ?? 0),
    customer_email: o.email ?? null,
    shipping_country: o.shipping_address?.country_code ?? null,
    raw: o,
  }, { onConflict: "id" });

  if (Array.isArray(o.line_items)) {
    const rows = o.line_items.map((li: any) => ({
      id: String(li.id ?? ""),
      order_id: orderId,
      shop_domain: shop,
      shopify_line_id: String(li.id ?? ""),
      sku: li.sku ?? null,
      title: li.title ?? null,
      quantity: Number(li.quantity ?? 0),
      price: Number(li.price ?? 0),
      total: Number(li.price ?? 0) * Number(li.quantity ?? 0),
      tax_rate: li.tax_lines?.[0]?.rate ?? null,
      tax_lines: li.tax_lines ?? [],
      raw: li,
    }));
    await s.from("order_lines").upsert(rows, { onConflict: "id" });
  }
}

async function ingestRefund(s: ReturnType<typeof sb>, shop: string, r: any) {
  const refundId = String(r.id ?? "");
  await s.from("refunds").upsert({
    id: refundId,
    shop_domain: shop,
    shopify_refund_id: refundId,
    shopify_order_id: String(r.order_id ?? ""),
    created_at_src: r.created_at ?? null,
    note: r.note ?? null,
    transactions: r.transactions ?? [],
    refund_line_items: r.refund_line_items ?? [],
    raw: r,
  }, { onConflict: "id" });
}
