// ┌───────────────────────────────────────────────────────────┐
// │ File: app/dashboard/vat/page.tsx                          │
// └───────────────────────────────────────────────────────────┘
'use client';

import { useEffect, useMemo, useState } from 'react';

type Obligation = {
  periodKey: string;
  start: string;
  end: string;
  due?: string;
  status: 'O' | 'F' | string;
};

type Boxes = {
  vatDueSales: string;
  vatDueAcquisitions: string;
  totalVatDue: string;
  vatReclaimedCurrPeriod: string;
  netVatDue: string;
  totalValueSalesExVAT: number;
  totalValuePurchasesExVAT: number;
  totalValueGoodsSuppliedExVAT: number;
  totalAcquisitionsExVAT: number;
};

function iso(d: string | null | undefined) {
  return (d ?? '').trim();
}
function fmtOb(o: Obligation) {
  return `${o.start} → ${o.end} (${o.status})`;
}
function sanitizeVrn(v: string) {
  return (v || '').replace(/\D/g, '').slice(0, 9);
}
function isValidVrn(v: string) {
  return /^\d{9}$/.test(v);
}

export default function VatPage() {
  // Mount flag to avoid hydration mismatch for client-only elements
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Read query params client-side
  const url = typeof window !== 'undefined' ? new URL(window.location.href) : null;
  const qpVrn = url?.searchParams.get('vrn') ?? '';
  const qpShop = url?.searchParams.get('shopDomain') ?? 'example.myshopify.com';

  // Last VRN from localStorage
  const savedVrn = typeof window !== 'undefined' ? localStorage.getItem('lastVrn') || '' : '';

  const [shopDomain, setShopDomain] = useState(qpShop);
  const initialVrn = isValidVrn(qpVrn) ? qpVrn : isValidVrn(savedVrn) ? savedVrn : '';
  const [vrn, setVrn] = useState(initialVrn);

  const [from, setFrom] = useState<string>('');
  const [to, setTo] = useState<string>('');

  const [obligations, setObligations] = useState<Obligation[]>([]);
  const [obLoading, setObLoading] = useState(false);
  const [obError, setObError] = useState<string | null>(null);
  const [periodKey, setPeriodKey] = useState<string>('');

  const [boxes, setBoxes] = useState<Boxes | null>(null);
  const [boxesErr, setBoxesErr] = useState<string | null>(null);
  const [boxesLoading, setBoxesLoading] = useState(false);

  const [alreadySubmitted, setAlreadySubmitted] = useState(false);

  const canLoad = useMemo(() => !!shopDomain && !!vrn, [shopDomain, vrn]);

  // Persist valid VRN
useEffect(() => {
  if (!shopDomain || !periodKey) return;

  const controller = new AbortController();
  (async () => {
    try {
      setBoxesLoading(true);
      setBoxesErr(null);
      setBoxes(null);

      // Find the obligation for the chosen periodKey
      const ob = obligations.find(o => o.periodKey === periodKey);
      if (!ob) {
        setBoxesErr('No obligation selected');
        return;
      }

      const calcQs = new URLSearchParams({
        shopDomain,
        from: ob.start,
        to: ob.end,
      });
      const url = `/api/vat/boxes?${calcQs.toString()}`;
      console.log('[boxes] GET', url);

      const resp = await fetch(url, { signal: controller.signal });
      const j = await resp.json();
      if (!resp.ok || !j.ok) {
        throw new Error(j?.error || resp.statusText || 'Box calc failed');
      }
      setBoxes(j.boxes);
    } catch (e: any) {
      if (e.name !== 'AbortError') setBoxesErr(String(e.message || e));
    } finally {
      setBoxesLoading(false);
    }
  })();

  return () => controller.abort();
}, [shopDomain, periodKey, obligations]);


  // Check if already submitted
  useEffect(() => {
    if (!shopDomain || !vrn || !periodKey) return;
    (async () => {
      try {
        const q = new URLSearchParams({ shopDomain, vrn, periodKey }).toString();
        const r = await fetch(`/api/hmrc/receipts?${q}`);
        const j = await r.json();
        setAlreadySubmitted(!!j.exists);
      } catch {
        setAlreadySubmitted(false);
      }
    })();
  }, [shopDomain, vrn, periodKey]);

 
  //obligations
useEffect(() => {
  if (!canLoad) return;

  const controller = new AbortController();
  (async () => {
    try {
      setObLoading(true);
      setObError(null);
      setObligations([]);
      setPeriodKey('');
      setBoxes(null); // reset boxes if period changes

      const qs = new URLSearchParams({ shopDomain, vrn });
      if (from) qs.set('from', iso(from));
      if (to) qs.set('to', iso(to));

      const res = await fetch(`/api/hmrc/obligations?${qs.toString()}`, {
        signal: controller.signal,
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json?.error || res.statusText);

      const list: Obligation[] =
        json.obligations?.obligations ?? json.obligations ?? [];
      setObligations(list);

      // pick first OPEN obligation if available
      const open = list.find((o) => String(o.status).toUpperCase() === 'O');
      setPeriodKey(open?.periodKey || list[0]?.periodKey || '');
    } catch (e: any) {
      if (e.name !== 'AbortError') setObError(e?.message || String(e));
    } finally {
      setObLoading(false);
    }
  })();

  return () => controller.abort();
}, [canLoad, shopDomain, vrn, from, to]);

 // Calculate boxes for selected period
 useEffect(() => {
  if (!shopDomain || !periodKey) return;

  const controller = new AbortController();
  (async () => {
    try {
      setBoxesLoading(true);
      setBoxesErr(null);
      setBoxes(null);

      // find obligation for this periodKey
      const ob = obligations.find((o) => o.periodKey === periodKey);
      if (!ob) {
        setBoxesErr('No obligation found for this period');
        return;
      }

      const qs = new URLSearchParams({
        shopDomain,
        from: ob.start,
        to: ob.end,
      });

      const res = await fetch(`/api/vat/boxes?${qs.toString()}`, {
        signal: controller.signal,
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json?.error || res.statusText);

      setBoxes(json.boxes);
    } catch (e: any) {
      if (e.name !== 'AbortError') setBoxesErr(e?.message || String(e));
    } finally {
      setBoxesLoading(false);
    }
  })();

  return () => controller.abort();
}, [shopDomain, periodKey, obligations]);

  // Submit VAT return
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!shopDomain || !vrn || !periodKey) {
      alert('Please provide shop domain, VRN and choose an obligation.');
      return;
    }
    const payload = {
      shopDomain,
      vrn,
      periodKey,
      vatDueSales: boxes?.vatDueSales ?? '0.00',
      vatDueAcquisitions: boxes?.vatDueAcquisitions ?? '0.00',
      totalVatDue: boxes?.totalVatDue ?? '0.00',
      vatReclaimedCurrPeriod: boxes?.vatReclaimedCurrPeriod ?? '0.00',
      netVatDue: boxes?.netVatDue ?? '0.00',
      totalValueSalesExVAT: boxes?.totalValueSalesExVAT ?? 0,
      totalValuePurchasesExVAT: boxes?.totalValuePurchasesExVAT ?? 0,
      totalValueGoodsSuppliedExVAT: boxes?.totalValueGoodsSuppliedExVAT ?? 0,
      totalAcquisitionsExVAT: boxes?.totalAcquisitionsExVAT ?? 0,
      finalised: true,
    };

    const res = await fetch('/api/hmrc/returns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      console.error('Submission failed', json);
      alert(`Submission failed: ${json.error || res.statusText}`);
      return;
    }
    alert('Return submitted! (sandbox)');
  }

  // Install app helper (guarded by `mounted` to avoid hydration issues)
  const API_KEY = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY;
  const installUrl = useMemo(() => {
    if (!mounted) return '';
    const store = (shopDomain || '').trim();
    return store && API_KEY ? `https://${store}/admin/apps/${API_KEY}` : '';
  }, [mounted, shopDomain, API_KEY]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold mb-6">File VAT Return</h1>

      <form onSubmit={onSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium mb-1">Shop Domain</label>
          <input
            name="shopDomain"
            value={shopDomain}
            onChange={(e) => setShopDomain(e.target.value.trim())}
            className="w-full rounded border px-3 py-2"
            placeholder="example.myshopify.com"
          />
          {/* Render after mount only to prevent SSR/CSR mismatch */}
          {mounted && installUrl && (
            <a href={installUrl} className="inline-block mt-2 text-sm underline">
              Install app on this store
            </a>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">VRN</label>
          <input
            name="vrn"
            value={vrn}
            onChange={(e) => setVrn(sanitizeVrn(e.target.value))}
            inputMode="numeric"
            pattern="\d*"
            className="w-full rounded border px-3 py-2"
            placeholder="9 digit VRN"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">From (ISO)</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full rounded border px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">To (ISO)</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full rounded border px-3 py-2"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Select Obligation (Period Key)</label>
          <select
            name="periodKey"
            value={periodKey}
            onChange={(e) => setPeriodKey(e.target.value)}
            className="w-full rounded border px-3 py-2"
            disabled={obLoading || !!obError}
            required
          >
            <option value="">
              {obLoading
                ? 'Loading obligations...'
                : obError
                ? `Error: ${obError}`
                : obligations.length
                ? 'Select an obligation'
                : 'No obligations found'}
            </option>
            {obligations.map((o) => (
              <option key={o.periodKey} value={o.periodKey}>
                {fmtOb(o)}
              </option>
            ))}
          </select>

          {boxesLoading && <p className="text-xs text-gray-500 mt-2">Calculating boxes…</p>}
          {boxesErr && <p className="text-xs text-red-600 mt-2">Box calc error: {boxesErr}</p>}
          {boxes && (
            <p className="text-xs text-gray-600 mt-2">
              Box 1: £{boxes.vatDueSales} · Box 5: £{boxes.netVatDue} · Box 6: £{boxes.totalValueSalesExVAT}
            </p>
          )}

          <p className="text-xs text-gray-500 mt-1">
            Leave the date filters blank to auto-load current OPEN obligations.
          </p>
        </div>

        {boxes && (
          <div className="mt-3 border rounded-lg p-3">
            <h3 className="font-medium mb-2">Calculated VAT (preview)</h3>
            <div className="grid grid-cols-2 gap-y-1 text-sm">
              <div>Box 1 — VAT due on sales</div><div>£{boxes.vatDueSales}</div>
              <div>Box 2 — VAT due on acquisitions</div><div>£{boxes.vatDueAcquisitions}</div>
              <div>Box 3 — Total VAT due</div><div>£{boxes.totalVatDue}</div>
              <div>Box 4 — VAT reclaimed</div><div>£{boxes.vatReclaimedCurrPeriod}</div>
              <div className="font-semibold">Box 5 — Net VAT due</div><div className="font-semibold">£{boxes.netVatDue}</div>
              <div>Box 6 — Total sales (ex VAT)</div><div>£{boxes.totalValueSalesExVAT}</div>
              <div>Box 7 — Purchases (ex VAT)</div><div>£{boxes.totalValuePurchasesExVAT}</div>
              <div>Box 8 — Goods to EU (ex VAT)</div><div>£{boxes.totalValueGoodsSuppliedExVAT}</div>
              <div>Box 9 — Acquisitions from EU (ex VAT)</div><div>£{boxes.totalAcquisitionsExVAT}</div>
            </div>
          </div>
        )}

        <button
          type="submit"
          className="rounded bg-black px-4 py-2 text-white disabled:opacity-60"
          disabled={!periodKey || !!obError || alreadySubmitted}
        >
          {alreadySubmitted ? 'Already submitted' : 'Submit VAT Return'}
        </button>
      </form>
    </main>
  );
}
