export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 prose">
      <h1>Privacy Policy</h1>
      <p>SignalWatch processes the URL you submit to run an audit and stores results to show your report and improve service quality.</p>
      <p>We log IP addresses to prevent abuse. We don’t sell personal data.</p>
      <p>Contact: support@signalwatch.io</p>
      <p>Last updated: {new Date().toISOString().slice(0,10)}</p>
    </main>
  );
}
