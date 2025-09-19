// ┌───────────────────────────────────────────────────────────┐
// │ File: app/api/hmrc/submit/route.ts                        │
// └───────────────────────────────────────────────────────────┘
import { NextRequest, NextResponse } from "next/server";
import { sb } from "@/lib/supabase/server";
import { HmrcClient, type HmrcToken } from "@/lib/hmrc/client";
import { refreshAccessToken } from "@/lib/hmrc/oauth";

export const runtime = "nodejs";

type Boxes = {
  vatDueSales: number;
  vatDueAcquisitions: number;
  totalVatDue?: number;
  vatReclaimedCurrPeriod: number;
  netVatDue?: number;
  totalValueSalesExVAT: number;          // integers (GBP)
  totalValuePurchasesExVAT: number;      // integers (GBP)
  totalValueGoodsSuppliedExVAT: number;  // integers (GBP)
  totalValueAcquisitionsExVAT?: number;  // legacy name we map to totalAcquisitionsExVAT
  totalAcquisitionsExVAT?: number;       // correct HMRC name (we’ll coerce either)
};

function bad(msg: string, code = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status: code });
}

const clamp = (n: number, min: number, max: number) =>
  Math.max(Math.min(n, max), min);
const to2 = (n: unknown) => {
  const x = Number(n ?? 0);
  return Number(clamp(isFinite(x) ? x : 0, -999999999999, 999999999999).toFixed(2));
};
const toGBPInt = (n: unknown) =>
  clamp(Math.round(Number(n ?? 0) || 0), -999999999999, 999999999999);

