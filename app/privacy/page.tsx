// ┌───────────────────────────────────────────────────────────┐
// │ File: app/privacy/page.tsx                                │
// └───────────────────────────────────────────────────────────┘
export const dynamic = "force-static";

export default function PrivacyPage() {
  const APP = process.env.NEXT_PUBLIC_APP_NAME ?? "SignalWatch";
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-semibold mb-4">Privacy Policy</h1>
      <p className="opacity-80 mb-6 text-sm">
        Last updated: {new Date().toISOString().slice(0,10)}
      </p>

      <h2 className="font-semibold mt-8 mb-2">What we collect</h2>
      <ul className="list-disc ml-5 mb-4">
        <li>Account info (e.g. email) when you join the waitlist or subscribe.</li>
        <li>Scan inputs (URLs) and generated results.</li>
        <li>Basic usage analytics and logs to improve {APP}.</li>
      </ul>

      <h2 className="font-semibold mt-6 mb-2">How we use it</h2>
      <p className="mb-4">
        To run scans, show reports, send alerts, bill for service, and keep the platform secure.
      </p>

      <h2 className="font-semibold mt-6 mb-2">Data retention</h2>
      <p className="mb-4">
        We retain reports while your account is active. You can request deletion at any time.
      </p>

      <h2 className="font-semibold mt-6 mb-2">Third-party processors</h2>
      <p className="mb-4">
        We use trusted providers (e.g., Supabase, Slack) to deliver {APP}. They process data on our behalf under contract.
      </p>

      <h2 className="font-semibold mt-6 mb-2">Contact</h2>
      <p className="mb-8">
        For privacy requests, email <a className="underline" href="mailto:support@signalwatch.co.uk">support@signalwatch.co.uk</a>.
      </p>

      <p className="text-xs opacity-70">We don’t sell personal data.</p>
    </div>
  );
}
