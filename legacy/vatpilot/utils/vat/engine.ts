export type Line = {
  kind: "item" | "shipping";
  qty: number;
  gross: number;        // line total inc VAT
  tax: number;          // line VAT amount
  rate: number;         // e.g. 0.2
};

export type OrderInput = {
  occurredAt: string;   // ISO
  currency: string;
  shippingCountry?: string;
  lines: Line[];
  refunds?: { occurredAt: string; gross: number; tax: number }[];
};

export type VatTotals = {
  net: number;
  tax: number;
  gross: number;
  byRate: { rate: number; net: number; tax: number; gross: number }[];
};

// Sum helper
function sum(a: number, b: number) { return a + b; }
const round = (n: number) => Math.round(n * 100) / 100;

export function computeOrderTotals(input: OrderInput): VatTotals {
  const byRate = new Map<number, { net: number; tax: number; gross: number }>();
  let gross = 0, tax = 0;

  for (const l of input.lines) {
    gross += l.gross;
    tax += l.tax;
    const net = l.gross - l.tax;
    const bucket = byRate.get(l.rate) || { net: 0, tax: 0, gross: 0 };
    bucket.net += net;
    bucket.tax += l.tax;
    bucket.gross += l.gross;
    byRate.set(l.rate, bucket);
  }

  // refunds reduce totals
  for (const r of input.refunds || []) {
    gross -= r.gross;
    tax -= r.tax;
    // we don’t try to apportion refunds per rate in MVP (can be improved)
  }

  const net = gross - tax;

  return {
    net: round(net),
    tax: round(tax),
    gross: round(gross),
    byRate: Array.from(byRate.entries()).map(([rate, b]) => ({
      rate,
      net: round(b.net),
      tax: round(b.tax),
      gross: round(b.gross),
    })),
  };
}

// Map totals into a UK 9-box draft (MVP: Box1 & Box6)
export function toNineBox(t: VatTotals) {
  const box1 = t.tax;     // output VAT on sales (MVP)
  const box6 = t.net;     // net value of sales excl VAT
  return {
    box1, box2: 0, box3: box1, box4: 0, box5: box1, box6, box7: 0, box8: 0, box9: 0,
  };
}
