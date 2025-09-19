// VatPilot — VAT logic core (TypeScript)
// Single-file drop-in: put this in /lib/vat/compute.ts (or similar)
// No external deps. Uses integer pennies to avoid float errors.

/*************************
 * TYPES & ENUMS
 *************************/
export type Currency = 'GBP' | 'EUR' | 'USD' | string;

export type VatScheme =
  | 'UK_STD' // 20%
  | 'UK_RED' // 5%
  | 'UK_ZERO' // 0%
  | 'EU_OSS' // destination-country VAT via OSS
  | 'REV_CHARGE' // B2B intra-EU reverse charge
  | 'EXEMPT' // out of scope / exempt
  | 'INTL_EXPORT'; // export outside UK/EU

export interface VatLine {
  orderId: string;
  sourceId: string; // line_item.id, shipping_line.id, refund.id etc
  source: 'line_item' | 'shipping' | 'refund_item' | 'refund_shipping' | 'adjustment';
  sku?: string | null;
  title: string;
  quantity: number;
  ratePct: number; // e.g. 20 for 20%
  vatScheme: VatScheme;
  netPennies: number; // always integer pennies
  vatPennies: number; // always integer pennies
  grossPennies: number; // net + vat
  currency: Currency;
  countryOfSupply: string; // ISO-2 of where tax is due (e.g. 'GB')
  notes?: string;
}

export interface VatSummary {
  lines: VatLine[];
  totals: {
    netPennies: number;
    vatPennies: number;
    grossPennies: number;
  };
  // Pre-aggregation helpful for UK 9-box mapping (sales side only)
  ukBoxes: {
    vatDueSalesPennies: number; // Box 1
    vatDueAcquisitionsPennies: number; // Box 2 (usually 0 for Shopify merchants)
    totalVatDuePennies: number; // Box 3 = 1 + 2
    vatReclaimedCurrPeriodPennies: number; // Box 4 (from purchases; not computed here)
    netVatDuePennies: number; // Box 5 = 3 - 4
    totalValueSalesExVAT: number; // Box 6 (whole pounds, no pennies)
    totalValuePurchasesExVAT: number; // Box 7 (not computed here)
    totalValueGoodsSuppliedExVAT: number; // Box 8 (EU goods supplies, often 0)
    totalValueAcquisitionsExVAT: number; // Box 9 (EU acquisitions, often 0)
  };
}

/*************************
 * SHOPIFY-SHAPED INPUTS (minimal subset we use)
 *************************/
export interface ShopifyTaxLine {
  price: string; // decimal string in shop currency (amount of tax on this line)
  rate: number; // e.g. 0.2
  title?: string;
}

export interface ShopifyDiscountAllocation {
  amount: string; // decimal string
  discount_application_index?: number;
}

export interface ShopifyLineItem {
  id: number | string;
  title: string;
  sku?: string | null;
  quantity: number;
  // prices:
  price: string; // unit price BEFORE any discounts, in shop currency
  taxable: boolean;
  tax_lines?: ShopifyTaxLine[];
  discount_allocations?: ShopifyDiscountAllocation[];
  total_discount?: string; // optional total discount on the line (decimal)
}

export interface ShopifyShippingLine {
  id: number | string;
  title: string;
  price: string; // shipping charge
  tax_lines?: ShopifyTaxLine[];
}

export interface ShopifyRefundLineItem {
  line_item_id: number | string;
  quantity: number;
  subtotal: string; // refund net or gross per Shopify semantics
  total_tax: string; // tax portion of the refund
}

export interface ShopifyRefund {
  id: number | string;
  refund_line_items: ShopifyRefundLineItem[];
  shipping?: { amount: string; tax_amount?: string };
}

