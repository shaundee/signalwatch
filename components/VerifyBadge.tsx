// components/VerifyBadge.tsx
export default function VerifyBadge({ verifiedAt }: { verifiedAt?: string | null }) {
  const ok = !!verifiedAt;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${
      ok ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
    }`}>
      {ok ? "Verified" : "Unverified"}
    </span>
  );
}
