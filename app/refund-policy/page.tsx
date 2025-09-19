// app/refund-policy/page.tsxexport 

 const metadata = { title: "Refund policy — VatPilot" };
export default function RefundPolicy() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-2xl font-semibold">Refund Policy</h1>
      <p className="mt-4 text-zinc-700">
        Annual subscriptions include a 14-day money-back guarantee. If you’re not satisfied,
        contact us within 14 days of purchase and we’ll refund your first payment in full.
      </p>
      <ul className="mt-4 list-disc pl-5 text-zinc-700">
        <li>Applies to annual plans only.</li>
        <li>Refunds cover the most recent annual charge; the subscription will be cancelled.</li>
        <li>This guarantee does not apply to monthly plans.</li>
      </ul>
      <p className="mt-6 text-zinc-700">
        Need help? Email <a className="underline" href={`mailto:${process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "support@example.com"}`}>
          {process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "support@example.com"}
        </a>.
      </p>
        <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold">Refund policy</h1>
      <p className="mt-4 text-zinc-600">
        Presale deposits are refundable anytime before launch. Annual plan has a 14-day money-back guarantee.
      </p>
    </main>
    </div>
  );
}
