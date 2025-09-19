// ┌───────────────────────────────────────────────────────────┐
// │ File: app/api/vat/submit/route.ts                         │
/* │ Calculates 9 boxes (enhanced) → refreshes token → submits
   │ to HMRC (unless dryRun=true) → upserts receipt.          */
// └───────────────────────────────────────────────────────────┘
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { HmrcClient, type HmrcToken } from "@/lib/hmrc/client";
import { refreshAccessToken } from "@/lib/hmrc/oauth";
import { BoxesSchema, SubmitQuerySchema } from "@/lib/validation/hmrc";
import { ok, bad } from "@/lib/api/http";

export const runtime = "nodejs";

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

// HMRC formatting rules
const toMoney = (n: number) => (Number.isFinite(n) ? n : 0).toFixed(2); // boxes 1–5
const toInt   = (n: number) => (Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0); // boxes 6–9

type OrderRow = {
  subtotal_price: number | null;
  total_tax: number | null;
  refund_amount_net_guess: number | null;
  refund_amount_vat_guess: number | null;
};

type ExpenseRow = { net_amount: number | null; vat_amount: number | null };
type AcquisitionRow = { acquisitions_net: number | null; vat_due: number | null };

function tableMissing(err: { message?: string; details?: string; code?: string }) {
  const m = `${err?.message ?? ""} ${err?.details ?? ""} ${err?.code ?? ""}`.toLowerCase();
  return m.includes("does not exist") || (m.includes("relation") && m.includes("does not exist"));
}

