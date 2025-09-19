// ┌───────────────────────────────────────────────────────────┐
// │lib/vat/persist.ts                                   │
// └───────────────────────────────────────────────────────────┘
import { createClient } from '@supabase/supabase-js';
import type { VatSummary, ShopifyOrderLike } from '@/lib/vat/compute';

/**
 * Create a Supabase client with service role key.
 * Only call this server-side (e.g., in API routes).
 */
const getSupabase = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

/**
 * Save or update VAT computation results for a Shopify order.
 */
export async function saveVatComputation({
  order,
  result,
  shopDomain,
  taxesIncluded,
}: {
  order: ShopifyOrderLike;
  result: VatSummary;
  shopDomain: string;
  taxesIncluded: boolean;
}) {
  const supabase = getSupabase();

  // Upsert order summary row
  const orderRow = {
    shop_domain: shopDomain,
    order_id: String(order.id),
    currency: order.currency,
    taxes_included: taxesIncluded,
    net_pennies: result.totals.netPennies,
    vat_pennies: result.totals.vatPennies,
    gross_pennies: result.totals.grossPennies,
    uk_box1_vat_pennies: result.ukBoxes.vatDueSalesPennies,
    uk_box6_value_pounds: result.ukBoxes.totalValueSalesExVAT,
    raw_order: order as any,
    computed_at: new Date().toISOString(),
  };

  const { error: upsertErr } = await supabase
    .from('vat_orders')
    .upsert(orderRow, { onConflict: 'shop_domain,order_id' });
  if (upsertErr) throw upsertErr;

  // Delete existing lines before inserting fresh (idempotent recompute)
  await supabase
    .from('vat_lines')
    .delete()
    .eq('shop_domain', shopDomain)
    .eq('order_id', String(order.id));

  const lineRows = result.lines.map((l) => ({
    shop_domain: shopDomain,
    order_id: String(order.id),
    source_id: l.sourceId,
    source: l.source,
    sku: l.sku,
    title: l.title,
    quantity: l.quantity,
    rate_pct: l.ratePct,
    vat_scheme: l.vatScheme,
    net_pennies: l.netPennies,
    vat_pennies: l.vatPennies,
    gross_pennies: l.grossPennies,
    currency: l.currency,
    country_of_supply: l.countryOfSupply,
    notes: l.notes || null,
  }));

  const { error: insErr } = await supabase.from('vat_lines').insert(lineRows);
  if (insErr) throw insErr;
}