export interface ShopifyOrderLike {
  id: number | string;
  currency: Currency;
  current_total_price?: string; // not required for our math
  current_total_tax?: string;
  subtotal_price?: string;
  total_discounts?: string;
  taxes_included: boolean; // key flag: tax-inclusive pricing?
  customer?: { tax_exempt?: boolean; default_address?: { country_code?: string | null } | null } | null;
  shipping_address?: { country_code?: string | null } | null;
  billing_address?: { country_code?: string | null } | null;
  presentment_currency?: Currency; // if using multi-currency, still compute in shop currency
  tax_lines?: ShopifyTaxLine[]; // order-level tax summary
  line_items: ShopifyLineItem[];
  shipping_lines?: ShopifyShippingLine[];
  refunds?: ShopifyRefund[];
}

/*************************
 * CONTEXT / CONFIG
 *************************/
export interface VatContext {
  merchantCountry: string; // e.g. 'GB'
  merchantIsOssRegistered?: boolean;
  // If you already classify products -> rate, fill this map by SKU or other key
  productRateBySku?: Record<string, { scheme: VatScheme; ratePct: number; countryOfSupply?: string; notes?: string }>;
  // Reverse charge checker
  isB2BIntraEUWithValidVat?: (order: ShopifyOrderLike) => boolean;
  // Shipping VAT policy override if needed
  shippingPolicy?: (order: ShopifyOrderLike) => { scheme: VatScheme; ratePct: number; countryOfSupply: string };
}

/*************************
 * MONEY HELPERS (integer pennies, half-up rounding)
 *************************/
const toPennies = (amountStr: string): number => {
  const [int, frac = ''] = amountStr.split('.');
  const f = (frac + '00').slice(0, 2);
  const sign = amountStr.trim().startsWith('-') ? -1 : 1;
  return sign * (Math.abs(parseInt(int || '0', 10)) * 100 + Math.abs(parseInt(f || '0', 10)));
};

const penniesToStr = (p: number): string => (p / 100).toFixed(2);

// (a * b) / base with HALF-UP rounding to pennies
const mulDivToPennies = (aPennies: number, b: number, base: number): number => {
  const num = aPennies * b;
  const q = Math.trunc(num / base);
  const r = Math.abs(num % base);
  const half = Math.trunc(base / 2);
  const adj = r >= half ? (num >= 0 ? 1 : -1) : 0;
  return q + adj;
};

// Compute VAT from gross when price includes VAT
const vatFromGrossInclusive = (grossPennies: number, ratePct: number): { net: number; vat: number } => {
  if (ratePct <= 0) return { net: grossPennies, vat: 0 };
  const denom = 100 + ratePct;
  const net = mulDivToPennies(grossPennies, 100, denom);
  const vat = grossPennies - net;
  return { net, vat };
};

// Compute VAT from net when price excludes VAT
const vatFromNetExclusive = (netPennies: number, ratePct: number): { net: number; vat: number } => {
  if (ratePct <= 0) return { net: netPennies, vat: 0 };
  const vat = mulDivToPennies(netPennies, ratePct, 100);
  return { net: netPennies, vat };
};

/*************************
 * DISCOUNT PRORATION
 *************************/
// Pro-rate an order-level discount total across line items by pre-discount line subtotal
const prorateDiscounts = (lines: { id: string | number; preDiscountGrossPennies: number }[], orderLevelDiscountPennies: number) => {
  const sumGross = lines.reduce((a, l) => a + l.preDiscountGrossPennies, 0);
  if (sumGross === 0 || orderLevelDiscountPennies === 0) {
    return Object.fromEntries(lines.map(l => [String(l.id), 0]));
  }
  let remaining = Math.abs(orderLevelDiscountPennies);
  const sign = orderLevelDiscountPennies < 0 ? -1 : 1; // support negative adjustments if needed
  const allocations: Record<string, number> = {};
  lines.forEach((l, idx) => {
    if (idx === lines.length - 1) {
      allocations[String(l.id)] = sign * remaining; // put the remainder on last line to preserve cents
    } else {
      const share = Math.round((Math.abs(l.preDiscountGrossPennies) * Math.abs(orderLevelDiscountPennies)) / sumGross);
      allocations[String(l.id)] = sign * share;
      remaining -= share;
    }
  });
  return allocations;
};

