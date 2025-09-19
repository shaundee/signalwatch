import { NextRequest, NextResponse } from "next/server";
import { sb } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ ok:false, error:"forbidden" }, { status: 403 });
  }

  const b = await req.json().catch(() => null) as null | {
    shopDomain?: string; vrn?: string;
    access_token?: string; refresh_token?: string;
    expires_in?: number; token_type?: string; scope?: string;
  };

  if (!b?.shopDomain || !b?.vrn || !b?.access_token || !b?.refresh_token) {
    return NextResponse.json({ ok:false, error:"missing fields" }, { status: 400 });
  }

  const expires_at = new Date(Date.now() + Number(b.expires_in ?? 3600) * 1000).toISOString();

  const row = {
    shop_domain: b.shopDomain,
    vrn: b.vrn,
    access_token: b.access_token,
    refresh_token: b.refresh_token,
    token_type: (b.token_type || "Bearer"),
    scope: b.scope || "read:vat write:vat",
    expires_in: Number(b.expires_in ?? 3600),
    expires_at,
    updated_at: new Date().toISOString(),
  };

  const { error } = await sb().from("hmrc_tokens").upsert(row, { onConflict: "shop_domain,vrn" });
  if (error) return NextResponse.json({ ok:false, where:"upsert", error: error.message, row }, { status: 500 });
  return NextResponse.json({ ok:true });
}
