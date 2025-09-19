// ┌───────────────────────────────────────────────────────────┐
// │ File: app/api/vat/boxes/route.ts                          │
// └───────────────────────────────────────────────────────────┘
import { ok, bad } from "@/lib/api/http";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const shopDomain = (url.searchParams.get("shopDomain") || "").trim();
  const from = (url.searchParams.get("from") || "").trim();
  const to   = (url.searchParams.get("to") || "").trim();
  if (!shopDomain || !from || !to) return bad("Missing shopDomain/from/to", 400);

  const s = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  // Call your DB function (already present in your schema)
  const { data, error } = await s.rpc("calc_vat_boxes", {
    p_shop_domain: shopDomain,
    p_from: from,
    p_to: to,
  });
  if (error) return bad(error.message, 500, "calc_vat_boxes");

  const row = (data as any[])?.[0] ?? null;
  if (!row) return ok({ boxes: null, meta: { shopDomain, from, to } });

  const toMoney = (n: any) => Number(n ?? 0).toFixed(2);     // boxes 1–5
  const toInt   = (n: any) => Math.trunc(Number(n ?? 0));    // boxes 6–9 (whole pounds)

  const boxes = {
    vatDueSales: toMoney(row.vat_due_sales),
    vatDueAcquisitions: toMoney(row.vat_due_acquisitions),
    totalVatDue: toMoney(row.total_vat_due),
    vatReclaimedCurrPeriod: toMoney(row.vat_reclaimed_curr_period),
    netVatDue: toMoney(row.net_vat_due),
    totalValueSalesExVAT: toInt(row.total_value_sales_ex_vat),
    totalValuePurchasesExVAT: toInt(row.total_value_purchases_ex_vat),
    totalValueGoodsSuppliedExVAT: toInt(row.total_value_goods_supplied_ex_vat),
    totalAcquisitionsExVAT: toInt(row.total_acquisitions_ex_vat),
  };

  return ok({ boxes, meta: { shopDomain, from, to } });
}
