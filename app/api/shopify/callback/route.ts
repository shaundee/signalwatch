import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const hmac = url.searchParams.get("hmac");
  const shop = url.searchParams.get("shop");
  const state = url.searchParams.get("state");

  if (!code || !shop || !hmac) {
    return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
  }

  // TODO: verify HMAC & state
  // Exchange code for token
  const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.SHOPIFY_API_KEY,
      client_secret: process.env.SHOPIFY_API_SECRET,
      code,
    }),
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    return NextResponse.json({ error: "Token exchange failed", details: text }, { status: 500 });
  }

  const data = await tokenRes.json();
  // TODO: persist data.access_token associated with `shop`
  return NextResponse.redirect("/dashboard");
}
