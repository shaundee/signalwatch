import SubscriptionStatus from "@/components/SubscriptionStatus";
import ManageBillingButton from "@/components/ManageBillingButton";
import ChangePlanButtons from "@/components/ChangePlanButtons";
import BillingHistory from "@/components/BillingHistory";
import ConditionalReactivate from "@/components/ConditionalReactivate";

export const dynamic = "force-dynamic";

export default function Dashboard() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
      <p className="mt-2 text-zinc-600">Subscription & billing controls.</p>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <div className="card">
          <h2 className="text-lg font-semibold">Subscription status</h2>
          <div className="mt-3"><SubscriptionStatus /></div>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold">Billing</h2>
          <p className="mt-2 text-sm text-zinc-600">Update payment details or cancel/reactivate.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <ManageBillingButton />
            {/* Cancel button intentionally hidden */}
            <ConditionalReactivate />
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold">Change plan</h2>
          <p className="mt-2 text-sm text-zinc-600">Switch monthly ↔ annual (proration applies).</p>
          <div className="mt-4"><ChangePlanButtons /></div>
        </div>

        <div className="card md:col-span-2">
          <h2 className="text-lg font-semibold">Billing history</h2>
          <div className="mt-3"><BillingHistory /></div>
        </div>
      </div>
    </div>
  );
}
