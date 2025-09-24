import { NextRequest, NextResponse } from "next/server";
import { sb } from "@/lib/supabase/server";
import { getShopMetafield } from "@/lib/shopify/admin";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const shopDomain = url.searchParams.get("shopDomain") || "";
  const vrn = url.searchParams.get("vrn") || "";
  if (!shopDomain || !vrn) {
    return NextResponse.json({ ok:false, error:"Missing shopDomain or vrn" }, { status:400 });
  }

  const { data: shopRow, error } = await sb()
    .from("shops")
    .select("access_token")
    .eq("shop_domain", shopDomain)
    .single();

  if (error || !shopRow?.access_token) {
    return NextResponse.json({ ok:false, error: error?.message || "No access token" }, { status:500 });
  }

  const { value } = await getShopMetafield(shopDomain, shopRow.access_token, "vatpilot", `last_filed_${vrn}`);
  return NextResponse.json({ ok:true, value });
}
