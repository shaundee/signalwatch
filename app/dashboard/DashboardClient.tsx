// ┌───────────────────────────────────────────────────────────┐
// │ File: app/dashboard/DashboardClient.tsx                   │
// └───────────────────────────────────────────────────────────┘
"use client";

import SubscriptionStatus from "@/components/SubscriptionStatus";
import ManageBillingButton from "@/components/ManageBillingButton";
import ChangePlanButtons from "@/components/ChangePlanButtons";
import BillingHistory from "@/components/BillingHistory";
import ConditionalReactivate from "@/components/ConditionalReactivate";
import UploadShopifyCsv from "@/components/UploadShopifyCsv";
import FileVatReturnCard from "@/components/FileVatReturnCard";

type Shop = { domain: string; created_at: string } | null;

export default function DashboardClient({
  shop,
  start,
  end,
  draft,
}: {
  shop: Shop;
  start: string;
  end: string;
  draft: any;
}) {
  const shopDomain = shop?.domain ?? "";

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
      <p className="mt-2 text-zinc-600">Subscription &amp; billing controls.</p>

      {/* Subscription & Billing */}
      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <div className="card">
          <h2 className="text-lg font-semibold">Subscription status</h2>
          <div className="mt-3">
            <SubscriptionStatus />
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold">Billing</h2>
          <p className="mt-2 text-sm text-zinc-600">
            Update payment details or cancel/reactivate.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <ManageBillingButton />
            <ConditionalReactivate />
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold">Change plan</h2>
          <p className="mt-2 text-sm text-zinc-600">
            Switch monthly ↔ annual (proration applies).
          </p>
          <div className="mt-4">
            <ChangePlanButtons />
          </div>
        </div>

        <div className="card md:col-span-2">
          <h2 className="text-lg font-semibold">Billing history</h2>
          <div className="mt-3">
            <BillingHistory />
          </div>
        </div>
      </div>

      {/* Imports, Draft & HMRC filing */}
      <div className="space-y-8 mt-8">
        <UploadShopifyCsv />

        {/* Draft snapshot */}
        <div className="rounded-lg border p-4">
          <h3 className="font-semibold">Draft VAT return (current quarter)</h3>
          <p className="text-sm text-zinc-600">
            Period: {start} → {end}
          </p>

          {draft?.ok ? (
            <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-md bg-zinc-50 p-3">
                <div className="text-xs text-zinc-500">Box 1 VAT due</div>
                <div className="text-lg font-semibold">
                  £{draft.totals.box1_vat_due.toFixed(2)}
                </div>
              </div>
              <div className="rounded-md bg-zinc-50 p-3">
                <div className="text-xs text-zinc-500">Box 6 Net sales</div>
                <div className="text-lg font-semibold">
                  £{draft.totals.box6_net_sales.toFixed(2)}
                </div>
              </div>
              <div className="rounded-md bg-zinc-50 p-3">
                <div className="text-xs text-zinc-500">Orders in period</div>
                <div className="text-lg font-semibold">{draft.orders}</div>
              </div>
              <div className="rounded-md bg-zinc-50 p-3">
                <div className="text-xs text-zinc-500">Status</div>
                <div className="text-lg font-semibold">Draft</div>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-sm text-zinc-500">
              No draft yet (import CSV to begin).
            </p>
          )}
        </div>

        {/* HMRC filing — new smart card */}
        <FileVatReturnCard
          defaultShopDomain={shopDomain}
          defaultVrn=""
          startISO={start}
          endISO={end}
        />

        {/* (Optional) link to returns list */}
        <a
          href={`/dashboard/returns?shopDomain=${encodeURIComponent(
            shopDomain
          )}`}
          className="inline-block text-xs text-blue-600 hover:underline"
        >
          View submitted returns
        </a>
      </div>
    </div>
  );
}
