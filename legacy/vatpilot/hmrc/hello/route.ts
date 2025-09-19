// ┌───────────────────────────────────────────────────────────┐
// │ File: app/api/hmrc/hello/route.ts                         │
// └───────────────────────────────────────────────────────────┘

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { HmrcToken } from "@/lib/hmrc/client";
import { hmrcFetch } from "@/lib/hmrc/client"; // ensure default/named export matches your file

const HMRC_TOKEN_TABLE = "hmrc_tokens";

// If you store tokens per user+env, adjust the filters in `getLatestToken`.
async function getSupabaseServer() {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );
  return supabase;
}

/**
 * Refresh an HMRC token if it's near/after expiry.
 * Expects `refresh_token` to be present in the DB row.
 */
async function ensureAccessToken(
  supabase: ReturnType<typeof createServerClient>,
  tokenRow: any
): Promise<string> {
  const now = Date.now();
  const skewMs = 60_000 * 2; // refresh if expiring within 2 minutes

  if (
    tokenRow.access_token &&
    tokenRow.expires_at &&
    Number(tokenRow.expires_at) - skewMs > now
  ) {
    return tokenRow.access_token as string;
  }

  // --- Refresh ---
  const res = await fetch(
    `${process.env.HMRC_BASE_URL || "https://test-api.service.hmrc.gov.uk"}/oauth/token`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: process.env.HMRC_CLIENT_ID || "",
        client_secret: process.env.HMRC_CLIENT_SECRET || "",
        refresh_token: tokenRow.refresh_token || "",
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`HMRC refresh failed (${res.status}): ${err}`);
  }

  const json = (await res.json()) as HmrcToken;

  // Compute and store absolute expiry (ms epoch)
  const expires_at =
    json.expires_in != null ? Date.now() + Number(json.expires_in) * 1000 : null;

  // Persist update
  const { error: upErr } = await supabase
    .from(HMRC_TOKEN_TABLE)
    .update({
      access_token: json.access_token,
      refresh_token: json.refresh_token ?? tokenRow.refresh_token, // keep old if HMRC omitted
      scope: json.scope ?? tokenRow.scope,
      token_type: json.token_type ?? "Bearer",
      expires_in: json.expires_in ?? tokenRow.expires_in,
      expires_at,
      updated_at: new Date().toISOString(),
    })
    .eq("id", tokenRow.id)
    .single();

  if (upErr) throw upErr;

  return json.access_token;
}

async function getLatestToken(
  supabase: ReturnType<typeof createServerClient>
) {
  // Adjust filters to your schema: maybe you key by user_id, shop_id, env, etc.
  const { data, error } = await supabase
    .from(HMRC_TOKEN_TABLE)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("No HMRC token found. Connect HMRC first.");
  return data;
}

export async function GET() {
  try {
    const supabase = await getSupabaseServer();

    // Load most recent token row for this user/app
    const tokenRow = await getLatestToken(supabase);

    // Ensure valid access_token, refresh if needed
    const accessToken = await ensureAccessToken(supabase, tokenRow);

    // Call HMRC /hello/user (requires scope "hello")
    const { ok, status, json } = await hmrcFetch<{
      message: string;
      user?: string;
    }>({
      method: "GET",
      path: "/hello/user",
      token: accessToken,
    });

    return NextResponse.json(
      { ok, status, data: json },
      { status: ok ? 200 : status }
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
