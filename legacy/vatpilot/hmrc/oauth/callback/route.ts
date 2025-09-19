import { NextRequest, NextResponse } from "next/server";
import { sb } from "@/lib/supabase/server";
export const runtime = "nodejs";

function parseState(raw: string): { shopDomain: string; vrn: string } | null {
  const cands: string[] = [];
  if (raw) {
    cands.push(raw);
    try { cands.push(decodeURIComponent(raw)); } catch {}
    try { cands.push(decodeURIComponent(decodeURIComponent(raw))); } catch {}
    // base64url / base64 fallbacks
    try { cands.push(Buffer.from(raw, "base64url").toString("utf8")); } catch {}
    try { cands.push(Buffer.from(raw.replace(/ /g, "+"), "base64").toString("utf8")); } catch {}
  }
  for (const s of cands) {
    try {
      const obj = JSON.parse(s);
      const shopDomain = String(obj.shopDomain || obj.shop || "").trim();
      const vrn = String(obj.vrn || "").trim();
      if (shopDomain && vrn) return { shopDomain, vrn };
    } catch {}
  }
  return null;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const rawState = url.searchParams.get("state") || "";
  const err = url.searchParams.get("error");
  if (err) return NextResponse.redirect(`/dashboard/vat?error=${encodeURIComponent(err)}`);
  if (!code) return NextResponse.redirect(`/dashboard/vat?error=missing_code`);

  const st = parseState(rawState);
  if (!st) return NextResponse.redirect(`/dashboard/vat?error=bad_state`);
  const { shopDomain, vrn } = st;

  const base = process.env.HMRC_BASE_URL || "https://test-api.service.hmrc.gov.uk";
  const clientId = process.env.HMRC_CLIENT_ID!;
  const clientSecret = process.env.HMRC_CLIENT_SECRET!;
  const redirectUri = process.env.HMRC_REDIRECT_URI!;

  const res = await fetch(`${base}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code,
    }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = json?.error_description || json?.error || res.statusText;
    return NextResponse.redirect(
      `/dashboard/vat?shopDomain=${encodeURIComponent(shopDomain)}&vrn=${encodeURIComponent(vrn)}&error=${encodeURIComponent(msg)}`
    );
  }

  const access_token: string = json.access_token;
  const refresh_token: string = json.refresh_token;
  const token_type: string = json.token_type || "Bearer";
  const scope: string = json.scope || "";
  const expires_in: number = Number(json.expires_in ?? 3600);
  const expires_at = new Date(Date.now() + expires_in * 1000).toISOString();

  const supabase = sb();
  const { error } = await supabase
    .from("hmrc_tokens")
    .upsert(
      { shop_domain: shopDomain, vrn, access_token, refresh_token, token_type, scope, expires_in, expires_at, updated_at: new Date().toISOString() },
      { onConflict: "shop_domain,vrn" }
    );
  if (error) {
    return NextResponse.redirect(
      `/dashboard/vat?shopDomain=${encodeURIComponent(shopDomain)}&vrn=${encodeURIComponent(vrn)}&error=${encodeURIComponent("Failed to save tokens: " + error.message)}`
    );
  }

  return NextResponse.redirect(
    `/dashboard/vat?shopDomain=${encodeURIComponent(shopDomain)}&vrn=${encodeURIComponent(vrn)}`
  );
}
