// ┌───────────────────────────────────────────────────────────┐
// │ File: components/SettingsFeedback.tsx                     │
// └───────────────────────────────────────────────────────────┘
'use client';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function SettingsFeedback() {
  const sp = useSearchParams();
  const [show, setShow] = useState(false);

  const saved = sp.get('saved');
  const msg = sp.get('msg');

  useEffect(() => {
    if (saved) {
      setShow(true);
      const t = setTimeout(() => setShow(false), 3500);
      return () => clearTimeout(t);
    }
  }, [saved]);

  if (!show) return null;

  const ok = saved === '1';
  const base = 'fixed bottom-4 left-1/2 -translate-x-1/2 z-50 min-w-[280px] max-w-[90vw] px-4 py-3 rounded-xl shadow-lg border text-sm';
  const cls = ok
    ? `${base} bg-green-50 border-green-200 text-green-800`
    : `${base} bg-red-50 border-red-200 text-red-800`;

  return (
    <div className={cls} role="status" aria-live="polite">
      {ok ? 'Saved tax settings.' : `Error: ${msg}`}
    </div>
  );
}