export async function POST(req: NextRequest) {
  const json = (await req.json().catch(() => null)) as
    | { shopDomain?: string; vrn?: string; periodKey?: string; boxes?: Boxes }
    | null;
  if (!json) return bad("Bad JSON");

  const shopDomain = (json.shopDomain || "").trim();
  const vrn = (json.vrn || "").trim();
  let periodKey = (json.periodKey || "").trim();
  const boxes = json.boxes as Boxes | undefined;

  if (!shopDomain || !vrn || !boxes) {
    return bad("Missing shopDomain, vrn or boxes");
  }

  const supabase = sb();

  // If user supplied a periodKey, block duplicate submits early
  if (periodKey) {
    const { data: existing, error: exErr } = await supabase
      .from("hmrc_returns")
      .select("id")
      .eq("shop_domain", shopDomain)
      .eq("vrn", vrn)
      .eq("period_key", periodKey)
      .limit(1);
    if (exErr) return bad(exErr.message, 500);
    if (existing?.length) return bad("Already submitted", 409);
  }

  // Load tokens
  const { data: tokRows, error: tokErr } = await supabase
    .from("hmrc_tokens")
    .select("*")
    .eq("shop_domain", shopDomain)
    .eq("vrn", vrn)
    .limit(1);
  if (tokErr) return bad(tokErr.message, 500);

  const row = tokRows?.[0];
  if (!row) return bad("No HMRC tokens stored for this shop/VRN", 404);

  const rowExpMs = Date.parse(String(row.expires_at));
  let tokens: HmrcToken = {
    access_token: row.access_token,
    refresh_token: row.refresh_token,
    expires_in:
      typeof row.expires_in === "number"
        ? row.expires_in
        : Math.max(Math.floor((rowExpMs - Date.now()) / 1000), 0),
    expires_at: isNaN(rowExpMs) ? Date.now() : rowExpMs,
    scope: row.scope ?? "",
    token_type: row.token_type ?? "Bearer",
  };

  // refresh if <= 60s to expiry
  if (!tokens.expires_at || tokens.expires_at - Date.now() <= 60_000) {
    try {
      const refreshed = await refreshAccessToken(tokens.refresh_token);
      const newExpMs = Date.now() + refreshed.expires_in * 1000;
      tokens = {
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token || tokens.refresh_token,
        expires_in: refreshed.expires_in,
        expires_at: newExpMs,
        scope: refreshed.scope,
        token_type: refreshed.token_type,
      };
      const { error: updErr } = await supabase
        .from("hmrc_tokens")
        .update({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_in: tokens.expires_in,
          expires_at: new Date(newExpMs).toISOString(),
          scope: tokens.scope,
          token_type: tokens.token_type,
          updated_at: new Date().toISOString(),
        })
        .eq("shop_domain", shopDomain)
        .eq("vrn", vrn);
      if (updErr) return bad(updErr.message, 500);
    } catch (e: any) {
      return bad(`Failed to refresh token: ${String(e?.message || e)}`, 502);
    }
  }

  const client = new HmrcClient(vrn, tokens);

  // Auto-pick OPEN obligation if periodKey not provided
  if (!periodKey) {
    const obs = await client.getObligations();
    const isOpen = (s: unknown) =>
      String(s ?? "").trim().toUpperCase() === "O" ||
      String(s ?? "").trim().toUpperCase() === "OPEN";
    const open = (obs?.obligations ?? []).find((o: any) => isOpen(o.status));
    if (!open) return bad("No OPEN obligation found for this VRN", 404);
    periodKey = open.periodKey;
  }

  // Re-check idempotency with chosen period
  {
    const { data: existing, error: exErr } = await supabase
      .from("hmrc_returns")
      .select("id")
      .eq("shop_domain", shopDomain)
      .eq("vrn", vrn)
      .eq("period_key", periodKey)
      .limit(1);
    if (exErr) return bad(exErr.message, 500);
    if (existing?.length) return bad("Already submitted", 409);
  }

  // Coerce all boxes to HMRC format
  const payload = {
    periodKey,

    vatDueSales: to2(boxes.vatDueSales),
    vatDueAcquisitions: to2(boxes.vatDueAcquisitions),
    totalVatDue: to2(boxes.totalVatDue ?? (boxes.vatDueSales + boxes.vatDueAcquisitions)),
    vatReclaimedCurrPeriod: to2(boxes.vatReclaimedCurrPeriod),
    netVatDue: to2(
      boxes.netVatDue ??
      ((boxes.totalVatDue ?? (boxes.vatDueSales + boxes.vatDueAcquisitions)) -
        boxes.vatReclaimedCurrPeriod)
    ),

    // boxes 6–9 must be integers (whole GBP)
    totalValueSalesExVAT: toGBPInt(boxes.totalValueSalesExVAT),
    totalValuePurchasesExVAT: toGBPInt(boxes.totalValuePurchasesExVAT),
    totalValueGoodsSuppliedExVAT: toGBPInt(boxes.totalValueGoodsSuppliedExVAT),

    // accept either name, but send the **correct HMRC key**
    totalAcquisitionsExVAT: toGBPInt(
      boxes.totalAcquisitionsExVAT ?? boxes.totalValueAcquisitionsExVAT
    ),

    finalised: true,
  };

  // Debug: make sure the key is present
  // console.log("HMRC payload", payload);

  // Submit to HMRC
  let receipt: Record<string, any>;
  try {
    receipt = (await client.submitReturn(payload)) as Record<string, any>;
  } catch (e: any) {
    const raw = String(e?.message || e);
    // Map duplicate to 409 for UX
    if (/DUPLICATE_SUBMISSION/i.test(raw)) return bad("Already submitted", 409);
    return bad(`HMRC API error: ${raw}`, 502);
  }

  // Record snapshot
  const { error: insErr } = await supabase.from("hmrc_returns").insert({
    shop_domain: shopDomain,
    vrn,
    period_key: periodKey,
    status: "submitted",
    submitted_at: new Date().toISOString(),
    boxes_json: payload,
    hmrc_receipt_json: receipt,
  });
  if ((insErr as any)?.code === "23505") return bad("Already submitted", 409);
  if (insErr) return bad(insErr.message, 500);

  // Non-blocking shop metafield write-back
  (async () => {
    try {
      const { data: shopRow } = await supabase
        .from("shops")
        .select("access_token")
        .eq("shop_domain", shopDomain)
        .single();
      if (shopRow?.access_token) {
        const { setShopMetafield } = await import("@/lib/shopify/admin");
        await setShopMetafield(
          shopDomain,
          shopRow.access_token,
          "vatpilot",
          `last_filed_${vrn}`,
          periodKey
        );
      }
    } catch {}
  })();

  return NextResponse.json({ ok: true, receipt });
}