/*************************
 * VAT TREATMENT RESOLUTION (simplified, override in context as needed)
 *************************/
const resolveVatForItem = (
  order: ShopifyOrderLike,
  ctx: VatContext,
  line?: ShopifyLineItem,
  isShipping = false
): { scheme: VatScheme; ratePct: number; countryOfSupply: string; notes?: string } => {
  const shipCountry = order.shipping_address?.country_code || order.billing_address?.country_code || ctx.merchantCountry;

  // B2B intra-EU reverse charge
  if (ctx.isB2BIntraEUWithValidVat?.(order)) {
    return { scheme: 'REV_CHARGE', ratePct: 0, countryOfSupply: shipCountry || 'GB', notes: 'B2B reverse charge' };
  }

  // Product-specific override by SKU
  if (line?.sku && ctx.productRateBySku?.[line.sku]) {
    const m = ctx.productRateBySku[line.sku];
    return { scheme: m.scheme, ratePct: m.ratePct, countryOfSupply: m.countryOfSupply || shipCountry || 'GB', notes: m.notes };
  }

  // Shipping override
  if (isShipping && ctx.shippingPolicy) {
    return ctx.shippingPolicy(order);
  }

  // Default UK-centric logic
  const isUK = (shipCountry || 'GB') === 'GB';
  if (isUK) {
    return { scheme: 'UK_STD', ratePct: 20, countryOfSupply: 'GB' };
  }

  // EU destination — if OSS registered, charge destination VAT, else zero-rate export (simplified)
  const euCountries = new Set(['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE']);
  if (euCountries.has((shipCountry || '').toUpperCase())) {
    if (ctx.merchantIsOssRegistered) {
      // You would look up the destination VAT rate here — placeholder 20%
      return { scheme: 'EU_OSS', ratePct: 20, countryOfSupply: (shipCountry || 'GB').toUpperCase(), notes: 'Placeholder rate — plug your rate lookup' };
    }
    // Not OSS registered => treat as export outside UK tax scope
    return { scheme: 'INTL_EXPORT', ratePct: 0, countryOfSupply: 'GB', notes: 'Export to EU without OSS — zero VAT' };
  }

  // Rest of world — export (zero-rated)
  return { scheme: 'INTL_EXPORT', ratePct: 0, countryOfSupply: 'GB', notes: 'Export ROW — zero VAT' };
};

/*************************
 * CORE: COMPUTE VAT LINES FROM SHOPIFY ORDER
 *************************/
