// ┌───────────────────────────────────────────────────────────┐
// │ File: components/SubmitButton.tsx                         │
// └───────────────────────────────────────────────────────────┘
'use client';

import { useFormStatus } from 'react-dom';

export default function SubmitButton({ children }: { children?: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="px-4 py-2 rounded-2xl shadow text-white bg-black disabled:opacity-60"
      disabled={pending}
    >
      {pending ? 'Submitting…' : (children ?? 'Submit VAT Return')}
    </button>
  );
}
