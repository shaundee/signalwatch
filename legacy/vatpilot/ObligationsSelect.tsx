// ┌───────────────────────────────────────────────────────────┐
// │ File: components/ObligationsSelect.tsx                    │
// └───────────────────────────────────────────────────────────┘
'use client';

import { useEffect, useState } from 'react';

export function ObligationsSelect({ shopDomain, vrn }: { shopDomain: string; vrn: string }) {
  const [periods, setPeriods] = useState<any[]>([]);

useEffect(() => {
  const u = `/api/hmrc/obligations?shopDomain=${shopDomain}&vrn=${vrn}`;
  fetch(u)
    .then(async (r) => {
      const json = await r.json().catch(() => ({}));
      if (!r.ok) {
        console.warn('Obligations error', r.status, json);
        setPeriods([]); // clear
        return;
      }
      setPeriods(json.obligations?.obligations || []);
    })
    .catch((e) => console.warn('Obligations fetch failed', e));
}, [shopDomain, vrn]);

  return (
    <select name="periodKey" className="border rounded-xl px-3 py-2 w-full">
      <option value="">Select an obligation</option>
      {periods.map((o) => (
        <option key={o.periodKey} value={o.periodKey}>
          {o.start} → {o.end} ({o.status})
        </option>
      ))}
    </select>
  );
}