export function computeVatLines(order: ShopifyOrderLike, ctx: VatContext): VatSummary {
  const lines: VatLine[] = [];
  const orderId = String(order.id);
  const currency = order.currency;
  const isTaxInclusive = !!order.taxes_included;

  // 1) Build base per-line totals BEFORE order-level discount spread
  const baseLines = order.line_items.map(li => {
    const unitGross = toPennies(li.price); // Shopify's price is usually the unit price (gross if taxes_included)
    const qty = li.quantity;
    const preDiscountGrossPennies = unitGross * qty; // BEFORE any order-level discounts

    // Line-level discounts (discount_allocations/total_discount) — subtract from gross before VAT math
    const lineLevelDiscount = toPennies(li.total_discount || '0');
    const grossAfterLineDisc = preDiscountGrossPennies - Math.abs(lineLevelDiscount);

    return {
      id: li.id,
      qty,
      title: li.title,
      sku: li.sku || null,
      preDiscountGrossPennies,
      grossAfterLineDisc,
      raw: li,
    };
  });

  // 2) Order-level discount proration across items
  const orderLevelDiscountPennies = toPennies(order.total_discounts || '0');
  const proration = prorateDiscounts(
    baseLines.map(b => ({ id: b.id, preDiscountGrossPennies: Math.max(0, b.grossAfterLineDisc) })),
    Math.max(0, orderLevelDiscountPennies - baseLines.reduce((a, b) => a + Math.max(0, toPennies(b.raw.total_discount || '0')), 0))
  );

  // 3) Compute VAT per sales line
  for (const b of baseLines) {
    const li = b.raw;
    const discountedGross = Math.max(0, b.grossAfterLineDisc - (proration[String(b.id)] || 0));

    const treatment = resolveVatForItem(order, ctx, li, false);

    let net = 0, vat = 0, gross = Math.max(0, discountedGross);
    if (isTaxInclusive) {
      const r = vatFromGrossInclusive(gross, treatment.ratePct);
      net = r.net; vat = r.vat;
    } else {
      const r = vatFromNetExclusive(gross, treatment.ratePct); // here `gross` variable represents NET when exclusive
      net = r.net; vat = r.vat; gross = net + vat;
    }

    lines.push({
      orderId,
      sourceId: String(li.id),
      source: 'line_item',
      sku: li.sku || null,
      title: li.title,
      quantity: li.quantity,
      ratePct: treatment.ratePct,
      vatScheme: treatment.scheme,
      netPennies: net,
      vatPennies: vat,
      grossPennies: gross,
      currency,
      countryOfSupply: treatment.countryOfSupply,
      notes: treatment.notes,
    });
  }

  // 4) Shipping as lines
  for (const sh of order.shipping_lines || []) {
    const grossInput = toPennies(sh.price);
    const treatment = resolveVatForItem(order, ctx, undefined, true);

    let net = 0, vat = 0, gross = Math.max(0, grossInput);
    if (isTaxInclusive) {
      const r = vatFromGrossInclusive(gross, treatment.ratePct);
      net = r.net; vat = r.vat;
    } else {
      const r = vatFromNetExclusive(gross, treatment.ratePct);
      net = r.net; vat = r.vat; gross = net + vat;
    }

    lines.push({
      orderId,
      sourceId: String(sh.id),
      source: 'shipping',
      sku: null,
      title: sh.title,
      quantity: 1,
      ratePct: treatment.ratePct,
      vatScheme: treatment.scheme,
      netPennies: net,
      vatPennies: vat,
      grossPennies: gross,
      currency,
      countryOfSupply: treatment.countryOfSupply,
      notes: treatment.notes,
    });
  }

  // 5) Refunds (reduce VAT in same boxes)
  for (const refund of order.refunds || []) {
    for (const rli of refund.refund_line_items || []) {
      const original = lines.find(l => l.source === 'line_item' && String(l.sourceId) === String(rli.line_item_id));
      const qtyFactor = Math.min(1, Math.max(0, rli.quantity / (original?.quantity || 1)));
      if (!original || qtyFactor <= 0) continue;

      // Refund figures typically provided as gross+tax portions; we recompute proportionally from original
      const refundGross = Math.round(original.grossPennies * qtyFactor);
      const refundNet = Math.round(original.netPennies * qtyFactor);
      const refundVat = refundGross - refundNet;

      lines.push({
        orderId,
        sourceId: `${refund.id}:${rli.line_item_id}`,
        source: 'refund_item',
        sku: original.sku || null,
        title: `Refund — ${original.title}`,
        quantity: Math.round((original.quantity || 1) * qtyFactor),
        ratePct: original.ratePct,
        vatScheme: original.vatScheme,
        netPennies: -refundNet,
        vatPennies: -refundVat,
        grossPennies: -refundGross,
        currency,
        countryOfSupply: original.countryOfSupply,
      });
    }

    if (refund.shipping?.amount) {
      // Find any shipping line to mirror rate
      const shipRef = lines.find(l => l.source === 'shipping');
      if (shipRef) {
        const refundGross = toPennies(refund.shipping.amount);
        const { ratePct, vatScheme, countryOfSupply } = shipRef;
        const r = order.taxes_included
          ? vatFromGrossInclusive(Math.abs(refundGross), ratePct)
          : vatFromNetExclusive(Math.abs(refundGross), ratePct);
        lines.push({
          orderId,
          sourceId: `${refund.id}:shipping`,
          source: 'refund_shipping',
          sku: null,
          title: 'Refund — Shipping',
          quantity: 1,
          ratePct,
          vatScheme,
          netPennies: -r.net,
          vatPennies: -r.vat,
          grossPennies: - (r.net + r.vat),
          currency,
          countryOfSupply,
        });
      }
    }
  }

  // 6) Totals & UK box helpers (sales only; purchases not covered here)
  const totals = lines.reduce(
    (acc, l) => {
      acc.netPennies += l.netPennies;
      acc.vatPennies += l.vatPennies;
      acc.grossPennies += l.grossPennies;
      return acc;
    },
    { netPennies: 0, vatPennies: 0, grossPennies: 0 }
  );

  // Box 1: VAT due on sales and other outputs (standard, reduced, shipping when taxable) minus refunds
  const vatDueSalesPennies = lines
    .filter(l => ['UK_STD','UK_RED','EU_OSS'].includes(l.vatScheme) && !l.source.startsWith('refund'))
    .reduce((a, l) => a + l.vatPennies, 0)
    + lines.filter(l => l.source.startsWith('refund')).reduce((a, l) => a + l.vatPennies, 0); // refunds are negative

  const totalValueSalesExVAT = lines
    .filter(l => l.source === 'line_item' || l.source === 'shipping')
    .reduce((a, l) => a + l.netPennies, 0);

  const ukBoxes = {
    vatDueSalesPennies: vatDueSalesPennies,
    vatDueAcquisitionsPennies: 0,
    totalVatDuePennies: vatDueSalesPennies + 0,
    vatReclaimedCurrPeriodPennies: 0, // purchases not in scope here
    netVatDuePennies: vatDueSalesPennies - 0,
    totalValueSalesExVAT: Math.max(0, Math.trunc(totalValueSalesExVAT / 100)), // whole pounds per HMRC
    totalValuePurchasesExVAT: 0,
    totalValueGoodsSuppliedExVAT: 0,
    totalValueAcquisitionsExVAT: 0,
  };

  return { lines, totals, ukBoxes };
}

