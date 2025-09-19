// ┌───────────────────────────────────────────────────────────┐
// │ File: app/api/orders/recompute/[orderId]/route.ts         │
// └───────────────────────────────────────────────────────────┘
import { NextResponse } from 'next/server';
import { computeVatLines, type VatContext, defaultIsB2BIntraEU } from '@/lib/vat/compute';
import { saveVatComputation } from '@/lib/vat/persist';

export const runtime = 'nodejs';

/**
 * Recompute VAT for a given order ID.
 * In production, you should fetch the order JSON from the Shopify Admin API.
 */
export async function POST(_req: Request, { params }: { params: { orderId: string } }) {
  // TODO: Replace stub with a real fetch of the order from Shopify Admin API
  const order: any = {
    id: params.orderId,
    currency: 'GBP',
    taxes_included: true,
    line_items: [],
    shipping_lines: [],
  };

  const ctx: VatContext = {
    merchantCountry: 'GB',
    merchantIsOssRegistered: false,
    isB2BIntraEUWithValidVat: defaultIsB2BIntraEU,
    shippingPolicy: () => ({ scheme: 'UK_STD', ratePct: 20, countryOfSupply: 'GB' }),
  };

  const result = computeVatLines(order, ctx);
  await saveVatComputation({ order, result, shopDomain: 'example.myshopify.com', taxesIncluded: !!order.taxes_included });

  return NextResponse.json({ ok: true, orderId: params.orderId });
}

