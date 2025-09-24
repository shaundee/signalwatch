// app/page.tsx
import SubscribeForm from "@/components/SubscribeForm";




export const metadata = {
  title: "SignalWatch — Free Website Audit & Shareable Report",
  description:
    "Find issues costing your site traffic & sales. Run a free audit, get a shareable report, export a PDF.",
  metadataBase: new URL(process.env.REPORT_BASE_URL || "http://localhost:3000"),
  openGraph: {
    title: "SignalWatch — Free Website Audit",
    description:
      "Run a free audit, share a clean report, and export a PDF.",
    url: "/",
    siteName: "SignalWatch",
    images: ["/og.png"], // optional, see note below
  },
  twitter: {
    card: "summary_large_image",
    title: "SignalWatch",
    description: "Free website audits.",
    images: ["/og.png"], // optional
  },
};


export default function HomePage() {
 const sampleShare = `/s/${process.env.SAMPLE_SHARE_TOKEN || "SAMPLE_SHARE_TOKEN"}`;

  return (
    <main className="mx-auto max-w-5xl px-6 py-14">
      <section className="text-center">
        <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight">
          Find issues costing your site <span className="whitespace-nowrap">traffic & sales</span>.
        </h1>
        <p className="mt-4 text-base sm:text-lg text-black/70 dark:text-white/70">
          Run a free audit in seconds. Get a shareable report link and a tidy PDF for your team or clients.
        </p>

        <div className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-3">
          <a
            href="/run-audit"
            className="rounded-2xl border px-6 py-3 font-medium hover:shadow-sm"
          >
            Run a free audit
          </a>
          <a
            href={sampleShare}
            className="rounded-2xl px-6 py-3 underline underline-offset-4 opacity-80 hover:opacity-100"
          >
            See a sample report
          </a>
        </div>

        <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
          <Feature title="Queue status">See queued/running at a glance.</Feature>
          <Feature title="Shareable link">Clean /s/&lt;token&gt; links for clients.</Feature>
          <Feature title="PDF export">One-click PDF for email or Slack.</Feature>
          <SubscribeForm />
        </div>


        <p className="mt-8 text-sm opacity-60">
          Made in London · Slack alerts & scheduled scans available in pilot
        </p>
      </section>
    </main>
  );
}

function Feature({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border p-4">
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-1 text-sm opacity-80">{children}</div>
    </div>
  );
}
