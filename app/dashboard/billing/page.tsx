import { ManageBillingButton, UpgradeButton } from "@/components/BillingButtons";

async function getAccount() {
  const r = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || ""}/api/me/account`, { cache: "no-store" });
  if (!r.ok) return null;
  const j = await r.json();
  return j.account as {
    id: string; name: string; tier: string;
    stripe_customer_id: string | null;
    soft_limit_scans: number; hard_limit_scans: number;
  } | null;
}

export default async function BillingPage() {
  const acc = await getAccount();
  if (!acc) return <div className="p-6">No account</div>;

  const starterPrice = process.env.NEXT_PUBLIC_PRICE_STARTER!;
  const agencyPrice  = process.env.NEXT_PUBLIC_PRICE_AGENCY!;

  return (
    <div className="mx-auto max-w-2xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Billing</h1>

      <div className="rounded-2xl border p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">{acc.name}</div>
            <div className="text-sm opacity-70">Current plan: <b>{acc.tier}</b></div>
            <div className="text-sm opacity-70">Limits: {acc.soft_limit_scans}/{acc.hard_limit_scans} scans/mo</div>
          </div>
          <ManageBillingButton customerId={acc.stripe_customer_id} className="rounded-xl border px-4 py-2">
            Manage billing
          </ManageBillingButton>
        </div>
      </div>

      {/* Optional upsell section */}
      {acc.tier !== "agency" && (
        <div className="rounded-2xl border p-6">
          <div className="mb-3 font-medium">Need more capacity?</div>
          <div className="flex gap-3">
            <UpgradeButton priceId={starterPrice} accountId={acc.id} className="rounded-xl bg-black text-white px-4 py-2">
              Upgrade Starter
            </UpgradeButton>
            <UpgradeButton priceId={agencyPrice} accountId={acc.id} className="rounded-xl bg-black text-white px-4 py-2">
              Upgrade Agency
            </UpgradeButton>
          </div>
        </div>
      )}
    </div>
  );
}
