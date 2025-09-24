"use client";

import { useEffect, useMemo, useState } from "react";
import { submitVatReturn } from "@/app/dashboard/actions/submitVatReturn";

type Status = {
  ok: boolean;
  connected: boolean;
  expiresAtISO: string | null;
  secondsToExpiry: number | null;
  needsReconnect: boolean;
  alreadySubmitted: boolean;
  effectivePeriodKey: string | null;
  error?: string;
};

export default function FileVatReturnCard({
  defaultShopDomain = "",
  defaultVrn = "",
  defaultPeriodKey = "",
  startISO,
  endISO,
}: {
  defaultShopDomain?: string;
  defaultVrn?: string;
  defaultPeriodKey?: string;
  startISO?: string; // pass your draft window start if you have it
  endISO?: string;   // pass your draft window end if you have it
}) {
  const [shopDomain, setShopDomain] = useState(defaultShopDomain);
  const [vrn, setVrn] = useState(defaultVrn);
  const [periodKey, setPeriodKey] = useState(defaultPeriodKey);
  const [status, setStatus] = useState<Status | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const queryParams = useMemo(() => {
    const p = new URLSearchParams({ shopDomain, vrn });
    if (periodKey) p.set("periodKey", periodKey);
    return p.toString();
  }, [shopDomain, vrn, periodKey]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setStatus(null);
      setMsg(null);
      if (!shopDomain || !vrn) return;
      const r = await fetch(`/api/hmrc/status?${queryParams}`, { cache: "no-store" });
      const j = (await r.json()) as Status;
      if (alive) setStatus(j);
      // If no manual periodKey but HMRC returned an OPEN one, adopt it
      if (!periodKey && j?.effectivePeriodKey) setPeriodKey(j.effectivePeriodKey);
    })();
    return () => { alive = false; };
  }, [shopDomain, vrn, queryParams]); // note: queryParams includes periodKey but we guard above

  const connectUrl = `/api/hmrc/oauth/start?shopDomain=${encodeURIComponent(shopDomain || "")}&vrn=${encodeURIComponent(vrn || "")}`;
  const canSubmit = !!shopDomain && !!vrn && status?.connected && !status?.alreadySubmitted && !submitting;

  async function onSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setMsg(null);
    const res = await submitVatReturn({
      shopDomain,
      vrn,
      periodKey: periodKey || undefined,
      fromISO: startISO,
      toISO: endISO,
    });
    setSubmitting(false);

    if (res.ok) {
      setMsg("Submitted to HMRC ✅");
      setStatus((s) => s ? { ...s, alreadySubmitted: true } : s);
    } else if ((res as any).alreadySubmitted) {
      setMsg("This period was already submitted.");
      setStatus((s) => s ? { ...s, alreadySubmitted: true } : s);
    } else {
      setMsg(res.error || "Submit failed");
    }
  }

  return (
    <div className="rounded-lg border p-4">
      <h3 className="font-semibold">File VAT Return (HMRC)</h3>
      <p className="text-sm text-zinc-600">Uses current period dates below unless you specify a period key.</p>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <label className="text-sm">
          <span className="block text-zinc-600 mb-1">Shop Domain</span>
          <input
            className="w-full rounded border px-3 py-2"
            value={shopDomain}
            onChange={(e) => setShopDomain(e.target.value.trim())}
            placeholder="example.myshopify.com"
          />
        </label>

        <label className="text-sm">
          <span className="block text-zinc-600 mb-1">VRN</span>
          <input
            className="w-full rounded border px-3 py-2"
            value={vrn}
            onChange={(e) => setVrn(e.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
            placeholder="9 digits"
            maxLength={9}
          />
        </label>

        <label className="text-sm">
          <span className="block text-zinc-600 mb-1">Period Key (optional)</span>
          <input
            className="w-full rounded border px-3 py-2"
            value={periodKey}
            onChange={(e) => setPeriodKey(e.target.value.toUpperCase())}
            placeholder="e.g. 17A1 (leave blank to auto-pick OPEN)"
          />
        </label>
      </div>

      <p className="text-xs text-zinc-500 mt-2">
        Period window: {startISO || "—"} → {endISO || "—"}
      </p>

      {/* Connection / status line */}
      <div className="mt-2 text-xs">
        {status?.connected ? (
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 rounded bg-green-50 border border-green-200 text-green-700">
              Connected
            </span>
            {status.needsReconnect && (
              <a href={connectUrl} className="text-blue-600 hover:underline">
                Reconnect (token expiring soon)
              </a>
            )}
            {status.expiresAtISO && (
              <span className="text-zinc-500">
                Expires: {new Date(status.expiresAtISO).toLocaleString()}
              </span>
            )}
          </div>
        ) : (
          shopDomain && vrn ? (
            <a href={connectUrl} className="text-blue-600 hover:underline">
              Connect HMRC (sandbox)
            </a>
          ) : (
            <span className="text-zinc-500">Enter shop + VRN to connect.</span>
          )
        )}
        {status?.alreadySubmitted && (
          <div className="mt-1 text-zinc-600">Already submitted for {periodKey || status.effectivePeriodKey || "this period"}.</div>
        )}
        {status?.error && (
          <div className="mt-1 text-red-600">{status.error}</div>
        )}
      </div>

      {/* Actions */}
      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={onSubmit}
          disabled={!canSubmit}
          className={`px-4 py-2 rounded text-white ${
            canSubmit ? "bg-black hover:opacity-90" : "bg-gray-400"
          }`}
        >
          {status?.alreadySubmitted ? "Already submitted"
           : submitting ? "Submitting…"
           : status?.connected ? "Submit to HMRC"
           : "Connect HMRC first"}
        </button>
      </div>

      {msg && <p className="text-sm mt-2">{msg}</p>}
    </div>
  );
}
