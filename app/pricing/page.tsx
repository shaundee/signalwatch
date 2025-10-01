import { headers } from "next/headers";
import { UpgradeButton } from "@/components/BillingButtons";

export const dynamic = "force-dynamic";

async function getAccount() {
  const h = headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || (process.env.NODE_ENV === "production" ? "https" : "http");
  const base = process.env.NEXT_PUBLIC_SITE_URL || `${proto}://${host}`;
  const r = await fetch(`${base}/api/me/account`, { cache: "no-store", headers: { cookie: h.get("cookie") || "" } });
  if (!r.ok) return null;
  const j = await r.json();
  return j.account as { id: string } | null;
}

function getPriceId(tier: "starter" | "pro" | "agency", annual: boolean) {
  const env = process.env;
  if (tier === "starter") return annual ? env.NEXT_PUBLIC_PRICE_STARTER_ANNUAL! : env.NEXT_PUBLIC_PRICE_STARTER_MONTHLY!;
  if (tier === "pro")     return annual ? env.NEXT_PUBLIC_PRICE_PRO_ANNUAL!     : env.NEXT_PUBLIC_PRICE_PRO_MONTHLY!;
  return annual ? env.NEXT_PUBLIC_PRICE_AGENCY_ANNUAL! : env.NEXT_PUBLIC_PRICE_AGENCY_MONTHLY!;
}

export default async function PricingPage() {
  const acc = await getAccount();
  const accountId = acc?.id ?? "";

  // simple server-side annual flag via query (?annual=1), or keep monthly default
  const search = new URLSearchParams(globalThis?.location ? location.search : "");
  const annual = search.get("annual") === "1"; // Next 14 SSR won't have location; you can swap to a client toggle if you like.

  // If you prefer a client toggle, create a small client component; keeping SSR simple here.
  const plans = [
    { key: "starter" as const, title: "Starter",  monthly: "£29",  annual: "£290",  blurb: "1 domain · 200 scans/mo" },
    { key: "pro"     as const, title: "Pro",      monthly: "£79",  annual: "£790",  blurb: "3 domains · 600 scans/mo" },
    { key: "agency"  as const, title: "Agency",   monthly: "£149", annual: "£1490", blurb: "10 domains · 2000 scans/mo" },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-bold">Pricing</h1>
      <p className="mt-2 text-zinc-600">Simple plans. Monthly or annual.</p>

      {/* if you want a client toggle, you can add it; here we expose links */}
      <div className="mt-4 text-sm">
        <a href="/pricing" className={!annual ? "font-semibold" : ""}>Monthly</a>
        <span className="mx-2 opacity-40">/</span>
        <a href="/pricing?annual=1" className={annual ? "font-semibold" : ""}>Annual</a>
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-3">
        {plans.map(p => {
          const priceId = getPriceId(p.key, annual);
          const price = annual ? p.annual : p.monthly;
          return (
            <div key={p.key} className="rounded-2xl border p-6 flex flex-col">
              <h2 className="text-lg font-semibold">{p.title}</h2>
              <p className="mt-1 text-zinc-600">{p.blurb}</p>
              <div className="mt-4 text-3xl font-bold">
                {price}<span className="text-base opacity-70">{annual ? "/yr" : "/mo"}</span>
              </div>
              <div className="mt-6">
                <UpgradeButton
                  priceId={priceId}
                  accountId={accountId}
                  className="w-full rounded-xl bg-black text-white py-3"
                >
                  {annual ? `Choose ${p.title} Annual` : `Choose ${p.title} Monthly`}
                </UpgradeButton>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-6 text-sm text-zinc-500">Annual = 2 months free. Cancel anytime.</p>
    </div>
  );
}
