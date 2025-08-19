import { NextResponse } from "next/server";
import crypto from "crypto";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const shop = searchParams.get("shop");
  if (!shop) {
    return NextResponse.json({ error: "Missing ?shop=my-shop.myshopify.com" }, { status: 400 });
  }

  const state = crypto.randomBytes(16).toString("hex");
  const redirectUri = `${process.env.SHOPIFY_APP_URL}/api/shopify/callback`;
  const params = new URLSearchParams({
    client_id: process.env.SHOPIFY_API_KEY!,
    scope: process.env.SHOPIFY_SCOPES || "read_products",
    redirect_uri: redirectUri,
    state,
  });
  const authUrl = `https://${shop}/admin/oauth/authorize?${params.toString()}`;
  // TODO: store `state` in a cookie/session to verify later
  return NextResponse.redirect(authUrl);
}