export async function POST(req: NextRequest) {
    
  const url = new URL(req.url);
  const shopDomain = (url.searchParams.get("shopDomain") || "").trim();
  const vrn        = (url.searchParams.get("vrn") || "").trim();
  const periodKey  = (url.searchParams.get("periodKey") || "").trim();
  const from       = (url.searchParams.get("from") || "").trim();
  const to         = (url.searchParams.get("to") || "").trim();
  const dryRun     = (url.searchParams.get("dryRun") || "").toLowerCase() === "true";
  const finalised  = (url.searchParams.get("finalised") || "").toLowerCase() !== "false"; // default true

  const parsed = SubmitQuerySchema.safeParse({
  shopDomain, vrn, periodKey, from, to,
  dryRun: url.searchParams.get("dryRun") || undefined,
  finalised: url.searchParams.get("finalised") || undefined,
});


if (!parsed.success) {
  return bad(parsed.error.issues.map(i => i.message).join("; "), 400, "submit_validate_query");
}
  if (!vrn || !periodKey || !shopDomain || !from || !to) {
  return bad("Missing shopDomain, vrn, periodKey, from or to", 400);
  }

  const supabase = sb();
  const diagnostics: Record<string, any> = {};

  // ---------------------------
  // 1) SALES & REFUNDS → Boxes 1 & 6
  // ---------------------------
  const { data: orders, error: oErr } = await supabase
    .from("v_orders_consolidated")
    .select("subtotal_price,total_tax,refund_amount_net_guess,refund_amount_vat_guess")
    .eq("shop_domain", shopDomain)
    .gte("created_at_src", `${from}T00:00:00Z`)
    .lte("created_at_src", `${to}T23:59:59Z`);

  if (oErr) {
    return bad(oErr.message, 500, "db_orders");
  }

  const rows: OrderRow[] = (orders as any[]) ?? [];
  diagnostics.ordersCount = rows.length;

  let headerNet = 0, headerVat = 0, refundNet = 0, refundVat = 0;
  for (const r of rows) {
    headerNet += Number(r.subtotal_price ?? 0);
    headerVat += Number(r.total_tax ?? 0);
    refundNet += Number(r.refund_amount_net_guess ?? 0);
    refundVat += Number(r.refund_amount_vat_guess ?? 0);
  }
  const salesNet = Math.max(0, headerNet - refundNet);
  const salesVat = Math.max(0, headerVat - refundVat);

  let box1 = salesVat; // VAT due on sales
  let box6 = salesNet; // total value of sales (ex VAT)

  // ---------------------------
  // 2) PURCHASES / INPUT VAT (optional) → Boxes 4 & 7
  // ---------------------------
  let box4 = 0, box7 = 0;
  try {
    const { data: expenses, error: eErr } = await supabase
      .from("v_expenses_vat")
      .select("net_amount,vat_amount")
      .eq("shop_domain", shopDomain)
      .gte("created_at", `${from}T00:00:00Z`)
      .lte("created_at", `${to}T23:59:59Z`);
    if (!eErr && expenses) {
      for (const x of expenses as ExpenseRow[]) {
        box7 += Number(x.net_amount ?? 0);
        box4 += Number(x.vat_amount ?? 0);
      }
      box4 = Math.max(0, box4);
      box7 = Math.max(0, box7);
    } else if (eErr && !tableMissing(eErr)) {
   return bad(eErr.message, 500, "db_expenses");
    } else {
      diagnostics.expensesInfo = "v_expenses_vat not present — boxes 4/7 left as 0";
    }
  } catch { diagnostics.expensesInfo = "v_expenses_vat lookup failed silently"; }

  // ---------------------------
  // 3) EU ACQUISITIONS (optional) → Boxes 2 & 9
  // ---------------------------
  let box2 = 0, box9 = 0;
  try {
    const { data: acq, error: aErr } = await supabase
      .from("v_eu_acquisitions")
      .select("acquisitions_net,vat_due")
      .eq("shop_domain", shopDomain)
      .gte("created_at", `${from}T00:00:00Z`)
      .lte("created_at", `${to}T23:59:59Z`);
    if (!aErr && acq) {
      for (const a of acq as AcquisitionRow[]) {
        box9 += Number(a.acquisitions_net ?? 0);
        box2 += Number(a.vat_due ?? 0);
      }
      box2 = Math.max(0, box2);
      box9 = Math.max(0, box9);
    } else if (aErr && !tableMissing(aErr)) {
     return bad(aErr.message, 500, "db_acquisitions");
    } else {
      diagnostics.acquisitionsInfo = "v_eu_acquisitions not present — boxes 2/9 left as 0";
    }
  } catch { diagnostics.acquisitionsInfo = "v_eu_acquisitions lookup failed silently"; }

  // ---------------------------
  // 4) EU GOODS SUPPLIED (optional) → Box 8
  // ---------------------------
  let box8 = 0;
  try {
    const { data: euOut, error: gErr } = await supabase
      .from("v_eu_goods_supplied")
      .select("net_amount")
      .eq("shop_domain", shopDomain)
      .gte("created_at", `${from}T00:00:00Z`)
      .lte("created_at", `${to}T23:59:59Z`);
    if (!gErr && euOut) {
      for (const r of euOut as { net_amount: number | null }[]) {
        box8 += Number(r.net_amount ?? 0);
      }
      box8 = Math.max(0, box8);
    } else if (gErr && !tableMissing(gErr)) {
     return bad(gErr.message, 500, "db_eu_goods");
    } else {
      diagnostics.euGoodsInfo = "v_eu_goods_supplied not present — box 8 left as 0";
    }
  } catch { diagnostics.euGoodsInfo = "v_eu_goods_supplied lookup failed silently"; }

  // ---------------------------
  // 5) Totals → final HMRC payload
  // ---------------------------
  const box3 = box1 + box2;
  const box5 = Math.max(0, box3 - box4);

  const boxes = {
    vatDueSales: toMoney(box1),
    vatDueAcquisitions: toMoney(box2),
    totalVatDue: toMoney(box3),
    vatReclaimedCurrPeriod: toMoney(box4),
    netVatDue: toMoney(box5),
    totalValueSalesExVAT: toInt(box6),
    totalValuePurchasesExVAT: toInt(box7),
    totalValueGoodsSuppliedExVAT: toInt(box8),
    totalAcquisitionsExVAT: toInt(box9),
  };



// ...

if (dryRun) {
  return ok({ vrn, periodKey, from, to, boxes, diagnostics, dryRun: true });
}

// ---------------------------
/// ---------------------------
// 6) Token load/refresh/persist
// ---------------------------
const { data: row, error: tErr } = await supabase
  .from("hmrc_tokens")
  .select("*")
  .eq("vrn", vrn)
  .eq("shop_domain", shopDomain)
  .order("created_at", { ascending: false })
  .limit(1)
  .maybeSingle();

if (tErr) return bad(tErr.message, 500, "db_tokens");
if (!row) return bad("No HMRC tokens found", 404, "db_tokens");

// (continue with rawExp / tokens / refresh logic here…)

  const rawExp =
    typeof row.expires_at === "string" ? Date.parse(row.expires_at) : Number(row.expires_at ?? 0);
  let tokens: HmrcToken = {
    access_token: row.access_token,
    refresh_token: row.refresh_token,
    expires_in: row.expires_in,
    expires_at: Number.isFinite(rawExp) ? rawExp : undefined,
    scope: row.scope,
    token_type: row.token_type ?? "Bearer",
  };

  const now = Date.now();
  const skewMs = 60_000;

  if (!tokens.expires_at || tokens.expires_at - now <= skewMs) {
    const refreshed = await refreshAccessToken(tokens.refresh_token);
    tokens = {
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token || tokens.refresh_token,
      expires_in: refreshed.expires_in,
      expires_at: now + ((refreshed.expires_in ?? 3600) * 1000),
      scope: refreshed.scope ?? tokens.scope,
      token_type: refreshed.token_type ?? tokens.token_type,
    };
    const expMs =
      typeof tokens.expires_at === "number" && Number.isFinite(tokens.expires_at)
        ? tokens.expires_at
        : now + ((tokens.expires_in ?? 3600) * 1000);

    await supabase
      .from("hmrc_tokens")
      .update({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        scope: tokens.scope,
        token_type: tokens.token_type,
        expires_in: tokens.expires_in ?? null,
        expires_at: new Date(expMs).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);
  }

  // ---------------------------
  // 7) Submit to HMRC + store receipt
  // ---------------------------
  const client = new HmrcClient(vrn, tokens);
  try {
    const receipt = await client.submitReturn({
      periodKey,
      ...boxes,
      finalised,
    });

    await supabase.from("hmrc_receipts").upsert(
      {
        shop_domain: shopDomain,
        vrn,
        period_key: periodKey,
        body: boxes,
        receipt: receipt as any,
        created_at: new Date().toISOString(),
      },
      { onConflict: "shop_domain,vrn,period_key" }
    );

   return ok({ vrn, periodKey, from, to, boxes, receipt, diagnostics });
  } catch (e: any) {
    return bad(String(e?.message || e), 502, "hmrc_submit");
  }
}
