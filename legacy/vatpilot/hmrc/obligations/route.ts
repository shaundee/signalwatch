// ┌───────────────────────────────────────────────────────────┐
// │ File: app/api/hmrc/obligations/route.ts                   │
// └───────────────────────────────────────────────────────────┘
import { NextRequest, NextResponse } from "next/server";
import { sb } from "@/lib/supabase/server";
import { HmrcClient, type HmrcToken } from "@/lib/hmrc/client";
import { refreshAccessToken } from "@/lib/hmrc/oauth";
import { ok, bad } from "@/lib/api/http";


export const runtime = "nodejs";

/**
 * GET /api/hmrc/obligations?vrn=...&shopDomain=...&from=YYYY-MM-DD&to=YYYY-MM-DD&status=O|F|OPEN|FULFILLED|M
 * - shopDomain optional (uses latest token row if omitted)
 * - status: O/F/OPEN/FULFILLED (M passthrough for sandbox)
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const shopDomain = (url.searchParams.get("shopDomain") || "").trim();
  const vrn = (url.searchParams.get("vrn") || "").trim();
  const from = url.searchParams.get("from") || undefined;
  const to = url.searchParams.get("to") || undefined;

  const toStatus = (raw?: string | null) => {
    if (!raw) return undefined;
    const s = raw.trim().toUpperCase();
    if (s === "OPEN" || s === "O") return "O";
    if (s === "FULFILLED" || s === "F") return "F";
    if (s === "M") return "M"; // harmless pass-through in sandbox
    return undefined;
  };
  const status = toStatus(url.searchParams.get("status"));

  if (!vrn) {
 return bad("Missing vrn", 400);
  }

  const supabase = sb();

  // ---- Load most recent token row (optionally by shopDomain) ----
  let q = supabase.from("hmrc_tokens").select("*").eq("vrn", vrn);
  if (shopDomain) q = q.eq("shop_domain", shopDomain);

  const { data: tokenRow, error: tokErr } = await q
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (tokErr) {
 return bad(tokErr.message, 500, "db_tokens");
  }
  if (!tokenRow) {
   return bad("No HMRC tokens stored for this VRN", 404, "db_tokens");
  }

  // ---- Normalise expiry (DB stores ISO) ----
  const rawExp =
    typeof tokenRow.expires_at === "string"
      ? Date.parse(tokenRow.expires_at)
      : Number(tokenRow.expires_at ?? 0);

  let tokens: HmrcToken = {
    access_token: tokenRow.access_token,
    refresh_token: tokenRow.refresh_token,
    expires_in: tokenRow.expires_in,
    expires_at: Number.isFinite(rawExp) ? rawExp : undefined,
    scope: tokenRow.scope ?? "",
    token_type: tokenRow.token_type ?? "Bearer",
  };

  const now = Date.now();
  const skewMs = 60_000; // refresh if <= 60s remaining

  // ---- Refresh if needed (with proper try/catch) ----
  if (!tokens.expires_at || tokens.expires_at - now <= skewMs) {
    try {
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
        .eq("id", tokenRow.id);
    } catch (e: any) {
      return bad(`Failed to refresh token: ${String(e?.message || e)}`, 502, "hmrc_refresh");
    }
  }

  // ---- Validate/sanitise date params and auto-swap if reversed ----
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  let safeFrom = from && iso.test(from) ? from : undefined;
  let safeTo = to && iso.test(to) ? to : undefined;
  if (safeFrom && safeTo && safeFrom > safeTo) {
    const tmp = safeFrom;
    safeFrom = safeTo;
    safeTo = tmp;
  }

  // ---- Call HMRC ----
  try {
    const client = new HmrcClient(vrn, tokens);
    const resp = await client.getObligations(safeFrom, safeTo, status);

    return ok({ obligations: resp?.obligations ?? [], raw: resp });
  } catch (e: any) {
  return bad(e?.message || String(e), 502, "hmrc_obligations");
  }
}
