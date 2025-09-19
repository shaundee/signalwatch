// ┌───────────────────────────────────────────────────────────┐
// │ File: app/api/hmrc/oauth/start/route.ts                   │
// └───────────────────────────────────────────────────────────┘
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * GET /api/hmrc/oauth/start?shopDomain=...&vrn=...&probe=1|peek=1
 * - Builds the HMRC authorization URL
 * - Encodes state as: "shopDomain|vrn|timestamp|flag"
 *   where flag ∈ {"probe","peek"} or omitted for the normal run
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const shopDomain = (url.searchParams.get("shopDomain") || "").trim().toLowerCase();
    const rawVrn = (url.searchParams.get("vrn") || "").trim();
    const probe = url.searchParams.get("probe") === "1";
    const peek  = url.searchParams.get("peek") === "1";

    // Basic validation (no server 500s — just bounce with an error)
    if (!shopDomain || !rawVrn) {
      const back = new URL("/dashboard/vat", req.url);
      if (shopDomain) back.searchParams.set("shopDomain", shopDomain);
      if (rawVrn)    back.searchParams.set("vrn", rawVrn);
      back.searchParams.set("error", "missing_shop_or_vrn");
      return NextResponse.redirect(back);
    }

    // Normalize VRN to digits (keep what user typed if you prefer)
    const vrn = rawVrn.replace(/\D+/g, "");

    // HMRC endpoints & app credentials
    const base = process.env.HMRC_BASE_URL || "https://test-api.service.hmrc.gov.uk";
    const authUrl = process.env.HMRC_AUTH_URL || `${base}/oauth/authorize`;
    const clientId = process.env.HMRC_CLIENT_ID;
    const redirectUri = process.env.HMRC_REDIRECT_URI;
    const scope = process.env.HMRC_SCOPE || "read:vat write:vat";

    if (!clientId || !redirectUri) {
      const back = new URL("/dashboard/vat", req.url);
      back.searchParams.set("shopDomain", shopDomain);
      back.searchParams.set("vrn", vrn);
      back.searchParams.set("error", "misconfigured_client");
      return NextResponse.redirect(back);
    }

    // Build the state: shop|vrn|ts|flag
    const ts = Date.now();
    const flag = peek ? "peek" : (probe ? "probe" : "");
    const state = flag ? `${shopDomain}|${vrn}|${ts}|${flag}` : `${shopDomain}|${vrn}|${ts}`;

    // Build HMRC authorize URL
    const qs = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      scope,
      state,
    });

    const authorize = `${authUrl}?${qs.toString()}`;
    return NextResponse.redirect(authorize);
  } catch (e: any) {
    // Final insurance — bounce back with a readable error
    const back = new URL("/dashboard/vat", req.url);
    back.searchParams.set("error", `oauth_start_exception:${encodeURIComponent(String(e?.message || e))}`);
    return NextResponse.redirect(back);
  }
}
