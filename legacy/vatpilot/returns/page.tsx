// ┌───────────────────────────────────────────────────────────┐
// │ File: app/dashboard/returns/page.tsx                      │
// └───────────────────────────────────────────────────────────┘
import Link from "next/link";
import { sb } from "@/lib/supabase/server";
import ShopDomainFilter from "@/components/ShopDomainFilter";
import TagFiledOrdersButton from "@/components/TagFiledOrdersButton";

export const dynamic = "force-dynamic";

type ReturnRow = {
  vrn: string;
  period_key: string;
  created_at: string; // ISO
  boxes: any;
  receipt: any;
};

async function loadReturns(shopDomain: string): Promise<ReturnRow[]> {
  const supabase = sb();

  // Preferred source: hmrc_returns
  const { data: ret, error: retErr } = await supabase
    .from("hmrc_returns")
    .select("vrn, period_key, submitted_at, boxes_json, hmrc_receipt_json")
    .eq("shop_domain", shopDomain)
    .order("submitted_at", { ascending: false });

  if (!retErr && ret && ret.length) {
    return ret.map((r: any) => ({
      vrn: r.vrn,
      period_key: r.period_key,
      created_at: r.submitted_at,
      boxes: r.boxes_json,
      receipt: r.hmrc_receipt_json,
    }));
  }

  // Fallback: legacy hmrc_receipts (receipt_json or receipt)
  const { data: legacy, error: legacyErr } = await supabase
    .from("hmrc_receipts")
    .select("vrn, period_key, created_at, receipt_json, receipt");

  if (legacyErr || !legacy) return [];
  return legacy.map((r: any) => ({
    vrn: r.vrn ?? "",
    period_key: r.period_key,
    created_at: r.created_at,
    boxes: null,
    receipt: r.receipt_json ?? r.receipt,
  }));
}

export default async function ReturnsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const shopDomain = (searchParams?.shopDomain as string) || "";
  const rows = shopDomain ? await loadReturns(shopDomain) : [];

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">VAT Returns</h1>

      <div className="flex items-center gap-3 text-sm">
        <ShopDomainFilter initialValue={shopDomain} />
        <Link
          href={`/dashboard/vat?shopDomain=${encodeURIComponent(shopDomain || "")}`}
          className="text-blue-600 hover:underline"
        >
          + File a return
        </Link>
      </div>

      {!shopDomain && (
        <p className="text-sm text-gray-500">
          Enter a shop domain above to view submitted returns.
        </p>
      )}

      {shopDomain && rows.length === 0 && (
        <p className="text-sm text-gray-500">
          No returns found for <code>{shopDomain}</code>.
        </p>
      )}

      <ul className="divide-y border rounded-xl">
        {rows.map((r, i) => (
          <li key={`${r.period_key}-${i}`} className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="font-medium">Period {r.period_key}</div>
                <div className="text-xs text-gray-500">
                  Submitted {new Date(r.created_at).toLocaleString()}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Link
                  href={`/api/vat/export?shopDomain=${encodeURIComponent(
                    shopDomain
                  )}&periodKey=${encodeURIComponent(r.period_key)}`}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Download CSV
                </Link>

                {/* Tag all included orders in Shopify */}
                <TagFiledOrdersButton
                  shopDomain={shopDomain}
                  vrn={r.vrn}
                  periodKey={r.period_key}
                />
              </div>
            </div>

            {r.boxes && (
              <>
                <div className="text-xs font-semibold mt-2">Boxes (snapshot)</div>
                <pre className="text-xs bg-gray-50 border rounded-lg p-2 overflow-auto">
                  {JSON.stringify(r.boxes, null, 2)}
                </pre>
              </>
            )}

            <div className="text-xs font-semibold">HMRC Receipt</div>
            <pre className="text-xs bg-gray-50 border rounded-lg p-2 overflow-auto">
              {JSON.stringify(r.receipt, null, 2)}
            </pre>
          </li>
        ))}
      </ul>
    </div>
  );
}
