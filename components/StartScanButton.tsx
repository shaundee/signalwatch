// components/StartScanButton.tsx (example)
"use client";
import { useState } from "react";

export default function StartScanButton({ domain }: { domain: string }) {
  const [banner, setBanner] = useState<null | { title: string; body: string; cta?: string }>(null);

  async function go() {
    const res = await fetch("/api/scan/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ domain }),
    });

    if (res.status === 402) {
      const j = await res.json().catch(() => ({}));
      if (j?.error === "verification_required") {
        setBanner({
          title: "Verify your domain",
          body: "Add the meta tag or the .well-known file, then click Re-check on the domain card.",
        });
        return;
      }
      if (j?.error === "limit_reached") {
        setBanner({
          title: "Monthly limit reached",
          body: "Upgrade your plan to continue scanning.",
          cta: "/pricing",
        });
        return;
      }
    }

    // success → maybe route to report
    const j = await res.json().catch(() => ({}));
    if (j?.reportUrl) window.location.href = j.reportUrl;
  }

  return (
    <div>
      {banner && (
        <div className="mb-3 rounded-xl border bg-amber-50 p-3">
          <div className="font-medium">{banner.title}</div>
          <div className="text-sm opacity-80">{banner.body}</div>
          {banner.cta && (
            <a href={banner.cta} className="mt-2 inline-block rounded-lg bg-black px-3 py-1 text-white">
              Upgrade
            </a>
          )}
        </div>
      )}
      <button onClick={go} className="rounded-xl bg-black px-4 py-2 text-white">Run audit</button>
    </div>
  );
}
