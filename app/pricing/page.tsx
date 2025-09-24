// app/pricing/page.tsx
import SubscribeButtons from "@/components/SubscribeButtons";
const TRIAL_DAYS = Number(process.env.NEXT_PUBLIC_TRIAL_DAYS || "0");

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-bold">Pricing</h1>
      <p className="mt-2 text-zinc-600">Simple plan. Monthly or annual.</p>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border p-6">
          <h2 className="text-lg font-semibold">Monthly</h2>
          <p className="mt-2 text-zinc-600">
            £29.00/month{TRIAL_DAYS > 0 ? ` — ${TRIAL_DAYS}-day free trial` : ""}.
          </p>
          <SubscribeButtons variant="monthly" trialDays={TRIAL_DAYS} />
        </div>

        <div className="rounded-2xl border p-6">
          <h2 className="text-lg font-semibold">Annual</h2>
          <p className="mt-2 text-zinc-600">
            £290.00/year <span className="opacity-80">(2 months free)</span>.
          </p>
          <p className="mt-1 text-sm text-emerald-700">14-day money-back guarantee.</p>
          <SubscribeButtons variant="annual" />
        </div>
      </div>
    </div>
  );
}
