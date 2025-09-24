"use client";
export default function TestModeBanner() {
  const isTest = typeof process !== "undefined" &&
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.startsWith("pk_test_");
  if (!isTest) return null;
  return (
    <div className="sticky top-[48px] z-20 flex justify-center">
      <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white/70 px-3 py-1 text-xs text-zinc-700 backdrop-blur">
        <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
        Test mode
      </div>
    </div>
  );
}