/*************************
 * EXAMPLE: resolve B2B intra-EU reverse charge
 *************************/
export const defaultIsB2BIntraEU: VatContext['isB2BIntraEUWithValidVat'] = (order) => {
  const shipCountry = order.shipping_address?.country_code || order.billing_address?.country_code || 'GB';
  const eu = new Set(['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE']);
  const isEU = eu.has((shipCountry || '').toUpperCase());
  // You should replace this with your own VAT number validation & capture.
  const hasVat = !!order.customer && (order.customer as any)['vat_number_valid'] === true;
  return isEU && hasVat;
};

/*************************
 * QUICK UNIT-STYLE EXAMPLE
 *************************/
if (require?.main === module) {
  const order: ShopifyOrderLike = {
    id: '1001',
    currency: 'GBP',
    taxes_included: true,
    shipping_address: { country_code: 'GB' },
    line_items: [
      { id: 'L1', title: 'Widget', sku: 'WID-STD', quantity: 2, price: '12.00', taxable: true, total_discount: '0.00' },
      { id: 'L2', title: 'Book (zero)', sku: 'BOOK-Z', quantity: 1, price: '10.00', taxable: true, total_discount: '0.00' },
    ],
    shipping_lines: [ { id: 'S1', title: 'Standard Shipping', price: '3.00' } ],
  };

  const ctx: VatContext = {
    merchantCountry: 'GB',
    productRateBySku: {
      'WID-STD': { scheme: 'UK_STD', ratePct: 20 },
      'BOOK-Z': { scheme: 'UK_ZERO', ratePct: 0 },
    },
    isB2BIntraEUWithValidVat: defaultIsB2BIntraEU,
    shippingPolicy: (o) => ({ scheme: 'UK_STD', ratePct: 20, countryOfSupply: 'GB' }),
  };

  const result = computeVatLines(order, ctx);
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(result, null, 2));
}
