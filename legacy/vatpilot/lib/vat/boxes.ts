// ┌───────────────────────────────────────────────────────────┐
// │ File: lib/vat/boxes.ts                                     │
// └───────────────────────────────────────────────────────────┘
import { createClient } from '@supabase/supabase-js';

export type NineBoxes = {
  periodKey: string; // fill in when calling HMRC obligations
  vatDueSales: string; // Box 1 (decimal string)
  vatDueAcquisitions: string; // Box 2
  totalVatDue: string; // Box 3 = 1 + 2
  vatReclaimedCurrPeriod: string; // Box 4 (purchases — not in scope yet)
  netVatDue: string; // Box 5 = 3 - 4
  totalValueSalesExVAT: string; // Box 6 (whole pounds, as string)
  totalValuePurchasesExVAT: string; // Box 7 (not in scope yet)
  totalValueGoodsSuppliedExVAT: string; // Box 8 (usually 0)
  totalValueAcquisitionsExVAT: string; // Box 9 (usually 0)
};

/**
 * Aggregate previously computed orders for a date range to produce UK 9‑boxes.
 * fromISO is inclusive, toISO is exclusive.
 */
export async function computeNineBoxesForRange({
  shopDomain,
  fromISO,
  toISO,
}: {
  shopDomain: string;
  fromISO: string;
  toISO: string;
}): Promise<NineBoxes> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { data: orders, error } = await supabase
    .from('vat_orders')
    .select('uk_box1_vat_pennies, uk_box6_value_pounds')
    .eq('shop_domain', shopDomain)
    .gte('computed_at', fromISO)
    .lt('computed_at', toISO);

  if (error) throw error;

  let box1Pennies = 0;
  let box6Pounds = 0;
  for (const o of orders || []) {
    box1Pennies += o.uk_box1_vat_pennies || 0;
    box6Pounds += o.uk_box6_value_pounds || 0;
  }

  const box1 = (box1Pennies / 100).toFixed(2);
  const box2 = '0.00';
  const box3 = (Number(box1) + Number(box2)).toFixed(2);
  const box4 = '0.00'; // integrate purchases later
  const box5 = (Number(box3) - Number(box4)).toFixed(2);

  return {
    periodKey: '',
    vatDueSales: box1,
    vatDueAcquisitions: box2,
    totalVatDue: box3,
    vatReclaimedCurrPeriod: box4,
    netVatDue: box5,
    totalValueSalesExVAT: String(Math.max(0, Math.trunc(box6Pounds))),
    totalValuePurchasesExVAT: '0',
    totalValueGoodsSuppliedExVAT: '0',
    totalValueAcquisitionsExVAT: '0',
  };
}
