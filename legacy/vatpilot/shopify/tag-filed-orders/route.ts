import { NextRequest, NextResponse } from "next/server";
import { sb } from "@/lib/supabase/server";
import { HmrcClient, type HmrcToken } from "@/lib/hmrc/clients";
import { refreshAccessToken } from "@/lib/hmrc/oauth";
import { addTagsToOrder } from "@/lib/shopify/admin";

function bad(msg: string, code = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status: code });
}

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null) as {
    shopDomain?: string;
    vrn?: string;
    periodKey?: string;
    tag?: string;
  } | null;

  if (!json) return bad("Bad JSON");
  const shopDomain = (json.shopDomain || "").trim();
  const vrn = (json.vrn || "").trim();
  const periodKey = (json.periodKey || "").trim();
  const tag = (json.tag || `vat-filed-${periodKey}`).trim();

  if (!shopDomain || !vrn || !periodKey) return bad("Missing shopDomain, vrn or periodKey");

  const supabase = sb();

  // 1) Shopify access token
  const { data: shopRow, error: shopErr } = await supabase
    .from("shops")
    .select("access_token")
    .eq("shop_domain", shopDomain)
    .single();
  if (shopErr || !shopRow?.access_token) return bad("No Shopify access token", 500);

  // 2) HMRC tokens (to derive the obligation date range)
  const { data: tokRows, error: tokErr } = await supabase
    .from("hmrc_tokens")
    .select("*")
    .eq("shop_domain", shopDomain)
    .eq("vrn", vrn)
    .limit(1);
  if (tokErr) return bad(tokErr.message, 500);
  const row = tokRows?.[0];
  if (!row) return bad("No HMRC tokens", 404);

  const expMs = Date.parse(String(row.expires_at));
  let tokens: HmrcToken = {
    access_token: row.access_token,
    refresh_token: row.refresh_token,
    expires_in: row.expires_in ?? Math.max(Math.floor((expMs - Date.now()) / 1000), 0),
    expires_at: expMs,
    scope: row.scope ?? "",
    token_type: row.token_type ?? "Bearer",
  };
  if (!tokens.expires_at || tokens.expires_at - Date.now() <= 60_000) {
    const refreshed = await refreshAccessToken(tokens.refresh_token);
    tokens = {
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token || tokens.refresh_token,
      expires_in: refreshed.expires_in,
      expires_at: Date.now() + refreshed.expires_in * 1000,
      scope: refreshed.scope,
      token_type: refreshed.token_type,
    };
  }

  // 3) Resolve period start/end from HMRC obligation
  const client = new HmrcClient(vrn, tokens);
  const obligations = await client.getObligations();
  const match = (obligations?.obligations || []).find((o: any) => o.periodKey === periodKey);
  if (!match) return bad("Period key not found on HMRC obligations", 404);

  const startISO = new Date(match.start).toISOString();
  // HMRC 'end' is inclusive; make exclusive end by adding 1 day
  const endD = new Date(match.end); endD.setDate(endD.getDate() + 1);
  const endISO = endD.toISOString();

  // 4) Pull order ids from your MV for that window
  // Adjust column names if your MV differs (created_at_src, order_id)
  const { data: orders, error: qErr } = await supabase
    .from("mv_orders_consolidated")
    .select("order_id")
    .eq("shop_domain", shopDomain)
    .gte("created_at_src", startISO)
    .lt("created_at_src", endISO);

  if (qErr) return bad(qErr.message, 500);
  const ids = (orders || [])
    .map((r: any) => r.order_id)
    .filter((n: any) => typeof n === "number" || typeof n === "string");

  if (!ids.length) {
    return NextResponse.json({ ok: true, tagged: 0, note: "No orders in range" });
  }

  // 5) Tag each order in Shopify
  let tagged = 0;
  const token = shopRow.access_token as string;
  for (const id of ids) {
    const gid = `gid://shopify/Order/${id}`;
    try {
      await addTagsToOrder(shopDomain, token, gid, [tag]);
      tagged++;
    } catch {
      // swallow per-order errors; continue
    }
  }

  return NextResponse.json({ ok: true, periodKey, tagged, tag });
}
