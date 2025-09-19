// ┌───────────────────────────────────────────────────────────┐
// │ File: app/api/hmrc/callback/route.ts                      │
// └───────────────────────────────────────────────────────────┘
import { NextRequest, NextResponse } from "next/server";
import { sb } from "@/lib/supabase/server";

export const runtime = "nodejs";

type ParsedState = { shopDomain: string; vrn: string; flags: Set<string> };

function parseState(raw: string): { ok: true; value: ParsedState } | { ok: false; tried: string[] } {
  const tried: string[] = [];
  const add = (v?: string) => { if (v && !tried.includes(v)) tried.push(v); };
  add(raw);
  try { add(decodeURIComponent(raw)); } catch {}
  try { add(decodeURIComponent(decodeURIComponent(raw))); } catch {}
  try { add(Buffer.from(raw, "base64url").toString("utf8")); } catch {}
  try { add(Buffer.from(raw.replace(/ /g, "+"), "base64").toString("utf8")); } catch {}

  for (const s of tried) {
    // JSON state
    try {
      const o = JSON.parse(s);
      const shopDomain = String(o?.shopDomain ?? "").trim();
      const vrn = String(o?.vrn ?? "").trim();
      const flags = new Set<string>();
      if (String(o?.probe ?? "").toLowerCase() === "true") flags.add("probe");
      if (String(o?.peek  ?? "").toLowerCase() === "true") flags.add("peek");
      if (shopDomain && vrn) return { ok: true, value: { shopDomain, vrn, flags } };
    } catch {}

    // Pipe state: shop|vrn|ts|flag
    if (s.includes("|")) {
      const [shop, v, _ts, f] = s.split("|");
      const shopDomain = String(shop ?? "").trim();
      const vrn = String(v ?? "").trim();
      const flags = new Set<string>();
      const flag = String(f ?? "").toLowerCase();
      if (flag === "probe") flags.add("probe");
      if (flag === "peek")  flags.add("peek");
      if (shopDomain && vrn) return { ok: true, value: { shopDomain, vrn, flags } };
    }
  }

  return { ok: false, tried };
}

function redirectToVat(req: NextRequest, q: Record<string, string | undefined>) {
  const u = new URL("/dashboard/vat", req.url);
  Object.entries(q).forEach(([k, v]) => v && u.searchParams.set(k, v));
  return NextResponse.redirect(u);
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code") || "";
    const rawState = url.searchParams.get("state") || "";
    const debug = url.searchParams.get("debug") === "1";

    const parsed = parseState(rawState);

    if (debug) {
      return NextResponse.json({
        phase: "callback-debug",
        received: { code, rawState },
        stateOk: parsed.ok,
        parsed: parsed.ok ? parsed.value : null,
        envOk: {
          HMRC_BASE_URL: !!process.env.HMRC_BASE_URL,
          HMRC_REDIRECT_URI: !!process.env.HMRC_REDIRECT_URI,
          HMRC_CLIENT_ID: !!process.env.HMRC_CLIENT_ID,
          HMRC_CLIENT_SECRET: !!process.env.HMRC_CLIENT_SECRET,
        },
      });
    }

    if (!code) {
      // No code → bounce with an error
      return redirectToVat(req, { error: "missing_code" });
    }
    if (!parsed.ok) {
      // Bad/garbled state → bounce with error
      return redirectToVat(req, { error: "bad_state" });
    }

    const { shopDomain, vrn, flags } = parsed.value;
    const base = process.env.HMRC_BASE_URL || "https://test-api.service.hmrc.gov.uk";
    const clientId = process.env.HMRC_CLIENT_ID!;
    const clientSecret = process.env.HMRC_CLIENT_SECRET!;
    const redirectUri = process.env.HMRC_REDIRECT_URI!;

    // ── Mode: PEAK (no token exchange, code not consumed) ────────────────
    if (flags.has("peek")) {
      return NextResponse.json({
        phase: "callback-peek",
        code,
        parsed: { shopDomain, vrn },
        note: "No token exchange performed (code not consumed).",
      });
    }

    // Helper to POST /oauth/token
    const exchange = async () => {
      const resp = await fetch(`${base}/oauth/token`, {
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
      const json = await resp.json().catch(() => ({}));
      return { resp, json };
    };

    // ── Mode: PROBE (visible token exchange; returns JSON) ───────────────
    if (flags.has("probe")) {
      try {
        const { resp, json } = await exchange();
        return NextResponse.json({
          phase: "callback-probe",
          http: { ok: resp.ok, status: resp.status, statusText: resp.statusText },
          json,
          parsed: { shopDomain, vrn },
        });
      } catch (e: any) {
        return NextResponse.json({
          phase: "callback-probe",
          http: { ok: false, status: 0, statusText: "network_error" },
          error: String(e?.message || e),
          parsed: { shopDomain, vrn },
        });
      }
    }

    // ── REAL FLOW: exchange + save tokens + redirect to dashboard ────────
    let tokenJson: any = null;
    try {
      const { resp, json } = await exchange();
      tokenJson = json;
      if (!resp.ok) {
        const msg = json?.error_description || json?.error || resp.statusText || "token_exchange_failed";
        return redirectToVat(req, {
          shopDomain, vrn,
          error: `token_exchange_failed:${encodeURIComponent(String(msg))}`,
        });
      }
    } catch (e: any) {
      return redirectToVat(req, {
        shopDomain, vrn,
        error: `token_exchange_network:${encodeURIComponent(String(e?.message || e))}`,
      });
    }

    // Persist tokens (guarded; no server 500s)
    try {
      const supabase = sb();
      const expiresIn = Number(tokenJson.expires_in ?? 3600);
      const row = {
        shop_domain: shopDomain,
        vrn,
        access_token: tokenJson.access_token,
        refresh_token: tokenJson.refresh_token,
        token_type: tokenJson.token_type || "Bearer",
        scope: tokenJson.scope || "",
        expires_in: expiresIn,
        expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("hmrc_tokens")
        .upsert(row, { onConflict: "shop_domain,vrn" });

      if (error) {
        return redirectToVat(req, {
          shopDomain, vrn,
          error: `save_tokens_failed:${encodeURIComponent(error.message)}`,
        });
      }
    } catch (e: any) {
      return redirectToVat(req, {
        shopDomain, vrn,
        error: `save_tokens_exception:${encodeURIComponent(String(e?.message || e))}`,
      });
    }

    // Success → back to VAT page, prefilled
    return redirectToVat(req, { shopDomain, vrn });
  } catch (e: any) {
    // Final insurance: never 500, always redirect with a message
    return redirectToVat(req, { error: `callback_500:${encodeURIComponent(String(e?.message || e))}` });
  }
}
