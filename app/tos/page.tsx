// ┌───────────────────────────────────────────────────────────┐
// │ File: app/tos/page.tsx                                    │
// └───────────────────────────────────────────────────────────┘
export const dynamic = "force-static";

export default function TosPage() {
  const APP = process.env.NEXT_PUBLIC_APP_NAME ?? "SignalWatch";
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-semibold mb-4">Terms of Service</h1>
      <p className="opacity-80 mb-6 text-sm">
        Last updated: {new Date().toISOString().slice(0,10)}
      </p>

      <h2 className="font-semibold mt-8 mb-2">1. What we provide</h2>
      <p className="mb-4">
        {APP} runs automated checks on publicly accessible web pages you submit and
        generates reports for you. It does not bypass authentication or access non-public content.
      </p>

      <h2 className="font-semibold mt-6 mb-2">2. Acceptable use</h2>
      <ul className="list-disc ml-5 mb-4">
        <li>No scanning of sites without permission from their owner.</li>
        <li>No attempts to overload, exploit, or disrupt target sites.</li>
      </ul>

      <h2 className="font-semibold mt-6 mb-2">3. Fees & cancellations</h2>
      <p className="mb-4">
        Paid plans are billed in advance. You may cancel at any time; access continues through the current billing period.
      </p>

      <h2 className="font-semibold mt-6 mb-2">4. No warranty</h2>
      <p className="mb-4">
        Reports are best-effort and may contain errors or omissions. {APP} is provided “as is” without warranties.
      </p>

      <h2 className="font-semibold mt-6 mb-2">5. Limitation of liability</h2>
      <p className="mb-8">
        To the maximum extent permitted by law, our aggregate liability is limited to the fees you paid in the last 3 months.
      </p>

      <p className="text-sm opacity-70">
        Questions? Email <a className="underline" href="mailto:support@signalwatch.co.uk">support@signalwatch.co.uk</a>.
      </p>
    </div>
  );
}
