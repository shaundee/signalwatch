// app/checkout/cancel/page.tsx
import Link from "next/link";

export default function CancelPage() {
  return (
    <main className="mx-auto max-w-xl px-6 py-16 text-center">
      <h1 className="text-2xl font-semibold">Checkout canceled — no charges made.</h1>
      <p className="mt-2 text-muted-foreground">
        You can try again or go back to your dashboard.
      </p>

      <div className="mt-6 flex justify-center gap-3">
        <Link href="/pricing" className="btn">Back to pricing</Link>
        <Link href="/dashboard" className="btn btn-outline">Go to dashboard</Link>
      </div>
    </main>
  );
}
