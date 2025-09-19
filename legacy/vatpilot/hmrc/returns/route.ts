// ┌───────────────────────────────────────────────────────────┐
// │ File: app/api/hmrc/returns/route.ts                       │
// └───────────────────────────────────────────────────────────┘
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { HmrcClient, type HmrcToken } from "@/lib/hmrc/client";
import { refreshAccessToken } from "@/lib/hmrc/oauth";
import { ok, bad } from "@/lib/api/http";

export const runtime = "nodejs";

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

// ---- Guards ----
const isMoney = (v: unknown) =>
  typeof v === "string" && /^-?\d+(\.\d{1,2})?$/.test(v.trim());
const isInt = (v: unknown) => typeof v === "number" && Number.isInteger(v);

export async function POST(req: NextRequest) {
  // ---- Parse body ----
  const body = await req.json().catch(() => null);
  if (!body) {
  return bad("Missing JSON body", 400);
  }

  const {
    shopDomain = "",
    vrn = "",
    periodKey = "",
    finalised,
    // HMRC 9 boxes:
    vatDueSales,
    vatDueAcquisitions,
    totalVatDue,
    vatReclaimedCurrPeriod,
    netVatDue,
    totalValueSalesExVAT,
    totalValuePurchasesExVAT,
    totalValueGoodsSuppliedExVAT,
    totalAcquisitionsExVAT,
  } = body;

  if (!vrn || !periodKey) {
   return bad("Missing shopDomain, vrn or periodKey", 400);
  }

  // ---- Validate boxes ----
  const moneyOk =
    isMoney(vatDueSales) &&
    isMoney(vatDueAcquisitions) &&
    isMoney(totalVatDue) &&
    isMoney(vatReclaimedCurrPeriod) &&
    isMoney(netVatDue);

  const intsOk =
    isInt(totalValueSalesExVAT) &&
    isInt(totalValuePurchasesExVAT) &&
    isInt(totalValueGoodsSuppliedExVAT) &&
    isInt(totalAcquisitionsExVAT);

  if (!moneyOk || !intsOk || typeof finalised !== "boolean") {
   return bad("Missing or invalid boxes payload", 400);
  }

  // ---- Load tokens (latest row, shopDomain optional) ----
  const supabase = sb();
  let q = supabase.from("hmrc_tokens").select("*").eq("vrn", vrn);
  if (shopDomain) q = q.eq("shop_domain", shopDomain);

  const { data: row, error: tErr } = await q
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (tErr) {
    return bad(tErr.message, 500, "db_select_tokens");
  }
  if (!row) {
    return bad("No HMRC tokens stored for this VRN", 404, "db_tokens");
  }

  // ---- Normalize expiry & refresh if needed ----
  const expMs =
    typeof row.expires_at === "string"
      ? Date.parse(row.expires_at)
      : Number(row.expires_at ?? 0);

  let tokens: HmrcToken = {
    access_token: row.access_token,
    refresh_token: row.refresh_token,
    expires_in: row.expires_in,
    expires_at: Number.isFinite(expMs) ? expMs : undefined,
    scope: row.scope,
    token_type: row.token_type ?? "Bearer",
  };

  const now = Date.now();
  const needsRefresh = !tokens.expires_at || tokens.expires_at - now < 60_000;

  if (needsRefresh && tokens.refresh_token) {
    try {
      const refreshed = await refreshAccessToken(tokens.refresh_token);
      const newExpMs = now + (refreshed.expires_in ?? 3600) * 1000;
      tokens = {
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token || tokens.refresh_token,
        expires_in: refreshed.expires_in,
        expires_at: newExpMs,
        scope: refreshed.scope ?? tokens.scope,
        token_type: refreshed.token_type ?? tokens.token_type,
      };
      await supabase
        .from("hmrc_tokens")
        .update({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          scope: tokens.scope,
          token_type: tokens.token_type,
          expires_in: tokens.expires_in ?? null,
          expires_at: new Date(newExpMs).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
    } catch (e: any) {
  return bad(String(e?.message || e), 502, "hmrc_refresh");
    }
  }

  // ---- Submit to HMRC ----
  const client = new HmrcClient(vrn, tokens);
  const submitBody = {
    periodKey,
    vatDueSales,
    vatDueAcquisitions,
    totalVatDue,
    vatReclaimedCurrPeriod,
    netVatDue,
    totalValueSalesExVAT,
    totalValuePurchasesExVAT,
    totalValueGoodsSuppliedExVAT,
    totalAcquisitionsExVAT,
    finalised,
  };

  try {
    const receipt = await client.submitReturn(submitBody);

    await supabase.from("hmrc_receipts").upsert(
      {
        shop_domain: shopDomain || null,
        vrn,
        period_key: periodKey,
        body: submitBody as any,
        receipt: receipt as any,
        created_at: new Date().toISOString(),
      },
      { onConflict: "shop_domain,vrn,period_key" }
    );

   return ok({ periodKey, receipt });
  } catch (e: any) {
    const msg = String(e?.message || e);
    if (msg.includes('"code":"DUPLICATE_SUBMISSION"')) {
   return bad("This VAT period has already been submitted for this VRN.", 409, "hmrc_submit_duplicate");
    }
   return bad(msg, 502, "hmrc_submit");
  }
}
