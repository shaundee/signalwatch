import { NextResponse } from "next/server";
import crypto from "crypto";

export async function GET() {
  const state = crypto.randomBytes(16).toString("hex");
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.HMRC_CLIENT_ID!,
    scope: process.env.HMRC_SCOPES || "read:vat",
    redirect_uri: process.env.HMRC_REDIRECT_URI!,
    state,
  });
  const authUrl = `${process.env.HMRC_BASE_URL || "https://test-api.service.hmrc.gov.uk"}/oauth/authorize?${params.toString()}`;
  // TODO: store `state`
  return NextResponse.redirect(authUrl);
}
