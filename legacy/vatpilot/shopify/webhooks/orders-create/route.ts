// ┌───────────────────────────────────────────────────────────┐
// │ File: app/api/shopify/webhooks/orders-create/route.ts     │
// └───────────────────────────────────────────────────────────┘
import { NextRequest, NextResponse } from 'next/server';
import { verifyShopifyWebhook } from '@/lib/shopify/verifyWebhook';
import { computeVatLines, type ShopifyOrderLike, type VatContext, defaultIsB2BIntraEU } from '@/lib/vat/compute';
import { saveVatComputation } from '@/lib/vat/persist';

export const runtime = 'nodejs'; // needed for crypto

export async function POST(req: NextRequest) {
  // 1) Validate HMAC using the *raw* body
  const rawBody = await req.text();
  const hmac = req.headers.get('x-shopify-hmac-sha256') || '';
  const topic = req.headers.get('x-shopify-topic') || '';
  const shop = req.headers.get('x-shopify-shop-domain') || '';

  if (!verifyShopifyWebhook(rawBody, hmac)) {
    return new NextResponse('Invalid HMAC', { status: 401 });
  }

  if (topic !== 'orders/create' && topic !== 'orders/updated') {
    return new NextResponse('Ignored topic', { status: 200 });
  }

  // 2) Parse order JSON & compute VAT
  let order: ShopifyOrderLike;
  try {
    order = JSON.parse(rawBody) as ShopifyOrderLike;
  } catch {
    return new NextResponse('Bad JSON', { status: 400 });
  }

  // TODO: fetch merchant context (country/OSS/shipping policy) from your DB via shop domain
  const ctx: VatContext = {
    merchantCountry: 'GB',
    merchantIsOssRegistered: false,
    isB2BIntraEUWithValidVat: defaultIsB2BIntraEU,
    shippingPolicy: () => ({ scheme: 'UK_STD', ratePct: 20, countryOfSupply: 'GB' }),
  };

  const result = computeVatLines(order, ctx);

  // 3) Persist normalized VAT lines & order summary
  await saveVatComputation({
    order,
    result,
    shopDomain: shop,
    taxesIncluded: !!order.taxes_included,
  });

  // Respond 200 quickly so Shopify stops retrying
  return NextResponse.json({ ok: true });
}
