export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 prose">
      <h1>Terms of Service</h1>
      <p>SignalWatch provides audits “as is”, without warranties. Use at your own risk.</p>
      <p>You agree not to abuse the service (rate limits apply) and to submit only URLs you’re authorized to scan.</p>
      <p>Contact: support@signalwatch.io</p>
      <p>Last updated: {new Date().toISOString().slice(0,10)}</p>
    </main>
  );
}
