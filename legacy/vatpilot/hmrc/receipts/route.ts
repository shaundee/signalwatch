// ┌───────────────────────────────────────────────────────────┐
// │ File: app/api/hmrc/receipts/route.ts                      │
// └───────────────────────────────────────────────────────────┘
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ok, bad } from "@/lib/api/http";

export const runtime = "nodejs";

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

/**
 * GET /api/hmrc/receipts?vrn=...&shopDomain=...&periodKey=...
 * - vrn required
 * - shopDomain optional → filters if provided
 * - periodKey optional → exact match if provided, otherwise latest 5
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const shopDomain = url.searchParams.get("shopDomain")?.trim() || "";
  const vrn = url.searchParams.get("vrn")?.trim() || "";
  const periodKey = url.searchParams.get("periodKey")?.trim() || "";

  if (!vrn) {
   return bad("Missing vrn", 400);
  }

  const supabase = sb();

  let q = supabase.from("hmrc_receipts").select("*").eq("vrn", vrn);
  if (shopDomain) q = q.eq("shop_domain", shopDomain);
  if (periodKey) q = q.eq("period_key", periodKey);

  const { data, error } = await q
    .order("created_at", { ascending: false })
    .limit(periodKey ? 1 : 5);

  if (error) {
   return bad(error.message, 500, "db_receipts");
  }

  const rows = data ?? [];
  const latest = rows[0] ?? null;

 return ok({ count: rows.length, latest, receipts: rows });
}

/**
 * POST /api/hmrc/receipts
 * Body: { vrn, shopDomain?, periodKey, payload?, receipt? }
 * - Upserts a manual/fake receipt for testing
 */
export async function POST(req: NextRequest) {
  const supabase = sb();
  const body = await req.json().catch(() => null);

  if (!body) {
   return bad("Missing JSON body", 400);
  }

  const { vrn, shopDomain = "", periodKey, payload, receipt } = body;

  if (!vrn || !periodKey) {
   return bad("Missing vrn or periodKey", 400);
  }

  try {
    const { error } = await supabase.from("hmrc_receipts").upsert(
      {
        shop_domain: shopDomain || null,
        vrn,
        period_key: periodKey,
        body: payload ?? {},
        receipt: receipt ?? {},
        created_at: new Date().toISOString(),
      },
      { onConflict: "shop_domain,vrn,period_key" }
    );

    if (error) {
     return bad(error.message, 500, "db_upsert");
    }

return ok({ vrn, periodKey });
} catch (e: any) {
  return bad(String(e?.message || e), 500, "receipts_post");
}
}

/**
 * DELETE /api/hmrc/receipts?vrn=...&periodKey=...&shopDomain=...
 * - Delete a specific receipt: require vrn + periodKey (shopDomain optional)
 *
 * DELETE /api/hmrc/receipts?vrn=...&all=true&shopDomain=...
 * - Purge all receipts for a VRN (optionally scoped to shopDomain)
 */
export async function DELETE(req: NextRequest) {
  const url = new URL(req.url);
  const shopDomain = url.searchParams.get("shopDomain")?.trim() || "";
  const vrn = url.searchParams.get("vrn")?.trim() || "";
  const periodKey = url.searchParams.get("periodKey")?.trim() || "";
  const all = (url.searchParams.get("all") || "").toLowerCase() === "true";

  if (!vrn) {
   return bad("Missing vrn", 400);
  }

  if (!all && !periodKey) {
   return bad("Provide periodKey, or set all=true to purge all for this VRN.", 400);
  }

  const supabase = sb();

  try {
    let del = supabase.from("hmrc_receipts").delete();
    del = del.eq("vrn", vrn);
    if (shopDomain) del = del.eq("shop_domain", shopDomain);
    if (!all) del = del.eq("period_key", periodKey);

    // Return the deleted rows so we can report how many
    const { data, error } = await del.select();

    if (error) {
     return bad(error.message, 500, "db_delete");
    }

   const count = data?.length ?? 0;
return ok({
  vrn,
  periodKey: all ? null : periodKey,
  purgedAllForVrn: all,
  deletedCount: count,
});
} catch (e: any) {
  return bad(String(e?.message || e), 500, "receipts_delete");
}
}