export default function PricingPage() {
  const APP = process.env.NEXT_PUBLIC_APP_NAME ?? "SignalWatch";
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-semibold mb-3">Pricing</h1>
      <p className="opacity-80 mb-6">Founding member pricing for early agencies.</p>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="rounded-2xl border p-5">
          <h2 className="font-semibold mb-2">Starter</h2>
          <div className="text-2xl font-bold mb-2">£49<span className="text-sm opacity-70">/site/mo</span></div>
          <ul className="list-disc ml-5 text-sm space-y-1 mb-4">
            <li>On-demand audits</li>
            <li>Top issues summary</li>
            <li>Email support</li>
          </ul>
          <a className="inline-block rounded-xl px-4 py-2 border hover:bg-gray-50" href="/request-access">Request access</a>
        </div>
        <div className="rounded-2xl border p-5">
          <h2 className="font-semibold mb-2">Agency</h2>
          <div className="text-2xl font-bold mb-2">£149<span className="text-sm opacity-70">/mo</span></div>
          <ul className="list-disc ml-5 text-sm space-y-1 mb-4">
            <li>Up to 5 sites</li>
            <li>Slack alerts</li>
            <li>Priority onboarding</li>
          </ul>
          <a className="inline-block rounded-xl px-4 py-2 border hover:bg-gray-50" href="/request-access">Request access</a>
        </div>
      </div>
      <p className="text-xs opacity-70 mt-6">{APP} only scans publicly accessible pages.</p>
    </div>
  );
}
