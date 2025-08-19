import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }

  const tokenUrl = `${process.env.HMRC_BASE_URL || "https://test-api.service.hmrc.gov.uk"}/oauth/token`;
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: process.env.HMRC_CLIENT_ID!,
    client_secret: process.env.HMRC_CLIENT_SECRET!,
    redirect_uri: process.env.HMRC_REDIRECT_URI!,
    code,
  });

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: "HMRC token exchange failed", details: text }, { status: 500 });
  }

  const tokens = await res.json();
  // TODO: persist tokens.access_token / refresh_token
  return NextResponse.redirect("/dashboard");
}
