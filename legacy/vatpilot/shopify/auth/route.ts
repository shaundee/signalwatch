// app/api/shopify/auth/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const shop = url.searchParams.get("shop");
  if (!shop) return new NextResponse("Missing shop", { status: 400 });

  const state = crypto.randomBytes(16).toString("hex");

  // Build Shopify authorize URL
  const redirect = new URL(`https://${shop}/admin/oauth/authorize`);
  redirect.searchParams.set("client_id", process.env.SHOPIFY_API_KEY!);
  redirect.searchParams.set("scope", process.env.SHOPIFY_SCOPES!);
  redirect.searchParams.set(
    "redirect_uri",
    `${process.env.SHOPIFY_APP_URL}/api/shopify/callback`,
  );
  redirect.searchParams.set("state", state);

  // Set cookies ON THE RESPONSE WE RETURN (most reliable)
  const res = NextResponse.redirect(redirect.toString(), {
    headers: { "Cache-Control": "no-store" },
  });
  res.cookies.set("shopify_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 5 * 60, // 5 min, optional
  });
  res.cookies.set("shopify_oauth_shop", shop, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 5 * 60,
  });
  return res;
}
