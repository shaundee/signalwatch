// ┌───────────────────────────────────────────────────────────┐
// │ File: app/api/hmrc/status/route.ts                        │
// └───────────────────────────────────────────────────────────┘
import { NextRequest, NextResponse } from "next/server";
import { sb } from "@/lib/supabase/server";
import { HmrcClient, type HmrcToken } from "@/lib/hmrc/client";

export const runtime = "nodejs";

function bad(msg: string, code = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status: code });
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const shopDomain = (url.searchParams.get("shopDomain") || "").trim();
  const vrn = (url.searchParams.get("vrn") || "").trim();
  const periodKey = (url.searchParams.get("periodKey") || "").trim(); // optional

  if (!shopDomain || !vrn) return bad("Missing shopDomain or vrn");

  const supabase = sb();

  // Load token if present
  const { data: tokRows, error: tokErr } = await supabase
    .from("hmrc_tokens")
    .select("*")
    .eq("shop_domain", shopDomain)
    .eq("vrn", vrn)
    .limit(1);

  if (tokErr) return bad(tokErr.message, 500);

  const row = tokRows?.[0];
  const connected = !!row;
  const expiresAtISO = row?.expires_at || null;
  const expiresAt = expiresAtISO ? Date.parse(String(expiresAtISO)) : 0;
  const secondsToExpiry = expiresAt ? Math.max(0, Math.floor((expiresAt - Date.now()) / 1000)) : null;
  const needsReconnect = secondsToExpiry !== null && secondsToExpiry <= 600; // 10 minutes

  // Already submitted (if a periodKey is provided)
  let alreadySubmitted = false;
  if (periodKey) {
    const { data: ret, error: retErr } = await supabase
      .from("hmrc_returns")
      .select("id")
      .eq("shop_domain", shopDomain)
      .eq("vrn", vrn)
      .eq("period_key", periodKey)
      .limit(1);

    if (retErr) return bad(retErr.message, 500);
    alreadySubmitted = !!ret?.length;
  }

  // Optionally try to discover the current OPEN period when no periodKey was provided.
  let effectivePeriodKey: string | null = null;
  if (!periodKey && row) {
    try {
      const tokens: HmrcToken = {
        access_token: row.access_token,
        refresh_token: row.refresh_token,
        token_type: (row.token_type as any) || "Bearer",
        scope: row.scope || "",
        expires_in: row.expires_in ?? 3600,
        expires_at: Date.parse(row.expires_at),
      };
      const client = new HmrcClient(vrn, tokens);
      const obs = await client.getObligations(undefined, undefined, "O");
      const isOpen = (s: unknown) => {
        const v = String(s ?? "").toUpperCase();
        return v === "O" || v === "OPEN";
      };
      const open = (obs?.obligations ?? []).find((o: any) => isOpen(o.status));
      effectivePeriodKey = open?.periodKey ?? null;
    } catch {
      effectivePeriodKey = null; // non-blocking
    }
  }

  return NextResponse.json({
    ok: true,
    connected,
    expiresAtISO,
    secondsToExpiry,
    needsReconnect,
    alreadySubmitted,
    effectivePeriodKey,
  });
}
