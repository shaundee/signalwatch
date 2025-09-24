"use client";
import { useState } from "react";

export default function SubscribeForm() {
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  return (
    <form
      className="mt-4 flex gap-2 justify-center"
      onSubmit={async (e: any) => {
        e.preventDefault();
        setBusy(true); setOk(false); setErr(null);
        const email = new FormData(e.currentTarget).get("email");
        const res = await fetch("/api/subscribe", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email })
        });
        if (res.ok) { setOk(true); e.currentTarget.reset(); }
        else {
          const j = await res.json().catch(() => ({}));
          setErr(j?.error || "Failed to subscribe");
        }
        setBusy(false);
      }}
    >
      <input
        name="email"
        type="email"
        required
        placeholder="you@company.com"
        className="rounded-xl border px-4 py-2 w-64"
      />
      <button className="rounded-xl border px-4 py-2" disabled={busy}>
        {busy ? "Saving…" : "Notify me"}
      </button>
      {ok && <span className="text-xs ml-2 opacity-70">Thanks! You’re on the list.</span>}
      {err && <span className="text-xs ml-2 text-red-600">{err}</span>}
    </form>
  );
}
